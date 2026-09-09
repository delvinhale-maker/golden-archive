import type {
  AgentLimits,
  AgentPermission,
  GovernanceSeverity,
  LeastPrivilegeAnalysis,
  LeastPrivilegeFinding,
  PermissionUsageStat,
} from "./types";

const DESTRUCTIVE_HINTS = ["delete", "remove", "revoke", "purge", "terminate", "disable", "destroy"];
const FINANCIAL_HINTS = ["refund", "purchase", "payment", "invoice", "charge", "transfer", "payout", "credit"];
const EXTERNAL_HINTS = ["send", "publish", "post", "message", "email", "proposal", "notify"];
const ADMIN_HINTS = ["permission", "role", "admin", "credential", "api_key", "token", "access"];

function hasHint(permission: AgentPermission, hints: string[]) {
  const text = `${permission.actionKey} ${permission.label} ${permission.category ?? ""}`.toLowerCase();
  return hints.some((hint) => text.includes(hint));
}

function daysSince(value: string | null | undefined, now: Date): number | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - parsed.getTime()) / 86_400_000));
}

function findingSeverity(permission: AgentPermission): GovernanceSeverity {
  if (permission.decision === "ALLOW" && (hasHint(permission, DESTRUCTIVE_HINTS) || hasHint(permission, ADMIN_HINTS))) return "CRITICAL";
  if (permission.decision === "ALLOW" && hasHint(permission, FINANCIAL_HINTS)) return "HIGH";
  if (permission.decision === "ALLOW" && hasHint(permission, EXTERNAL_HINTS)) return "HIGH";
  if (permission.decision === "ALLOW") return "MEDIUM";
  if (permission.decision === "APPROVAL_REQUIRED") return "LOW";
  return "INFO";
}

function recommendRestrict(permission: AgentPermission): AgentPermission["decision"] {
  if (permission.decision === "ALLOW") return "APPROVAL_REQUIRED";
  if (permission.decision === "APPROVAL_REQUIRED") return "BLOCK";
  return "BLOCK";
}

