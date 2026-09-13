import { createHash } from "node:crypto";
import { generateApiKey } from "./api-keys.server";
import { assertIncidentTransition } from "./incident";
import { validateRedelegation } from "./delegation-policy";
import { analyzeLeastPrivilege } from "./least-privilege";
import { diffPolicyVersions, type PolicyVersionForDiff } from "./policy-diff";
import { calculateGovernanceReadiness } from "./readiness";
import { verifyAuthorizationReceipt } from "./receipt-verification";
import { calculateAgentRiskScore } from "./risk-score";
import { simulateActionGate } from "./shadow-mode";
import { minimizeAuditMetadata } from "./audit-minimization";
import { loadPassportVersionIdentity } from "./policy-version-identity.server";
import { classifyWebhookDelivery, validateWebhookEndpointUrl, validateWebhookSubscriptions, webhookDeliveryHealth } from "./webhooks.server";
import type {
  ActionGateRequest,
  AgentLimits,
  AgentPermission,
  DataClassification,
  IncidentSeverity,
  IncidentStatus,
  PassportPolicySnapshot,
  PermissionUsageStat,
  PolicyIdentitySnapshot,
} from "./types";

export type WorkspaceRole = "OWNER" | "ADMIN" | "APPROVER" | "AUDITOR" | "MEMBER";
const ADMIN_ROLES: WorkspaceRole[] = ["OWNER", "ADMIN"];
const AUDIT_ROLES: WorkspaceRole[] = ["OWNER", "ADMIN", "AUDITOR"];
const GOVERNANCE_ROLES: WorkspaceRole[] = ["OWNER", "ADMIN", "APPROVER", "AUDITOR"];

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, stable(nested)]),
    );
  }
  return value;
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

async function membership(workspaceId: string, userId: string) {
  const client = await db();
  const { data, error } = await client
    .from("agent_authority_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Forbidden: workspace membership required");
  return data as { role: WorkspaceRole };
}

async function requireRole(workspaceId: string, userId: string, roles?: WorkspaceRole[]) {
  const member = await membership(workspaceId, userId);
  if (roles && !roles.includes(member.role)) throw new Error("Forbidden: insufficient workspace authority");
  return member;
}

async function audit(
  workspaceId: string,
  userId: string | null,
  eventType: string,
  resourceType: string,
  resourceId: string | null,
  metadata: Record<string, unknown> = {},
) {
  const client = await db();
  const { error } = await client.from("agent_authority_audit_events").insert({
    workspace_id: workspaceId,
    actor_user_id: userId,
    event_type: eventType,
    resource_type: resourceType,
    resource_id: resourceId,
    metadata: minimizeAuditMetadata(metadata),
  });
  if (error) throw error;
}

