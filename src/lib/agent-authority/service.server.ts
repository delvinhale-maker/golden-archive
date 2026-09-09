import { createHash, randomInt } from "node:crypto";
import { evaluateActionGate } from "./decision-engine";
import { generateApiKey } from "./api-keys.server";
import { generateAuditCsv, generateAuditPdf, type AuditExportRow } from "./export.server";
import { hashReceipt } from "./integrity.server";
import { highestPermittedEvidenceLevel } from "./receipt";
import { diffPolicyVersions } from "./policy-diff";
import { resolveRequestDataClassification } from "./data-classification.server";
import { assertActionApprovalAuthority } from "./delegation.server";
import type {
  ActionGateRequest,
  AgentPermission,
  AgentLimits,
  AuthorizationReceiptInput,
  PassportPolicySnapshot,
} from "./types";

export type WorkspaceRole = "OWNER" | "ADMIN" | "APPROVER" | "AUDITOR" | "MEMBER";
const ADMIN_ROLES: WorkspaceRole[] = ["OWNER", "ADMIN"];
const APPROVER_ROLES: WorkspaceRole[] = ["OWNER", "ADMIN", "APPROVER"];
const AUDIT_ROLES: WorkspaceRole[] = ["OWNER", "ADMIN", "AUDITOR"];
const API_SCOPES = [
  "passports:read",
  "decisions:write",
  "approvals:read",
  "receipts:read",
  "evidence:write",
  "webhooks:manage",
] as const;

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Generated database types will be refreshed when the detached schema is attached/applied.
  return supabaseAdmin as any;
}

function stableHash(value: unknown): string {
  const sort = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(sort);
    if (item && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, nested]) => [key, sort(nested)]),
      );
    }
    return item;
  };
  return createHash("sha256").update(JSON.stringify(sort(value))).digest("hex");
}

async function membership(workspaceId: string, userId: string) {
  const client = await db();
  const { data, error } = await client
    .from("agent_authority_members")
    .select("workspace_id,user_id,role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Forbidden: workspace membership required");
  return data as { workspace_id: string; user_id: string; role: WorkspaceRole };
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
    metadata,
  });
  if (error) throw error;
}

