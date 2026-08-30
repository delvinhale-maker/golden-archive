/**
 * AurumVault Risk & Conflict Review™ — sync and status server functions.
 *
 * syncReviewFlags is the only place the deterministic rule engine
 * (rights-passport-risk-rules.ts) actually runs against real data. It
 * reconciles the computed flag set against rights_review_flags:
 *   - a computed flag with no existing row is inserted (status OPEN);
 *   - a computed flag matching an existing OPEN/ACKNOWLEDGED row is left
 *     alone (its status/history isn't reset by re-evaluation);
 *   - a computed flag matching an existing ACCEPTED_RISK row is left
 *     alone too — re-running the engine never silently reopens a risk the
 *     user explicitly accepted;
 *   - a stored OPEN/ACKNOWLEDGED/ACCEPTED_RISK row whose condition no
 *     longer appears in the freshly-computed set is marked RESOLVED — the
 *     underlying issue is gone, so an accepted-but-now-moot risk doesn't
 *     linger either.
 * The (passport_key, rule_code, affected_entity_type, affected_entity_id)
 * unique constraint at the DB layer is what makes the upsert idempotent —
 * re-running this on unchanged data never creates duplicates.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PASSPORT_COLS,
  ASSET_COLS,
  type PassportRow,
  type AssetRow,
} from "@/lib/rights-passport.schema";
import {
  AI_CONSENT_COLS,
  LICENSE_COLS,
  EVIDENCE_COLS,
  REVIEW_FLAG_COLS,
  type AiConsentRow,
  type LicenseRow,
  type EvidenceRow,
  type ReviewFlagRow,
  FLAG_STATUSES,
} from "@/lib/rights-passport-workspace.schema";
import { evaluateRiskRules, type RiskFlag } from "@/lib/rights-passport-risk-rules";

function flagKey(f: Pick<RiskFlag, "ruleCode" | "entityType" | "entityId">): string {
  return `${f.ruleCode}::${f.entityType}::${f.entityId ?? ""}`;
}

function rowKey(
  r: Pick<ReviewFlagRow, "rule_code" | "affected_entity_type" | "affected_entity_id">,
): string {
  return `${r.rule_code}::${r.affected_entity_type}::${r.affected_entity_id ?? ""}`;
}

/**
 * Core reconciliation logic, extracted so callers other than the
 * syncReviewFlags server fn — specifically rights-passport-proposals
 * .functions.ts's applyProposal, after it writes a structured record — can
 * refresh flags against the just-mutated data without duplicating this
 * logic. createServerFn-wrapped exports aren't safe to call as plain
 * functions from another server function's handler in this codebase's
 * convention (see rights-passport-analysis.functions.ts's own
 * assertOwnsPassportKey duplication for the established precedent), so this
 * is a plain exported async function instead, and syncReviewFlags becomes a
 * thin wrapper around it.
 */