async function appendEvidence(input: {
  workspaceId: string;
  passportId?: string | null;
  actionRequestId?: string | null;
  eventType: string;
  actorType: "HUMAN" | "AGENT" | "SYSTEM" | "INTEGRATION";
  actorUserId?: string | null;
  priorStatus?: string | null;
  newStatus?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const client = await db();
  const metadata = minimizeAuditMetadata(input.metadata);
  const integrityHash = stableHash({ ...input, metadata });
  const { error } = await client.from("evidence_events").insert({
    workspace_id: input.workspaceId,
    passport_id: input.passportId ?? null,
    action_request_id: input.actionRequestId ?? null,
    event_type: input.eventType,
    actor_type: input.actorType,
    actor_user_id: input.actorUserId ?? null,
    prior_status: input.priorStatus ?? null,
    new_status: input.newStatus ?? null,
    metadata,
    integrity_hash: integrityHash,
  });
  if (error) throw error;
}

async function loadPolicyVersion(workspaceId: string, passportId: string, version?: number): Promise<PassportPolicySnapshot & { agentName: string; nextReviewAt?: string | null; identity: PolicyIdentitySnapshot }> {
  const client = await db();
  const { data: passport, error: passportError } = await client
    .from("agent_passports")
    .select("id,passport_code,workspace_id,agent_name,human_sponsor,department,business_purpose,provider,model,platform,environment,status,current_version,authorized_at,authorization_expires_at,next_review_at")
    .eq("workspace_id", workspaceId)
    .eq("id", passportId)
    .single();
  if (passportError || !passport) throw passportError ?? new Error("Passport not found");
  const selectedVersion = version ?? Number(passport.current_version);

  const [{ data: permissions, error: permissionError }, { data: limits, error: limitError }, { data: versionRow }] = await Promise.all([
    client
      .from("agent_permissions")
      .select("action_key,label,system_name,category,decision,approval_role,approval_above_amount,data_classification_policy,notes")
      .eq("passport_id", passportId)
      .eq("passport_version", selectedVersion),
    client
      .from("agent_limits")
      .select("currency,max_single_purchase,max_daily_spend,max_refund,max_invoice,external_communication_policy,financial_actions_policy,sensitive_data_policy,high_risk_requires_approval,allowed_systems,blocked_systems,data_classification_policy")
      .eq("passport_id", passportId)
      .eq("passport_version", selectedVersion)
      .single(),
    client
      .from("agent_passport_versions")
      .select("identity_snapshot,authorized_at")
      .eq("passport_id", passportId)
      .eq("version", selectedVersion)
      .maybeSingle(),
  ]);
  if (permissionError) throw permissionError;
  if (limitError || !limits) throw limitError ?? new Error("Authority limits missing");
  const identity = (versionRow?.identity_snapshot ?? {
    agentName: passport.agent_name,
    humanSponsor: passport.human_sponsor,
    department: passport.department,
    businessPurpose: passport.business_purpose,
    provider: passport.provider,
    model: passport.model,
    platform: passport.platform,
    environment: passport.environment,
  }) as PolicyIdentitySnapshot;

  return {
    passportId: passport.id,
    passportCode: passport.passport_code,
    organizationId: passport.workspace_id,
    agentName: passport.agent_name,
    version: selectedVersion,
    status: selectedVersion === Number(passport.current_version) ? passport.status : "DRAFT",
    authorizedAt: selectedVersion === Number(passport.current_version) ? passport.authorized_at : versionRow?.authorized_at ?? null,
    authorizationExpiresAt: selectedVersion === Number(passport.current_version) ? passport.authorization_expires_at : null,
    nextReviewAt: passport.next_review_at,
    identity,
    permissions: (permissions ?? []).map((row: any) => ({
      actionKey: row.action_key,
      label: row.label,
      system: row.system_name,
      category: row.category,
      decision: row.decision,
      approvalRole: row.approval_role,
      approvalAboveAmount: row.approval_above_amount == null ? null : Number(row.approval_above_amount),
      dataClassificationPolicy: row.data_classification_policy ?? {},
      notes: row.notes,
    } satisfies AgentPermission)),
    limits: {
      currency: limits.currency,
      maxSinglePurchase: limits.max_single_purchase == null ? null : Number(limits.max_single_purchase),
      maxDailySpend: limits.max_daily_spend == null ? null : Number(limits.max_daily_spend),
      maxRefund: limits.max_refund == null ? null : Number(limits.max_refund),
      maxInvoice: limits.max_invoice == null ? null : Number(limits.max_invoice),
      externalCommunicationPolicy: limits.external_communication_policy,
      financialActionsPolicy: limits.financial_actions_policy,
      sensitiveDataPolicy: limits.sensitive_data_policy,
      highRiskRequiresApproval: limits.high_risk_requires_approval,
      allowedSystems: limits.allowed_systems ?? [],
      blockedSystems: limits.blocked_systems ?? [],
      dataClassificationPolicy: limits.data_classification_policy ?? {},
    } satisfies AgentLimits,
  };
}

function asDiffVersion(policy: Awaited<ReturnType<typeof loadPolicyVersion>>): PolicyVersionForDiff {
  return { identity: policy.identity, permissions: policy.permissions, limits: policy.limits };
}

export async function getPassportPolicyDiff(userId: string, input: { workspaceId: string; passportId: string; fromVersion?: number; toVersion?: number }) {
  await requireRole(input.workspaceId, userId);
  const client = await db();
  const { data: passport, error } = await client.from("agent_passports").select("current_version").eq("workspace_id", input.workspaceId).eq("id", input.passportId).single();
  if (error || !passport) throw error ?? new Error("Passport not found");
  const toVersion = input.toVersion ?? Number(passport.current_version);
  const fromVersion = input.fromVersion ?? Math.max(1, toVersion - 1);
  if (fromVersion === toVersion) return { fromVersion, toVersion, ...diffPolicyVersions(asDiffVersion(await loadPolicyVersion(input.workspaceId, input.passportId, fromVersion)), asDiffVersion(await loadPolicyVersion(input.workspaceId, input.passportId, toVersion))) };
  const [before, after] = await Promise.all([
    loadPolicyVersion(input.workspaceId, input.passportId, fromVersion),
    loadPolicyVersion(input.workspaceId, input.passportId, toVersion),
  ]);
  return { fromVersion, toVersion, ...diffPolicyVersions(asDiffVersion(before), asDiffVersion(after)) };
}

async function permissionUsage(workspaceId: string, passportId: string, lookbackDays: number): Promise<PermissionUsageStat[]> {
  const client = await db();
  const since = new Date(Date.now() - lookbackDays * 86_400_000).toISOString();
  const [{ data: requests, error: requestError }, { data: decisions, error: decisionError }, { data: receipts, error: receiptError }] = await Promise.all([
    client.from("action_requests").select("id,action_key,requested_at").eq("workspace_id", workspaceId).eq("passport_id", passportId).gte("requested_at", since).limit(10000),
    client.from("action_decisions").select("action_request_id,decision,decided_at").eq("workspace_id", workspaceId).eq("passport_id", passportId).gte("decided_at", since).limit(10000),
    client.from("authorization_receipts").select("action_request_id,action_key,receipt_kind,executed_at").eq("workspace_id", workspaceId).eq("passport_id", passportId).eq("receipt_kind", "EXECUTION").gte("created_at", since).limit(10000),
  ]);
  if (requestError) throw requestError;
  if (decisionError) throw decisionError;
  if (receiptError) throw receiptError;
  const requestById = new Map<string, any>((requests ?? []).map((row: any) => [String(row.id), row]));
  const stats = new Map<string, PermissionUsageStat>();
  for (const row of requests ?? []) {
    if (!stats.has(row.action_key)) stats.set(row.action_key, { actionKey: row.action_key, totalEvaluations: 0, allowedCount: 0, approvalRequiredCount: 0, blockedCount: 0, executionCount: 0 });
  }
  for (const row of decisions ?? []) {
    const request = requestById.get(row.action_request_id);
    if (!request) continue;
    const stat: PermissionUsageStat = stats.get(request.action_key) ?? { actionKey: request.action_key, totalEvaluations: 0, allowedCount: 0, approvalRequiredCount: 0, blockedCount: 0, executionCount: 0 };
    stat.totalEvaluations += 1;
    if (row.decision === "ALLOW") stat.allowedCount += 1;
    else if (row.decision === "APPROVAL_REQUIRED") stat.approvalRequiredCount += 1;
    else if (row.decision === "BLOCK") stat.blockedCount += 1;
    if (!stat.lastEvaluatedAt || new Date(row.decided_at) > new Date(stat.lastEvaluatedAt)) stat.lastEvaluatedAt = row.decided_at;
    stats.set(stat.actionKey, stat);
  }
  for (const row of receipts ?? []) {
    const stat: PermissionUsageStat = stats.get(row.action_key) ?? { actionKey: row.action_key, totalEvaluations: 0, allowedCount: 0, approvalRequiredCount: 0, blockedCount: 0, executionCount: 0 };
    stat.executionCount += 1;
    if (row.executed_at && (!stat.lastExecutedAt || new Date(row.executed_at) > new Date(stat.lastExecutedAt))) stat.lastExecutedAt = row.executed_at;
    stats.set(stat.actionKey, stat);
  }
  return [...stats.values()];
}

export async function analyzePassportLeastPrivilege(userId: string, input: { workspaceId: string; passportId: string; lookbackDays?: number; persist?: boolean }) {
  await requireRole(input.workspaceId, userId);
  const lookbackDays = Math.max(7, Math.min(input.lookbackDays ?? 90, 365));
  const policy = await loadPolicyVersion(input.workspaceId, input.passportId);
  const usage = await permissionUsage(input.workspaceId, input.passportId, Math.max(lookbackDays, 180));
  const analysis = analyzeLeastPrivilege({ permissions: policy.permissions, limits: policy.limits, usage, lookbackDays });
  if (input.persist !== false) {
    const client = await db();
    const { error } = await client.from("agent_governance_analyses").insert({
      workspace_id: input.workspaceId,
      passport_id: input.passportId,
      passport_version: policy.version,
      analysis_type: "LEAST_PRIVILEGE",
      payload: analysis,
      created_by: userId,
    });
    if (error) throw error;
  }
  return { ...analysis, usage };
}

export async function getPassportRiskScore(userId: string, input: { workspaceId: string; passportId: string; persist?: boolean }) {
  await requireRole(input.workspaceId, userId);
  const policy = await loadPolicyVersion(input.workspaceId, input.passportId);
  const risk = calculateAgentRiskScore({ passport: policy, nextReviewAt: policy.nextReviewAt });
  if (input.persist !== false) {
    const client = await db();
    const { error } = await client.from("agent_governance_analyses").insert({
      workspace_id: input.workspaceId,
      passport_id: input.passportId,
      passport_version: policy.version,
      analysis_type: "RISK_SCORE",
      score: risk.score,
      band: risk.band,
      payload: risk,
      created_by: userId,
    });
    if (error) throw error;
  }
  return risk;
}

export async function runShadowSimulation(userId: string, input: { workspaceId: string; passportId: string; request: ActionGateRequest }) {
  await requireRole(input.workspaceId, userId);
  const policy = await loadPolicyVersion(input.workspaceId, input.passportId);
  let classification = input.request.dataClassification ?? null;
  if (!classification) {
    const key = input.request.resourceKey?.trim() || input.request.target?.trim();
    if (key) {
      const client = await db();
      const { data } = await client.from("agent_data_classifications").select("classification").eq("workspace_id", input.workspaceId).eq("resource_key", key).maybeSingle();
      classification = (data?.classification as DataClassification | undefined) ?? null;
    }
  }
  const request = { ...input.request, dataClassification: classification };
  const simulation = simulateActionGate(policy, request);
  const client = await db();
  const { data, error } = await client.from("agent_shadow_simulations").insert({
    workspace_id: input.workspaceId,
    passport_id: input.passportId,
    passport_version: policy.version,
    requested_by: userId,
    request_payload: request,
    simulated_decision: simulation.result.decision,
    reason_codes: simulation.result.reasonCodes,
    executable: false,
    simulated_at: simulation.simulatedAt,
  }).select("id,simulated_at").single();
  if (error) throw error;
  await audit(input.workspaceId, userId, "shadow.simulated", "passport", input.passportId, { simulationId: data.id, decision: simulation.result.decision });
  return { ...simulation, simulationId: data.id };
}

export async function listShadowSimulations(userId: string, input: { workspaceId: string; passportId?: string; limit?: number }) {
  await requireRole(input.workspaceId, userId);
  const client = await db();
  let query = client.from("agent_shadow_simulations").select("id,passport_id,passport_version,request_payload,simulated_decision,reason_codes,executable,simulated_at").eq("workspace_id", input.workspaceId).order("simulated_at", { ascending: false }).limit(Math.min(input.limit ?? 100, 500));
  if (input.passportId) query = query.eq("passport_id", input.passportId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function upsertDataClassification(userId: string, input: { workspaceId: string; resourceKey: string; systemName?: string | null; displayName: string; classification: DataClassification; description?: string | null }) {
  await requireRole(input.workspaceId, userId, ADMIN_ROLES);
  const resourceKey = input.resourceKey.trim();
  if (!resourceKey || resourceKey.length > 240) throw new Error("resourceKey must be 1-240 characters");
  const client = await db();
  const { data, error } = await client.from("agent_data_classifications").upsert({
    workspace_id: input.workspaceId,
    resource_key: resourceKey,
    system_name: input.systemName?.trim() || null,
    display_name: input.displayName.trim(),
    classification: input.classification,
    description: input.description?.trim() || null,
    created_by: userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "workspace_id,resource_key" }).select("*").single();
  if (error) throw error;
  await audit(input.workspaceId, userId, "data.classification_saved", "data_classification", data.id, { resourceKey, classification: input.classification });
  return data;
}

export async function listDataClassifications(userId: string, workspaceId: string) {
  await requireRole(workspaceId, userId);
  const client = await db();
  const { data, error } = await client.from("agent_data_classifications").select("id,resource_key,system_name,display_name,classification,description,updated_at").eq("workspace_id", workspaceId).order("resource_key");
  if (error) throw error;
  return data ?? [];
}

async function appendIncidentEvent(input: { workspaceId: string; incidentId: string; passportId?: string | null; eventType: string; actorUserId?: string | null; priorStatus?: string | null; newStatus?: string | null; note?: string | null; metadata?: Record<string, unknown> }) {
  const client = await db();
  const metadata = input.metadata ?? {};
  const integrityHash = stableHash({ ...input, metadata });
  const { data, error } = await client.from("agent_incident_events").insert({
    workspace_id: input.workspaceId,
    incident_id: input.incidentId,
    passport_id: input.passportId ?? null,
    event_type: input.eventType,
    actor_user_id: input.actorUserId ?? null,
    prior_status: input.priorStatus ?? null,
    new_status: input.newStatus ?? null,
    note: input.note?.trim() || null,
    metadata,
    integrity_hash: integrityHash,
  }).select("id,occurred_at").single();
  if (error) throw error;
  return data;
}

export async function createIncident(userId: string, input: { workspaceId: string; passportId?: string | null; title: string; severity: IncidentSeverity; summary: string; ownerUserId?: string | null }) {
  await requireRole(input.workspaceId, userId);
  if (input.title.trim().length < 3 || input.summary.trim().length < 10) throw new Error("Incident title and summary are required");
  const client = await db();
  const { data, error } = await client.from("agent_incidents").insert({
    workspace_id: input.workspaceId,
    passport_id: input.passportId ?? null,
    title: input.title.trim(),
    severity: input.severity,
    summary: input.summary.trim(),
    owner_user_id: input.ownerUserId ?? userId,
    created_by: userId,
  }).select("*").single();
  if (error) throw error;
  await appendIncidentEvent({ workspaceId: input.workspaceId, incidentId: data.id, passportId: data.passport_id, eventType: "incident.created", actorUserId: userId, newStatus: "OPEN", note: input.summary });
  await appendEvidence({ workspaceId: input.workspaceId, passportId: data.passport_id, eventType: "incident.created", actorType: "HUMAN", actorUserId: userId, newStatus: "OPEN", metadata: { incidentId: data.id, incidentCode: data.incident_code, severity: data.severity } });
  return data;
}

export async function containIncident(userId: string, input: { workspaceId: string; incidentId: string; containmentSummary: string; suspendPassport?: boolean }) {
  await requireRole(input.workspaceId, userId, ADMIN_ROLES);
  if (input.containmentSummary.trim().length < 5) throw new Error("Containment summary must be at least 5 characters");
  const client = await db();
  const { data: incident, error } = await client.from("agent_incidents").select("id,passport_id,status,incident_code").eq("workspace_id", input.workspaceId).eq("id", input.incidentId).single();
  if (error || !incident) throw error ?? new Error("Incident not found");
  if (incident.status === "CLOSED") throw new Error("Closed incidents cannot be modified");
  if (input.suspendPassport && incident.passport_id) {
    const service = await import("./service.server");
    await service.suspendPassport(userId, { workspaceId: input.workspaceId, passportId: incident.passport_id, reason: `Incident ${incident.incident_code}: ${input.containmentSummary.trim()}` });
  }
  const now = new Date().toISOString();
  const { error: updateError } = await client.from("agent_incidents").update({ status: "CONTAINED", containment_summary: input.containmentSummary.trim(), contained_at: now, updated_at: now }).eq("id", incident.id);
  if (updateError) throw updateError;
  await appendIncidentEvent({ workspaceId: input.workspaceId, incidentId: incident.id, passportId: incident.passport_id, eventType: "incident.contained", actorUserId: userId, priorStatus: incident.status, newStatus: "CONTAINED", note: input.containmentSummary, metadata: { passportSuspended: Boolean(input.suspendPassport && incident.passport_id) } });
  return { incidentId: incident.id, status: "CONTAINED", containedAt: now };
}

export async function updateIncident(userId: string, input: { workspaceId: string; incidentId: string; status: Exclude<IncidentStatus, "CLOSED">; note: string; rootCause?: string | null; correctiveActions?: Array<{ action: string; owner?: string; dueAt?: string; status?: string }> }) {
  await requireRole(input.workspaceId, userId, ADMIN_ROLES);
  const allowed: IncidentStatus[] = ["OPEN", "CONTAINED", "INVESTIGATING", "REMEDIATING", "RESOLVED"];
  if (!allowed.includes(input.status)) throw new Error("Invalid incident status transition");
  if (input.note.trim().length < 3) throw new Error("Incident update note is required");
  const client = await db();
  const { data: incident, error } = await client.from("agent_incidents").select("id,passport_id,status").eq("workspace_id", input.workspaceId).eq("id", input.incidentId).single();
  if (error || !incident) throw error ?? new Error("Incident not found");
  if (incident.status === "CLOSED") throw new Error("Closed incidents cannot be modified");
  assertIncidentTransition(incident.status as IncidentStatus, input.status);
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: input.status, updated_at: now };
  if (input.rootCause !== undefined) patch.root_cause = input.rootCause?.trim() || null;
  if (input.correctiveActions !== undefined) patch.corrective_actions = input.correctiveActions;
  if (input.status === "RESOLVED") patch.resolved_at = now;
  const { error: updateError } = await client.from("agent_incidents").update(patch).eq("id", incident.id);
  if (updateError) throw updateError;
  await appendIncidentEvent({ workspaceId: input.workspaceId, incidentId: incident.id, passportId: incident.passport_id, eventType: "incident.status_changed", actorUserId: userId, priorStatus: incident.status, newStatus: input.status, note: input.note, metadata: { rootCauseUpdated: input.rootCause !== undefined, correctiveActionsUpdated: input.correctiveActions !== undefined } });
  return { incidentId: incident.id, status: input.status, updatedAt: now };
}

export async function closeIncident(userId: string, input: { workspaceId: string; incidentId: string; closureNote: string }) {
  await requireRole(input.workspaceId, userId, ADMIN_ROLES);
  if (input.closureNote.trim().length < 5) throw new Error("Closure note must be at least 5 characters");
  const client = await db();
  const { data: incident, error } = await client.from("agent_incidents").select("id,passport_id,status").eq("workspace_id", input.workspaceId).eq("id", input.incidentId).single();
  if (error || !incident) throw error ?? new Error("Incident not found");
  if (incident.status !== "RESOLVED") throw new Error("Incident must be RESOLVED before it can be CLOSED");
  assertIncidentTransition(incident.status as IncidentStatus, "CLOSED");
  const now = new Date().toISOString();
  const { error: updateError } = await client.from("agent_incidents").update({ status: "CLOSED", closed_at: now, updated_at: now }).eq("id", incident.id);
  if (updateError) throw updateError;
  await appendIncidentEvent({ workspaceId: input.workspaceId, incidentId: incident.id, passportId: incident.passport_id, eventType: "incident.closed", actorUserId: userId, priorStatus: incident.status, newStatus: "CLOSED", note: input.closureNote });
  return { incidentId: incident.id, status: "CLOSED", closedAt: now };
}

export async function listIncidents(userId: string, input: { workspaceId: string; status?: IncidentStatus | null; limit?: number }) {
  await requireRole(input.workspaceId, userId);
  const client = await db();
  let query = client.from("agent_incidents").select("id,incident_code,passport_id,title,severity,status,summary,containment_summary,root_cause,corrective_actions,owner_user_id,created_at,contained_at,resolved_at,closed_at,updated_at").eq("workspace_id", input.workspaceId).order("created_at", { ascending: false }).limit(Math.min(input.limit ?? 100, 500));
  if (input.status) query = query.eq("status", input.status);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function appendDelegationEvent(input: { workspaceId: string; delegationId: string; eventType: string; actorUserId: string; note?: string | null; metadata?: Record<string, unknown> }) {
  const client = await db();
  const metadata = input.metadata ?? {};
  const integrityHash = stableHash({ ...input, metadata });
  const { error } = await client.from("agent_delegation_events").insert({ workspace_id: input.workspaceId, delegation_id: input.delegationId, event_type: input.eventType, actor_user_id: input.actorUserId, note: input.note?.trim() || null, metadata, integrity_hash: integrityHash });
  if (error) throw error;
}

export async function createDelegation(userId: string, input: { workspaceId: string; delegateUserId: string; purpose: string; actionKeys?: string[]; maxApprovalAmount?: number | null; startsAt?: string; endsAt: string; canRedelegate?: boolean; parentDelegationId?: string | null }) {
  const member = await requireRole(input.workspaceId, userId);
  if (!["OWNER", "ADMIN", "APPROVER"].includes(member.role)) throw new Error("Forbidden: only approval-capable members may delegate authority");
  if (input.delegateUserId === userId) throw new Error("Authority cannot be delegated to yourself");
  if (input.purpose.trim().length < 5) throw new Error("Delegation purpose must be at least 5 characters");
  const startsAt = input.startsAt ?? new Date().toISOString();
  const endsAt = new Date(input.endsAt);
  if (Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= new Date(startsAt).getTime()) throw new Error("Delegation end must be after start");
  const client = await db();
  const { data: delegateMembership } = await client.from("agent_authority_members").select("role").eq("workspace_id", input.workspaceId).eq("user_id", input.delegateUserId).maybeSingle();
  if (!delegateMembership) throw new Error("Delegate must be a member of this workspace");

  if (member.role === "APPROVER") {
    if (!input.parentDelegationId) throw new Error("Re-delegation requires an active parent delegation");
    const now = new Date().toISOString();
    const { data: parent, error } = await client.from("agent_delegations").select("id,delegate_user_id,action_keys,max_approval_amount,ends_at,status,can_redelegate").eq("workspace_id", input.workspaceId).eq("id", input.parentDelegationId).single();
    if (error || !parent) throw error ?? new Error("Parent delegation not found");
    if (parent.delegate_user_id !== userId || parent.status !== "ACTIVE" || !parent.can_redelegate || new Date(parent.ends_at).getTime() <= Date.now()) throw new Error("Parent delegation does not permit re-delegation");
    validateRedelegation(
      { actionKeys: (parent.action_keys ?? []) as string[], maxApprovalAmount: parent.max_approval_amount == null ? null : Number(parent.max_approval_amount), endsAt: parent.ends_at, canRedelegate: Boolean(parent.can_redelegate) },
      { actionKeys: input.actionKeys ?? [], maxApprovalAmount: input.maxApprovalAmount ?? null, endsAt: endsAt.toISOString(), canRedelegate: Boolean(input.canRedelegate) },
    );
    void now;
  }

  const { data, error } = await client.from("agent_delegations").insert({
    workspace_id: input.workspaceId,
    delegator_user_id: userId,
    delegate_user_id: input.delegateUserId,
    parent_delegation_id: input.parentDelegationId ?? null,
    purpose: input.purpose.trim(),
    can_approve_actions: true,
    can_redelegate: Boolean(input.canRedelegate && (member.role === "OWNER" || member.role === "ADMIN" || input.parentDelegationId)),
    action_keys: [...new Set((input.actionKeys ?? []).map((key) => key.trim()).filter(Boolean))],
    max_approval_amount: input.maxApprovalAmount ?? null,
    starts_at: startsAt,
    ends_at: endsAt.toISOString(),
    created_by: userId,
  }).select("*").single();
  if (error) throw error;
  await appendDelegationEvent({ workspaceId: input.workspaceId, delegationId: data.id, eventType: "delegation.created", actorUserId: userId, metadata: { delegateUserId: input.delegateUserId, actionKeys: data.action_keys, maxApprovalAmount: data.max_approval_amount, endsAt: data.ends_at } });
  await audit(input.workspaceId, userId, "delegation.created", "delegation", data.id, { delegateUserId: input.delegateUserId });
  return data;
}

export async function revokeDelegation(userId: string, input: { workspaceId: string; delegationId: string; reason: string }) {
  await requireRole(input.workspaceId, userId, ADMIN_ROLES);
  if (input.reason.trim().length < 5) throw new Error("Revocation reason must be at least 5 characters");
  const client = await db();
  const { data: row, error } = await client.from("agent_delegations").select("id,status,delegate_user_id").eq("workspace_id", input.workspaceId).eq("id", input.delegationId).single();
  if (error || !row) throw error ?? new Error("Delegation not found");
  if (row.status !== "ACTIVE") throw new Error(`Delegation is already ${row.status}`);
  const now = new Date().toISOString();
  const { error: updateError } = await client.from("agent_delegations").update({ status: "REVOKED", revoked_by: userId, revoked_at: now, revocation_reason: input.reason.trim() }).eq("id", row.id).eq("status", "ACTIVE");
  if (updateError) throw updateError;
  await appendDelegationEvent({ workspaceId: input.workspaceId, delegationId: row.id, eventType: "delegation.revoked", actorUserId: userId, note: input.reason, metadata: { delegateUserId: row.delegate_user_id } });
  return { delegationId: row.id, status: "REVOKED", revokedAt: now };
}

export async function listDelegations(userId: string, workspaceId: string) {
  await requireRole(workspaceId, userId, GOVERNANCE_ROLES);
  const client = await db();
  const { data, error } = await client.from("agent_delegations").select("id,delegator_user_id,delegate_user_id,parent_delegation_id,purpose,can_approve_actions,can_redelegate,action_keys,max_approval_amount,starts_at,ends_at,status,revoked_at,revocation_reason,created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ ...row, effectiveStatus: row.status === "ACTIVE" && new Date(row.ends_at).getTime() <= Date.now() ? "EXPIRED" : row.status }));
}

export async function listPolicyChangeRequests(userId: string, input: { workspaceId: string; status?: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | null }) {
  await requireRole(input.workspaceId, userId);
  const client = await db();
  let query = client.from("agent_policy_change_requests").select("id,passport_id,from_version,to_version,change_reason,diff,has_material_increase,status,requested_by,requested_at,expires_at,decided_by,decided_at,decision_note").eq("workspace_id", input.workspaceId).order("requested_at", { ascending: false });
  if (input.status) query = query.eq("status", input.status);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function resolvePolicyChangeRequest(userId: string, input: { workspaceId: string; requestId: string; decision: "APPROVED" | "REJECTED"; note?: string | null }) {
  await requireRole(input.workspaceId, userId, ADMIN_ROLES);
  const client = await db();
  const { data: request, error } = await client.from("agent_policy_change_requests").select("*").eq("workspace_id", input.workspaceId).eq("id", input.requestId).single();
  if (error || !request) throw error ?? new Error("Policy change request not found");
  if (request.status !== "PENDING") throw new Error(`Policy change request is already ${request.status}`);
  if (request.requested_by === userId) {
    const { count: otherApprovers, error: approverCountError } = await client
      .from("agent_authority_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", input.workspaceId)
      .in("role", ["OWNER", "ADMIN"])
      .neq("user_id", userId);
    if (approverCountError) throw approverCountError;
    if ((otherApprovers ?? 0) > 0) {
      throw new Error("Independent policy-change approval is required because another OWNER/ADMIN is available");
    }
    if ((input.note?.trim().length ?? 0) < 10) {
      throw new Error("Sole-admin self-approval requires a decision note of at least 10 characters");
    }
  }
  if (new Date(request.expires_at).getTime() <= Date.now()) {
    await client.from("agent_policy_change_requests").update({ status: "EXPIRED" }).eq("id", request.id).eq("status", "PENDING");
    throw new Error("Policy change request has expired");
  }
  const now = new Date().toISOString();
  const { error: updateError } = await client.from("agent_policy_change_requests").update({ status: input.decision, decided_by: userId, decided_at: now, decision_note: input.note?.trim() || null }).eq("id", request.id).eq("status", "PENDING");
  if (updateError) throw updateError;
  await appendEvidence({ workspaceId: input.workspaceId, passportId: request.passport_id, eventType: "policy.change_decided", actorType: "HUMAN", actorUserId: userId, priorStatus: "PENDING", newStatus: input.decision, metadata: { requestId: request.id, fromVersion: request.from_version, toVersion: request.to_version } });
  await audit(input.workspaceId, userId, `policy_change.${input.decision.toLowerCase()}`, "policy_change_request", request.id);
  return { requestId: request.id, status: input.decision, decidedAt: now };
}

export async function verifyReceipt(userId: string, input: { workspaceId: string; receiptId: string }) {
  await requireRole(input.workspaceId, userId, AUDIT_ROLES);
  const client = await db();
  const { data: receipt, error } = await client.from("authorization_receipts").select("id,receipt_code,passport_id,passport_version,action_key,target,authority_result,policy_code,policy_version,requested_at,human_approver_id,human_approved_at,executed_at,evidence_level,outcome,evidence_references,integrity_hash").eq("workspace_id", input.workspaceId).eq("id", input.receiptId).single();
  if (error || !receipt) throw error ?? new Error("Receipt not found");
  const identity = await loadPassportVersionIdentity({
    client,
    workspaceId: input.workspaceId,
    passportId: receipt.passport_id,
    passportVersion: Number(receipt.passport_version),
  });
  return verifyAuthorizationReceipt({
    receiptCode: receipt.receipt_code,
    passportCode: identity.passportCode,
    agentName: identity.agentName,
    actionKey: receipt.action_key,
    target: receipt.target,
    authorityResult: receipt.authority_result,
    policyCode: receipt.policy_code,
    policyVersion: receipt.policy_version,
    requestedAt: receipt.requested_at,
    approvedBy: receipt.human_approver_id,
    approvedAt: receipt.human_approved_at,
    executedAt: receipt.executed_at,
    evidenceLevel: receipt.evidence_level,
    outcome: receipt.outcome,
    evidenceReferences: receipt.evidence_references ?? [],
    integrityHash: receipt.integrity_hash,
  });
}

const API_SCOPES = ["passports:read", "decisions:write", "approvals:read", "receipts:read", "evidence:write", "webhooks:manage"];

export async function listApiKeys(userId: string, workspaceId: string) {
  await requireRole(workspaceId, userId, ADMIN_ROLES);
  const client = await db();
  const { data, error } = await client.from("agent_authority_api_keys").select("id,name,display_prefix,last4,scopes,created_by,created_at,last_used_at,expires_at,revoked_at,rate_limit_per_minute,rotated_from_key_id").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function rotateApiKey(userId: string, input: { workspaceId: string; apiKeyId: string; reason: string; expiresAt?: string | null }) {
  await requireRole(input.workspaceId, userId, ADMIN_ROLES);
  if (input.reason.trim().length < 5) throw new Error("Rotation reason must be at least 5 characters");
  const client = await db();
  const { data: oldKey, error } = await client.from("agent_authority_api_keys").select("id,name,scopes,expires_at,revoked_at,rate_limit_per_minute").eq("workspace_id", input.workspaceId).eq("id", input.apiKeyId).single();
  if (error || !oldKey) throw error ?? new Error("API key not found");
  if (oldKey.revoked_at) throw new Error("Cannot rotate a revoked API key");
  const generated = generateApiKey();
  const now = new Date().toISOString();
  const { data: next, error: insertError } = await client.from("agent_authority_api_keys").insert({
    workspace_id: input.workspaceId,
    name: `${oldKey.name} (rotated)`,
    key_hash: generated.hash,
    display_prefix: generated.displayPrefix,
    last4: generated.last4,
    scopes: (oldKey.scopes ?? []).filter((scope: string) => API_SCOPES.includes(scope)),
    created_by: userId,
    expires_at: input.expiresAt ?? oldKey.expires_at ?? null,
    rate_limit_per_minute: oldKey.rate_limit_per_minute ?? 60,
    rotated_from_key_id: oldKey.id,
  }).select("id,name,display_prefix,last4,scopes,expires_at,rate_limit_per_minute,created_at").single();
  if (insertError) throw insertError;
  const { error: revokeError } = await client.from("agent_authority_api_keys").update({ revoked_at: now }).eq("id", oldKey.id).is("revoked_at", null);
  if (revokeError) throw revokeError;
  await audit(input.workspaceId, userId, "api_key.rotated", "api_key", next.id, { rotatedFrom: oldKey.id, reason: input.reason.trim() });
  return { apiKey: generated.plaintext, record: next, warning: "Copy this API key now. Plaintext is not stored and cannot be retrieved later." };
}

export async function revokeApiKey(userId: string, input: { workspaceId: string; apiKeyId: string; reason: string }) {
  await requireRole(input.workspaceId, userId, ADMIN_ROLES);
  if (input.reason.trim().length < 5) throw new Error("Revocation reason must be at least 5 characters");
  const client = await db();
  const now = new Date().toISOString();
  const { data, error } = await client.from("agent_authority_api_keys").update({ revoked_at: now }).eq("workspace_id", input.workspaceId).eq("id", input.apiKeyId).is("revoked_at", null).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("API key not found or already revoked");
  await audit(input.workspaceId, userId, "api_key.revoked", "api_key", input.apiKeyId, { reason: input.reason.trim() });
  return { apiKeyId: input.apiKeyId, revokedAt: now };
}

export async function createWebhookEndpoint(userId: string, input: { workspaceId: string; url: string; subscribedEvents: string[]; secretReference?: string | null; secretFingerprint?: string | null }) {
  await requireRole(input.workspaceId, userId, ADMIN_ROLES);
  const normalizedUrl = validateWebhookEndpointUrl(input.url);
  const subscribedEvents = validateWebhookSubscriptions(input.subscribedEvents);
  const client = await db();
  const { data, error } = await client.from("agent_authority_webhook_endpoints").insert({
    workspace_id: input.workspaceId,
    url: normalizedUrl,
    subscribed_events: subscribedEvents,
    active: true,
    secret_reference: input.secretReference ?? null,
    secret_fingerprint: input.secretFingerprint ?? null,
    created_by: userId,
  }).select("id,url,subscribed_events,active,secret_fingerprint,failure_count,consecutive_failures,last_delivery_status,last_delivery_at,last_success_at,created_at").single();
  if (error) throw error;
  await audit(input.workspaceId, userId, "webhook.created", "webhook_endpoint", data.id, { subscribedEvents: data.subscribed_events });
  return data;
}

export async function listWebhookHealth(userId: string, workspaceId: string) {
  await requireRole(workspaceId, userId, AUDIT_ROLES);
  const client = await db();
  const { data: endpoints, error } = await client.from("agent_authority_webhook_endpoints").select("id,url,subscribed_events,active,failure_count,consecutive_failures,last_delivery_status,last_delivery_at,last_success_at,created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
  if (error) throw error;
  const { data: deadLetters, error: deadError } = await client.from("agent_authority_webhook_deliveries").select("webhook_endpoint_id").eq("workspace_id", workspaceId).eq("state", "DEAD_LETTER");
  if (deadError) throw deadError;
  const counts = new Map<string, number>();
  for (const row of deadLetters ?? []) counts.set(row.webhook_endpoint_id, (counts.get(row.webhook_endpoint_id) ?? 0) + 1);
  return (endpoints ?? []).map((endpoint: any) => ({
    ...endpoint,
    deadLetterCount: counts.get(endpoint.id) ?? 0,
    health: webhookDeliveryHealth({ active: endpoint.active, consecutiveFailures: endpoint.consecutive_failures ?? 0, lastDeliveryStatus: endpoint.last_delivery_status, deadLetterCount: counts.get(endpoint.id) ?? 0 }),
  }));
}


export async function listDeadLetterWebhookDeliveries(userId: string, workspaceId: string) {
  await requireRole(workspaceId, userId, AUDIT_ROLES);
  const client = await db();
  const { data, error } = await client.from("agent_authority_webhook_deliveries")
    .select("id,webhook_endpoint_id,event_type,event_reference,attempt_count,response_status,error_category,dead_lettered_at,created_at,agent_authority_webhook_endpoints(url)")
    .eq("workspace_id", workspaceId).eq("state", "DEAD_LETTER").order("dead_lettered_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function recordWebhookDeliveryResult(input: { workspaceId: string; deliveryId: string; responseStatus?: number | null; networkError?: boolean }) {
  const client = await db();
  const { data: delivery, error } = await client.from("agent_authority_webhook_deliveries").select("id,webhook_endpoint_id,attempt_count,state").eq("workspace_id", input.workspaceId).eq("id", input.deliveryId).single();
  if (error || !delivery) throw error ?? new Error("Webhook delivery not found");
  if (delivery.state === "DELIVERED") return delivery;
  const attemptCount = Number(delivery.attempt_count ?? 0) + 1;
  const now = new Date();
  const transition = classifyWebhookDelivery({ attemptCount, responseStatus: input.responseStatus ?? null, networkError: input.networkError, now });
  const patch: Record<string, unknown> = {
    attempt_count: attemptCount,
    response_status: input.responseStatus ?? null,
    state: transition.state,
    error_category: transition.errorCategory,
    next_attempt_at: transition.nextAttemptAt,
    last_attempt_at: now.toISOString(),
    delivered_at: transition.state === "DELIVERED" ? now.toISOString() : null,
    dead_lettered_at: transition.state === "DEAD_LETTER" ? now.toISOString() : null,
    updated_at: now.toISOString(),
  };
  const { data: updatedDelivery, error: updateError } = await client
    .from("agent_authority_webhook_deliveries")
    .update(patch)
    .eq("id", delivery.id)
    .eq("attempt_count", Number(delivery.attempt_count ?? 0))
    .neq("state", "DELIVERED")
    .select("id")
    .maybeSingle();
  if (updateError) throw updateError;
  if (!updatedDelivery) throw new Error("Webhook delivery was claimed by another worker");
  const { error: endpointError } = await client.rpc("update_agent_authority_webhook_endpoint_health", {
    p_endpoint_id: delivery.webhook_endpoint_id,
    p_response_status: input.responseStatus ?? null,
    p_delivered: transition.state === "DELIVERED",
  });
  if (endpointError) throw endpointError;
  return { deliveryId: delivery.id, attemptCount, ...transition };
}

export async function replayWebhookDelivery(userId: string, input: { workspaceId: string; deliveryId: string; reason: string }) {
  await requireRole(input.workspaceId, userId, ADMIN_ROLES);
  if (input.reason.trim().length < 5) throw new Error("Replay reason must be at least 5 characters");
  const client = await db();
  const { data: source, error } = await client.from("agent_authority_webhook_deliveries").select("id,webhook_endpoint_id,event_type,event_reference,payload_hash,state").eq("workspace_id", input.workspaceId).eq("id", input.deliveryId).single();
  if (error || !source) throw error ?? new Error("Webhook delivery not found");
  if (source.state !== "DEAD_LETTER") throw new Error("Only dead-letter deliveries may be manually replayed");
  const { data, error: insertError } = await client.from("agent_authority_webhook_deliveries").insert({
    workspace_id: input.workspaceId,
    webhook_endpoint_id: source.webhook_endpoint_id,
    event_type: source.event_type,
    event_reference: source.event_reference,
    payload_hash: source.payload_hash,
    state: "PENDING",
    attempt_count: 0,
    replayed_from_delivery_id: source.id,
  }).select("id,state,created_at").single();
  if (insertError) throw insertError;
  await audit(input.workspaceId, userId, "webhook.replayed", "webhook_delivery", data.id, { replayedFrom: source.id, reason: input.reason.trim() });
  return data;
}

export async function getGovernanceReadiness(userId: string, workspaceId: string, persist = true) {
  await requireRole(workspaceId, userId);
  const client = await db();
  const now = new Date().toISOString();
  const [
    { count: overdueReviews },
    { count: expiredStatus },
    { count: expiredByDate },
    { count: pendingApprovals },
    { count: openIncidents },
    { count: criticalIncidents },
    { count: deadLetters },
    { count: totalReceipts },
    { count: unverifiedReceipts },
    { data: passports },
    { data: endpoints },
  ] = await Promise.all([
    client.from("agent_passports").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).not("next_review_at", "is", null).lte("next_review_at", now).not("status", "in", '(REVOKED,EXPIRED)'),
    client.from("agent_passports").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "EXPIRED"),
    client.from("agent_passports").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "AUTHORIZED").not("authorization_expires_at", "is", null).lte("authorization_expires_at", now),
    client.from("approval_requests").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "PENDING"),
    client.from("agent_incidents").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).not("status", "in", '(RESOLVED,CLOSED)'),
    client.from("agent_incidents").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("severity", "CRITICAL").not("status", "in", '(RESOLVED,CLOSED)'),
    client.from("agent_authority_webhook_deliveries").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("state", "DEAD_LETTER"),
    client.from("authorization_receipts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    client.from("authorization_receipts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).in("evidence_level", ["DECLARED", "APPROVAL_VERIFIED"]),
    client.from("agent_passports").select("id").eq("workspace_id", workspaceId).not("status", "eq", "REVOKED").limit(500),
    client.from("agent_authority_webhook_endpoints").select("failure_count").eq("workspace_id", workspaceId),
  ]);

  let highRiskPassports = 0;
  let unusedPermissions = 0;
  for (const passport of passports ?? []) {
    try {
      const policy = await loadPolicyVersion(workspaceId, passport.id);
      const risk = calculateAgentRiskScore({ passport: policy, nextReviewAt: policy.nextReviewAt });
      if (risk.band === "HIGH" || risk.band === "CRITICAL") highRiskPassports += 1;
      const usage = await permissionUsage(workspaceId, passport.id, 180);
      const least = analyzeLeastPrivilege({ permissions: policy.permissions, limits: policy.limits, usage, lookbackDays: 90 });
      unusedPermissions += least.findings.filter((finding) => finding.category === "UNUSED").length;
    } catch {
      highRiskPassports += 1;
    }
  }
  const webhookFailures = (endpoints ?? []).reduce((sum: number, row: any) => sum + Number(row.failure_count ?? 0), 0);
  const readiness = calculateGovernanceReadiness({
    overdueReviews: overdueReviews ?? 0,
    expiredAgents: (expiredStatus ?? 0) + (expiredByDate ?? 0),
    highRiskPassports,
    unusedPermissions,
    pendingApprovals: pendingApprovals ?? 0,
    openIncidents: openIncidents ?? 0,
    criticalIncidents: criticalIncidents ?? 0,
    webhookFailures,
    deadLetterWebhooks: deadLetters ?? 0,
    receiptsWithoutVerifiedEvidence: unverifiedReceipts ?? 0,
    totalReceipts: totalReceipts ?? 0,
  });
  if (persist) {
    const { error } = await client.from("agent_governance_analyses").insert({ workspace_id: workspaceId, analysis_type: "READINESS", score: readiness.score, band: readiness.band, payload: readiness, created_by: userId });
    if (error) throw error;
  }
  return readiness;
}
