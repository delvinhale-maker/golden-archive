export interface DelegationScope {
  actionKeys: string[];
  maxApprovalAmount?: number | null;
  endsAt: string;
  canRedelegate: boolean;
}

/** Re-delegation may only narrow authority and time, never expand it. */
export function validateRedelegation(parent: DelegationScope, child: DelegationScope): void {
  if (!parent.canRedelegate) throw new Error("Parent delegation does not permit re-delegation");
  if (new Date(child.endsAt).getTime() > new Date(parent.endsAt).getTime()) throw new Error("Re-delegation cannot extend beyond parent delegation");
  const parentKeys = new Set(parent.actionKeys);
  if (parentKeys.size > 0 && child.actionKeys.some((key) => !parentKeys.has(key))) throw new Error("Re-delegation action scope exceeds parent delegation");
  if (parent.maxApprovalAmount != null) {
    if (child.maxApprovalAmount == null || Number(child.maxApprovalAmount) > Number(parent.maxApprovalAmount)) throw new Error("Re-delegation amount exceeds parent delegation");
  }
}