async function evidence(input: {
  workspaceId: string;
  passportId?: string | null;
  actionRequestId?: string | null;
  receiptId?: string | null;
  eventType: string;
  actorType: "HUMAN" | "AGENT" | "SYSTEM" | "INTEGRATION";
  actorUserId?: string | null;
  sourceSystem?: string | null;
  externalReference?: string | null;
  priorStatus?: string | null;
  newStatus?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const client = await db();
  const safeMetadata = input.metadata ?? {};
  const integrityHash = stableHash({
    workspaceId: input.workspaceId,
    passportId: input.passportId ?? null,
    actionRequestId: input.actionRequestId ?? null,
    eventType: input.eventType,
    actorType: input.actorType,
    actorUserId: input.actorUserId ?? null,
    sourceSystem: input.sourceSystem ?? null,
    externalReference: input.externalReference ?? null,
    priorStatus: input.priorStatus ?? null,
    newStatus: input.newStatus ?? null,
    metadata: safeMetadata,
  });
  const { data, error } = await client
    .from("evidence_events")
    .insert({
      workspace_id: input.workspaceId,
      passport_id: input.passportId ?? null,
      action_request_id: input.actionRequestId ?? null,
      receipt_id: input.receiptId ?? null,
      event_type: input.eventType,
      actor_type: input.actorType,
      actor_user_id: input.actorUserId ?? null,
      source_system: input.sourceSystem ?? null,
      external_reference: input.externalReference ?? null,
      prior_status: input.priorStatus ?? null,
      new_status: input.newStatus ?? null,
      metadata: safeMetadata,
      integrity_hash: integrityHash,
    })
    .select("id,occurred_at")
    .single();
  if (error) throw error;
  return data;
}

export async function createWorkspace(userId: string, input: { name: string }) {
  const client = await db();
  const name = input.name.trim();
  if (name.length < 2 || name.length > 160) throw new Error("Workspace name must be 2-160 characters");

  const { data: workspace, error: workspaceError } = await client
    .from("agent_authority_workspaces")
    .insert({ name, created_by: userId })
    .select("id,name,created_at")
    .single();
  if (workspaceError) throw workspaceError;

  const { error: memberError } = await client.from("agent_authority_members").insert({
    workspace_id: workspace.id,
    user_id: userId,
    role: "OWNER",
  });
  if (memberError) {
    await client.from("agent_authority_workspaces").delete().eq("id", workspace.id);
    throw memberError;
  }
  await audit(workspace.id, userId, "workspace.created", "workspace", workspace.id, { name });
  return workspace;
}

export async function listMyWorkspaces(userId: string) {
  const client = await db();
  const { data: memberships, error } = await client
    .from("agent_authority_members")
    .select("workspace_id,role")
    .eq("user_id", userId);
  if (error) throw error;
  const rows = memberships ?? [];
  if (rows.length === 0) return [];
  const ids = rows.map((row: any) => row.workspace_id);
  const { data: workspaces, error: workspaceError } = await client
    .from("agent_authority_workspaces")
    .select("id,name,created_at")
    .in("id", ids)
    .order("created_at", { ascending: true });
  if (workspaceError) throw workspaceError;
  const roleByWorkspace = new Map(rows.map((row: any) => [row.workspace_id, row.role]));
  return (workspaces ?? []).map((workspace: any) => ({ ...workspace, role: roleByWorkspace.get(workspace.id) }));
}

export async function registerPassport(
  userId: string,
  input: {
    workspaceId: string;
    agentName: string;
    humanSponsor: string;
    department?: string | null;
    businessPurpose: string;
    provider?: string | null;
    model?: string | null;
    platform?: string | null;
    environment?: "development" | "staging" | "production" | "other";
    authorizationExpiresAt?: string | null;
    reviewCadenceDays?: 30 | 60 | 90 | 180 | 365 | null;
    permissions: AgentPermission[];
    limits: AgentLimits;
    authorizeNow?: boolean;
  },
) {
  await requireRole(input.workspaceId, userId, ADMIN_ROLES);
  if (!input.agentName.trim() || !input.businessPurpose.trim() || !input.humanSponsor.trim()) {
    throw new Error("Agent name, human sponsor, and business purpose are required");
  }
  if (input.permissions.length === 0) throw new Error("At least one explicit authority permission is required");
  if (new Set(input.permissions.map((item) => item.actionKey)).size !== input.permissions.length) {
    throw new Error("Duplicate action keys are not allowed");
  }

  const client = await db();
  const now = new Date();
  const nextReviewAt = input.reviewCadenceDays
    ? new Date(now.getTime() + input.reviewCadenceDays * 86_400_000).toISOString()
    : null;
  const status = input.authorizeNow ? "AUTHORIZED" : "DRAFT";
  const authorizedAt = input.authorizeNow ? now.toISOString() : null;

  const { data: passport, error: passportError } = await client
    .from("agent_passports")
    .insert({
      workspace_id: input.workspaceId,
      agent_name: input.agentName.trim(),
      human_sponsor: input.humanSponsor.trim(),
      department: input.department?.trim() || null,
      business_purpose: input.businessPurpose.trim(),
      provider: input.provider?.trim() || null,
      model: input.model?.trim() || null,
      platform: input.platform?.trim() || null,
      environment: input.environment ?? "production",
      status,
      current_version: 1,
      authorized_at: authorizedAt,
      authorization_expires_at: input.authorizationExpiresAt ?? null,
      review_cadence_days: input.reviewCadenceDays ?? null,
      next_review_at: nextReviewAt,
      created_by: userId,
    })
    .select("id,passport_code,agent_name,status,current_version,created_at")
    .single();
  if (passportError) throw passportError;

  try {
    const identitySnapshot = {
      agentName: input.agentName,
      humanSponsor: input.humanSponsor,
      department: input.department ?? null,
      businessPurpose: input.businessPurpose,
      provider: input.provider ?? null,
      model: input.model ?? null,
      platform: input.platform ?? null,
      environment: input.environment ?? "production",
    };
    const { error: versionError } = await client.from("agent_passport_versions").insert({
      passport_id: passport.id,
      workspace_id: input.workspaceId,
      version: 1,
      identity_snapshot: identitySnapshot,
      authority_snapshot: { permissions: input.permissions },
      limits_snapshot: input.limits,
      requires_reauthorization: false,
      authorized_by: input.authorizeNow ? userId : null,
      authorized_at: authorizedAt,
      created_by: userId,
    });
    if (versionError) throw versionError;

    const { error: permissionError } = await client.from("agent_permissions").insert(
      input.permissions.map((item) => ({
        workspace_id: input.workspaceId,
        passport_id: passport.id,
        passport_version: 1,
        action_key: item.actionKey,
        label: item.label,
        system_name: item.system ?? null,
        category: item.category ?? null,
        decision: item.decision,
        approval_role: item.approvalRole ?? null,
        approval_above_amount: item.approvalAboveAmount ?? null,
        data_classification_policy: item.dataClassificationPolicy ?? {},
        notes: item.notes ?? null,
        created_by: userId,
      })),
    );
    if (permissionError) throw permissionError;

    const { error: limitError } = await client.from("agent_limits").insert({
      workspace_id: input.workspaceId,
      passport_id: passport.id,
      passport_version: 1,
      currency: input.limits.currency.toUpperCase(),
      max_single_purchase: input.limits.maxSinglePurchase ?? null,
      max_daily_spend: input.limits.maxDailySpend ?? null,
      max_refund: input.limits.maxRefund ?? null,
      max_invoice: input.limits.maxInvoice ?? null,
      external_communication_policy: input.limits.externalCommunicationPolicy,
      financial_actions_policy: input.limits.financialActionsPolicy,
      sensitive_data_policy: input.limits.sensitiveDataPolicy,
      high_risk_requires_approval: input.limits.highRiskRequiresApproval,
      allowed_systems: input.limits.allowedSystems ?? [],
      blocked_systems: input.limits.blockedSystems ?? [],
      data_classification_policy: input.limits.dataClassificationPolicy ?? {},
      created_by: userId,
    });
    if (limitError) throw limitError;
  } catch (error) {
    // Best-effort cleanup for this detached foundation. Production attachment should wrap this
    // operation in a database transaction/RPC before launch.
    await client.from("agent_passports").delete().eq("id", passport.id);
    throw error;
  }

  await evidence({
    workspaceId: input.workspaceId,
    passportId: passport.id,
    eventType: input.authorizeNow ? "passport.authorized" : "passport.created",
    actorType: "HUMAN",
    actorUserId: userId,
    newStatus: status,
    metadata: { passportCode: passport.passport_code, version: 1 },
  });
  await audit(input.workspaceId, userId, "passport.registered", "passport", passport.id, {
    passportCode: passport.passport_code,
    authorized: Boolean(input.authorizeNow),
  });
  return passport;
}

export async function revisePassport(
  userId: string,
  input: {
    workspaceId: string;
    passportId: string;
    changeReason: string;
    agentName: string;
    humanSponsor: string;
    department?: string | null;
    businessPurpose: string;
    provider?: string | null;
    model?: string | null;
    platform?: string | null;
    environment?: "development" | "staging" | "production" | "other";
    authorizationExpiresAt?: string | null;
    reviewCadenceDays?: 30 | 60 | 90 | 180 | 365 | null;
    permissions: AgentPermission[];
    limits: AgentLimits;
  },
) {
  await requireRole(input.workspaceId, userId, ADMIN_ROLES);
  const reason = input.changeReason.trim();
  if (reason.length < 5) throw new Error("A material-change reason of at least 5 characters is required");
  if (input.permissions.length === 0) throw new Error("At least one explicit authority permission is required");
  const client = await db();
  const { data: current, error: currentError } = await client
    .from("agent_passports")
    .select("id,status,current_version,agent_name,human_sponsor,department,business_purpose,provider,model,platform,environment")
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.passportId)
    .single();
  if (currentError || !current) throw currentError ?? new Error("Passport not found");
  if (current.status === "REVOKED") throw new Error("A revoked Passport cannot be revised; register a new Passport");
  const nextVersion = Number(current.current_version) + 1;
  const identitySnapshot = {
    agentName: input.agentName, humanSponsor: input.humanSponsor, department: input.department ?? null,
    businessPurpose: input.businessPurpose, provider: input.provider ?? null, model: input.model ?? null,
    platform: input.platform ?? null, environment: input.environment ?? "production",
  };
  const currentPolicy = await loadPolicy(input.workspaceId, input.passportId);
  const priorIdentity = {
    agentName: current.agent_name, humanSponsor: current.human_sponsor, department: current.department ?? null,
    businessPurpose: current.business_purpose, provider: current.provider ?? null, model: current.model ?? null,
    platform: current.platform ?? null, environment: current.environment ?? "production",
  };
  const policyDiff = diffPolicyVersions(
    { identity: priorIdentity, permissions: currentPolicy.permissions, limits: currentPolicy.limits },
    { identity: identitySnapshot, permissions: input.permissions, limits: input.limits },
  );
  const { error: versionError } = await client.from("agent_passport_versions").insert({
    passport_id: input.passportId, workspace_id: input.workspaceId, version: nextVersion,
    identity_snapshot: identitySnapshot, authority_snapshot: { permissions: input.permissions }, limits_snapshot: input.limits,
    change_reason: reason, requires_reauthorization: policyDiff.requiresReauthorization,
    requires_policy_change_approval: policyDiff.requiresPolicyChangeApproval, policy_diff: policyDiff, created_by: userId,
  });
  if (versionError) throw versionError;
  const { error: permissionsError } = await client.from("agent_permissions").insert(input.permissions.map((item) => ({
    workspace_id: input.workspaceId, passport_id: input.passportId, passport_version: nextVersion,
    action_key: item.actionKey, label: item.label, system_name: item.system ?? null, category: item.category ?? null,
    decision: item.decision, approval_role: item.approvalRole ?? null, approval_above_amount: item.approvalAboveAmount ?? null,
    data_classification_policy: item.dataClassificationPolicy ?? {}, notes: item.notes ?? null, created_by: userId,
  })));
  if (permissionsError) throw permissionsError;
  const { error: limitsError } = await client.from("agent_limits").insert({
    workspace_id: input.workspaceId, passport_id: input.passportId, passport_version: nextVersion, currency: input.limits.currency.toUpperCase(),
    max_single_purchase: input.limits.maxSinglePurchase ?? null, max_daily_spend: input.limits.maxDailySpend ?? null,
    max_refund: input.limits.maxRefund ?? null, max_invoice: input.limits.maxInvoice ?? null,
    external_communication_policy: input.limits.externalCommunicationPolicy, financial_actions_policy: input.limits.financialActionsPolicy,
    sensitive_data_policy: input.limits.sensitiveDataPolicy, high_risk_requires_approval: input.limits.highRiskRequiresApproval,
    allowed_systems: input.limits.allowedSystems ?? [], blocked_systems: input.limits.blockedSystems ?? [],
    data_classification_policy: input.limits.dataClassificationPolicy ?? {}, created_by: userId,
  });
  if (limitsError) throw limitsError;
  const now = new Date().toISOString();
  const { error: updateError } = await client.from("agent_passports").update({
    agent_name: input.agentName.trim(), human_sponsor: input.humanSponsor.trim(), department: input.department?.trim() || null,
    business_purpose: input.businessPurpose.trim(), provider: input.provider?.trim() || null, model: input.model?.trim() || null,
    platform: input.platform?.trim() || null, environment: input.environment ?? "production", current_version: nextVersion,
    status: "DRAFT", authorized_at: null, authorization_expires_at: input.authorizationExpiresAt ?? null,
    review_cadence_days: input.reviewCadenceDays ?? null, updated_at: now,
  }).eq("id", input.passportId);
  if (updateError) throw updateError;
  let policyChangeRequest: any = null;
  if (policyDiff.requiresPolicyChangeApproval) {
    const { data, error: changeError } = await client.from("agent_policy_change_requests").insert({
      workspace_id: input.workspaceId, passport_id: input.passportId, from_version: Number(current.current_version), to_version: nextVersion,
      change_reason: reason, diff: policyDiff, has_material_increase: policyDiff.hasMaterialIncrease, requested_by: userId,
    }).select("id,status,expires_at").single();
    if (changeError) throw changeError;
    policyChangeRequest = data;
    await evidence({ workspaceId: input.workspaceId, passportId: input.passportId, eventType: "policy.change_requested", actorType: "HUMAN", actorUserId: userId, newStatus: "PENDING", metadata: { requestId: data.id, fromVersion: current.current_version, toVersion: nextVersion, increases: policyDiff.increases } });
  }
  await evidence({ workspaceId: input.workspaceId, passportId: input.passportId, eventType: "passport.reauthorization_required", actorType: "HUMAN", actorUserId: userId, priorStatus: current.status, newStatus: "DRAFT", metadata: { fromVersion: current.current_version, toVersion: nextVersion, changeReason: reason, policyDiff: { increases: policyDiff.increases, decreases: policyDiff.decreases, lateral: policyDiff.lateral, requiresPolicyChangeApproval: policyDiff.requiresPolicyChangeApproval } } });
  return { passportId: input.passportId, version: nextVersion, status: "DRAFT", requiresReauthorization: policyDiff.requiresReauthorization, policyDiff, policyChangeRequest };
}

