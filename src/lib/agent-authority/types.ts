export type AuthorityDecision = "ALLOW" | "APPROVAL_REQUIRED" | "BLOCK";
export type PassportStatus = "DRAFT" | "AUTHORIZED" | "SUSPENDED" | "EXPIRED" | "REVOKED";
export type EvidenceLevel = "DECLARED" | "APPROVAL_VERIFIED" | "EXECUTION_VERIFIED" | "SIGNED_EVIDENCE";
export type AmountKind = "PURCHASE" | "REFUND" | "INVOICE" | "OTHER";
export type DataClassification = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
export type GovernanceSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type DecisionReasonCode =
  | "PASSPORT_NOT_AUTHORIZED"
  | "PASSPORT_SUSPENDED"
  | "PASSPORT_REVOKED"
  | "PASSPORT_EXPIRED"
  | "UNKNOWN_ACTION"
  | "ACTION_BLOCKED"
  | "SYSTEM_BLOCKED"
  | "SYSTEM_NOT_ALLOWED"
  | "FINANCIAL_ACTION_PROHIBITED"
  | "FINANCIAL_ACTION_APPROVAL_REQUIRED"
  | "SENSITIVE_DATA_PROHIBITED"
  | "SENSITIVE_DATA_APPROVAL_REQUIRED"
  | "EXTERNAL_COMMUNICATION_BLOCKED"
  | "EXTERNAL_COMMUNICATION_APPROVAL_REQUIRED"
  | "HIGH_RISK_APPROVAL_REQUIRED"
  | "DATA_CLASSIFICATION_BLOCKED"
  | "DATA_CLASSIFICATION_APPROVAL_REQUIRED"
  | "CURRENCY_MISMATCH"
  | "MAX_PURCHASE_EXCEEDED"
  | "MAX_DAILY_SPEND_EXCEEDED"
  | "MAX_REFUND_EXCEEDED"
  | "MAX_INVOICE_EXCEEDED"
  | "ACTION_THRESHOLD_APPROVAL_REQUIRED"
  | "BASE_APPROVAL_REQUIRED"
  | "BASE_ALLOW";

export interface AgentPermission {
  actionKey: string;
  label: string;
  system?: string | null;
  category?: string | null;
  decision: AuthorityDecision;
  approvalRole?: "OWNER" | "ADMIN" | "APPROVER" | null;
  approvalAboveAmount?: number | null;
  /** Per-action override. If omitted, the Passport-level classification policy applies. */
  dataClassificationPolicy?: Partial<Record<DataClassification, AuthorityDecision>>;
  notes?: string | null;
}

export interface AgentLimits {
  currency: string;
  maxSinglePurchase?: number | null;
  maxDailySpend?: number | null;
  maxRefund?: number | null;
  maxInvoice?: number | null;
  externalCommunicationPolicy: AuthorityDecision;
  financialActionsPolicy: AuthorityDecision;
  sensitiveDataPolicy: AuthorityDecision;
  highRiskRequiresApproval: boolean;
  allowedSystems?: string[];
  blockedSystems?: string[];
  /** Default policy for resources by classification. Unspecified classes fail closed above INTERNAL. */
  dataClassificationPolicy?: Partial<Record<DataClassification, AuthorityDecision>>;
}

export interface PassportPolicySnapshot {
  passportId: string;
  passportCode: string;
  organizationId: string;
  version: number;
  status: PassportStatus;
  authorizedAt?: string | null;
  authorizationExpiresAt?: string | null;
  permissions: AgentPermission[];
  limits: AgentLimits;
}

export interface ActionGateRequest {
  actionKey: string;
  target?: string | null;
  resourceKey?: string | null;
  system?: string | null;
  amount?: number | null;
  amountKind?: AmountKind | null;
  currency?: string | null;
  dailySpendToDate?: number | null;
  externalCommunication?: boolean;
  financialAction?: boolean;
  sensitiveData?: boolean;
  highRisk?: boolean;
  dataClassification?: DataClassification | null;
  requestedAt?: string;
  idempotencyKey: string;
}

export interface ActionGateResult {
  decision: AuthorityDecision;
  reasonCodes: DecisionReasonCode[];
  primaryReason: DecisionReasonCode;
  matchedActionKey: string | null;
  policyVersion: number;
  passportCode: string;
  approvalRole: "OWNER" | "ADMIN" | "APPROVER" | null;
}

