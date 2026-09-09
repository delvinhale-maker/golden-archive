from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing patch marker: {label}")
    return text.replace(old, new, 1)


service_path = Path("src/lib/agent-authority/service.server.ts")
text = service_path.read_text()
if 'from "./audit-minimization"' not in text:
    text = replace_once(
        text,
        'import { loadRecordedDailyPurchaseSpend } from "./daily-spend.server";\n',
        'import { loadRecordedDailyPurchaseSpend } from "./daily-spend.server";\nimport { minimizeAuditMetadata } from "./audit-minimization";\nimport { loadPassportVersionIdentity } from "./policy-version-identity.server";\n',
        "service imports",
    )
text = replace_once(
    text,
    '    metadata,\n  });\n  if (error) throw error;\n}\n\nasync function evidence',
    '    metadata: minimizeAuditMetadata(metadata),\n  });\n  if (error) throw error;\n}\n\nasync function evidence',
    "service audit minimization",
)
text = replace_once(
    text,
    '  const safeMetadata = input.metadata ?? {};',
    '  const safeMetadata = minimizeAuditMetadata(input.metadata);',
    "service evidence minimization",
)
text = replace_once(
    text,
    '  const client = await db();\n  const receiptCode = `AV-${randomInt(100000000, 999999999)}`;',
    '  const client = await db();\n  const receiptVersion = Number(input.decision.passport_version ?? input.decision.policy_version ?? input.passport.version);\n  const receiptIdentity = await loadPassportVersionIdentity({ client, workspaceId: input.workspaceId, passportId: input.passport.passportId, passportVersion: receiptVersion });\n  const receiptCode = `AV-${randomInt(100000000, 999999999)}`;',
    "terminal receipt historical identity setup",
)
text = replace_once(
    text,
    '    passportCode: input.passport.passportCode,\n    agentName: input.passport.agentName,',
    '    passportCode: receiptIdentity.passportCode,\n    agentName: receiptIdentity.agentName,',
    "terminal receipt historical identity",
)
text = replace_once(text, '      passport_version: input.passport.version,', '      passport_version: receiptVersion,', "terminal receipt version")

start = text.index("export async function resolveApproval(")
end = text.index("\nexport async function reportExecution(", start)
new_resolve_approval = '''export async function resolveApproval(
  userId: string,
  input: { workspaceId: string; approvalRequestId: string; decision: "APPROVED" | "REJECTED"; note?: string | null },
) {
  const client = await db();
  const note = input.note?.trim() || null;
  if (note && note.length > 2000) throw new Error("Approval note must be 2000 characters or fewer");
  const { data: approval, error } = await client
    .from("approval_requests")
    .select("*, action_requests(*), action_decisions(*)")
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.approvalRequestId)
    .single();
  if (error || !approval) throw error ?? new Error("Approval request not found");

  const request = Array.isArray(approval.action_requests) ? approval.action_requests[0] : approval.action_requests;
  const actionDecision = Array.isArray(approval.action_decisions) ? approval.action_decisions[0] : approval.action_decisions;
  if (!request || !actionDecision) throw new Error("Approval request is missing its action context");

  // Prove direct/delegated human authority before entering the service-role-only mutation RPC.
  const approvalAuthority = await assertActionApprovalAuthority({
    workspaceId: input.workspaceId,
    userId,
    assignedRole: approval.assigned_role,
    actionKey: request.action_key,
    amount: request.amount == null ? null : Number(request.amount),
  });

  const { data: resolvedRows, error: resolveError } = await client.rpc("resolve_agent_authority_approval_atomic", {
    p_workspace_id: input.workspaceId,
    p_approval_request_id: approval.id,
    p_approver_id: userId,
    p_decision: input.decision,
    p_note: note,
  });
  if (resolveError) throw resolveError;
  const resolved = Array.isArray(resolvedRows) ? resolvedRows[0] : resolvedRows;
  if (!resolved) throw new Error("Atomic approval resolution returned no result");
  if (resolved.approval_status === "EXPIRED") throw new Error("Approval request has expired");
  if (resolved.already_resolved) throw new Error(`Approval is already ${resolved.approval_status}`);

  const recorded = {
    id: resolved.approval_decision_id,
    decision: resolved.approval_status,
    approver_id: resolved.approver_id,
    note: resolved.note,
    decided_at: resolved.decided_at,
  };
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
    metadata: {
      approvalRequestId: approval.id,
      notePresent: Boolean(note),
      authoritySource: approvalAuthority.mode,
      delegationId: approvalAuthority.delegationId ?? null,
    },
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
'''
text = text[:start] + new_resolve_approval + text[end:]
text = replace_once(
    text,
    '  const passport = await loadPolicy(input.workspaceId, request.passport_id);\n  const executedAt = input.executedAt ?? new Date().toISOString();',
    '''  const passport = await loadPolicy(input.workspaceId, request.passport_id);
  if (passport.status !== "AUTHORIZED") throw new Error(`Passport is ${passport.status}; execution evidence cannot be recorded`);
  if (passport.authorizationExpiresAt && new Date(passport.authorizationExpiresAt).getTime() <= Date.now()) {
    throw new Error("Passport authorization has expired; re-evaluate before execution");
  }
  if (Number(passport.version) !== Number(decision.passport_version)) {
    throw new Error("Passport policy version changed after authorization; submit a new Action Gate request");
  }
  const receiptIdentity = await loadPassportVersionIdentity({
    client,
    workspaceId: input.workspaceId,
    passportId: request.passport_id,
    passportVersion: Number(decision.passport_version),
  });
  const executedAt = input.executedAt ?? new Date().toISOString();''',
    "execution policy cutover",
)
text = replace_once(
    text,
    '    passportCode: passport.passportCode,\n    agentName: passport.agentName,',
    '    passportCode: receiptIdentity.passportCode,\n    agentName: receiptIdentity.agentName,',
    "execution receipt historical identity",
)
service_path.write_text(text)