export async function authorizePassport(
  userId: string,
  input: { workspaceId: string; passportId: string; authorizationExpiresAt?: string | null },
) {
  await requireRole(input.workspaceId, userId, ADMIN_ROLES);
  const client = await db();
  const { data: passport, error } = await client.from("agent_passports")
    .select("id,status,current_version,passport_code")
    .eq("workspace_id", input.workspaceId).eq("id", input.passportId).single();
  if (error || !passport) throw error ?? new Error("Passport not found");
  if (passport.status === "REVOKED") throw new Error("Revoked Passports cannot be reauthorized");
  const [{ count: permissionCount }, { data: limits }, { data: versionRow }] = await Promise.all([
    client.from("agent_permissions").select("id", { count: "exact", head: true }).eq("passport_id", input.passportId).eq("passport_version", passport.current_version),
    client.from("agent_limits").select("id").eq("passport_id", input.passportId).eq("passport_version", passport.current_version).maybeSingle(),
    client.from("agent_passport_versions").select("requires_policy_change_approval").eq("passport_id", input.passportId).eq("version", passport.current_version).maybeSingle(),
  ]);
  if (!permissionCount || !limits || !versionRow) throw new Error("Passport cannot be authorized without an Authority Matrix and Authority Limits");
  if (versionRow.requires_policy_change_approval) {
    const { data: changeRequest } = await client.from("agent_policy_change_requests").select("status,expires_at").eq("passport_id", input.passportId).eq("to_version", passport.current_version).maybeSingle();
    if (!changeRequest || changeRequest.status !== "APPROVED") {
      throw new Error("Material authority increases require an approved Policy Change request before reauthorization");
    }
  }
  if (input.authorizationExpiresAt && new Date(input.authorizationExpiresAt).getTime() <= Date.now()) throw new Error("Authorization expiration must be in the future");
  const now = new Date().toISOString();
  const { error: versionError } = await client.from("agent_passport_versions").update({ authorized_by: userId, authorized_at: now, requires_reauthorization: false }).eq("passport_id", input.passportId).eq("version", passport.current_version);
  if (versionError) throw versionError;
  const { error: passportError } = await client.from("agent_passports").update({ status: "AUTHORIZED", authorized_at: now, authorization_expires_at: input.authorizationExpiresAt ?? null, suspended_at: null, suspended_by: null, suspension_reason: null, updated_at: now }).eq("id", input.passportId);
  if (passportError) throw passportError;
  await evidence({ workspaceId: input.workspaceId, passportId: input.passportId, eventType: "passport.authorized", actorType: "HUMAN", actorUserId: userId, priorStatus: passport.status, newStatus: "AUTHORIZED", metadata: { passportCode: passport.passport_code, version: passport.current_version, authorizationExpiresAt: input.authorizationExpiresAt ?? null } });
  return { passportId: input.passportId, passportCode: passport.passport_code, version: passport.current_version, status: "AUTHORIZED", authorizedAt: now };
}

