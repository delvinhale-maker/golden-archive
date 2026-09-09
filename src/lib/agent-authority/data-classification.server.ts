import type { DataClassification } from "./types";

const CLASSIFICATION_RANK: Record<DataClassification, number> = {
  PUBLIC: 0,
  INTERNAL: 1,
  CONFIDENTIAL: 2,
  RESTRICTED: 3,
};

/**
 * Returns the stricter of two classifications. This prevents an API caller
 * from downgrading a resource that the workspace has already classified at a
 * higher sensitivity level.
 */
export function stricterDataClassification(
  first?: DataClassification | null,
  second?: DataClassification | null,
): DataClassification | null {
  if (!first) return second ?? null;
  if (!second) return first;
  return CLASSIFICATION_RANK[first] >= CLASSIFICATION_RANK[second] ? first : second;
}

export async function resolveRequestDataClassification(input: {
  workspaceId: string;
  explicit?: DataClassification | null;
  resourceKey?: string | null;
  target?: string | null;
}): Promise<DataClassification | null> {
  const key = input.resourceKey?.trim() || input.target?.trim();
  if (!key) return input.explicit ?? null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const client = supabaseAdmin as any;
  const { data, error } = await client
    .from("agent_data_classifications")
    .select("classification")
    .eq("workspace_id", input.workspaceId)
    .eq("resource_key", key)
    .maybeSingle();
  if (error) throw error;

  const stored = (data?.classification as DataClassification | undefined) ?? null;
  return stricterDataClassification(input.explicit ?? null, stored);
}