governance_path = Path("src/lib/agent-authority/governance.service.server.ts")
text = governance_path.read_text()
text = replace_once(
    text,
    'import { classifyWebhookDelivery, webhookDeliveryHealth } from "./webhooks.server";',
    'import { classifyWebhookDelivery, validateWebhookEndpointUrl, validateWebhookSubscriptions, webhookDeliveryHealth } from "./webhooks.server";',
    "governance webhook imports",
)
if 'from "./audit-minimization"' not in text:
    text = replace_once(
        text,
        'import { simulateActionGate } from "./shadow-mode";\n',
        'import { simulateActionGate } from "./shadow-mode";\nimport { minimizeAuditMetadata } from "./audit-minimization";\nimport { loadPassportVersionIdentity } from "./policy-version-identity.server";\n',
        "governance hardening imports",
    )
text = replace_once(
    text,
    'const ADMIN_ROLES: WorkspaceRole[] = ["OWNER", "ADMIN"];',
    'const ADMIN_ROLES: WorkspaceRole[] = ["OWNER", "ADMIN"];\nconst AUDIT_ROLES: WorkspaceRole[] = ["OWNER", "ADMIN", "AUDITOR"];\nconst GOVERNANCE_ROLES: WorkspaceRole[] = ["OWNER", "ADMIN", "APPROVER", "AUDITOR"];',
    "governance role constants",
)
text = replace_once(
    text,
    '    metadata,\n  });\n  if (error) throw error;\n}\n\nasync function appendEvidence',
    '    metadata: minimizeAuditMetadata(metadata),\n  });\n  if (error) throw error;\n}\n\nasync function appendEvidence',
    "governance audit minimization",
)
text = replace_once(text, '  const metadata = input.metadata ?? {};', '  const metadata = minimizeAuditMetadata(input.metadata);', "governance evidence minimization")
text = replace_once(
    text,
    'export async function listDelegations(userId: string, workspaceId: string) {\n  await requireRole(workspaceId, userId);',
    'export async function listDelegations(userId: string, workspaceId: string) {\n  await requireRole(workspaceId, userId, GOVERNANCE_ROLES);',
    "delegation list role",
)
text = replace_once(
    text,
    'export async function listWebhookHealth(userId: string, workspaceId: string) {\n  await requireRole(workspaceId, userId);',
    'export async function listWebhookHealth(userId: string, workspaceId: string) {\n  await requireRole(workspaceId, userId, AUDIT_ROLES);',
    "webhook health role",
)
text = replace_once(
    text,
    'export async function listDeadLetterWebhookDeliveries(userId: string, workspaceId: string) {\n  await requireRole(workspaceId, userId);',
    'export async function listDeadLetterWebhookDeliveries(userId: string, workspaceId: string) {\n  await requireRole(workspaceId, userId, AUDIT_ROLES);',
    "dead letter list role",
)
text = replace_once(
    text,
    'export async function verifyReceipt(userId: string, input: { workspaceId: string; receiptId: string }) {\n  await requireRole(input.workspaceId, userId);',
    'export async function verifyReceipt(userId: string, input: { workspaceId: string; receiptId: string }) {\n  await requireRole(input.workspaceId, userId, AUDIT_ROLES);',
    "receipt verify role",
)
text = replace_once(
    text,
    '''  const parsed = new URL(input.url);
  if (parsed.protocol !== "https:") throw new Error("Webhook URL must use HTTPS");
  const client = await db();
  const { data, error } = await client.from("agent_authority_webhook_endpoints").insert({
    workspace_id: input.workspaceId,
    url: input.url,
    subscribed_events: [...new Set(input.subscribedEvents)],''',
    '''  const normalizedUrl = validateWebhookEndpointUrl(input.url);
  const subscribedEvents = validateWebhookSubscriptions(input.subscribedEvents);
  const client = await db();
  const { data, error } = await client.from("agent_authority_webhook_endpoints").insert({
    workspace_id: input.workspaceId,
    url: normalizedUrl,
    subscribed_events: subscribedEvents,''',
    "webhook endpoint validation",
)
text = replace_once(
    text,
    '.select("id,receipt_code,passport_id,action_key,target,authority_result,policy_code,policy_version,requested_at,human_approver_id,human_approved_at,executed_at,evidence_level,outcome,evidence_references,integrity_hash")',
    '.select("id,receipt_code,passport_id,passport_version,action_key,target,authority_result,policy_code,policy_version,requested_at,human_approver_id,human_approved_at,executed_at,evidence_level,outcome,evidence_references,integrity_hash")',
    "receipt verify version select",
)
text = replace_once(
    text,
    '''  const { data: passport, error: passportError } = await client.from("agent_passports").select("passport_code,agent_name").eq("workspace_id", input.workspaceId).eq("id", receipt.passport_id).single();
  if (passportError || !passport) throw passportError ?? new Error("Receipt Passport not found");
  return verifyAuthorizationReceipt({
    receiptCode: receipt.receipt_code,
    passportCode: passport.passport_code,
    agentName: passport.agent_name,''',
    '''  const identity = await loadPassportVersionIdentity({
    client,
    workspaceId: input.workspaceId,
    passportId: receipt.passport_id,
    passportVersion: Number(receipt.passport_version),
  });
  return verifyAuthorizationReceipt({
    receiptCode: receipt.receipt_code,
    passportCode: identity.passportCode,
    agentName: identity.agentName,''',
    "receipt verify historical identity",
)
governance_path.write_text(text)
print("Agent Authority source hardening patch applied")