async function loadPolicy(workspaceId: string, passportId: string): Promise<PassportPolicySnapshot & { agentName: string }> {
  const client = await db();
  const { data: passport, error: passportError } = await client
    .from("agent_passports")
    .select("id,passport_code,workspace_id,agent_name,status,current_version,authorized_at,authorization_expires_at")
    .eq("workspace_id", workspaceId)
    .eq("id", passportId)
    .single();
  if (passportError || !passport) throw passportError ?? new Error("Passport not found");

  const [{ data: permissions, error: permissionError }, { data: limits, error: limitError }] = await Promise.all([
    client
      .from("agent_permissions")
      .select("action_key,label,system_name,category,decision,approval_role,approval_above_amount,data_classification_policy,notes")
      .eq("passport_id", passport.id)
      .eq("passport_version", passport.current_version),
    client
      .from("agent_limits")
      .select("currency,max_single_purchase,max_daily_spend,max_refund,max_invoice,external_communication_policy,financial_actions_policy,sensitive_data_policy,high_risk_requires_approval,allowed_systems,blocked_systems,data_classification_policy")
      .eq("passport_id", passport.id)
      .eq("passport_version", passport.current_version)
      .single(),
  ]);
  if (permissionError) throw permissionError;
  if (limitError || !limits) throw limitError ?? new Error("Passport authority limits missing");

  return {
    passportId: passport.id,
    passportCode: passport.passport_code,
    organizationId: passport.workspace_id,
    agentName: passport.agent_name,
    version: passport.current_version,
    status: passport.status,
    authorizedAt: passport.authorized_at,
    authorizationExpiresAt: passport.authorization_expires_at,
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
    })),
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
    },
  } as PassportPolicySnapshot & { agentName: string };
}

async function terminalReceipt(input: {
  workspaceId: string;
  request: any;
  decision: any;
  passport: PassportPolicySnapshot & { agentName: string };
  outcome: string;
  approverId?: string | null;
  approvedAt?: string | null;
  approvalVerified?: boolean;
}) {
  const client = await db();
  const receiptCode = `AV-${randomInt(100000000, 999999999)}`;
  const receiptInput: AuthorizationReceiptInput = {
    receiptCode,
    passportCode: input.passport.passportCode,
    agentName: input.passport.agentName,
    actionKey: input.request.action_key,
    target: input.request.target,
    authorityResult: input.decision.decision,
    policyCode: input.decision.policy_code,
    policyVersion: input.decision.policy_version,
    requestedAt: input.request.requested_at,
    approvedBy: input.approverId ?? null,
    approvedAt: input.approvedAt ?? null,
    executionConfirmed: false,
    signedEvidencePresent: false,
    evidenceLevel: input.approvalVerified ? "APPROVAL_VERIFIED" : "DECLARED",
    outcome: input.outcome,
    evidenceReferences: [],
  };
  const integrityHash = hashReceipt(receiptInput);
  const { data: receipt, error } = await client
    .from("authorization_receipts")
    .insert({
      workspace_id: input.workspaceId,
      receipt_code: receiptCode,
      action_request_id: input.request.id,
      decision_id: input.decision.id,
      passport_id: input.passport.passportId,
      passport_version: input.passport.version,
      receipt_kind: "TERMINAL",
      action_key: input.request.action_key,
      target: input.request.target,
      authority_result: input.decision.decision,
      policy_code: input.decision.policy_code,
      policy_version: input.decision.policy_version,
      human_approver_id: input.approverId ?? null,
      human_approved_at: input.approvedAt ?? null,
      requested_at: input.request.requested_at,
      execution_status: "NOT_EXECUTED",
      outcome: input.outcome,
      evidence_level: receiptInput.evidenceLevel,
      evidence_references: [],
      integrity_hash: integrityHash,
    })
    .select("id,receipt_code,evidence_level,created_at")
    .single();
  if (error) throw error;
  await evidence({
    workspaceId: input.workspaceId,
    passportId: input.passport.passportId,
    actionRequestId: input.request.id,
    receiptId: receipt.id,
    eventType: "receipt.created",
    actorType: "SYSTEM",
    metadata: { receiptCode: receipt.receipt_code, receiptKind: "TERMINAL", evidenceLevel: receipt.evidence_level },
  });
  return receipt;
}

