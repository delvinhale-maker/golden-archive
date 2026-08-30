/**
 * AurumVault Digital Rights Passport Generator — passport (identity-level,
 * versioned) server functions.
 *
 * rights_passports has genuine owner-scoped RLS (SELECT/INSERT/UPDATE
 * granted to `authenticated`, policy scoped by owner_user_id = auth.uid()),
 * so — matching qr_projects' established convention in this codebase, not
 * seller_applications' service-role convention — every function here uses
 * context.supabase (the RLS-bound client), never service-role. Ownership is
 * always derived from context.userId, never accepted from client input.
 *
 * SAFETY: nothing here computes or asserts legal ownership. See
 * RIGHTS_PASSPORT_DISCLAIMER in rights-passport.schema.ts — the UI must
 * always display it, and REVIEW_REQUIRED is a first-class value throughout
 * this schema for exactly that reason.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  passportUpsertSchema,
  PASSPORT_COLS,
  ASSET_COLS,
  PASSPORT_STATUSES,
  type PassportRow,
  type AssetRow,
} from "@/lib/rights-passport.schema";
import { computeReadinessScore, type ReadinessResult } from "@/lib/rights-passport-readiness";
import {
  computeReadinessScoreV2,
  type ReadinessResultV2,
} from "@/lib/rights-passport-readiness-v2";
import { evaluateRiskRules } from "@/lib/rights-passport-risk-rules";
import {
  AI_CONSENT_COLS,
  LICENSE_COLS,
  EVIDENCE_COLS,
  type AiConsentRow,
  type LicenseRow,
  type EvidenceRow,
} from "@/lib/rights-passport-workspace.schema";

function toPatch(input: Partial<Record<string, unknown>>): Record<string, unknown> {
  const map: Record<string, string> = {
    publicProfessionalName: "public_professional_name",
    legalName: "legal_name",
    stageBrandName: "stage_brand_name",
    primaryRole: "primary_role",
    jurisdiction: "jurisdiction",
    rightsContactEmail: "rights_contact_email",
    rightsEntity: "rights_entity",
    publicRightsUrl: "public_rights_url",
    verificationLevel: "verification_level",
    representativeName: "representative_name",
    representativeContact: "representative_contact",
    agentManagerName: "agent_manager_name",
    agentManagerContact: "agent_manager_contact",
    successorEstateContact: "successor_estate_contact",
    effectiveDate: "effective_date",
    reviewFrequency: "review_frequency",
    publicNotes: "public_notes",
    privateNotes: "private_notes",
  };
  const patch: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(map)) {
    if (input[key] !== undefined) patch[column] = input[key];
  }
  return patch;
}

/** Creates the first DRAFT version of a brand-new passport lineage. */
export const createPassport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => passportUpsertSchema.parse(input))
  .handler(async ({ data, context }): Promise<PassportRow> => {
    const { supabase, userId } = context;
    const patch = toPatch(data);

    const { data: row, error } = await (supabase.from("rights_passports" as never) as any)
      .insert({
        owner_user_id: userId,
        version: 1,
        status: "DRAFT",
        ...patch,
      })
      .select(PASSPORT_COLS)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Couldn't create passport");
    return row;
  });

const updateSchema = passportUpsertSchema.extend({
  id: z.string().uuid(),
  status: z.enum(PASSPORT_STATUSES).optional(),
});

/**
 * Updates one version row's editable fields. Setting status to ACTIVE first
 * supersedes any other row sharing the same passport_key that is currently
 * ACTIVE (two sequential atomic UPDATEs — old-to-SUPERSEDED commits before
 * new-to-ACTIVE runs, so the one-active-per-key unique index is never
 * violated at any point, without needing a hand-rolled transaction).
 */
export const updatePassport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }): Promise<PassportRow> => {
    const { supabase, userId } = context;
    const { id, status, ...rest } = data;
    const patch = toPatch(rest);
    if (status !== undefined) patch.status = status;

    if (status === "ACTIVE") {
      const { data: current } = await supabase
        .from("rights_passports" as never)
        .select("passport_key" as never)
        .eq("id" as never, id)
        .eq("owner_user_id" as never, userId)
        .maybeSingle();
      if (!current) throw new Error("Passport not found");
      const passportKey = (current as any).passport_key as string;

      await (supabase.from("rights_passports" as never) as any)
        .update({ status: "SUPERSEDED" })
        .eq("passport_key", passportKey)
        .eq("owner_user_id", userId)
        .eq("status", "ACTIVE")
        .neq("id", id);
    }

    if (!Object.keys(patch).length) throw new Error("Nothing to update");

    const { data: row, error } = await (supabase.from("rights_passports" as never) as any)
      .update(patch)
      .eq("id", id)
      .eq("owner_user_id", userId)
      .select(PASSPORT_COLS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Passport not found");
    return row;
  });

export const getPassport = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<PassportRow> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("rights_passports" as never)
      .select(PASSPORT_COLS as never)
      .eq("id" as never, data.id)
      .eq("owner_user_id" as never, userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Passport not found");
    return row as unknown as PassportRow;
  });

export type PassportVersionSummary = {
  id: string;
  version: number;
  status: string;
  updated_at: string;
};

