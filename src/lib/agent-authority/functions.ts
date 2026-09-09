import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ActionGateRequest, AgentLimits, AgentPermission, DataClassification, IncidentSeverity, IncidentStatus } from "./types";

export const createAuthorityWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./service.server");
    return service.createWorkspace(context.userId, data);
  });

export const registerAgentPassport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
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
  }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./service.server");
    return service.registerPassport(context.userId, data);
  });

export const submitAuthorityAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; passportId: string; request: ActionGateRequest }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./service.server");
    return service.submitAction(context.userId, data);
  });

export const resolveAuthorityApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; approvalRequestId: string; decision: "APPROVED" | "REJECTED"; note?: string | null }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./service.server");
    return service.resolveApproval(context.userId, data);
  });

export const reportAuthorityExecution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    workspaceId: string;
    actionRequestId: string;
    executionStatus: "EXECUTED" | "FAILED" | "CANCELLED";
    executedAt?: string | null;
    sourceSystem?: string | null;
    externalReference?: string | null;
    executionConfirmed?: boolean;
    signedEvidencePresent?: boolean;
    evidenceReferences?: string[];
  }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./service.server");
    return service.reportExecution(context.userId, data);
  });

export const suspendAgentPassport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; passportId: string; reason: string }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./service.server");
    return service.suspendPassport(context.userId, data);
  });

export const reinstateAgentPassport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; passportId: string; reason: string }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./service.server");
    return service.reinstatePassport(context.userId, data);
  });

export const reviewAgentPassport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    workspaceId: string;
    passportId: string;
    reviewType: "RECERTIFY" | "MODIFY_AND_REAUTHORIZE" | "SUSPEND" | "REVOKE";
    notes?: string | null;
  }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./service.server");
    return service.reviewPassport(context.userId, data);
  });

export const getAuthorityCommandCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./service.server");
    return service.listCommandCenter(context.userId, data.workspaceId);
  });

export const getAuthorityApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./service.server");
    return service.listApprovalQueue(context.userId, data.workspaceId);
  });

export const getEvidenceLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; passportId?: string | null; eventType?: string | null; limit?: number }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./service.server");
    return service.listEvidenceLedger(context.userId, data);
  });

export const createAuthorityApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; name: string; scopes: string[]; expiresAt?: string | null; rateLimitPerMinute?: number }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./service.server");
    return service.createWorkspaceApiKey(context.userId, data);
  });

export const exportAuthorityAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; organizationName: string; from?: string | null; to?: string | null; passportId?: string | null }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./service.server");
    return service.exportAudit(context.userId, data);
  });

export const listAuthorityWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const service = await import("./service.server");
    return service.listMyWorkspaces(context.userId);
  });

export const reviseAgentPassport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    workspaceId: string; passportId: string; changeReason: string; agentName: string; humanSponsor: string; department?: string | null;
    businessPurpose: string; provider?: string | null; model?: string | null; platform?: string | null;
    environment?: "development" | "staging" | "production" | "other"; authorizationExpiresAt?: string | null;
    reviewCadenceDays?: 30 | 60 | 90 | 180 | 365 | null; permissions: AgentPermission[]; limits: AgentLimits;
  }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./service.server");
    return service.revisePassport(context.userId, data);
  });

export const authorizeAgentPassport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; passportId: string; authorizationExpiresAt?: string | null }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./service.server");
    return service.authorizePassport(context.userId, data);
  });

// ---------------- Phase 1.5 governance hardening ----------------

export const getAgentPolicyDiff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; passportId: string; fromVersion?: number; toVersion?: number }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.getPassportPolicyDiff(context.userId, data);
  });

export const analyzeAgentLeastPrivilege = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; passportId: string; lookbackDays?: number }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.analyzePassportLeastPrivilege(context.userId, data);
  });

export const getAgentRiskScore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; passportId: string }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.getPassportRiskScore(context.userId, data);
  });

export const simulateAgentAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; passportId: string; request: ActionGateRequest }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.runShadowSimulation(context.userId, data);
  });

export const getShadowSimulations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; passportId?: string; limit?: number }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.listShadowSimulations(context.userId, data);
  });

export const saveDataClassification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; resourceKey: string; systemName?: string | null; displayName: string; classification: DataClassification; description?: string | null }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.upsertDataClassification(context.userId, data);
  });

export const getDataClassifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.listDataClassifications(context.userId, data.workspaceId);
  });

export const createAgentIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; passportId?: string | null; title: string; severity: IncidentSeverity; summary: string; ownerUserId?: string | null }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.createIncident(context.userId, data);
  });

export const containAgentIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; incidentId: string; containmentSummary: string; suspendPassport?: boolean }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.containIncident(context.userId, data);
  });

export const updateAgentIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; incidentId: string; status: Exclude<IncidentStatus, "CLOSED">; note: string; rootCause?: string | null; correctiveActions?: Array<{ action: string; owner?: string; dueAt?: string; status?: string }> }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.updateIncident(context.userId, data);
  });

export const closeAgentIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; incidentId: string; closureNote: string }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.closeIncident(context.userId, data);
  });

export const getAgentIncidents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; status?: IncidentStatus | null; limit?: number }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.listIncidents(context.userId, data);
  });

export const createAuthorityDelegation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; delegateUserId: string; purpose: string; actionKeys?: string[]; maxApprovalAmount?: number | null; startsAt?: string; endsAt: string; canRedelegate?: boolean; parentDelegationId?: string | null }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.createDelegation(context.userId, data);
  });

export const revokeAuthorityDelegation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; delegationId: string; reason: string }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.revokeDelegation(context.userId, data);
  });

export const getAuthorityDelegations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.listDelegations(context.userId, data.workspaceId);
  });

export const getPolicyChangeRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; status?: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | null }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.listPolicyChangeRequests(context.userId, data);
  });

export const resolvePolicyChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; requestId: string; decision: "APPROVED" | "REJECTED"; note?: string | null }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.resolvePolicyChangeRequest(context.userId, data);
  });

export const verifyAuthorityReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; receiptId: string }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.verifyReceipt(context.userId, data);
  });

export const getAuthorityApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.listApiKeys(context.userId, data.workspaceId);
  });

export const rotateAuthorityApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; apiKeyId: string; reason: string; expiresAt?: string | null }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.rotateApiKey(context.userId, data);
  });

export const revokeAuthorityApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; apiKeyId: string; reason: string }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.revokeApiKey(context.userId, data);
  });

export const createAuthorityWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; url: string; subscribedEvents: string[]; secretReference?: string | null; secretFingerprint?: string | null }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.createWebhookEndpoint(context.userId, data);
  });

export const getAuthorityWebhookHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.listWebhookHealth(context.userId, data.workspaceId);
  });


export const getDeadLetterWebhooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.listDeadLetterWebhookDeliveries(context.userId, data.workspaceId);
  });

export const replayAuthorityWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; deliveryId: string; reason: string }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.replayWebhookDelivery(context.userId, data);
  });

export const getGovernanceReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string }) => input)
  .handler(async ({ context, data }) => {
    const service = await import("./governance.service.server");
    return service.getGovernanceReadiness(context.userId, data.workspaceId);
  });