export async function submitAction(
  userId: string,
  input: { workspaceId: string; passportId: string; request: ActionGateRequest },
  actorOverride?: { type: "API_KEY"; apiKeyId: string },
) {
  if (!actorOverride) await requireRole(input.workspaceId, userId);
  if (!input.request.idempotencyKey?.trim()) throw new Error("idempotencyKey is required");
  const client = await db();

  const { data: existing, error: existingError } = await client
    .from("action_requests")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("idempotency_key", input.request.idempotencyKey)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    const { data: existingDecision, error } = await client
      .from("action_decisions")
      .select("id,decision,primary_reason,reason_codes,policy_code,policy_version,decided_at")
      .eq("action_request_id", existing.id)
      .single();
    if (error) throw error;
    return { idempotentReplay: true, actionRequestId: existing.id, decision: existingDecision };
  }

  const policy = await loadPolicy(input.workspaceId, input.passportId);
  const resolvedClassification = await resolveRequestDataClassification({
    workspaceId: input.workspaceId, explicit: input.request.dataClassification ?? null, resourceKey: input.request.resourceKey ?? null, target: input.request.target ?? null,
  });
  const requestForEvaluation = { ...input.request, dataClassification: resolvedClassification };
  const evaluated = evaluateActionGate(policy, requestForEvaluation);
  const requestedAt = input.request.requestedAt ?? new Date().toISOString();

  const { data: actionRequest, error: requestError } = await client
    .from("action_requests")
    .insert({
      workspace_id: input.workspaceId,
      passport_id: input.passportId,
      passport_version: policy.version,
      action_key: input.request.actionKey,
      target: input.request.target ?? null,
      system_name: input.request.system ?? null,
      amount: input.request.amount ?? null,
      amount_kind: input.request.amountKind ?? null,
      currency: input.request.currency?.toUpperCase() ?? null,
      external_communication: Boolean(input.request.externalCommunication),
      financial_action: Boolean(input.request.financialAction),
      sensitive_data: Boolean(input.request.sensitiveData),
      high_risk: Boolean(input.request.highRisk),
      data_classification: resolvedClassification,
      context_metadata: input.request.resourceKey ? { resourceKey: input.request.resourceKey } : {},
      idempotency_key: input.request.idempotencyKey,
      actor_type: actorOverride ? "API_KEY" : "HUMAN",
      requested_by: actorOverride ? null : userId,
      requested_via_api_key_id: actorOverride?.apiKeyId ?? null,
      requested_at: requestedAt,
    })
    .select("*")
    .single();
  if (requestError) {
    // A concurrent duplicate is expected to lose on the unique idempotency constraint.
    if (String(requestError.code) === "23505") return submitAction(userId, input, actorOverride);
    throw requestError;
  }

  const policyCode = `PASSPORT:${policy.passportCode}`;
  const { data: decision, error: decisionError } = await client
    .from("action_decisions")
    .insert({
      workspace_id: input.workspaceId,
      action_request_id: actionRequest.id,
      passport_id: input.passportId,
      passport_version: policy.version,
      decision: evaluated.decision,
      primary_reason: evaluated.primaryReason,
      reason_codes: evaluated.reasonCodes,
      policy_code: policyCode,
      policy_version: policy.version,
    })
    .select("*")
    .single();
  if (decisionError) throw decisionError;

  await evidence({
    workspaceId: input.workspaceId,
    passportId: input.passportId,
    actionRequestId: actionRequest.id,
    eventType: "decision.created",
    actorType: "SYSTEM",
    metadata: {
      decision: evaluated.decision,
      primaryReason: evaluated.primaryReason,
      reasonCodes: evaluated.reasonCodes,
      policyCode,
      policyVersion: policy.version,
    },
  });

  let approval = null;
  let receipt = null;
  if (evaluated.decision === "APPROVAL_REQUIRED") {
    const expiresAt = new Date(new Date(requestedAt).getTime() + 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await client
      .from("approval_requests")
      .insert({
        workspace_id: input.workspaceId,
        action_request_id: actionRequest.id,
        decision_id: decision.id,
        assigned_role: evaluated.approvalRole ?? "APPROVER",
        reason: evaluated.primaryReason,
        requested_at: requestedAt,
        expires_at: expiresAt,
      })
      .select("id,status,assigned_role,requested_at,expires_at")
      .single();
    if (error) throw error;
    approval = data;
    await evidence({
      workspaceId: input.workspaceId,
      passportId: input.passportId,
      actionRequestId: actionRequest.id,
      eventType: "approval.requested",
      actorType: "SYSTEM",
      metadata: { approvalRequestId: data.id, assignedRole: data.assigned_role, expiresAt: data.expires_at },
    });
  } else if (evaluated.decision === "BLOCK") {
    receipt = await terminalReceipt({ workspaceId: input.workspaceId, request: actionRequest, decision, passport: policy, outcome: "BLOCKED_BY_POLICY" });
  }

  return {
    idempotentReplay: false,
    actionRequestId: actionRequest.id,
    decision: evaluated,
    approval,
    receipt,
  };
}

export async function resolveApproval(
  userId: string,
  input: { workspaceId: string; approvalRequestId: string; decision: "APPROVED" | "REJECTED"; note?: string | null },
) {
  const client = await db();
  const { data: approval, error } = await client
    .from("approval_requests")
    .select("*, action_requests(*), action_decisions(*)")
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.approvalRequestId)
    .single();
  if (error || !approval) throw error ?? new Error("Approval request not found");
  if (approval.status !== "PENDING") throw new Error(`Approval is already ${approval.status}`);
  if (new Date(approval.expires_at).getTime() <= Date.now()) {
    await client.from("approval_requests").update({ status: "EXPIRED", resolved_at: new Date().toISOString() }).eq("id", approval.id);
    throw new Error("Approval request has expired");
  }

  const request = Array.isArray(approval.action_requests) ? approval.action_requests[0] : approval.action_requests;
  const actionDecision = Array.isArray(approval.action_decisions) ? approval.action_decisions[0] : approval.action_decisions;
  if (!request || !actionDecision) throw new Error("Approval request is missing its action context");
  // Authorization must be proven BEFORE any approval mutation is written.
  const approvalAuthority = await assertActionApprovalAuthority({
    workspaceId: input.workspaceId, userId, assignedRole: approval.assigned_role, actionKey: request.action_key, amount: request.amount == null ? null : Number(request.amount),
  });

  const now = new Date().toISOString();
  const { data: recorded, error: decisionError } = await client
    .from("approval_decisions")
    .insert({
      workspace_id: input.workspaceId,
      approval_request_id: approval.id,
      decision: input.decision,
      approver_id: userId,
      note: input.note?.trim() || null,
      decided_at: now,
    })
    .select("id,decision,approver_id,note,decided_at")
    .single();
  if (decisionError) throw decisionError;

  const { error: updateError } = await client
    .from("approval_requests")
    .update({ status: input.decision, resolved_at: now, resolved_by: userId })
    .eq("id", approval.id)
    .eq("status", "PENDING");
  if (updateError) throw updateError;

  const policy = await loadPolicy(input.workspaceId, request.passport_id);

  await evidence({
    workspaceId: input.workspaceId,
    passportId: request.passport_id,
    actionRequestId: request.id,
    eventType: "approval.decided",
    actorType: "HUMAN",
    actorUserId: userId,
    priorStatus: "PENDING",
    newStatus: input.decision,
    metadata: { approvalRequestId: approval.id, notePresent: Boolean(input.note?.trim()), authoritySource: approvalAuthority.mode, delegationId: approvalAuthority.delegationId ?? null },
  });

  let receipt = null;
  if (input.decision === "REJECTED") {
    receipt = await terminalReceipt({
      workspaceId: input.workspaceId,
      request,
      decision: actionDecision,
      passport: policy,
      outcome: "REJECTED_BY_HUMAN_APPROVER",
    });
  }
  await audit(input.workspaceId, userId, `approval.${input.decision.toLowerCase()}`, "approval_request", approval.id);
  return { approvalDecision: recorded, receipt };
}