export const listMyPassportVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PassportVersionSummary[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("rights_passports" as never)
      .select("id,version,status,updated_at" as never)
      .eq("owner_user_id" as never, userId)
      .order("version" as never, { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as PassportVersionSummary[];
  });

/**
 * Clones the given version's editable fields into a brand-new DRAFT row —
 * version+1, previous_version_id pointing back, same passport_key. The
 * source row is left completely untouched (still ACTIVE if it was).
 */
export const createNewPassportVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<PassportRow> => {
    const { supabase, userId } = context;
    const { data: source, error: sourceErr } = await supabase
      .from("rights_passports" as never)
      .select(PASSPORT_COLS as never)
      .eq("id" as never, data.id)
      .eq("owner_user_id" as never, userId)
      .maybeSingle();
    if (sourceErr) throw new Error(sourceErr.message);
    if (!source) throw new Error("Passport not found");
    const src = source as unknown as PassportRow;

    const { data: row, error } = await (supabase.from("rights_passports" as never) as any)
      .insert({
        owner_user_id: userId,
        passport_key: src.passport_key,
        version: src.version + 1,
        previous_version_id: src.id,
        status: "DRAFT",
        public_professional_name: src.public_professional_name,
        legal_name: src.legal_name,
        stage_brand_name: src.stage_brand_name,
        primary_role: src.primary_role,
        jurisdiction: src.jurisdiction,
        rights_contact_email: src.rights_contact_email,
        rights_entity: src.rights_entity,
        public_rights_url: src.public_rights_url,
        verification_level: src.verification_level,
        representative_name: src.representative_name,
        representative_contact: src.representative_contact,
        agent_manager_name: src.agent_manager_name,
        agent_manager_contact: src.agent_manager_contact,
        successor_estate_contact: src.successor_estate_contact,
        effective_date: src.effective_date,
        review_frequency: src.review_frequency,
        public_notes: src.public_notes,
        private_notes: src.private_notes,
      })
      .select(PASSPORT_COLS)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Couldn't create new version");
    return row;
  });

export type PassportHome = {
  passport: PassportRow | null;
  readiness: ReadinessResultV2 | null;
  assetCount: number;
  licenseCount: number;
  evidenceCount: number;
  openReviewCount: number;
};

/**
 * Powers Passport Home. Prefers the ACTIVE version; falls back to the
 * latest DRAFT (highest version number) if no version has been activated
 * yet. Readiness is v2 (rights-passport-readiness-v2.ts) — scored from real
 * asset/AI-consent/license/evidence/review-flag records, not just identity
 * fields. Review flags are read as already-stored rows (not re-synced here)
 * — syncReviewFlags (rights-passport-review.functions.ts) is the only place
 * that writes them; Home reads whatever is currently OPEN/ACKNOWLEDGED.
 */
export const getPassportHome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PassportHome> => {
    const { supabase, userId } = context;

    const { data: activeRow } = await supabase
      .from("rights_passports" as never)
      .select(PASSPORT_COLS as never)
      .eq("owner_user_id" as never, userId)
      .eq("status" as never, "ACTIVE")
      .maybeSingle();

    let passport = activeRow as unknown as PassportRow | null;
    if (!passport) {
      const { data: draftRow } = await supabase
        .from("rights_passports" as never)
        .select(PASSPORT_COLS as never)
        .eq("owner_user_id" as never, userId)
        .order("version" as never, { ascending: false })
        .limit(1)
        .maybeSingle();
      passport = draftRow as unknown as PassportRow | null;
    }

    if (!passport) {
      return {
        passport: null,
        readiness: null,
        assetCount: 0,
        licenseCount: 0,
        evidenceCount: 0,
        openReviewCount: 0,
      };
    }

    const [assetsRes, consentsRes, licensesRes, evidenceRes, flagsRes] = await Promise.all([
      supabase
        .from("rights_passport_assets" as never)
        .select(ASSET_COLS as never)
        .eq("passport_key" as never, passport.passport_key)
        .neq("status" as never, "ARCHIVED"),
      supabase
        .from("rights_ai_consents" as never)
        .select(AI_CONSENT_COLS as never)
        .eq("passport_key" as never, passport.passport_key),
      supabase
        .from("rights_licenses" as never)
        .select(LICENSE_COLS as never)
        .eq("passport_key" as never, passport.passport_key),
      supabase
        .from("rights_evidence" as never)
        .select(EVIDENCE_COLS as never)
        .eq("passport_key" as never, passport.passport_key),
      supabase
        .from("rights_review_flags" as never)
        .select("rule_code,severity,status" as never)
        .eq("passport_key" as never, passport.passport_key)
        .in("status" as never, ["OPEN", "ACKNOWLEDGED"] as never),
    ]);

    const assets = (assetsRes.data ?? []) as unknown as AssetRow[];
    const aiConsents = (consentsRes.data ?? []) as unknown as AiConsentRow[];
    const licenses = (licensesRes.data ?? []) as unknown as LicenseRow[];
    const evidence = (evidenceRes.data ?? []) as unknown as EvidenceRow[];
    const openFlags = (flagsRes.data ?? []) as unknown as { rule_code: string; severity: any }[];

    const readiness = computeReadinessScoreV2({
      passport,
      assets,
      aiConsents,
      licenses,
      evidence,
      openFlags: openFlags.map((f) => ({ ruleCode: f.rule_code, severity: f.severity })),
    });

    return {
      passport,
      readiness,
      assetCount: assets.length,
      licenseCount: licenses.length,
      evidenceCount: evidence.length,
      openReviewCount: openFlags.length,
    };
  });
