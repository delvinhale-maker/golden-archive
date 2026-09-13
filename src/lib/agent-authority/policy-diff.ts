import type {
  AgentLimits,
  AgentPermission,
  AuthorityDecision,
  DataClassification,
  PolicyDiffItem,
  PolicyDiffResult,
  PolicyIdentitySnapshot,
} from "./types";

const authorityRank: Record<AuthorityDecision, number> = {
  BLOCK: 0,
  APPROVAL_REQUIRED: 1,
  ALLOW: 2,
};

const defaultClassificationPolicy: Record<DataClassification, AuthorityDecision> = {
  PUBLIC: "ALLOW",
  INTERNAL: "ALLOW",
  CONFIDENTIAL: "BLOCK",
  RESTRICTED: "BLOCK",
};

function direction(before: number, after: number): "INCREASE" | "DECREASE" | "LATERAL" {
  if (after > before) return "INCREASE";
  if (after < before) return "DECREASE";
  return "LATERAL";
}

function add(
  changes: PolicyDiffItem[],
  input: Omit<PolicyDiffItem, "material" | "requiresApproval"> & { material?: boolean; requiresApproval?: boolean },
) {
  changes.push({
    ...input,
    material: input.material ?? true,
    requiresApproval: input.requiresApproval ?? input.direction === "INCREASE",
  });
}

function moneyAuthority(value: number | null | undefined): number {
  // null means uncapped, therefore more permissive than any finite limit.
  if (value == null) return Number.POSITIVE_INFINITY;
  return Math.max(0, value);
}

function compareDecision(
  changes: PolicyDiffItem[],
  key: string,
  label: string,
  kind: PolicyDiffItem["kind"],
  before: AuthorityDecision,
  after: AuthorityDecision,
  reason: string,
) {
  if (before === after) return;
  const dir = direction(authorityRank[before], authorityRank[after]);
  add(changes, { key, label, kind, direction: dir, before, after, reason });
}

function classificationDecision(
  permission: AgentPermission | undefined,
  limits: AgentLimits,
  classification: DataClassification,
): AuthorityDecision {
  return (
    permission?.dataClassificationPolicy?.[classification] ??
    limits.dataClassificationPolicy?.[classification] ??
    defaultClassificationPolicy[classification]
  );
}

function normalizeStrings(values: string[] | undefined): Set<string> {
  return new Set((values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean));
}

export interface PolicyVersionForDiff {
  identity?: PolicyIdentitySnapshot | null;
  permissions: AgentPermission[];
  limits: AgentLimits;
}

/**
 * Explainable policy diff. Authority increases are the changes that can widen what
 * an agent may do, lower the friction before execution, expand system/data scope,
 * or raise/remove hard monetary caps.
 */