export async function reportExecution(
  userId: string,
  input: {
    workspaceId: string;
    actionRequestId: string;
    executionStatus: "EXECUTED" | "FAILED" | "CANCELLED";
    executedAt?: string | null;
    sourceSystem?: string | null;
    externalReference?: string | null;
    executionConfirmed?: boolean;
    signedEvidencePresent?: boolean;
    evidenceReferences?: string[];
  },
  actorOverride?: { type: "API_KEY"; apiKeyId: string },
) {
  if (!actorOverride) await requireRole(input.workspaceId, userId);
  const client = await db();
  const { data: request, error: requestError } = await client
    .from("action_requests")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.actionRequestId)
    .single();
  if (requestError || !request) throw requestError ?? new Error("Action request not found");
  const { data: decision, error: decisionError } = await client
    .from("action_decisions")
    .select("*")
    .eq("action_request_id", request.id)
    .single();
  if (decisionError || !decision) throw decisionError ?? new Error("Action decision not found");
  if (decision.decision === "BLOCK") throw new Error("Blocked actions cannot be reported as executed");

  let approvalDecision: any = null;
  if (decision.decision === "APPROVAL_REQUIRED") {
    const { data: approval } = await client.from("approval_requests").select("id,status,resolved_by,resolved_at").eq("action_request_id", request.id).single();
    if (!approval || approval.status !== "APPROVED") throw new Error("Human approval is required before execution can be recorded");
    approvalDecision = approval;
  }

  const passport = await loadPolicy(input.workspaceId, request.passport_id);
  const executedAt = input.executedAt ?? new Date().toISOString();
  const executionConfirmed = Boolean(input.executionConfirmed);
  const signedEvidencePresent = Boolean(input.signedEvidencePresent);
  const evidenceLevel = highestPermittedEvidenceLevel({
    approved: Boolean(approvalDecision),
    executionConfirmed,
    signedEvidencePresent,
  });
  const receiptCode = `AV-${randomInt(100000000, 999999999)}`;
  const receiptInput: AuthorizationReceiptInput = {
    receiptCode,
    passportCode: passport.passportCode,
    agentName: passport.agentName,
    actionKey: request.action_key,
    target: request.target,
    authorityResult: decision.decision,
    policyCode: decision.policy_code,
    policyVersion: decision.policy_version,
    requestedAt: request.requested_at,
    approvedBy: approvalDecision?.resolved_by ?? null,
    approvedAt: approvalDecision?.resolved_at ?? null,
    executedAt,
    executionConfirmed,
    signedEvidencePresent,
    evidenceLevel,
    outcome: input.executionStatus,
    evidenceReferences: input.evidenceReferences ?? [],
  };
  const integrityHash = hashReceipt(receiptInput);
  const { data: receipt, error: receiptError } = await client
    .from("authorization_receipts")
    .insert({
      workspace_id: input.workspaceId,
      receipt_code: receiptCode,
      action_request_id: request.id,
      decision_id: decision.id,
      passport_id: request.passport_id,
      passport_version: decision.passport_version,
      receipt_kind: "EXECUTION",
      action_key: request.action_key,
      target: request.target,
      authority_result: decision.decision,
      policy_code: decision.policy_code,
      policy_version: decision.policy_version,
      human_approver_id: approvalDecision?.resolved_by ?? null,
      human_approved_at: approvalDecision?.resolved_at ?? null,
      requested_at: request.requested_at,
      executed_at: executedAt,
      execution_status: input.executionStatus,
      outcome: input.executionStatus,
      evidence_level: evidenceLevel,
      evidence_references: input.evidenceReferences ?? [],
      integrity_hash: integrityHash,
    })
    .select("id,receipt_code,evidence_level,execution_status,integrity_hash,created_at")
    .single();
  if (receiptError) {
    if (String(receiptError.code) === "23505") throw new Error("Execution receipt already exists for this action request");
    throw receiptError;
  }

  await evidence({
    workspaceId: input.workspaceId,
    passportId: request.passport_id,
    actionRequestId: request.id,
    receiptId: receipt.id,
    eventType: "execution.reported",
    actorType: actorOverride || input.sourceSystem ? "INTEGRATION" : "HUMAN",
    actorUserId: actorOverride ? null : userId,
    sourceSystem: input.sourceSystem ?? null,
    externalReference: input.externalReference ?? null,
    metadata: { executionStatus: input.executionStatus, evidenceLevel, evidenceReferenceCount: input.evidenceReferences?.length ?? 0 },
  });
  await evidence({
    workspaceId: input.workspaceId,
    passportId: request.passport_id,
    actionRequestId: request.id,
    receiptId: receipt.id,
    eventType: "receipt.created",
    actorType: "SYSTEM",
    metadata: { receiptCode: receipt.receipt_code, receiptKind: "EXECUTION", evidenceLevel },
  });
  return receipt;
}

export async function submitActionFromApiKey(
  apiKey: { id: string; workspaceId: string; createdBy: string },
  input: { passportId: string; request: ActionGateRequest },
) {
  return submitAction(apiKey.createdBy, { workspaceId: apiKey.workspaceId, passportId: input.passportId, request: input.request }, { type: "API_KEY", apiKeyId: apiKey.id });
}

export async function reportExecutionFromApiKey(
  apiKey: { id: string; workspaceId: string; createdBy: string },
  input: Omit<Parameters<typeof reportExecution>[1], "workspaceId">,
) {
  return reportExecution(apiKey.createdBy, { workspaceId: apiKey.workspaceId, ...input }, { type: "API_KEY", apiKeyId: apiKey.id });
}

