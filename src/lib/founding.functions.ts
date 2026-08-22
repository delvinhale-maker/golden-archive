import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FOUNDING_COHORT_SIZE } from "@/lib/founding";

export type FoundingCohortStatus = {
  accepted: number;
  remaining: number;
  isFull: boolean;
  cohortSize: number;
};

/** Public, truthful cohort counter — derived from accepted rows, never hardcoded. */
export const getFoundingCohortStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<FoundingCohortStatus> => {
    const { publicClient } = await import("@/lib/founding-public.server");
    const { count, error } = await publicClient()
      .from("founding_creators")
      .select("founding_number", { count: "exact", head: true });
    if (error) throw error;
    const accepted = count ?? 0;
    return {
      accepted,
      remaining: Math.max(FOUNDING_COHORT_SIZE - accepted, 0),
      isFull: accepted >= FOUNDING_COHORT_SIZE,
      cohortSize: FOUNDING_COHORT_SIZE,
    };
  },
);

export type MyFoundingStatus = {
  isFounding: boolean;
  foundingNumber: number | null;
  acceptedAt: string | null;
};

/** The signed-in creator's own founding status. */
export const getMyFoundingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyFoundingStatus> => {
    const { data } = await context.supabase
      .from("founding_creators")
      .select("founding_number, accepted_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      isFounding: Boolean(data),
      foundingNumber: (data?.founding_number as number | undefined) ?? null,
      acceptedAt: (data?.accepted_at as string | undefined) ?? null,
    };
  });

/** Founding number for any creator (public badge data only). */
export const getFoundingNumberForUser = createServerFn({ method: "GET" })
  .inputValidator((input: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<{ foundingNumber: number | null }> => {
    const { publicClient } = await import("@/lib/founding-public.server");
    const { data: row } = await publicClient()
      .from("founding_creators")
      .select("founding_number")
      .eq("user_id", data.userId)
      .maybeSingle();
    return { foundingNumber: (row?.founding_number as number | undefined) ?? null };
  });

/** Admin-only: accept an approved application into the Founding 100. */
export const acceptIntoFounding100 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { applicationId: string }) =>
    z.object({ applicationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { acceptFoundingCreator } = await import("@/lib/founding.server");
    return acceptFoundingCreator({ applicationId: data.applicationId, acceptedBy: context.userId });
  });

/**
 * Admin-only end-to-end funnel: visitor → starter pack → application →
 * approval → first product → first sale. Every stage is counted from records.
 */
export const getFoundingFunnel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { adminClient } = await import("@/lib/starter-pack.server");
    const { computeFoundingFunnel } = await import("@/lib/founding-funnel.server");
    return computeFoundingFunnel(adminClient());
  });

export type FoundingMetrics = {
  accepted: number;
  remaining: number;
  isFull: boolean;
  cohortSize: number;
  campaignApplications: number;
  campaignApplicationsApproved: number;
  campaignApplicationsPending: number;
  applyClicks: number;
  pageViews: number;
  prospects: { status: string; count: number }[];
  acceptedRecent: { foundingNumber: number; brandName: string | null; acceptedAt: string }[];
};

/** Admin-only Founding 100 command-center metrics. */
export const getFoundingMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FoundingMetrics> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { adminClient } = await import("@/lib/starter-pack.server");
    const { FOUNDING_CAMPAIGN, FOUNDING_EVENTS } = await import("@/lib/founding");
    const supabase = adminClient();

    const [cohortRes, appsRes, clicksRes, prospectRes] = await Promise.all([
      supabase
        .from("founding_creators")
        .select("founding_number, accepted_at, seller_application_id")
        .order("founding_number", { ascending: false })
        .limit(500),
      supabase
        .from("seller_applications")
        .select("id, brand_name, status, campaign")
        .eq("campaign", FOUNDING_CAMPAIGN)
        .limit(2000),
      supabase.from("cta_click_events").select("cta_location").limit(20000),
      supabase.from("creator_prospects").select("status").limit(5000),
    ]);

    const cohort = cohortRes.data ?? [];
    const apps = appsRes.data ?? [];
    const clicks = clicksRes.data ?? [];
    const brandById = new Map(apps.map((a: any) => [a.id, a.brand_name as string]));

    const prospectTally = new Map<string, number>();
    for (const p of prospectRes.data ?? []) {
      const key = (p as any).status as string;
      prospectTally.set(key, (prospectTally.get(key) ?? 0) + 1);
    }

    const accepted = cohort.length;
    return {
      accepted,
      remaining: Math.max(FOUNDING_COHORT_SIZE - accepted, 0),
      isFull: accepted >= FOUNDING_COHORT_SIZE,
      cohortSize: FOUNDING_COHORT_SIZE,
      campaignApplications: apps.length,
      campaignApplicationsApproved: apps.filter((a: any) => a.status === "approved").length,
      campaignApplicationsPending: apps.filter((a: any) =>
        ["pending", "under_review", "info_requested"].includes(a.status),
      ).length,
      applyClicks: clicks.filter((c: any) => c.cta_location === FOUNDING_EVENTS.applyClicked).length,
      pageViews: clicks.filter((c: any) => c.cta_location === FOUNDING_EVENTS.viewed).length,
      prospects: [...prospectTally.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      acceptedRecent: cohort.slice(0, 25).map((c: any) => ({
        foundingNumber: c.founding_number,
        brandName: c.seller_application_id ? brandById.get(c.seller_application_id) ?? null : null,
        acceptedAt: c.accepted_at,
      })),
    };
  });
