/**
 * AurumVault Digital Rights Passport Generator — Round 4 publishing server
 * functions: Verify Passport™, Publish/Supersede/Revoke, and the PUBLIC
 * Rights Card read path.
 *
 * WORKSPACE DATA vs PUBLISHED SNAPSHOT (spec §B): publishPassport always
 * operates on the passport_key lineage's currently-ACTIVE Round 1 workspace
 * row (never a DRAFT directly — the user must have already promoted a
 * workspace version to ACTIVE via Round 1's existing updatePassport flow).
 * It freezes a serialized copy into rights_passport_snapshots
 * (immutable — DB guard trigger blocks any change but status/revoked_at)
 * and supersedes the previous ACTIVE snapshot in the same lineage, if any.
 * Nothing here ever re-derives a historical public payload dynamically —
 * getPublicRightsCard reads the frozen public_payload verbatim.
 *
 * getPublicRightsCard is the one function in this file with NO
 * requireSupabaseAuth middleware — it is the actual public route handler,
 * using supabaseAdmin (service-role, bypasses RLS) exactly like every other
 * "public but privacy-sensitive" read elsewhere in this codebase (e.g.
 * validateStoredManuscript's use of supabaseAdmin). It selects and returns
 * ONLY the already-sanitized public_payload column plus a few safe
 * metadata fields — never anything else from the row.
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
  type AiConsentRow,
  type LicenseRow,
  type EvidenceRow,
} from "@/lib/rights-passport-workspace.schema";
import {
  computeVerificationChecklist,
  type VerificationResult,
} from "@/lib/rights-passport-verify";
import {
  serializePublicPassport,
  serializePrivatePassport,
  type SerializeInput,
} from "@/lib/rights-passport-serialize";
import { hashCanonicalPayload, shortIntegrityId } from "@/lib/rights-passport-canonical-json";
import { generateQrPublicId, SITE_URL } from "@/lib/qr";

const RIGHTS_CARD_BASE = `${SITE_URL}/rights`;

export function publicUrlFor(publicId: string): string {
  return `${RIGHTS_CARD_BASE}/${publicId}`;
}

// ---------------------------------------------------------------------------
// Shared data gathering — one place both getVerifyStatus and publishPassport
// pull the same workspace snapshot from, so they can never disagree.
// ---------------------------------------------------------------------------

export async function gatherWorkspaceForVerification(
  supabase: any,
  userId: string,
  passportKey: string,
) {
  const { data: passportRow, error: passportErr } = await supabase
    .from("rights_passports" as never)
    .select(PASSPORT_COLS as never)
    .eq("passport_key" as never, passportKey)
    .eq("owner_user_id" as never, userId)
    .eq("status" as never, "ACTIVE")
    .maybeSingle();
  if (passportErr) throw new Error(passportErr.message);
  const passport = passportRow as unknown as PassportRow | null;
  if (!passport) {
    throw new Error(
      "This passport has no ACTIVE workspace version yet — activate a version before verifying or publishing.",
    );
  }

  const [assetsRes, consentsRes, licensesRes, evidenceRes, flagsRes] = await Promise.all([
    supabase
      .from("rights_passport_assets" as never)
      .select(ASSET_COLS as never)
      .eq("passport_key" as never, passportKey)
      .eq("owner_user_id" as never, userId)
      .neq("status" as never, "ARCHIVED"),
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
      .select("rule_code,severity,status" as never)
      .eq("passport_key" as never, passportKey)
      .eq("owner_user_id" as never, userId)
      .in("status" as never, ["OPEN", "ACKNOWLEDGED"] as never),
  ]);

  return {
    passport,
    assets: (assetsRes.data ?? []) as unknown as AssetRow[],
    aiConsents: (consentsRes.data ?? []) as unknown as AiConsentRow[],
    licenses: (licensesRes.data ?? []) as unknown as LicenseRow[],
    evidence: (evidenceRes.data ?? []) as unknown as EvidenceRow[],
    openFlags: ((flagsRes.data ?? []) as unknown as { rule_code: string; severity: string }[]).map(
      (f) => ({
        ruleCode: f.rule_code,
        severity: f.severity as never,
      }),
    ),
  };
}

export function buildSerializeInput(
  workspace: Awaited<ReturnType<typeof gatherWorkspaceForVerification>>,
  publicId: string,
  status: "ACTIVE" | "SUPERSEDED" | "REVOKED" | "ARCHIVED",
  publishedAt: string,
): SerializeInput {
  const { passport, assets, aiConsents, licenses, evidence } = workspace;
  return {
    publicId,
    passportVersion: passport.version,
    status,
    publishedAt,
    effectiveAt: passport.effective_date,
    humanReadableUrl: publicUrlFor(publicId),
    passport: {
      public_professional_name: passport.public_professional_name,
      legal_name: passport.legal_name,
      stage_brand_name: passport.stage_brand_name,
      primary_role: passport.primary_role,
      jurisdiction: passport.jurisdiction,
      rights_contact_email: passport.rights_contact_email,
      rights_entity: passport.rights_entity,
      public_rights_url: passport.public_rights_url,
      verification_level: passport.verification_level as never,
      representative_name: passport.representative_name,
      representative_contact: passport.representative_contact,
      agent_manager_name: passport.agent_manager_name,
      agent_manager_contact: passport.agent_manager_contact,
      successor_estate_contact: passport.successor_estate_contact,
      effective_date: passport.effective_date,
      review_frequency: passport.review_frequency,
      public_notes: passport.public_notes,
      private_notes: passport.private_notes,
    },
    assets: assets.map((a) => ({
      name: a.name,
      asset_type: a.asset_type,
      territory: a.territory,
      is_public: a.is_public,
      default_ai_policy: a.default_ai_policy as never,
      default_license_policy: a.default_license_policy,
      claimed_owner_controller: a.claimed_owner_controller,
      control_basis: a.control_basis,
      registration_identifier: a.registration_identifier,
      evidence_location: a.evidence_location,
      representative: a.representative,
      notes: a.notes,
    })),
    aiConsents: aiConsents.map((c) => ({
      asset_id: c.asset_id,
      use_case: c.use_case,
      permission: c.permission as never,
      compensation_rule: c.compensation_rule,
      evidence_reference: c.evidence_reference,
      license_contact: c.license_contact,
      notes: c.notes,
    })),
    licenses: licenses.map((l) => ({
      status: l.status,
      is_exclusive: l.is_exclusive,
      compensation: l.compensation,
      notes: l.notes,
    })),
    evidence: evidence.map((e) => ({
      evidence_type: e.evidence_type,
      status: e.status,
      source_creator: e.source_creator,
      file_url: e.file_url,
      hash_fingerprint: e.hash_fingerprint,
      notes: e.notes,
    })),
  };
}

// ---------------------------------------------------------------------------
// getVerifyStatus
// ---------------------------------------------------------------------------

export const getVerifyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { passportKey: string }) =>
    z.object({ passportKey: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<VerificationResult> => {
    const { supabase, userId } = context;
    const workspace = await gatherWorkspaceForVerification(supabase, userId, data.passportKey);
    return computeVerificationChecklist({
      passport: workspace.passport,
      assets: workspace.assets,
      aiConsents: workspace.aiConsents,
      licenses: workspace.licenses,
      evidence: workspace.evidence,
      openFlags: workspace.openFlags,
      version: workspace.passport.version,
      updatedAt: workspace.passport.updated_at,
    });
  });

// ---------------------------------------------------------------------------
// publishPassport
// ---------------------------------------------------------------------------

export type PublishResult = {
  snapshotId: string;
  publicId: string;
  publicUrl: string;
  passportVersion: number;
  status: "ACTIVE";
  publishedAt: string;
  contentHash: string;
  shortIntegrityId: string;
};

export const publishPassport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { passportKey: string }) =>
    z.object({ passportKey: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<PublishResult> => {
    const { supabase, userId } = context;
    const workspace = await gatherWorkspaceForVerification(supabase, userId, data.passportKey);

    const verification = computeVerificationChecklist({
      passport: workspace.passport,
      assets: workspace.assets,
      aiConsents: workspace.aiConsents,
      licenses: workspace.licenses,
      evidence: workspace.evidence,
      openFlags: workspace.openFlags,
      version: workspace.passport.version,
      updatedAt: workspace.passport.updated_at,
    });
    if (!verification.readyToPublish) {
      throw new Error(`This passport cannot be published yet: ${verification.blockers.join(" ")}`);
    }

    // Reuse (never mint a second one) the lineage's stable public_id.
    const { data: existingIdentity, error: identityErr } = await supabase
      .from("rights_passport_public_identities" as never)
      .select("public_id" as never)
      .eq("passport_key" as never, data.passportKey)
      .eq("owner_user_id" as never, userId)
      .maybeSingle();
    if (identityErr) throw new Error(identityErr.message);

    let publicId = (existingIdentity as unknown as { public_id: string } | null)?.public_id ?? null;
    if (!publicId) {
      publicId = `drp_${generateQrPublicId()}`;
      const { error: insertIdentityErr } = await (
        supabase.from("rights_passport_public_identities" as never) as any
      ).insert({ owner_user_id: userId, passport_key: data.passportKey, public_id: publicId });
      if (insertIdentityErr) throw new Error(insertIdentityErr.message);
    }

    const publishedAt = new Date().toISOString();
    const serializeInput = buildSerializeInput(workspace, publicId, "ACTIVE", publishedAt);
    const publicPayload = serializePublicPassport(serializeInput);
    const contentHash = await hashCanonicalPayload(publicPayload);

    const { data: previousActive } = await supabase
      .from("rights_passport_snapshots" as never)
      .select("id" as never)
      .eq("passport_key" as never, data.passportKey)
      .eq("owner_user_id" as never, userId)
      .eq("status" as never, "ACTIVE")
      .maybeSingle();
    const previousActiveId = (previousActive as unknown as { id: string } | null)?.id ?? null;

    if (previousActiveId) {
      const { error: supersedeErr } = await (
        supabase.from("rights_passport_snapshots" as never) as any
      )
        .update({ status: "SUPERSEDED" })
        .eq("id", previousActiveId)
        .eq("owner_user_id", userId)
        .eq("status", "ACTIVE");
      if (supersedeErr) throw new Error(supersedeErr.message);
    }

    const { data: snapshotRow, error: insertErr } = await (
      supabase.from("rights_passport_snapshots" as never) as any
    )
      .insert({
        owner_user_id: userId,
        passport_key: data.passportKey,
        source_passport_id: workspace.passport.id,
        public_id: publicId,
        passport_version: workspace.passport.version,
        status: "ACTIVE",
        schema_version: "1.0",
        public_payload: publicPayload,
        private_snapshot_metadata: {
          verification_score: verification.score,
          verification_status: verification.status,
          open_review_flags: verification.openReviewFlags,
        },
        content_hash: contentHash,
        supersedes_snapshot_id: previousActiveId,
        published_at: publishedAt,
        effective_at: workspace.passport.effective_date,
      })
      .select("id,published_at")
      .single();
    if (insertErr || !snapshotRow)
      throw new Error(insertErr?.message ?? "Couldn't publish this passport");

    return {
      snapshotId: snapshotRow.id,
      publicId,
      publicUrl: publicUrlFor(publicId),
      passportVersion: workspace.passport.version,
      status: "ACTIVE",
      publishedAt: snapshotRow.published_at,
      contentHash,
      shortIntegrityId: shortIntegrityId(contentHash),
    };
  });

// ---------------------------------------------------------------------------
// getPublishedSnapshotStatus — owner-side Export Center summary
// ---------------------------------------------------------------------------

export type SnapshotSummary = {
  status: "ACTIVE" | "SUPERSEDED" | "REVOKED" | "ARCHIVED";
  publicId: string;
  publicUrl: string;
  passportVersion: number;
  publishedAt: string;
  contentHash: string;
  shortIntegrityId: string;
} | null;

export const getPublishedSnapshotStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { passportKey: string }) =>
    z.object({ passportKey: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<SnapshotSummary> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("rights_passport_snapshots" as never)
      .select("status,public_id,passport_version,published_at,content_hash" as never)
      .eq("passport_key" as never, data.passportKey)
      .eq("owner_user_id" as never, userId)
      .in("status" as never, ["ACTIVE", "REVOKED"] as never)
      .order("published_at" as never, { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const r = row as unknown as {
      status: "ACTIVE" | "SUPERSEDED" | "REVOKED" | "ARCHIVED";
      public_id: string;
      passport_version: number;
      published_at: string;
      content_hash: string;
    };
    return {
      status: r.status,
      publicId: r.public_id,
      publicUrl: publicUrlFor(r.public_id),
      passportVersion: r.passport_version,
      publishedAt: r.published_at,
      contentHash: r.content_hash,
      shortIntegrityId: shortIntegrityId(r.content_hash),
    };
  });

// ---------------------------------------------------------------------------
// revokeSnapshot
// ---------------------------------------------------------------------------

export const revokeSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { passportKey: string }) =>
    z.object({ passportKey: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { error } = await (supabase.from("rights_passport_snapshots" as never) as any)
      .update({ status: "REVOKED", revoked_at: new Date().toISOString() })
      .eq("passport_key", data.passportKey)
      .eq("owner_user_id", userId)
      .eq("status", "ACTIVE");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Owner-side export downloads (JSON) — public uses the frozen snapshot when
// one exists; falls back to a clearly-labeled live preview pre-publish.
// ---------------------------------------------------------------------------

export type ExportJsonResult =
  | { mode: "published"; payload: unknown; contentHash: string; publishedAt: string }
  | { mode: "preview"; payload: unknown };

export const downloadPublicJson = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { passportKey: string }) =>
    z.object({ passportKey: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ExportJsonResult> => {
    const { supabase, userId } = context;
    const { data: snapshot } = await supabase
      .from("rights_passport_snapshots" as never)
      .select("public_payload,content_hash,published_at" as never)
      .eq("passport_key" as never, data.passportKey)
      .eq("owner_user_id" as never, userId)
      .eq("status" as never, "ACTIVE")
      .maybeSingle();
    if (snapshot) {
      const s = snapshot as unknown as {
        public_payload: unknown;
        content_hash: string;
        published_at: string;
      };
      return {
        mode: "published",
        payload: s.public_payload,
        contentHash: s.content_hash,
        publishedAt: s.published_at,
      };
    }

    const workspace = await gatherWorkspaceForVerification(supabase, userId, data.passportKey);
    const previewInput = buildSerializeInput(
      workspace,
      "UNPUBLISHED",
      "ACTIVE",
      new Date().toISOString(),
    );
    return { mode: "preview", payload: serializePublicPassport(previewInput) };
  });

export const downloadPrivateJson = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { passportKey: string }) =>
    z.object({ passportKey: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ payload: unknown }> => {
    const { supabase, userId } = context;
    const workspace = await gatherWorkspaceForVerification(supabase, userId, data.passportKey);

    const { data: snapshot } = await supabase
      .from("rights_passport_snapshots" as never)
      .select("public_id,passport_version,status,published_at" as never)
      .eq("passport_key" as never, data.passportKey)
      .eq("owner_user_id" as never, userId)
      .eq("status" as never, "ACTIVE")
      .maybeSingle();
    const s = snapshot as unknown as {
      public_id: string;
      passport_version: number;
      status: string;
      published_at: string;
    } | null;

    const input = buildSerializeInput(
      workspace,
      s?.public_id ?? "UNPUBLISHED",
      (s?.status as never) ?? "ACTIVE",
      s?.published_at ?? new Date().toISOString(),
    );
    return { payload: serializePrivatePassport(input) };
  });

// ---------------------------------------------------------------------------
// getPublicRightsCard — PUBLIC ROUTE. No requireSupabaseAuth. Reads via
// supabaseAdmin (service role) so RLS never has to grant anon access to
// these tables at all.
// ---------------------------------------------------------------------------

export type PublicRightsCardResult =
  | { found: false }
  | {
      found: true;
      revoked: boolean;
      payload: unknown;
      shortIntegrityId: string;
      publishedAt: string;
    };

const publicIdSchema = z.object({ publicId: z.string().trim().min(1).max(200) });

export const getPublicRightsCard = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => publicIdSchema.parse(input))
  .handler(async ({ data }): Promise<PublicRightsCardResult> => {
    // Reject anything that doesn't look like a real public_id up front —
    // cheap, and avoids handing a malformed string to the database at all.
    if (!/^drp_[0-9a-f]{40}$/.test(data.publicId)) {
      return { found: false };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: activeRow } = await supabaseAdmin
      .from("rights_passport_snapshots" as never)
      .select("public_payload,content_hash,published_at" as never)
      .eq("public_id" as never, data.publicId)
      .eq("status" as never, "ACTIVE")
      .maybeSingle();

    if (activeRow) {
      const r = activeRow as unknown as {
        public_payload: unknown;
        content_hash: string;
        published_at: string;
      };
      return {
        found: true,
        revoked: false,
        payload: r.public_payload,
        shortIntegrityId: shortIntegrityId(r.content_hash),
        publishedAt: r.published_at,
      };
    }

    const { data: revokedRow } = await supabaseAdmin
      .from("rights_passport_snapshots" as never)
      .select("public_payload,content_hash,published_at" as never)
      .eq("public_id" as never, data.publicId)
      .eq("status" as never, "REVOKED")
      .order("published_at" as never, { ascending: false })
      .limit(1)
      .maybeSingle();

    if (revokedRow) {
      const r = revokedRow as unknown as {
        public_payload: unknown;
        content_hash: string;
        published_at: string;
      };
      return {
        found: true,
        revoked: true,
        payload: r.public_payload,
        shortIntegrityId: shortIntegrityId(r.content_hash),
        publishedAt: r.published_at,
      };
    }

    return { found: false };
  });
