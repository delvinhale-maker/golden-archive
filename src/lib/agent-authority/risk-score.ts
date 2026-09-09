import type { AgentPermission, AgentRiskScore, PassportPolicySnapshot, RiskFactorScore } from "./types";

const DESTRUCTIVE_HINTS = ["delete", "remove", "revoke", "purge", "terminate", "disable", "destroy", "permission", "role", "credential"];

function isDestructive(permission: AgentPermission) {
  const value = `${permission.actionKey} ${permission.label} ${permission.category ?? ""}`.toLowerCase();
  return DESTRUCTIVE_HINTS.some((hint) => value.includes(hint));
}

function maxMoney(passport: PassportPolicySnapshot): number | null {
  const values = [
    passport.limits.maxSinglePurchase,
    passport.limits.maxDailySpend,
    passport.limits.maxRefund,
    passport.limits.maxInvoice,
  ];
  if (values.some((value) => value == null)) return null;
  return Math.max(0, ...values.map((value) => Number(value ?? 0)));
}

function financialFactor(passport: PassportPolicySnapshot): RiskFactorScore {
  const policy = passport.limits.financialActionsPolicy;
  const max = maxMoney(passport);
  let points = policy === "BLOCK" ? 0 : policy === "APPROVAL_REQUIRED" ? 5 : 10;
  if (policy !== "BLOCK") {
    if (max == null) points = 20;
    else if (max > 10_000) points = Math.max(points, 19);
    else if (max > 1_000) points = Math.max(points, 16);
    else if (max > 100) points = Math.max(points, 13);
    else if (max > 0) points = Math.max(points, 9);
  }
  return {
    key: "FINANCIAL_AUTHORITY",
    label: "Financial authority",
    points,
    maxPoints: 20,
    explanation: policy === "BLOCK"
      ? "Direct financial actions are globally blocked."
      : max == null
        ? `${policy} financial authority has at least one uncapped monetary limit.`
        : `${policy} financial authority with a largest configured hard cap of ${passport.limits.currency} ${max.toLocaleString()}.`,
  };
}

function destructiveFactor(passport: PassportPolicySnapshot): RiskFactorScore {
  const destructive = passport.permissions.filter(isDestructive);
  const allow = destructive.filter((permission) => permission.decision === "ALLOW").length;
  const approval = destructive.filter((permission) => permission.decision === "APPROVAL_REQUIRED").length;
  const points = Math.min(15, allow * 7 + approval * 2);
  return {
    key: "DESTRUCTIVE_PERMISSIONS",
    label: "Destructive / administrative permissions",
    points,
    maxPoints: 15,
    explanation: destructive.length === 0
      ? "No destructive or access-administrative actions were detected."
      : `${allow} destructive/admin actions are ALLOW and ${approval} require approval.`,
  };
}

function sensitiveFactor(passport: PassportPolicySnapshot): RiskFactorScore {
  const policy = passport.limits.sensitiveDataPolicy;
  let points = policy === "BLOCK" ? 0 : policy === "APPROVAL_REQUIRED" ? 7 : 12;
  const classPolicy = passport.limits.dataClassificationPolicy ?? {};
  if (classPolicy.RESTRICTED === "ALLOW") points = 15;
  else if (classPolicy.RESTRICTED === "APPROVAL_REQUIRED") points = Math.max(points, 11);
  if (classPolicy.CONFIDENTIAL === "ALLOW") points = Math.max(points, 13);
  return {
    key: "SENSITIVE_DATA",
    label: "Sensitive data authority",
    points,
    maxPoints: 15,
    explanation: policy === "BLOCK"
      ? "Sensitive data is globally blocked unless an explicit data-classification override is configured."
      : `${policy} is the global sensitive-data policy; classification overrides are included in this score.`,
  };
}

