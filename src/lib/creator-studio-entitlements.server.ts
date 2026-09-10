import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CreatorStudioPlan = "FREE" | "PRO" | "BUSINESS";
export const CREATOR_STUDIO_PLAN_LIMITS: Record<CreatorStudioPlan, number> = {
  FREE: 1,
  PRO: 10,
  BUSINESS: 50,
};

export async function reserveCreatorStudioVideo(ownerUserId: string, idempotencyKey: string) {
  const { data, error } = await (supabaseAdmin.rpc as any)("creator_studio_reserve_video", {
    p_owner_user_id: ownerUserId,
    p_idempotency_key: idempotencyKey,
  });
  if (error) {
    if (String(error.message ?? "").includes("creator_studio_quota_exceeded")) throw new Error("CREATOR_STUDIO_QUOTA_EXCEEDED");
    throw new Error("CREATOR_STUDIO_QUOTA_UNAVAILABLE");
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.usage_id) throw new Error("CREATOR_STUDIO_QUOTA_UNAVAILABLE");
  return row as { usage_id: string; usage_type: "FREE_PREVIEW" | "INCLUDED" | "EXTRA"; period_key: string };
}

export async function finalizeCreatorStudioVideo(ownerUserId: string, idempotencyKey: string, success: boolean, renderJobId?: string) {
  const { error } = await (supabaseAdmin.rpc as any)("creator_studio_finalize_video", {
    p_owner_user_id: ownerUserId,
    p_idempotency_key: idempotencyKey,
    p_success: success,
    p_render_job_id: renderJobId ?? null,
  });
  if (error) throw new Error("CREATOR_STUDIO_USAGE_FINALIZE_FAILED");
}

export async function getCreatorStudioEntitlement(ownerUserId: string) {
  const { data: entitlement, error } = await (supabaseAdmin.from("creator_studio_entitlements" as never) as any)
    .select("plan_key,included_videos,period_start,period_end")
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (error) throw new Error("CREATOR_STUDIO_ENTITLEMENT_UNAVAILABLE");

  const plan = (entitlement?.plan_key ?? "FREE") as CreatorStudioPlan;
  const includedVideos = entitlement?.included_videos ?? CREATOR_STUDIO_PLAN_LIMITS[plan] ?? 1;
  const periodKey = plan === "FREE" ? "LIFETIME" : entitlement?.period_start ?? new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();

  const { count: used, error: usageError } = await (supabaseAdmin.from("creator_studio_usage" as never) as any)
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", ownerUserId)
    .eq("period_key", periodKey)
    .in("status", ["RESERVED", "CONSUMED"])
    .in("usage_type", ["FREE_PREVIEW", "INCLUDED"]);
  if (usageError) throw new Error("CREATOR_STUDIO_ENTITLEMENT_UNAVAILABLE");

  const { data: credits, error: creditError } = await (supabaseAdmin.from("creator_studio_extra_credits" as never) as any)
    .select("remaining")
    .eq("owner_user_id", ownerUserId)
    .gt("remaining", 0);
  if (creditError) throw new Error("CREATOR_STUDIO_ENTITLEMENT_UNAVAILABLE");

  const extraVideos = (credits ?? []).reduce((sum: number, row: any) => sum + Number(row.remaining || 0), 0);
  return {
    plan,
    includedVideos,
    includedUsed: used ?? 0,
    includedRemaining: Math.max(0, includedVideos - (used ?? 0)),
    extraVideos,
    periodStart: entitlement?.period_start ?? null,
    periodEnd: entitlement?.period_end ?? null,
  };
}
