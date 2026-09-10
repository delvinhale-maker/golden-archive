import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { creatorStudioIncludedVideos, type CreatorStudioPaidPlan } from "@/lib/creator-studio-pricing";

export async function setCreatorStudioEntitlementFromPayment(input: {
  ownerUserId: string;
  plan: CreatorStudioPaidPlan;
  sourceReference: string;
  periodStart: string;
  periodEnd: string;
}) {
  const includedVideos = creatorStudioIncludedVideos(input.plan);
  const { data, error } = await (supabaseAdmin.from("creator_studio_entitlements" as never) as any)
    .upsert({
      owner_user_id: input.ownerUserId,
      plan_key: input.plan,
      included_videos: includedVideos,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      source: "STRIPE",
      source_reference: input.sourceReference,
      updated_at: new Date().toISOString(),
    }, { onConflict: "owner_user_id" })
    .select("owner_user_id,plan_key,included_videos,period_start,period_end,source_reference")
    .single();
  if (error || !data) throw new Error("CREATOR_STUDIO_ENTITLEMENT_SYNC_FAILED");
  return data;
}

export async function grantCreatorStudioExtraCredits(input: {
  ownerUserId: string;
  quantity: number;
  sourceReference: string;
}) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0 || input.quantity > 1000) {
    throw new Error("CREATOR_STUDIO_INVALID_CREDIT_QUANTITY");
  }
  const { data: existing, error: existingError } = await (supabaseAdmin.from("creator_studio_extra_credits" as never) as any)
    .select("id,owner_user_id,quantity,remaining,source_reference")
    .eq("source_reference", input.sourceReference)
    .maybeSingle();
  if (existingError) throw new Error("CREATOR_STUDIO_CREDIT_SYNC_FAILED");
  if (existing) return existing;

  const { data, error } = await (supabaseAdmin.from("creator_studio_extra_credits" as never) as any)
    .insert({
      owner_user_id: input.ownerUserId,
      quantity: input.quantity,
      remaining: input.quantity,
      source_reference: input.sourceReference,
    })
    .select("id,owner_user_id,quantity,remaining,source_reference")
    .single();
  if (error || !data) {
    const { data: raced } = await (supabaseAdmin.from("creator_studio_extra_credits" as never) as any)
      .select("id,owner_user_id,quantity,remaining,source_reference")
      .eq("source_reference", input.sourceReference)
      .maybeSingle();
    if (raced) return raced;
    throw new Error("CREATOR_STUDIO_CREDIT_SYNC_FAILED");
  }
  return data;
}