function externalFactor(passport: PassportPolicySnapshot): RiskFactorScore {
  const policy = passport.limits.externalCommunicationPolicy;
  const points = policy === "BLOCK" ? 0 : policy === "APPROVAL_REQUIRED" ? 5 : 10;
  return {
    key: "EXTERNAL_COMMUNICATIONS",
    label: "External communications",
    points,
    maxPoints: 10,
    explanation: policy === "ALLOW"
      ? "External communications may execute without human approval."
      : policy === "APPROVAL_REQUIRED"
        ? "External communications require human approval."
        : "External communications are globally blocked.",
  };
}

function systemsFactor(passport: PassportPolicySnapshot): RiskFactorScore {
  const explicit = (passport.limits.allowedSystems ?? []).map((item) => item.trim().toLowerCase()).filter(Boolean);
  const permissionSystems = passport.permissions.map((item) => item.system?.trim().toLowerCase()).filter(Boolean) as string[];
  const systems = new Set(explicit.length > 0 ? explicit : permissionSystems);
  const count = systems.size;
  const points = count === 0 ? 1 : count <= 2 ? 2 : count <= 4 ? 4 : count <= 6 ? 6 : count <= 8 ? 8 : 10;
  return {
    key: "SYSTEM_COUNT",
    label: "Connected system scope",
    points,
    maxPoints: 10,
    explanation: explicit.length === 0 && permissionSystems.length > 0
      ? `${count} systems are referenced by permissions, but no explicit allowlist is configured.`
      : `${count} systems are within the Passport's explicit or inferred operating scope.`,
  };
}

function autonomyFactor(passport: PassportPolicySnapshot): RiskFactorScore {
  const executable = passport.permissions.filter((permission) => permission.decision !== "BLOCK");
  const allowed = executable.filter((permission) => permission.decision === "ALLOW").length;
  const ratio = executable.length === 0 ? 0 : allowed / executable.length;
  const points = Math.round(ratio * 20);
  return {
    key: "AUTONOMY",
    label: "Execution autonomy",
    points,
    maxPoints: 20,
    explanation: executable.length === 0
      ? "No executable permissions are configured."
      : `${allowed} of ${executable.length} executable permissions (${Math.round(ratio * 100)}%) can run without an action-level approval state.`,
  };
}

function staleReviewFactor(nextReviewAt: string | null | undefined, now: Date): RiskFactorScore {
  let points = 0;
  let explanation = "Authority review is currently within its configured review window.";
  if (!nextReviewAt) {
    points = 7;
    explanation = "No next authority review date is configured.";
  } else {
    const parsed = new Date(nextReviewAt);
    if (Number.isNaN(parsed.getTime())) {
      points = 10;
      explanation = "The next review date is invalid and cannot enforce review freshness.";
    } else if (parsed.getTime() <= now.getTime()) {
      const overdueDays = Math.floor((now.getTime() - parsed.getTime()) / 86_400_000);
      points = overdueDays >= 90 ? 10 : overdueDays >= 30 ? 8 : 5;
      explanation = `Authority review is overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"}.`;
    }
  }
  return {
    key: "STALE_REVIEW",
    label: "Review freshness",
    points,
    maxPoints: 10,
    explanation,
  };
}

export function calculateAgentRiskScore(input: {
  passport: PassportPolicySnapshot;
  nextReviewAt?: string | null;
  now?: Date;
}): AgentRiskScore {
  const now = input.now ?? new Date();
  const factors: RiskFactorScore[] = [
    financialFactor(input.passport),
    destructiveFactor(input.passport),
    sensitiveFactor(input.passport),
    externalFactor(input.passport),
    systemsFactor(input.passport),
    autonomyFactor(input.passport),
    staleReviewFactor(input.nextReviewAt, now),
  ];
  const score = Math.min(100, Math.max(0, factors.reduce((sum, factor) => sum + factor.points, 0)));
  const band: AgentRiskScore["band"] = score >= 75 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 25 ? "MODERATE" : "LOW";
  return { score, band, factors, calculatedAt: now.toISOString() };
}
