import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AlertRow = {
  id: string;
  ran_at: string;
  status: "ok" | "warn" | "fail";
  missing_slug_count: number;
  duplicate_group_count: number;
  index_present: boolean;
  details: { duplicates?: Array<{ seller_id: string; slug: string; count: number }> };
};

async function ensureAdmin(ctx: { supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const runSlugIntegrityCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context as { supabase: typeof context.supabase; userId: string });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("run_slug_integrity_check");
    if (error) throw new Error(error.message);
    return data as AlertRow;
  });

export const listSlugIntegrityAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context as { supabase: typeof context.supabase; userId: string });
    const { data, error } = await context.supabase
      .from("slug_integrity_alerts")
      .select("*")
      .order("ran_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return (data ?? []) as AlertRow[];
  });
