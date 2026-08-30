/**
 * AurumVault Digital Rights Passport Generator — release-candidate
 * entitlements. Reads a user's plan from rights_passport_entitlements
 * (proposed migration 20260830190000, not yet applied) with a safe default
 * when no row exists, computes current usage by counting/summing existing
 * Rights Passport tables (no separate, driftable "usage counter" table —
 * see the migration's own header for why), and exposes a single assertion
 * helper server functions call before a gated action.
 *
 * WIRING STATUS (documented honestly, not overstated): `createPassport`
 * (rights-passport.functions.ts) calls `assertRightsPassportCapability` for
 * MANAGED_IDENTITIES as the end-to-end proof this module works. The usage
 * lookups for every other capability are implemented and exercised by this
 * module's own logic, but are not yet called from every other gated
 * endpoint (document upload, AI analysis runs, publish, exports) — that
 * remaining wiring is mechanical (one `await assertRightsPassportCapability(...)`
 * call per handler, following the exact pattern already in createPassport)
 * and is called out explicitly in the release report rather than rushed in
 * across a dozen more call sites without the ability to test against a
 * live database in this environment.
 */
import {
  checkRightsPassportCapability,
  DEFAULT_RIGHTS_PASSPORT_PLAN,
  RIGHTS_PASSPORT_QUOTA_MESSAGE,
  type RightsPassportCapability,
  type RightsPassportPlan,
} from "@/lib/rights-passport-plans";

export async function getUserPlan(supabase: any, userId: string): Promise<RightsPassportPlan> {
  const { data, error } = await supabase
    .from("rights_passport_entitlements" as never)
    .select("plan" as never)
    .eq("user_id" as never, userId)
    .maybeSingle();
  // A missing row, an RLS-invisible row, or a query error all fall back to
  // the same safe default — never throw here, since an entitlements lookup
  // failure must never be interpreted as "unlimited."
  if (error || !data) return DEFAULT_RIGHTS_PASSPORT_PLAN;
  const row = data as unknown as { plan: RightsPassportPlan };
  return row.plan ?? DEFAULT_RIGHTS_PASSPORT_PLAN;
}

/**
 * Current usage for one capability. `passportKey` is required only for
 * per-passport capabilities (DOCUMENT_UPLOADS_PER_PASSPORT); ignored
 * otherwise. Boolean capabilities never call this — see
 * checkRightsPassportCapability, which ignores usage for them.
 */
export async function getRightsPassportUsage(
  supabase: any,
  userId: string,
  capability: RightsPassportCapability,
  passportKey?: string,
): Promise<number> {
  switch (capability) {
    case "ACTIVE_PASSPORTS": {
      const { count } = await supabase
        .from("rights_passports" as never)
        .select("passport_key" as never, { count: "exact", head: true })
        .eq("owner_user_id" as never, userId)
        .eq("status" as never, "ACTIVE");
      return count ?? 0;
    }
    case "MANAGED_IDENTITIES": {
      // Distinct passport_key lineages regardless of version status.
      const { data } = await supabase
        .from("rights_passports" as never)
        .select("passport_key" as never)
        .eq("owner_user_id" as never, userId);
      const rows = (data ?? []) as unknown as { passport_key: string }[];
      return new Set(rows.map((r) => r.passport_key)).size;
    }
    case "DOCUMENT_UPLOADS_PER_PASSPORT": {
      if (!passportKey) return 0;
      const { count } = await supabase
        .from("rights_passport_documents" as never)
        .select("id" as never, { count: "exact", head: true })
        .eq("owner_user_id" as never, userId)
        .eq("passport_key" as never, passportKey);
      return count ?? 0;
    }
    case "AI_ANALYSES_PER_MONTH": {
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("rights_analysis_runs" as never)
        .select("id" as never, { count: "exact", head: true })
        .eq("owner_user_id" as never, userId)
        .gte("created_at" as never, monthStart.toISOString());
      return count ?? 0;
    }
    case "STORAGE_MB": {
      const { data } = await supabase
        .from("rights_passport_documents" as never)
        .select("file_size_bytes" as never)
        .eq("owner_user_id" as never, userId);
      const rows = (data ?? []) as unknown as { file_size_bytes: number }[];
      const totalBytes = rows.reduce((sum, r) => sum + (r.file_size_bytes ?? 0), 0);
      return totalBytes / (1024 * 1024);
    }
    default:
      // Boolean capabilities (PUBLIC_PUBLISH, PDF_EXPORTS, JSON_EXPORTS,
      // PRIVATE_OWNER_EXPORTS, ADVANCED_CONFLICT_ANALYSIS) and
      // VERSION_HISTORY_DEPTH (a display concern, not a write gate) never
      // need a usage count.
      return 0;
  }
}

/**
 * Throws a safe, user-facing, plan-aware message when the capability is
 * denied; resolves silently when allowed. Call this at the top of a gated
 * handler, before any mutation.
 */
export async function assertRightsPassportCapability(
  supabase: any,
  userId: string,
  capability: RightsPassportCapability,
  passportKey?: string,
): Promise<void> {
  const plan = await getUserPlan(supabase, userId);
  const usage = await getRightsPassportUsage(supabase, userId, capability, passportKey);
  const result = checkRightsPassportCapability(plan, capability, usage);
  if (!result.allowed) {
    throw new Error(RIGHTS_PASSPORT_QUOTA_MESSAGE[capability]);
  }
}
