import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildLeadAnalytics, type LeadAnalytics } from "@/lib/lead-analytics";

/**
 * Admin-only: clicks-to-leads conversion for the creator recruitment funnel,
 * broken down by CTA location / page path, product type and follower band.
 */
export const getLeadAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { days?: number } | undefined) => ({
    days: Math.min(Math.max(input?.days ?? 30, 1), 365),
  }))
  .handler(async ({ context, data }): Promise<LeadAnalytics> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [clicks, leads] = await Promise.all([
      supabaseAdmin
        .from("cta_click_events")
        .select("cta_location, page_path, session_id, created_at")
        .gte("created_at", since)
        .limit(20000),
      supabaseAdmin
        .from("creator_leads")
        .select("cta_source, product_type, follower_count, created_at")
        .gte("created_at", since)
        .limit(20000),
    ]);

    if (clicks.error) throw clicks.error;
    if (leads.error) throw leads.error;

    return buildLeadAnalytics(clicks.data ?? [], leads.data ?? [], data.days);
  });
