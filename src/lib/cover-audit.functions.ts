import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import {
  COVER_AUDIT_CATEGORIES,
  type CoverAuditResult,
  type CoverAuditRow,
  type CoverCategory,
} from "./cover-audit.server";

export type { CoverAuditResult, CoverAuditRow, CoverCategory };

export type CachedCoverAudit = CoverAuditResult & { cached: true };

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) throw new Error("Forbidden: admin only");
}

// Run on-demand from the admin page. Writes through to the cache table.
export const auditCovers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ category: z.enum(COVER_AUDIT_CATEGORIES).default("ebooks") }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<CoverAuditResult> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { runCoverAudit, writeCoverAuditCache } = await import("./cover-audit.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await runCoverAudit(supabase, data.category);
    // Use admin client to bypass RLS for the cache write so on-demand and cron share one table.
    await writeCoverAuditCache(supabaseAdmin, result);
    return result;
  });

// Read the cached row for a single category. Admin only.
export const getCachedCoverAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ category: z.enum(COVER_AUDIT_CATEGORIES).default("ebooks") }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<CachedCoverAudit | null> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: row, error } = await supabase
      .from("cover_audit_runs")
      .select("*")
      .eq("category", data.category)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return {
      cached: true,
      ok: row.ok,
      checkedAt: row.checked_at,
      category: row.category as CoverCategory,
      summary: { total: row.total, passing: row.passing, failing: row.failing },
      results: (row.results as CoverAuditRow[]) ?? [],
      failing: (row.failing_rows as CoverAuditRow[]) ?? [],
    };
  });