export function diffPolicyVersions(before: PolicyVersionForDiff, after: PolicyVersionForDiff): PolicyDiffResult {
  const changes: PolicyDiffItem[] = [];
  const beforePermissions = new Map(before.permissions.map((permission) => [permission.actionKey, permission]));
  const afterPermissions = new Map(after.permissions.map((permission) => [permission.actionKey, permission]));
  const actionKeys = new Set([...beforePermissions.keys(), ...afterPermissions.keys()]);

  for (const actionKey of [...actionKeys].sort()) {
    const oldPermission = beforePermissions.get(actionKey);
    const newPermission = afterPermissions.get(actionKey);
    if (!oldPermission && newPermission) {
      const dir = newPermission.decision === "BLOCK" ? "LATERAL" : "INCREASE";
      add(changes, {
        key: `permission:${actionKey}`,
        label: newPermission.label,
        kind: "PERMISSION_ADDED",
        direction: dir,
        before: null,
        after: newPermission.decision,
        reason: dir === "INCREASE" ? "A previously undefined action gains executable authority." : "A new action is explicitly blocked.",
        requiresApproval: dir === "INCREASE",
      });
      continue;
    }
    if (oldPermission && !newPermission) {
      const dir = oldPermission.decision === "BLOCK" ? "LATERAL" : "DECREASE";
      add(changes, {
        key: `permission:${actionKey}`,
        label: oldPermission.label,
        kind: "PERMISSION_REMOVED",
        direction: dir,
        before: oldPermission.decision,
        after: null,
        reason: dir === "DECREASE" ? "An executable permission is removed and will fail closed." : "An explicit block is removed, but the missing action still fails closed.",
        requiresApproval: false,
      });
      continue;
    }
    if (!oldPermission || !newPermission) continue;

    compareDecision(
      changes,
      `permission:${actionKey}:decision`,
      newPermission.label,
      "PERMISSION_DECISION",
      oldPermission.decision,
      newPermission.decision,
      "The action's base authority changed.",
    );

    const oldThreshold = oldPermission.approvalAboveAmount;
    const newThreshold = newPermission.approvalAboveAmount;
    if ((oldThreshold ?? null) !== (newThreshold ?? null)) {
      const oldAuthority = oldThreshold == null ? Number.POSITIVE_INFINITY : oldThreshold;
      const newAuthority = newThreshold == null ? Number.POSITIVE_INFINITY : newThreshold;
      const dir = direction(oldAuthority, newAuthority);
      add(changes, {
        key: `permission:${actionKey}:threshold`,
        label: `${newPermission.label} approval threshold`,
        kind: "PERMISSION_THRESHOLD",
        direction: dir,
        before: oldThreshold ?? null,
        after: newThreshold ?? null,
        reason: dir === "INCREASE" ? "Human approval is required less often for this action." : "Human approval is required at a lower threshold.",
      });
    }

    for (const classification of ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"] as DataClassification[]) {
      const oldDecision = classificationDecision(oldPermission, before.limits, classification);
      const newDecision = classificationDecision(newPermission, after.limits, classification);
      if (oldDecision === newDecision) continue;
      compareDecision(
        changes,
        `permission:${actionKey}:classification:${classification}`,
        `${newPermission.label} · ${classification}`,
        "DATA_CLASSIFICATION",
        oldDecision,
        newDecision,
        `Authority for ${classification.toLowerCase()} data changed for this action.`,
      );
    }
  }

  const moneyFields: Array<[keyof AgentLimits, string]> = [
    ["maxSinglePurchase", "Maximum single purchase"],
    ["maxDailySpend", "Maximum daily spend"],
    ["maxRefund", "Maximum refund"],
    ["maxInvoice", "Maximum invoice"],
  ];
  for (const [field, label] of moneyFields) {
    const oldValue = before.limits[field] as number | null | undefined;
    const newValue = after.limits[field] as number | null | undefined;
    if ((oldValue ?? null) === (newValue ?? null)) continue;
    const dir = direction(moneyAuthority(oldValue), moneyAuthority(newValue));
    add(changes, {
      key: `limits:${String(field)}`,
      label,
      kind: "MONETARY_LIMIT",
      direction: dir,
      before: oldValue ?? null,
      after: newValue ?? null,
      reason: dir === "INCREASE" ? "The agent can act on a larger monetary amount before the hard cap blocks it." : "The monetary hard cap is reduced.",
    });
  }

  const globalPolicies: Array<[keyof AgentLimits, string]> = [
    ["externalCommunicationPolicy", "External communication policy"],
    ["financialActionsPolicy", "Financial actions policy"],
    ["sensitiveDataPolicy", "Sensitive data policy"],
  ];
  for (const [field, label] of globalPolicies) {
    compareDecision(
      changes,
      `limits:${String(field)}`,
      label,
      "GLOBAL_POLICY",
      before.limits[field] as AuthorityDecision,
      after.limits[field] as AuthorityDecision,
      "A global authority policy changed.",
    );
  }

  if (before.limits.highRiskRequiresApproval !== after.limits.highRiskRequiresApproval) {
    const dir = after.limits.highRiskRequiresApproval ? "DECREASE" : "INCREASE";
    add(changes, {
      key: "limits:highRiskRequiresApproval",
      label: "High-risk human approval",
      kind: "GLOBAL_POLICY",
      direction: dir,
      before: before.limits.highRiskRequiresApproval,
      after: after.limits.highRiskRequiresApproval,
      reason: dir === "INCREASE" ? "High-risk actions no longer automatically require approval." : "High-risk actions now require human approval.",
    });
  }

  const oldAllowed = normalizeStrings(before.limits.allowedSystems);
  const newAllowed = normalizeStrings(after.limits.allowedSystems);
  if ([...oldAllowed].sort().join("|") !== [...newAllowed].sort().join("|")) {
    let dir: "INCREASE" | "DECREASE" | "LATERAL" = "LATERAL";
    if (oldAllowed.size === 0 && newAllowed.size > 0) dir = "DECREASE";
    else if (oldAllowed.size > 0 && newAllowed.size === 0) dir = "INCREASE";
    else if ([...newAllowed].some((item) => !oldAllowed.has(item))) dir = "INCREASE";
    else dir = "DECREASE";
    add(changes, {
      key: "limits:allowedSystems",
      label: "Allowed systems",
      kind: "SYSTEM_SCOPE",
      direction: dir,
      before: [...oldAllowed].sort(),
      after: [...newAllowed].sort(),
      reason: dir === "INCREASE" ? "The system allow-scope is broader." : "The system allow-scope is narrower.",
    });
  }

  const oldBlocked = normalizeStrings(before.limits.blockedSystems);
  const newBlocked = normalizeStrings(after.limits.blockedSystems);
  if ([...oldBlocked].sort().join("|") !== [...newBlocked].sort().join("|")) {
    const removedBlock = [...oldBlocked].some((item) => !newBlocked.has(item));
    const addedBlock = [...newBlocked].some((item) => !oldBlocked.has(item));
    const dir = removedBlock ? "INCREASE" : addedBlock ? "DECREASE" : "LATERAL";
    add(changes, {
      key: "limits:blockedSystems",
      label: "Blocked systems",
      kind: "SYSTEM_SCOPE",
      direction: dir,
      before: [...oldBlocked].sort(),
      after: [...newBlocked].sort(),
      reason: dir === "INCREASE" ? "At least one previously blocked system is no longer blocked." : "Additional systems are explicitly blocked.",
    });
  }

  for (const classification of ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"] as DataClassification[]) {
    const oldDecision = before.limits.dataClassificationPolicy?.[classification] ?? defaultClassificationPolicy[classification];
    const newDecision = after.limits.dataClassificationPolicy?.[classification] ?? defaultClassificationPolicy[classification];
    if (oldDecision === newDecision) continue;
    compareDecision(
      changes,
      `limits:classification:${classification}`,
      `${classification} data default policy`,
      "DATA_CLASSIFICATION",
      oldDecision,
      newDecision,
      `The Passport-wide default for ${classification.toLowerCase()} data changed.`,
    );
  }

  const oldIdentity = before.identity ?? null;
  const newIdentity = after.identity ?? null;
  if (oldIdentity && newIdentity) {
    const identityFields: Array<[keyof PolicyIdentitySnapshot, string]> = [
      ["humanSponsor", "Human sponsor"],
      ["businessPurpose", "Business purpose"],
      ["provider", "Provider"],
      ["model", "Model"],
      ["platform", "Platform / integration"],
      ["environment", "Environment"],
    ];
    for (const [field, label] of identityFields) {
      const oldValue = oldIdentity[field] ?? null;
      const newValue = newIdentity[field] ?? null;
      if (oldValue === newValue) continue;
      add(changes, {
        key: `identity:${String(field)}`,
        label,
        kind: "IDENTITY",
        direction: "LATERAL",
        before: oldValue,
        after: newValue,
        reason: "A material Passport identity/purpose attribute changed and must be reauthorized.",
        material: true,
        requiresApproval: false,
      });
    }
  }

  const increases = changes.filter((change) => change.direction === "INCREASE").length;
  const decreases = changes.filter((change) => change.direction === "DECREASE").length;
  const lateral = changes.filter((change) => change.direction === "LATERAL").length;
  const hasMaterialIncrease = changes.some((change) => change.material && change.direction === "INCREASE");
  return {
    changes,
    increases,
    decreases,
    lateral,
    hasMaterialIncrease,
    requiresPolicyChangeApproval: changes.some((change) => change.requiresApproval),
    requiresReauthorization: changes.some((change) => change.material),
  };
}
