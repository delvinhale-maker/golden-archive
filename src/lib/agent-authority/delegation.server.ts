export type WorkspaceRole = "OWNER" | "ADMIN" | "APPROVER" | "AUDITOR" | "MEMBER";

const roleRank: Record<WorkspaceRole, number> = {
  MEMBER: 0,
  AUDITOR: 0,
  APPROVER: 1,
  ADMIN: 2,
  OWNER: 3,
};

function roleSatisfies(actual: WorkspaceRole, required: "OWNER" | "ADMIN" | "APPROVER"): boolean {
  return roleRank[actual] >= roleRank[required];
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function assertActionApprovalAuthority(input: {
  workspaceId: string;
  userId: string;
  assignedRole: "OWNER" | "ADMIN" | "APPROVER";
  actionKey: string;
  amount?: number | null;
  now?: Date;
}): Promise<{ mode: "ROLE" | "DELEGATION"; delegationId?: string; delegatorUserId?: string }> {
  const client = await db();
  const { data: member, error: memberError } = await client
    .from("agent_authority_members")
    .select("role")
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (memberError) throw memberError;
  if (!member) throw new Error("Forbidden: workspace membership required");
  if (roleSatisfies(member.role as WorkspaceRole, input.assignedRole)) return { mode: "ROLE" };

  const now = (input.now ?? new Date()).toISOString();
  const { data: delegations, error: delegationError } = await client
    .from("agent_delegations")
    .select("id,delegator_user_id,action_keys,max_approval_amount,starts_at,ends_at,status")
    .eq("workspace_id", input.workspaceId)
    .eq("delegate_user_id", input.userId)
    .eq("status", "ACTIVE")
    .eq("can_approve_actions", true)
    .lte("starts_at", now)
    .gt("ends_at", now);
  if (delegationError) throw delegationError;

  for (const delegation of delegations ?? []) {
    const actionKeys = (delegation.action_keys ?? []) as string[];
    if (actionKeys.length > 0 && !actionKeys.includes(input.actionKey)) continue;
    if (delegation.max_approval_amount != null && input.amount != null && Number(input.amount) > Number(delegation.max_approval_amount)) continue;

    const { data: delegatorMembership } = await client
      .from("agent_authority_members")
      .select("role")
      .eq("workspace_id", input.workspaceId)
      .eq("user_id", delegation.delegator_user_id)
      .maybeSingle();
    if (!delegatorMembership || !roleSatisfies(delegatorMembership.role as WorkspaceRole, input.assignedRole)) continue;
    return { mode: "DELEGATION", delegationId: delegation.id, delegatorUserId: delegation.delegator_user_id };
  }

  throw new Error("Forbidden: no active role or delegation permits this approval");
}