export interface AuthorizationReceiptInput {
  receiptCode: string;
  passportCode: string;
  agentName: string;
  actionKey: string;
  target?: string | null;
  authorityResult: AuthorityDecision;
  policyCode: string;
  policyVersion: number;
  requestedAt: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  executedAt?: string | null;
  executionConfirmed: boolean;
  signedEvidencePresent: boolean;
  evidenceLevel: EvidenceLevel;
  outcome: string;
  evidenceReferences?: string[];
}

export interface PolicyIdentitySnapshot {
  agentName: string;
  humanSponsor: string;
  department?: string | null;
  businessPurpose: string;
  provider?: string | null;
  model?: string | null;
  platform?: string | null;
  environment?: string | null;
}

export type PolicyChangeDirection = "INCREASE" | "DECREASE" | "LATERAL";
export type PolicyChangeKind =
  | "PERMISSION_ADDED"
  | "PERMISSION_REMOVED"
  | "PERMISSION_DECISION"
  | "PERMISSION_THRESHOLD"
  | "DATA_CLASSIFICATION"
  | "MONETARY_LIMIT"
  | "GLOBAL_POLICY"
  | "SYSTEM_SCOPE"
  | "IDENTITY";

export interface PolicyDiffItem {
  key: string;
  label: string;
  kind: PolicyChangeKind;
  direction: PolicyChangeDirection;
  before: unknown;
  after: unknown;
  material: boolean;
  requiresApproval: boolean;
  reason: string;
}

export interface PolicyDiffResult {
  changes: PolicyDiffItem[];
  increases: number;
  decreases: number;
  lateral: number;
  hasMaterialIncrease: boolean;
  requiresPolicyChangeApproval: boolean;
  requiresReauthorization: boolean;
}

export interface PermissionUsageStat {
  actionKey: string;
  totalEvaluations: number;
  allowedCount: number;
  approvalRequiredCount: number;
  blockedCount: number;
  executionCount: number;
  lastEvaluatedAt?: string | null;
  lastExecutedAt?: string | null;
}

export interface LeastPrivilegeFinding {
  id: string;
  actionKey?: string | null;
  severity: GovernanceSeverity;
  category: "UNUSED" | "STALE" | "EXCESSIVE" | "HIGH_RISK" | "OVERBROAD_SYSTEM_SCOPE" | "DATA_ACCESS";
  title: string;
  explanation: string;
  recommendation: string;
  currentDecision?: AuthorityDecision | null;
  suggestedDecision?: AuthorityDecision | null;
}

export interface LeastPrivilegeAnalysis {
  findings: LeastPrivilegeFinding[];
  findingCount: number;
  highOrCriticalCount: number;
  analyzedAt: string;
  lookbackDays: number;
}

export interface RiskFactorScore {
  key:
    | "FINANCIAL_AUTHORITY"
    | "DESTRUCTIVE_PERMISSIONS"
    | "SENSITIVE_DATA"
    | "EXTERNAL_COMMUNICATIONS"
    | "SYSTEM_COUNT"
    | "AUTONOMY"
    | "STALE_REVIEW";
  label: string;
  points: number;
  maxPoints: number;
  explanation: string;
}

export interface AgentRiskScore {
  score: number;
  band: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  factors: RiskFactorScore[];
  calculatedAt: string;
}

export interface ShadowSimulationResult {
  mode: "SHADOW";
  executable: false;
  simulatedAt: string;
  request: ActionGateRequest;
  result: ActionGateResult;
}

export type ReceiptVerificationStatus = "VALID" | "TAMPERED" | "INCOMPLETE";
export interface ReceiptVerificationResult {
  status: ReceiptVerificationStatus;
  storedHash?: string | null;
  recomputedHash?: string | null;
  missingFields: string[];
  verifiedAt: string;
}

export type IncidentStatus = "OPEN" | "CONTAINED" | "INVESTIGATING" | "REMEDIATING" | "RESOLVED" | "CLOSED";
export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface GovernanceReadinessMetric {
  key: string;
  label: string;
  count: number;
  severity: GovernanceSeverity;
  explanation: string;
}

export interface GovernanceReadinessScore {
  score: number;
  band: "READY" | "ATTENTION" | "AT_RISK" | "CRITICAL";
  metrics: GovernanceReadinessMetric[];
  calculatedAt: string;
}
