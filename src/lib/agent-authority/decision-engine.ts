import type {
  ActionGateRequest,
  ActionGateResult,
  AgentPermission,
  AuthorityDecision,
  DataClassification,
  DecisionReasonCode,
  PassportPolicySnapshot,
} from "./types";

const decisionRank: Record<AuthorityDecision, number> = {
  ALLOW: 0,
  APPROVAL_REQUIRED: 1,
  BLOCK: 2,
};

const defaultClassificationPolicy: Record<DataClassification, AuthorityDecision> = {
  PUBLIC: "ALLOW",
  INTERNAL: "ALLOW",
  CONFIDENTIAL: "BLOCK",
  RESTRICTED: "BLOCK",
};

function classificationDecision(
  passport: PassportPolicySnapshot,
  permission: AgentPermission,
  classification?: DataClassification | null,
): AuthorityDecision | null {
  if (!classification) return null;
  return (
    permission.dataClassificationPolicy?.[classification] ??
    passport.limits.dataClassificationPolicy?.[classification] ??
    defaultClassificationPolicy[classification]
  );
}

function normalizeSystem(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

function isExpired(expiresAt: string | null | undefined, now: Date): boolean {
  if (!expiresAt) return false;
  const expires = new Date(expiresAt);
  return Number.isNaN(expires.getTime()) || expires.getTime() <= now.getTime();
}

function result(
  passport: PassportPolicySnapshot,
  decision: AuthorityDecision,
  reasonCodes: DecisionReasonCode[],
  permission?: AgentPermission | null,
): ActionGateResult {
  const codes: DecisionReasonCode[] = reasonCodes.length > 0
    ? reasonCodes
    : [decision === "ALLOW" ? "BASE_ALLOW" : "ACTION_BLOCKED"];
  return {
    decision,
    reasonCodes: codes,
    primaryReason: codes[0],
    matchedActionKey: permission?.actionKey ?? null,
    policyVersion: passport.version,
    passportCode: passport.passportCode,
    approvalRole: decision === "APPROVAL_REQUIRED" ? permission?.approvalRole ?? "APPROVER" : null,
  };
}

function promote(
  current: AuthorityDecision,
  next: AuthorityDecision,
): AuthorityDecision {
  return decisionRank[next] > decisionRank[current] ? next : current;
}

/**
 * Deterministic, fail-closed Action Gate evaluator.
 *
 * Evaluation order:
 * 1. Passport validity/status/expiration.
 * 2. Permission existence.
 * 3. Hard system/data/financial prohibitions.
 * 4. Data-classification restrictions.
 * 5. Hard monetary limits.
 * 6. Action-level amount threshold.
 * 7. External/high-risk approval promotion.
 * 8. Base action authority.
 */
export function evaluateActionGate(
  passport: PassportPolicySnapshot,
  request: ActionGateRequest,
  now = new Date(request.requestedAt ?? Date.now()),
): ActionGateResult {
  if (passport.status === "SUSPENDED") return result(passport, "BLOCK", ["PASSPORT_SUSPENDED"]);
  if (passport.status === "REVOKED") return result(passport, "BLOCK", ["PASSPORT_REVOKED"]);
  if (passport.status !== "AUTHORIZED") return result(passport, "BLOCK", ["PASSPORT_NOT_AUTHORIZED"]);
  if (isExpired(passport.authorizationExpiresAt, now)) return result(passport, "BLOCK", ["PASSPORT_EXPIRED"]);

  const permission = passport.permissions.find((item) => item.actionKey === request.actionKey);
  if (!permission) return result(passport, "BLOCK", ["UNKNOWN_ACTION"]);

  const reasons: DecisionReasonCode[] = [];
  const limits = passport.limits;
  const requestedSystem = normalizeSystem(request.system ?? permission.system);
  const blockedSystems = new Set((limits.blockedSystems ?? []).map((item) => item.trim().toLowerCase()));
  const allowedSystems = new Set((limits.allowedSystems ?? []).map((item) => item.trim().toLowerCase()));

  if (requestedSystem && blockedSystems.has(requestedSystem)) {
    return result(passport, "BLOCK", ["SYSTEM_BLOCKED"], permission);
  }
  if (requestedSystem && allowedSystems.size > 0 && !allowedSystems.has(requestedSystem)) {
    return result(passport, "BLOCK", ["SYSTEM_NOT_ALLOWED"], permission);
  }

  if (request.financialAction && limits.financialActionsPolicy === "BLOCK") {
    return result(passport, "BLOCK", ["FINANCIAL_ACTION_PROHIBITED"], permission);
  }
  if (request.sensitiveData && limits.sensitiveDataPolicy === "BLOCK") {
    return result(passport, "BLOCK", ["SENSITIVE_DATA_PROHIBITED"], permission);
  }
  if (request.externalCommunication && limits.externalCommunicationPolicy === "BLOCK") {
    return result(passport, "BLOCK", ["EXTERNAL_COMMUNICATION_BLOCKED"], permission);
  }

  const classification = classificationDecision(passport, permission, request.dataClassification);
  if (classification === "BLOCK") {
    return result(passport, "BLOCK", ["DATA_CLASSIFICATION_BLOCKED"], permission);
  }

  const amount = request.amount ?? null;
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
    return result(passport, "BLOCK", ["ACTION_BLOCKED"], permission);
  }
  if (
    amount !== null &&
    request.currency &&
    limits.currency &&
    request.currency.toUpperCase() !== limits.currency.toUpperCase()
  ) {
    return result(passport, "BLOCK", ["CURRENCY_MISMATCH"], permission);
  }

  if (amount !== null) {
    if (request.amountKind === "PURCHASE" && limits.maxSinglePurchase != null && amount > limits.maxSinglePurchase) {
      return result(passport, "BLOCK", ["MAX_PURCHASE_EXCEEDED"], permission);
    }
    if (
      request.amountKind === "PURCHASE" &&
      limits.maxDailySpend != null &&
      (request.dailySpendToDate ?? 0) + amount > limits.maxDailySpend
    ) {
      return result(passport, "BLOCK", ["MAX_DAILY_SPEND_EXCEEDED"], permission);
    }
    if (request.amountKind === "REFUND" && limits.maxRefund != null && amount > limits.maxRefund) {
      return result(passport, "BLOCK", ["MAX_REFUND_EXCEEDED"], permission);
    }
    if (request.amountKind === "INVOICE" && limits.maxInvoice != null && amount > limits.maxInvoice) {
      return result(passport, "BLOCK", ["MAX_INVOICE_EXCEEDED"], permission);
    }
  }

  if (permission.decision === "BLOCK") {
    return result(passport, "BLOCK", ["ACTION_BLOCKED"], permission);
  }

  let finalDecision: AuthorityDecision = permission.decision;
  if (permission.decision === "APPROVAL_REQUIRED") reasons.push("BASE_APPROVAL_REQUIRED");

  if (amount !== null && permission.approvalAboveAmount != null && amount > permission.approvalAboveAmount) {
    finalDecision = promote(finalDecision, "APPROVAL_REQUIRED");
    reasons.push("ACTION_THRESHOLD_APPROVAL_REQUIRED");
  }
  if (request.financialAction && limits.financialActionsPolicy === "APPROVAL_REQUIRED") {
    finalDecision = promote(finalDecision, "APPROVAL_REQUIRED");
    reasons.push("FINANCIAL_ACTION_APPROVAL_REQUIRED");
  }
  if (request.sensitiveData && limits.sensitiveDataPolicy === "APPROVAL_REQUIRED") {
    finalDecision = promote(finalDecision, "APPROVAL_REQUIRED");
    reasons.push("SENSITIVE_DATA_APPROVAL_REQUIRED");
  }
  if (request.externalCommunication && limits.externalCommunicationPolicy === "APPROVAL_REQUIRED") {
    finalDecision = promote(finalDecision, "APPROVAL_REQUIRED");
    reasons.push("EXTERNAL_COMMUNICATION_APPROVAL_REQUIRED");
  }
  if (request.highRisk && limits.highRiskRequiresApproval) {
    finalDecision = promote(finalDecision, "APPROVAL_REQUIRED");
    reasons.push("HIGH_RISK_APPROVAL_REQUIRED");
  }
  if (classification === "APPROVAL_REQUIRED") {
    finalDecision = promote(finalDecision, "APPROVAL_REQUIRED");
    reasons.push("DATA_CLASSIFICATION_APPROVAL_REQUIRED");
  }

  if (finalDecision === "ALLOW") reasons.push("BASE_ALLOW");
  return result(passport, finalDecision, reasons, permission);
}
