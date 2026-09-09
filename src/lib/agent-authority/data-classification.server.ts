import type { DataClassification } from "./types";

export async function resolveRequestDataClassification(input: {
  workspaceId: string;
  explicit?: DataClassification | null;
  resourceKey?: string | null;
  target?: string | null;
}): Promise<DataClassification | null> {
  if (input.explicit) return input.explicit;
  const key = input.resourceKey?.trim() || input.target?.trim();
  if (!key) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const client = supabaseAdmin as any;
  const { data, error } = await client
    .from("agent_data_classifications")
    .select("classification")
    .eq("workspace_id", input.workspaceId)
    .eq("resource_key", key)
    .maybeSingle();
  if (error) throw error;
  return (data?.classification as DataClassification | undefined) ?? null;
}
