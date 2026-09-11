import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCreatorStudioEnabled } from "./feature-flags.middleware";

export type MyEntitlements = {
  plan: "FREE" | "CREATOR_PRO" | "CREATOR_BUSINESS";
  videosRemainingIncluded: number;
  freePreviewAvailable: boolean;
  extraCreditsBalance: number;
  periodEnd: string | null;
};

/**
 * Customer-facing quota summary -- "videos remaining" / "renewal date" /
 * "extra video balance", never any backend/infrastructure term. Reads
 * straight from creator_studio_entitlements (RLS: owner-only SELECT); a
 * user who has never reserved a credit has no row yet, so the FREE-preview
 * default below mirrors exactly what the reserve RPC would create lazily.
 */
export const getMyEntitlementsFn = createServerFn({ method: "GET" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyEntitlements> => {
    const { data: row } = await context.supabase
      .from("creator_studio_entitlements" as any)
      .select(
        "plan,videos_included_per_period,videos_used_this_period,free_preview_used,extra_credits_balance,period_end",
      )
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!row) {
      return {
        plan: "FREE",
        videosRemainingIncluded: 0,
        freePreviewAvailable: true,
        extraCreditsBalance: 0,
        periodEnd: null,
      };
    }

    return {
      plan: row.plan,
      videosRemainingIncluded:
        row.plan === "FREE"
          ? 0
          : Math.max(0, row.videos_included_per_period - row.videos_used_this_period),
      freePreviewAvailable: row.plan === "FREE" && !row.free_preview_used,
      extraCreditsBalance: row.extra_credits_balance,
      periodEnd: row.period_end,
    };
  });
