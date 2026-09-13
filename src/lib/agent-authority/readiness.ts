import type { GovernanceReadinessMetric, GovernanceReadinessScore, GovernanceSeverity } from "./types";

export interface GovernanceReadinessInput {
  overdueReviews: number;
  expiredAgents: number;
  highRiskPassports: number;
  unusedPermissions: number;
  pendingApprovals: number;
  openIncidents: number;
  criticalIncidents?: number;
  webhookFailures: number;
  deadLetterWebhooks?: number;
  receiptsWithoutVerifiedEvidence: number;
  totalReceipts: number;
}

const severityWeight: Record<GovernanceSeverity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 4,
  CRITICAL: 8,
};

function metric(key: string, label: string, count: number, severity: GovernanceSeverity, explanation: string): GovernanceReadinessMetric {
  return { key, label, count: Math.max(0, count), severity, explanation };
}

export function calculateGovernanceReadiness(input: GovernanceReadinessInput, now = new Date()): GovernanceReadinessScore {
  const metrics: GovernanceReadinessMetric[] = [
    metric("overdue_reviews", "Overdue authority reviews", input.overdueReviews, input.overdueReviews ? "HIGH" : "INFO", "Passports with overdue recertification should not remain unattended."),
    metric("expired_agents", "Expired Passports", input.expiredAgents, input.expiredAgents ? "HIGH" : "INFO", "Expired authorization is fail-closed and blocks future Action Gate requests."),
    metric("high_risk_passports", "High/Critical risk Passports", input.highRiskPassports, input.highRiskPassports ? "HIGH" : "INFO", "Explainable risk scoring identified Passports with broad or consequential authority."),
    metric("unused_permissions", "Unused permissions", input.unusedPermissions, input.unusedPermissions ? "MEDIUM" : "INFO", "Unused authority is a least-privilege reduction opportunity."),
    metric("pending_approvals", "Pending approvals", input.pendingApprovals, input.pendingApprovals >= 10 ? "MEDIUM" : input.pendingApprovals ? "LOW" : "INFO", "Pending approvals represent unresolved execution dependencies."),
    metric("open_incidents", "Open incidents", input.openIncidents, input.openIncidents ? "HIGH" : "INFO", "Open governance incidents should have an owner, containment status and corrective action."),
    metric("critical_incidents", "Critical incidents", input.criticalIncidents ?? 0, (input.criticalIncidents ?? 0) ? "CRITICAL" : "INFO", "Critical incidents indicate material governance exposure."),
    metric("webhook_failures", "Webhook failures", input.webhookFailures, input.webhookFailures >= 5 ? "MEDIUM" : input.webhookFailures ? "LOW" : "INFO", "Delivery failures can prevent downstream systems from receiving governance events."),
    metric("dead_letter_webhooks", "Dead-letter webhook deliveries", input.deadLetterWebhooks ?? 0, (input.deadLetterWebhooks ?? 0) ? "HIGH" : "INFO", "Dead-letter deliveries exhausted automatic retries and require authorized review/replay."),
    metric("unverified_receipts", "Receipts without verified execution evidence", input.receiptsWithoutVerifiedEvidence, input.receiptsWithoutVerifiedEvidence ? "MEDIUM" : "INFO", "Declared or approval-only receipts are valid records but are not independent execution confirmation."),
  ];

  let penalty = 0;
  for (const item of metrics) {
    if (item.count <= 0) continue;
    const cappedCount = Math.min(item.count, 10);
    penalty += severityWeight[item.severity] * Math.min(3, Math.ceil(cappedCount / 2));
  }
  if (input.totalReceipts > 0) {
    const unverifiedRatio = input.receiptsWithoutVerifiedEvidence / input.totalReceipts;
    penalty += Math.round(Math.min(15, unverifiedRatio * 15));
  }
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const band: GovernanceReadinessScore["band"] = score >= 85 ? "READY" : score >= 65 ? "ATTENTION" : score >= 40 ? "AT_RISK" : "CRITICAL";
  return { score, band, metrics, calculatedAt: now.toISOString() };
}