export async function reconcileReviewFlagsForPassportKey(
  supabase: any,
  userId: string,
  passportKey: string,
): Promise<ReviewFlagRow[]> {
  const { data: passportRow, error: passportErr } = await supabase
    .from("rights_passports" as never)
    .select(PASSPORT_COLS as never)
    .eq("passport_key" as never, passportKey)
    .eq("owner_user_id" as never, userId)
    .eq("status" as never, "ACTIVE")
    .maybeSingle();
  if (passportErr) throw new Error(passportErr.message);
  let passport = passportRow as unknown as PassportRow | null;
  if (!passport) {
    const { data: latestRow, error: latestErr } = await supabase
      .from("rights_passports" as never)
      .select(PASSPORT_COLS as never)
      .eq("passport_key" as never, passportKey)
      .eq("owner_user_id" as never, userId)
      .order("version" as never, { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestErr) throw new Error(latestErr.message);
    passport = latestRow as unknown as PassportRow | null;
  }
  if (!passport) throw new Error("Passport not found");

  const [assetsRes, consentsRes, licensesRes, evidenceRes, existingFlagsRes] = await Promise.all([
    supabase
      .from("rights_passport_assets" as never)
      .select(ASSET_COLS as never)
      .eq("passport_key" as never, passportKey)
      .eq("owner_user_id" as never, userId),
    supabase
      .from("rights_ai_consents" as never)
      .select(AI_CONSENT_COLS as never)
      .eq("passport_key" as never, passportKey)
      .eq("owner_user_id" as never, userId),
    supabase
      .from("rights_licenses" as never)
      .select(LICENSE_COLS as never)
      .eq("passport_key" as never, passportKey)
      .eq("owner_user_id" as never, userId),
    supabase
      .from("rights_evidence" as never)
      .select(EVIDENCE_COLS as never)
      .eq("passport_key" as never, passportKey)
      .eq("owner_user_id" as never, userId),
    supabase
      .from("rights_review_flags" as never)
      .select(REVIEW_FLAG_COLS as never)
      .eq("passport_key" as never, passportKey)
      .eq("owner_user_id" as never, userId),
  ]);

  const assets = (assetsRes.data ?? []) as unknown as AssetRow[];
  const aiConsents = (consentsRes.data ?? []) as unknown as AiConsentRow[];
  const licenses = (licensesRes.data ?? []) as unknown as LicenseRow[];
  const evidence = (evidenceRes.data ?? []) as unknown as EvidenceRow[];
  const existingFlags = (existingFlagsRes.data ?? []) as unknown as ReviewFlagRow[];

  const computed = evaluateRiskRules({ passport, assets, aiConsents, licenses, evidence });
  const computedByKey = new Map(computed.map((f) => [flagKey(f), f]));
  const existingByKey = new Map(existingFlags.map((r) => [rowKey(r), r]));

  const toInsert: Record<string, unknown>[] = [];
  for (const [key, flag] of computedByKey) {
    const existing = existingByKey.get(key);
    if (!existing) {
      toInsert.push({
        owner_user_id: userId,
        passport_key: passportKey,
        rule_code: flag.ruleCode,
        title: flag.title,
        description: flag.description,
        severity: flag.severity,
        affected_entity_type: flag.entityType,
        affected_entity_id: flag.entityId,
        evidence_context: flag.evidenceContext,
        recommended_action: flag.recommendedAction,
        status: "OPEN",
      });
    }
    // Existing OPEN/ACKNOWLEDGED/ACCEPTED_RISK rows are intentionally
    // left untouched here — see the module docstring.
  }

  const toResolveIds: string[] = [];
  for (const [key, row] of existingByKey) {
    if (!computedByKey.has(key) && row.status !== "RESOLVED") {
      toResolveIds.push(row.id);
    }
  }

  if (toInsert.length) {
    const { error } = await (supabase.from("rights_review_flags" as never) as any).insert(toInsert);
    if (error) throw new Error(error.message);
  }
  if (toResolveIds.length) {
    const { error } = await (supabase.from("rights_review_flags" as never) as any)
      .update({ status: "RESOLVED", resolved_at: new Date().toISOString() })
      .in("id", toResolveIds)
      .eq("owner_user_id", userId);
    if (error) throw new Error(error.message);
  }

  const { data: finalRows, error: finalErr } = await supabase
    .from("rights_review_flags" as never)
    .select(REVIEW_FLAG_COLS as never)
    .eq("passport_key" as never, passportKey)
    .eq("owner_user_id" as never, userId)
    .order("severity" as never, { ascending: true })
    .order("created_at" as never, { ascending: false });
  if (finalErr) throw new Error(finalErr.message);
  return (finalRows ?? []) as unknown as ReviewFlagRow[];
}

export const syncReviewFlags = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<ReviewFlagRow[]> => {
    const { supabase, userId } = context;
    const { data: passportRow, error: passportErr } = await supabase
      .from("rights_passports" as never)
      .select("passport_key" as never)
      .eq("id" as never, data.id)
      .eq("owner_user_id" as never, userId)
      .maybeSingle();
    if (passportErr) throw new Error(passportErr.message);
    if (!passportRow) throw new Error("Passport not found");
    const passportKey = (passportRow as unknown as { passport_key: string }).passport_key;
    return reconcileReviewFlagsForPassportKey(supabase, userId, passportKey);
  });

export const listReviewFlags = createServerFn({ method: "GET" })
  .inputValidator((input: { passportKey: string }) =>
    z.object({ passportKey: z.string().uuid() }).parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<ReviewFlagRow[]> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("rights_review_flags" as never)
      .select(REVIEW_FLAG_COLS as never)
      .eq("passport_key" as never, data.passportKey)
      .eq("owner_user_id" as never, userId)
      .order("created_at" as never, { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as ReviewFlagRow[];
  });

const flagStatusSchema = z.enum(FLAG_STATUSES);

export const setReviewFlagStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; status: string }) =>
    z.object({ id: z.string().uuid(), status: flagStatusSchema }).parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<ReviewFlagRow> => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "RESOLVED") patch.resolved_at = new Date().toISOString();
    if (data.status === "OPEN" || data.status === "ACKNOWLEDGED") patch.resolved_at = null;

    const { data: row, error } = await (supabase.from("rights_review_flags" as never) as any)
      .update(patch)
      .eq("id", data.id)
      .eq("owner_user_id", userId)
      .select(REVIEW_FLAG_COLS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Review flag not found");
    return row;
  });