export async function suspendPassport(userId: string, input: { workspaceId: string; passportId: string; reason: string }) {
  await requireRole(input.workspaceId, userId, ADMIN_ROLES);
  const reason = input.reason.trim();
  if (reason.length < 5) throw new Error("Suspension reason must be at least 5 characters");
  const client = await db();
  const { data: current, error: loadError } = await client
    .from("agent_passports")
    .select("id,status,passport_code")
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.passportId)
    .single();
  if (loadError || !current) throw loadError ?? new Error("Passport not found");
  if (current.status === "REVOKED") throw new Error("Revoked passports cannot be suspended");

  const now = new Date().toISOString();
  const { error } = await client
    .from("agent_passports")
    .update({ status: "SUSPENDED", suspended_at: now, suspended_by: userId, suspension_reason: reason, updated_at: now })
    .eq("id", input.passportId);
  if (error) throw error;
  await evidence({
    workspaceId: input.workspaceId,
    passportId: input.passportId,
    eventType: "passport.suspended",
    actorType: "HUMAN",
    actorUserId: userId,
    priorStatus: current.status,
    newStatus: "SUSPENDED",
    metadata: { reason },
  });
  await audit(input.workspaceId, userId, "passport.suspended", "passport", input.passportId, { reason });
  return { ok: true, status: "SUSPENDED", suspendedAt: now };
}

export async function reinstatePassport(userId: string, input: { workspaceId: string; passportId: string; reason: string }) {
  await requireRole(input.workspaceId, userId, ADMIN_ROLES);
  const reason = input.reason.trim();
  if (reason.length < 5) throw new Error("Reinstatement reason must be at least 5 characters");
  const client = await db();
  const { data: current, error: loadError } = await client
    .from("agent_passports")
    .select("id,status,authorization_expires_at,current_version")
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.passportId)
    .single();
  if (loadError || !current) throw loadError ?? new Error("Passport not found");
  if (current.status !== "SUSPENDED") throw new Error("Only suspended passports can be reinstated");
  if (current.authorization_expires_at && new Date(current.authorization_expires_at).getTime() <= Date.now()) {
    throw new Error("Passport authorization has expired and must be reauthorized");
  }

  const now = new Date().toISOString();
  const { error } = await client
    .from("agent_passports")
    .update({ status: "AUTHORIZED", suspended_at: null, suspended_by: null, suspension_reason: null, updated_at: now })
    .eq("id", input.passportId);
  if (error) throw error;
  await evidence({
    workspaceId: input.workspaceId,
    passportId: input.passportId,
    eventType: "passport.reinstated",
    actorType: "HUMAN",
    actorUserId: userId,
    priorStatus: "SUSPENDED",
    newStatus: "AUTHORIZED",
    metadata: { reason, version: current.current_version },
  });
  return { ok: true, status: "AUTHORIZED", reinstatedAt: now };
}

export async function reviewPassport(
  userId: string,
  input: {
    workspaceId: string;
    passportId: string;
    reviewType: "RECERTIFY" | "MODIFY_AND_REAUTHORIZE" | "SUSPEND" | "REVOKE";
    notes?: string | null;
  },
) {
  await requireRole(input.workspaceId, userId, ADMIN_ROLES);
  if (input.reviewType === "SUSPEND") return suspendPassport(userId, { workspaceId: input.workspaceId, passportId: input.passportId, reason: input.notes || "Authority review suspension" });
  const client = await db();
  const policy = await loadPolicy(input.workspaceId, input.passportId);
  const { data: row, error: loadError } = await client
    .from("agent_passports")
    .select("review_cadence_days,status,current_version")
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.passportId)
    .single();
  if (loadError || !row) throw loadError ?? new Error("Passport not found");
  const now = new Date();
  const nextReviewAt = row.review_cadence_days ? new Date(now.getTime() + row.review_cadence_days * 86_400_000).toISOString() : null;

  if (input.reviewType === "MODIFY_AND_REAUTHORIZE") {
    const { error } = await client
      .from("agent_passports")
      .update({ status: "DRAFT", authorized_at: null, last_review_at: now.toISOString(), next_review_at: nextReviewAt, updated_at: now.toISOString() })
      .eq("id", input.passportId);
    if (error) throw error;
  } else if (input.reviewType === "REVOKE") {
    const reason = input.notes?.trim();
    if (!reason || reason.length < 5) throw new Error("Revocation requires a reason of at least 5 characters");
    const { error } = await client
      .from("agent_passports")
      .update({ status: "REVOKED", revoked_at: now.toISOString(), revoked_by: userId, revocation_reason: reason, last_review_at: now.toISOString(), next_review_at: null, updated_at: now.toISOString() })
      .eq("id", input.passportId);
    if (error) throw error;
  } else {
    if (policy.status !== "AUTHORIZED") throw new Error("Only an authorized Passport can be recertified");
    const { error } = await client
      .from("agent_passports")
      .update({ last_review_at: now.toISOString(), next_review_at: nextReviewAt, updated_at: now.toISOString() })
      .eq("id", input.passportId);
    if (error) throw error;
  }

  const snapshot = { permissions: policy.permissions, limits: policy.limits, status: policy.status, version: policy.version };
  const { data: review, error: reviewError } = await client
    .from("authority_reviews")
    .insert({
      workspace_id: input.workspaceId,
      passport_id: input.passportId,
      passport_version: row.current_version,
      review_type: input.reviewType,
      reviewer_id: userId,
      notes: input.notes?.trim() || null,
      authority_snapshot: snapshot,
      reviewed_at: now.toISOString(),
      next_review_at: input.reviewType === "REVOKE" ? null : nextReviewAt,
    })
    .select("id,review_type,reviewed_at,next_review_at")
    .single();
  if (reviewError) throw reviewError;
  await evidence({
    workspaceId: input.workspaceId,
    passportId: input.passportId,
    eventType: "passport.reviewed",
    actorType: "HUMAN",
    actorUserId: userId,
    priorStatus: row.status,
    newStatus: input.reviewType === "REVOKE" ? "REVOKED" : input.reviewType === "MODIFY_AND_REAUTHORIZE" ? "DRAFT" : row.status,
    metadata: { reviewType: input.reviewType, reviewId: review.id, nextReviewAt },
  });
  return review;
}