export function analyzeLeastPrivilege(input: {
  permissions: AgentPermission[];
  limits: AgentLimits;
  usage: PermissionUsageStat[];
  lookbackDays?: number;
  staleDays?: number;
  now?: Date;
}): LeastPrivilegeAnalysis {
  const now = input.now ?? new Date();
  const lookbackDays = Math.max(7, input.lookbackDays ?? 90);
  const staleDays = Math.max(lookbackDays, input.staleDays ?? 180);
  const usageByAction = new Map(input.usage.map((stat) => [stat.actionKey, stat]));
  const findings: LeastPrivilegeFinding[] = [];

  for (const permission of input.permissions) {
    if (permission.decision === "BLOCK") continue;
    const usage = usageByAction.get(permission.actionKey);
    const evaluations = usage?.totalEvaluations ?? 0;
    const executions = usage?.executionCount ?? 0;
    const lastActivity = usage?.lastExecutedAt ?? usage?.lastEvaluatedAt ?? null;
    const ageDays = daysSince(lastActivity, now);

    if (evaluations === 0) {
      findings.push({
        id: `unused:${permission.actionKey}`,
        actionKey: permission.actionKey,
        severity: findingSeverity(permission),
        category: "UNUSED",
        title: `${permission.label} has no observed use`,
        explanation: `This ${permission.decision} permission has no recorded evaluations in the analyzed activity set. Unused authority increases attack surface without demonstrated business need.`,
        recommendation: permission.decision === "ALLOW" ? "Downgrade to APPROVAL_REQUIRED or BLOCK until a real need is demonstrated." : "Consider BLOCK unless there is a documented near-term use case.",
        currentDecision: permission.decision,
        suggestedDecision: recommendRestrict(permission),
      });
    } else if (ageDays != null && ageDays >= staleDays) {
      findings.push({
        id: `stale:${permission.actionKey}`,
        actionKey: permission.actionKey,
        severity: permission.decision === "ALLOW" ? "HIGH" : "MEDIUM",
        category: "STALE",
        title: `${permission.label} authority is stale`,
        explanation: `The most recent recorded use was ${ageDays} days ago, beyond the ${staleDays}-day stale threshold.`,
        recommendation: "Require re-justification and reduce the permission unless the owner confirms it is still needed.",
        currentDecision: permission.decision,
        suggestedDecision: recommendRestrict(permission),
      });
    }

    if (permission.decision === "ALLOW" && (hasHint(permission, DESTRUCTIVE_HINTS) || hasHint(permission, ADMIN_HINTS))) {
      findings.push({
        id: `high-risk:${permission.actionKey}`,
        actionKey: permission.actionKey,
        severity: "CRITICAL",
        category: "HIGH_RISK",
        title: `${permission.label} executes without approval`,
        explanation: "This action appears destructive or access-administrative and currently has direct execution authority.",
        recommendation: "Require human approval or block the action. Destructive and permission-management actions should rarely execute autonomously in an SMB environment.",
        currentDecision: permission.decision,
        suggestedDecision: "APPROVAL_REQUIRED",
      });
    } else if (permission.decision === "ALLOW" && hasHint(permission, FINANCIAL_HINTS)) {
      findings.push({
        id: `financial:${permission.actionKey}`,
        actionKey: permission.actionKey,
        severity: "HIGH",
        category: "EXCESSIVE",
        title: `${permission.label} has autonomous financial authority`,
        explanation: "Financial actions can create direct monetary loss and should be tightly bounded even when the amount is small.",
        recommendation: "Use APPROVAL_REQUIRED and a low hard amount cap unless autonomous execution is explicitly justified.",
        currentDecision: permission.decision,
        suggestedDecision: "APPROVAL_REQUIRED",
      });
    }

    if (permission.decision === "ALLOW" && executions === 0 && evaluations > 0 && evaluations >= 5) {
      findings.push({
        id: `observed-not-executed:${permission.actionKey}`,
        actionKey: permission.actionKey,
        severity: "MEDIUM",
        category: "EXCESSIVE",
        title: `${permission.label} is evaluated but never executed`,
        explanation: `The action was evaluated ${evaluations} times but has no execution evidence. The direct ALLOW state may be broader than operational behavior requires.`,
        recommendation: "Consider APPROVAL_REQUIRED until execution need is demonstrated with verified evidence.",
        currentDecision: permission.decision,
        suggestedDecision: "APPROVAL_REQUIRED",
      });
    }
  }

  const allowedSystems = new Set((input.limits.allowedSystems ?? []).map((item) => item.trim().toLowerCase()).filter(Boolean));
  if (allowedSystems.size === 0 && input.permissions.some((permission) => permission.decision !== "BLOCK" && permission.system)) {
    findings.push({
      id: "systems:no-allowlist",
      severity: "HIGH",
      category: "OVERBROAD_SYSTEM_SCOPE",
      title: "No system allowlist is enforced",
      explanation: "The Passport contains executable permissions tied to named systems, but the Authority Limits layer has no allowlist. An unrecognized system can therefore rely on action-level rules alone.",
      recommendation: "Define the exact systems this agent is allowed to access and fail closed for every other system.",
    });
  } else if (allowedSystems.size > 8) {
    findings.push({
      id: "systems:wide-allowlist",
      severity: "MEDIUM",
      category: "OVERBROAD_SYSTEM_SCOPE",
      title: `System access spans ${allowedSystems.size} systems`,
      explanation: "A wide integration footprint increases the blast radius of a compromised or misconfigured agent.",
      recommendation: "Split responsibilities across narrower Passports or remove systems not required for the agent's primary job.",
    });
  }

  const dataPolicy = input.limits.dataClassificationPolicy ?? {};
  if (dataPolicy.RESTRICTED === "ALLOW") {
    findings.push({
      id: "data:restricted-autonomous",
      severity: "CRITICAL",
      category: "DATA_ACCESS",
      title: "Restricted data can be accessed without approval",
      explanation: "The default Passport policy grants ALLOW for RESTRICTED data, the highest sensitivity classification.",
      recommendation: "Set RESTRICTED to BLOCK or, only when necessary, APPROVAL_REQUIRED.",
    });
  }
  if (dataPolicy.CONFIDENTIAL === "ALLOW") {
    findings.push({
      id: "data:confidential-autonomous",
      severity: "HIGH",
      category: "DATA_ACCESS",
      title: "Confidential data can be accessed without approval",
      explanation: "The default Passport policy grants autonomous authority over CONFIDENTIAL data.",
      recommendation: "Use APPROVAL_REQUIRED for confidential data unless there is a documented least-privilege exception.",
    });
  }

  const severityRank: Record<GovernanceSeverity, number> = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  findings.sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || a.title.localeCompare(b.title));
  return {
    findings,
    findingCount: findings.length,
    highOrCriticalCount: findings.filter((finding) => finding.severity === "HIGH" || finding.severity === "CRITICAL").length,
    analyzedAt: now.toISOString(),
    lookbackDays,
  };
}
