import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin-only read of seller_applications, including the fields that were
 * removed from the general `authenticated` column grant (applicant_email,
 * admin_notes, admin_feedback, reapply_after) — see the accompanying
 * migration. Authenticates the caller, verifies admin role via
 * has_role-equivalent lookup, then reads with the service-role client
 * (never exposed to the browser — imported dynamically inside the handler,
 * same pattern as admin-earnings.functions.ts).
 */
export type AdminSellerApplication = {
  id: string;
  user_id: string;
  brand_name: string;
  brand_slug: string | null;
  pitch: string;
  product_types: string | null;
  categories: string[] | null;
  price_range: string | null;
  website: string | null;
  country: string | null;
  social_links: Record<string, string> | null;
  status: string;
  admin_notes: string | null;
  admin_feedback: string | null;
  reapply_after: string | null;
  created_at: string;
  reviewed_at: string | null;
  applicant_email: string | null;
};

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("forbidden");
}

export const getSellerApplicationsForAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminSellerApplication[]> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("seller_applications")
      .select(
        "id,user_id,brand_name,brand_slug,pitch,product_types,categories,price_range,website,country,social_links,status,admin_notes,admin_feedback,reapply_after,created_at,reviewed_at,applicant_email",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as AdminSellerApplication[];
  });