export async function listCommandCenter(userId: string, workspaceId: string) {
  await requireRole(workspaceId, userId);
  const client = await db();
  const now = new Date().toISOString();
  const in30Days = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const [passports, approvals, blocked, receipts, reviews] = await Promise.all([
    client.from("agent_passports").select("id,passport_code,agent_name,department,provider,model,status,authorization_expires_at,next_review_at,updated_at").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }),
    client.from("approval_requests").select("id", { count: "exact" }).eq("workspace_id", workspaceId).eq("status", "PENDING"),
    client.from("action_decisions").select("id", { count: "exact" }).eq("workspace_id", workspaceId).eq("decision", "BLOCK"),
    client.from("authorization_receipts").select("id,receipt_code,evidence_level,execution_status,created_at,action_key").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(8),
    client.from("agent_passports").select("id,passport_code,agent_name,next_review_at").eq("workspace_id", workspaceId).not("next_review_at", "is", null).lte("next_review_at", in30Days).order("next_review_at", { ascending: true }).limit(8),
  ]);
  for (const part of [passports, approvals, blocked, receipts, reviews]) if (part.error) throw part.error;
  const passportRows = passports.data ?? [];
  return {
    now,
    counts: {
      governed: passportRows.length,
      authorized: passportRows.filter((row: any) => row.status === "AUTHORIZED").length,
      suspended: passportRows.filter((row: any) => row.status === "SUSPENDED").length,
      expired: passportRows.filter((row: any) => row.status === "EXPIRED" || (row.authorization_expires_at && row.authorization_expires_at <= now)).length,
      pendingApprovals: approvals.count ?? 0,
      blockedActions: blocked.count ?? 0,
    },
    passports: passportRows,
    recentReceipts: receipts.data ?? [],
    upcomingReviews: reviews.data ?? [],
  };
}

export async function listApprovalQueue(userId: string, workspaceId: string) {
  await requireRole(workspaceId, userId);
  const client = await db();
  const { data, error } = await client
    .from("approval_requests")
    .select("id,status,assigned_role,reason,requested_at,expires_at,resolved_at,resolved_by,action_requests(id,passport_id,action_key,target,amount,currency,requested_by),action_decisions(decision,primary_reason,reason_codes,policy_code,policy_version),agent_authority_workspaces(name)")
    .eq("workspace_id", workspaceId)
    .order("requested_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function listEvidenceLedger(userId: string, input: { workspaceId: string; passportId?: string | null; eventType?: string | null; limit?: number }) {
  await requireRole(input.workspaceId, userId);
  const client = await db();
  let query = client
    .from("evidence_events")
    .select("id,passport_id,action_request_id,receipt_id,event_type,actor_type,actor_user_id,source_system,external_reference,prior_status,new_status,metadata,integrity_hash,occurred_at")
    .eq("workspace_id", input.workspaceId)
    .order("occurred_at", { ascending: false })
    .limit(Math.min(Math.max(input.limit ?? 200, 1), 500));
  if (input.passportId) query = query.eq("passport_id", input.passportId);
  if (input.eventType) query = query.eq("event_type", input.eventType);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createWorkspaceApiKey(
  userId: string,
  input: { workspaceId: string; name: string; scopes: string[]; expiresAt?: string | null; rateLimitPerMinute?: number },
) {
  await requireRole(input.workspaceId, userId, ADMIN_ROLES);
  const scopes = [...new Set(input.scopes)];
  if (scopes.length === 0 || scopes.some((scope) => !API_SCOPES.includes(scope as any))) throw new Error("Invalid API key scopes");
  const rateLimitPerMinute = Math.max(1, Math.min(Math.floor(input.rateLimitPerMinute ?? 60), 10_000));
  const generated = generateApiKey();
  const client = await db();
  const { data, error } = await client
    .from("agent_authority_api_keys")
    .insert({
      workspace_id: input.workspaceId,
      name: input.name.trim() || "API key",
      key_hash: generated.hash,
      display_prefix: generated.displayPrefix,
      last4: generated.last4,
      scopes,
      created_by: userId,
      expires_at: input.expiresAt ?? null,
      rate_limit_per_minute: rateLimitPerMinute,
    })
    .select("id,name,display_prefix,last4,scopes,created_at,expires_at,rate_limit_per_minute")
    .single();
  if (error) throw error;
  await audit(input.workspaceId, userId, "api_key.created", "api_key", data.id, { scopes, rateLimitPerMinute });
  return { ...data, plaintextKey: generated.plaintext }; // returned once; never persisted
}

export async function exportAudit(
  userId: string,
  input: { workspaceId: string; organizationName: string; from?: string | null; to?: string | null; passportId?: string | null },
) {
  await requireRole(input.workspaceId, userId, AUDIT_ROLES);
  const client = await db();
  let query = client
    .from("action_requests")
    .select("id,requested_at,passport_id,action_key,target,agent_passports(passport_code,agent_name),action_decisions(decision,primary_reason),approval_requests(status,resolved_by),authorization_receipts(receipt_code,evidence_level,execution_status,created_at)")
    .eq("workspace_id", input.workspaceId)
    .order("requested_at", { ascending: true });
  if (input.from) query = query.gte("requested_at", input.from);
  if (input.to) query = query.lte("requested_at", input.to);
  if (input.passportId) query = query.eq("passport_id", input.passportId);
  const { data, error } = await query;
  if (error) throw error;

  const rows: AuditExportRow[] = (data ?? []).map((row: any) => {
    const passport = Array.isArray(row.agent_passports) ? row.agent_passports[0] : row.agent_passports;
    const decision = Array.isArray(row.action_decisions) ? row.action_decisions[0] : row.action_decisions;
    const approval = Array.isArray(row.approval_requests) ? row.approval_requests[0] : row.approval_requests;
    const receipts = Array.isArray(row.authorization_receipts) ? row.authorization_receipts : row.authorization_receipts ? [row.authorization_receipts] : [];
    const receipt = receipts.sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    return {
      occurredAt: row.requested_at,
      passportCode: passport?.passport_code ?? "",
      agentName: passport?.agent_name ?? "",
      actionKey: row.action_key,
      target: row.target,
      decision: decision?.decision ?? "",
      reason: decision?.primary_reason ?? "",
      approvalStatus: approval?.status ?? null,
      approvedBy: approval?.resolved_by ?? null,
      receiptCode: receipt?.receipt_code ?? null,
      evidenceLevel: receipt?.evidence_level ?? null,
      executionStatus: receipt?.execution_status ?? null,
    };
  });

  const filters = [input.from ? `from ${input.from}` : null, input.to ? `to ${input.to}` : null, input.passportId ? `passport ${input.passportId}` : null].filter(Boolean).join("; ");
  const exportedAt = new Date().toISOString();
  const csv = generateAuditCsv(rows);
  const pdf = await generateAuditPdf({ organizationName: input.organizationName, exportedAt, filters, rows });
  await audit(input.workspaceId, userId, "audit.exported", "workspace", input.workspaceId, {
    rowCount: rows.length,
    from: input.from ?? null,
    to: input.to ?? null,
    passportId: input.passportId ?? null,
  });
  return { exportedAt, rowCount: rows.length, csv, pdfBase64: Buffer.from(pdf).toString("base64") };
}
