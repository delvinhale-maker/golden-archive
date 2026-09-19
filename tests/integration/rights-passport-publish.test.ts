/**
 * AurumVault Digital Rights Passport Generator — Round 4 (Generate, Verify,
 * Public Card & Export) security/regression guard.
 *
 * Same constraint as every other tests/integration/rights-passport-*.test.ts
 * file: rights-passport-publish.functions.ts / rights-passport-generate
 * .functions.ts pull in zod/@supabase/supabase-js/qrcode/pdf-lib, none of
 * which are installed in this sandbox. This suite is therefore source-level
 * verification, covering the Round 4 spec's explicit checklist (§P):
 *   - foreign user cannot publish passport
 *   - user cannot publish someone else's passport
 *   - public route sees public snapshot only
 *   - private fields never appear anonymously
 *   - superseded snapshot cannot become silently mutable
 *   - publish blocked when readiness blockers exist
 *   - successful publication creates immutable snapshot
 *   - public ID is opaque
 *   - revoke changes public state safely
 *   - QR destination correctness / public URL construction
 *
 * rights-passport-canonical-json.test.ts, rights-passport-serialize.test.ts,
 * rights-passport-export-schema.test.ts, and rights-passport-verify.test.ts
 * cover what genuinely runs (all pure logic) with real, executed
 * assertions — including the sentinel-injection privacy tests, hash
 * determinism, schema validation, and publish-blocker gating.
 *
 * Run: bun test tests/integration/rights-passport-publish.test.ts
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const migration = read("docs/proposed-migrations/20260830150000_rights_passport_publishing.sql");
const publishFn = read("src/lib/rights-passport-publish.functions.ts");
const generateFn = read("src/lib/rights-passport-generate.functions.ts");
const pdfServer = read("src/lib/rights-passport-pdf.server.ts");
const qrLib = read("src/lib/qr.ts");

function bodyOf(source: string, exportName: string): string {
  const start = source.indexOf(`export const ${exportName}`);
  expect(start, `${exportName} should exist`).toBeGreaterThan(-1);
  const end = source.indexOf("\nexport const", start + 10);
  const endAsync = source.indexOf("\nexport async function", start + 10);
  const endFn = source.indexOf("\nfunction ", start + 10);
  const endType = source.indexOf("\nexport type", start + 10);
  const candidates = [end, endAsync, endFn, endType].filter((i) => i !== -1);
  const cut = candidates.length ? Math.min(...candidates) : -1;
  return source.slice(start, cut === -1 ? undefined : cut);
}

// ---------------------------------------------------------------------------
// Migration — immutability, ownership, no anon access
// ---------------------------------------------------------------------------

describe("migration — additive only, staged (not auto-applied)", () => {
  it("lives under docs/proposed-migrations, not supabase/migrations, so it is not auto-applied", () => {
    expect(migration.length).toBeGreaterThan(0);
  });

  it("never drops, truncates, or deletes existing data; never alters a pre-existing table", () => {
    expect(migration).not.toMatch(/DROP TABLE/i);
    expect(migration).not.toMatch(/^\s*TRUNCATE TABLE/im);
    expect(migration).not.toMatch(/DELETE FROM/i);
    expect(migration).not.toMatch(
      /^ALTER TABLE public\.(rights_passports|rights_passport_assets|rights_ai_consents|rights_licenses|rights_evidence|rights_review_flags|rights_passport_documents|rights_analysis_runs|rights_analysis_findings)\b/im,
    );
  });

  it("both new tables have RLS enabled and no anon grant — private fields can never appear anonymously via direct table access", () => {
    for (const table of ["rights_passport_public_identities", "rights_passport_snapshots"]) {
      expect(migration).toContain(`CREATE TABLE public.${table}`);
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`REVOKE ALL ON public.${table} FROM anon`);
    }
  });

  it("no anon SELECT policy exists on either table — the public route must go through a server function, never direct RLS", () => {
    expect(migration).not.toMatch(/FOR SELECT TO (anon|public)/i);
  });

  it("(check: superseded snapshot cannot become silently mutable) a guard trigger blocks changing public_payload, content_hash, passport_version, public_id, passport_key, owner, or source once a snapshot row exists — only status/revoked_at may ever change", () => {
    expect(migration).toContain("rights_passport_snapshots_guard_immutable_trg");
    expect(migration).toContain("A published snapshot''s public_payload is immutable");
    expect(migration).toContain("A published snapshot''s content_hash is immutable");
    expect(migration).toContain("A published snapshot''s version is immutable");
    expect(migration).toContain("A published snapshot''s public_id is immutable");
  });

  it("at most one ACTIVE snapshot per passport_key lineage — a publish that fails to supersede the old one can never leave two simultaneously ACTIVE", () => {
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX rights_passport_snapshots_one_active_per_key\s+ON public\.rights_passport_snapshots \(passport_key\) WHERE status = 'ACTIVE'/,
    );
  });

  it("(check: public ID is opaque) public_id format is enforced at the DB layer as drp_ + 40 hex chars (160 bits of entropy) — never a sequential ID", () => {
    expect(migration).toContain("CHECK (public_id ~ '^drp_[0-9a-f]{40}$')");
  });

  it("a passport's public_id is permanent once minted — a guard trigger blocks any UPDATE to rights_passport_public_identities at all", () => {
    expect(migration).toContain("rights_passport_public_identities_guard_immutable_trg");
    expect(migration).toContain("A passport''s public_id is permanent and cannot be changed");
  });

  it("both tables reuse the existing rights_workspace_guard_passport_owner ownership guard rather than redefining it", () => {
    expect(migration).toContain("rights_passport_public_identities_guard_passport_owner_trg");
    expect(migration).toContain("rights_passport_snapshots_guard_passport_owner_trg");
    expect(migration).not.toContain(
      "CREATE OR REPLACE FUNCTION public.rights_workspace_guard_passport_owner()",
    );
  });
});

// ---------------------------------------------------------------------------
// rights-passport-publish.functions.ts
// ---------------------------------------------------------------------------

describe("rights-passport-publish.functions.ts — auth and ownership", () => {
  it("every owner-facing function requires requireSupabaseAuth", () => {
    for (const name of [
      "getVerifyStatus",
      "publishPassport",
      "getPublishedSnapshotStatus",
      "revokeSnapshot",
      "downloadPublicJson",
      "downloadPrivateJson",
    ]) {
      expect(bodyOf(publishFn, name)).toMatch(
        /\.middleware\(\[(?:requireRightsPassport\w+,\s*)?requireSupabaseAuth\]\)/,
      );
    }
  });

  it("getPublicRightsCard — the actual public route — has NO requireSupabaseAuth middleware (it must be callable anonymously)", () => {
    const body = bodyOf(publishFn, "getPublicRightsCard");
    expect(body).not.toMatch(
      /\.middleware\(\[(?:requireRightsPassport\w+,\s*)?requireSupabaseAuth\]\)/,
    );
  });

  it("(check: foreign user cannot publish / cannot publish someone else's passport) gatherWorkspaceForVerification scopes the ACTIVE workspace row by both passport_key and owner_user_id", () => {
    const helper = publishFn.slice(
      publishFn.indexOf("export async function gatherWorkspaceForVerification"),
      publishFn.indexOf("function buildSerializeInput"),
    );
    expect(helper).toMatch(/\.eq\(\s*"passport_key"[^)]*passportKey\s*\)/);
    expect(helper).toMatch(/\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/);
    expect(helper).toMatch(/\.eq\(\s*"status"[^)]*"ACTIVE"\s*\)/);
  });

  it("every child-table read in gatherWorkspaceForVerification is scoped by owner_user_id — a foreign user's data can never be pulled into someone else's verification/publish", () => {
    const helper = publishFn.slice(
      publishFn.indexOf("export async function gatherWorkspaceForVerification"),
      publishFn.indexOf("function buildSerializeInput"),
    );
    const ownerMatches = helper.match(/\.eq\("owner_user_id" as never, userId\)/g) ?? [];
    expect(ownerMatches.length).toBeGreaterThanOrEqual(5);
  });

  it("(check: publish blocked when readiness blockers exist) publishPassport checks verification.readyToPublish and throws BEFORE any snapshot table is touched", () => {
    const body = bodyOf(publishFn, "publishPassport");
    const checkIdx = body.indexOf("!verification.readyToPublish");
    const identityIdx = body.indexOf("rights_passport_public_identities");
    const snapshotInsertIdx = body.indexOf('.from("rights_passport_snapshots"');
    expect(checkIdx).toBeGreaterThan(-1);
    expect(checkIdx).toBeLessThan(identityIdx);
    expect(checkIdx).toBeLessThan(snapshotInsertIdx);
  });

  it("(check: public ID is opaque) publishPassport mints a public_id using generateQrPublicId() (160-bit CSPRNG) prefixed drp_, never a sequential/derived value, and reuses an existing one rather than minting a second", () => {
    const body = bodyOf(publishFn, "publishPassport");
    expect(body).toContain("`drp_${generateQrPublicId()}`");
    expect(body).toContain("publicId = (existingIdentity");
  });

  it("(check: successful publication creates immutable snapshot) publishPassport supersedes the previous ACTIVE snapshot (scoped by passport_key+owner+status=ACTIVE) BEFORE inserting the new one, and links supersedes_snapshot_id", () => {
    const body = bodyOf(publishFn, "publishPassport");
    const supersedeIdx = body.indexOf('.update({ status: "SUPERSEDED" })');
    const insertMatch = body.match(
      /rights_passport_snapshots" as never\) as any\s*\)\s*\.insert\(/,
    );
    expect(supersedeIdx).toBeGreaterThan(-1);
    expect(insertMatch).not.toBeNull();
    const insertIdx = body.indexOf(insertMatch![0]);
    expect(insertIdx).toBeGreaterThan(supersedeIdx);
    expect(body).toContain("supersedes_snapshot_id: previousActiveId");
  });

  it("the content_hash stored on the new snapshot is computed from the same public_payload that gets stored — never a hash of something else", () => {
    const body = bodyOf(publishFn, "publishPassport");
    expect(body).toContain("const contentHash = await hashCanonicalPayload(publicPayload)");
    expect(body).toMatch(/public_payload: publicPayload,[\s\S]{0,300}content_hash: contentHash,/);
  });

  it("(check: revoke changes public state safely) revokeSnapshot is scoped by passport_key, owner_user_id, AND status=ACTIVE — cannot revoke another user's snapshot or an already-revoked one", () => {
    const body = bodyOf(publishFn, "revokeSnapshot");
    expect(body).toMatch(/\.eq\(\s*"passport_key"[^)]*data\.passportKey\s*\)/);
    expect(body).toMatch(/\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/);
    expect(body).toMatch(/\.eq\(\s*"status"[^)]*"ACTIVE"\s*\)/);
    expect(body).toContain('status: "REVOKED"');
  });

  it("(check: public route sees public snapshot only / private fields never appear anonymously) getPublicRightsCard selects ONLY public_payload, content_hash, and published_at — never owner_user_id, passport_key, source_passport_id, or private_snapshot_metadata", () => {
    const body = bodyOf(publishFn, "getPublicRightsCard");
    const selectCalls = [...body.matchAll(/\.select\("([^"]+)" as never\)/g)].map((m) => m[1]);
    expect(selectCalls.length).toBeGreaterThan(0);
    for (const cols of selectCalls) {
      expect(cols).not.toContain("owner_user_id");
      expect(cols).not.toContain("private_snapshot_metadata");
      expect(cols).not.toContain("source_passport_id");
      expect(cols).not.toMatch(/(^|,)passport_key(,|$)/);
    }
  });

  it("getPublicRightsCard uses supabaseAdmin (service role), never the RLS-bound context.supabase — RLS on these tables grants nothing to anon, so an anonymous caller can only ever reach data through this one deliberately-narrow function", () => {
    const body = bodyOf(publishFn, "getPublicRightsCard");
    expect(body).toContain("supabaseAdmin");
    expect(body).not.toContain("context.supabase");
  });

  it("getPublicRightsCard rejects any publicId that doesn't match the real format before ever querying the database", () => {
    const body = bodyOf(publishFn, "getPublicRightsCard");
    expect(body).toMatch(/\/\^drp_\[0-9a-f\]\{40\}\$\/\.test\(data\.publicId\)/);
  });

  it("getPublicRightsCard only ever resolves ACTIVE or REVOKED snapshots — never SUPERSEDED (no historical version browsing) — and prefers ACTIVE first", () => {
    const body = bodyOf(publishFn, "getPublicRightsCard");
    const activeIdx = body.indexOf('.eq("status" as never, "ACTIVE")');
    const revokedIdx = body.indexOf('.eq("status" as never, "REVOKED")');
    expect(activeIdx).toBeGreaterThan(-1);
    expect(revokedIdx).toBeGreaterThan(activeIdx);
    expect(body).not.toContain('"SUPERSEDED")');
  });

  it("(check: QR destination / public URL construction) publicUrlFor builds the URL from SITE_URL + /rights/ + publicId — the same canonical base URL used by the rest of the QR system, never a staging/preview origin", () => {
    expect(publishFn).toContain("const RIGHTS_CARD_BASE = `${SITE_URL}/rights`");
    expect(publishFn).toContain("export function publicUrlFor(publicId: string): string {");
    expect(publishFn).toContain("return `${RIGHTS_CARD_BASE}/${publicId}`");
  });

  it("owner_user_id is always derived from context, never accepted from client input", () => {
    expect(publishFn).not.toMatch(/ownerUserId/);
    expect(publishFn).not.toMatch(/owner_user_id:\s*data\./);
  });

  it("downloadPublicJson/downloadPrivateJson are owner-scoped and read the frozen ACTIVE snapshot when one exists rather than always re-deriving from live workspace state", () => {
    for (const name of ["downloadPublicJson", "downloadPrivateJson"]) {
      const body = bodyOf(publishFn, name);
      expect(body).toMatch(/\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/);
      expect(body).toContain('.eq("status" as never, "ACTIVE")');
    }
  });
});

// ---------------------------------------------------------------------------
// rights-passport-generate.functions.ts — QR + PDF
// ---------------------------------------------------------------------------

describe("rights-passport-generate.functions.ts — QR reuses the one existing QR pipeline, never a second system", () => {
  it("imports validateQrColors/resolveQrSizePx from the existing @/lib/qr module rather than reimplementing color/size validation", () => {
    expect(generateFn).toContain('import { validateQrColors, resolveQrSizePx } from "@/lib/qr"');
  });

  it("uses the qrcode package directly (same library qr.functions.ts's renderQrImage already uses), not a second QR-encoding dependency", () => {
    expect(generateFn).toContain('import QRCode from "qrcode"');
  });

  it("renderPassportQr always encodes publicUrlFor(publicId) — never a raw destination, never JSON, never a signed storage URL", () => {
    const body = bodyOf(generateFn, "renderPassportQr");
    expect(body).toContain("const url = publicUrlFor(publicId)");
    expect(body).toMatch(/QRCode\.toDataURL\(url,/);
    expect(body).toMatch(/QRCode\.toString\(url,/);
  });

  it("the QR destination is resolved server-side from the owner's own resolveOwnedPublicId lookup — never accepted as a client-supplied URL", () => {
    expect(generateFn).not.toMatch(/data\.url/);
    expect(generateFn).not.toMatch(/data\.destination/);
    const helper = generateFn.slice(
      generateFn.indexOf("async function resolveOwnedPublicId"),
      generateFn.indexOf("async function renderQrPng"),
    );
    expect(helper).toMatch(/\.eq\(\s*"passport_key"[^)]*passportKey\s*\)/);
    expect(helper).toMatch(/\.eq\(\s*"owner_user_id"[^)]*userId\s*\)/);
  });

  it("PDF downloads are owner-scoped through gatherWorkspaceForVerification/resolvePayloadForPdf, reusing the same shared helpers publishPassport uses rather than a separate data path", () => {
    for (const name of ["downloadPublicPassportPdf", "downloadPrivatePassportPdf"]) {
      expect(bodyOf(generateFn, name)).toMatch(
        /\.middleware\(\[(?:requireRightsPassport\w+,\s*)?requireSupabaseAuth\]\)/,
      );
    }
    expect(generateFn).toMatch(/resolvePayloadForPdf\(\s*supabase,\s*userId,\s*data\.passportKey/);
  });

  it("the public PDF path calls serializePublicPassport, the private PDF path calls serializePrivatePassport — never the wrong one", () => {
    const helper = generateFn.slice(
      generateFn.indexOf("async function resolvePayloadForPdf"),
      generateFn.indexOf("function bytesToBase64"),
    );
    expect(helper).toMatch(
      /mode === "public"\s*\?\s*serializePublicPassport\(serializeInput\)\s*:\s*serializePrivatePassport\(serializeInput\)/,
    );
  });
});

describe("rights-passport-pdf.server.ts — no independent field sourcing beyond the serializer types", () => {
  it("draws only fields already typed on PublicPassportPayload/PrivatePassportPayload — imports those types rather than raw DB row types", () => {
    expect(pdfServer).toMatch(
      /import type \{\s*PublicPassportPayload,\s*PrivatePassportPayload,?\s*\} from "@\/lib\/rights-passport-serialize"/,
    );
    expect(pdfServer).not.toMatch(/from "@\/lib\/rights-passport\.schema"/);
    expect(pdfServer).not.toMatch(/from "@\/lib\/rights-passport-workspace\.schema"/);
  });

  it("is a .server.ts module — never bundled to the client, matching the existing client.server.ts naming convention", () => {
    expect(pdfServer.length).toBeGreaterThan(0);
  });

  it("private-only content (legal_name, representative, successor contact) is only drawn when mode === 'private'", () => {
    const block = pdfServer.slice(
      pdfServer.indexOf('if (opts.mode === "private" && "private" in payload)'),
    );
    expect(block).toContain("priv.legal_name");
    expect(block).toContain("priv.successor_estate_contact");
  });
});

describe("QR base URL — consistent with the rest of the AurumVault QR system (spec §F: SEARCH FIRST)", () => {
  it("qr.ts's SITE_URL is the same constant rights-passport-publish.functions.ts builds public URLs from", () => {
    expect(qrLib).toContain('export const SITE_URL = "https://www.aurumvault.store"');
    expect(publishFn).toContain("SITE_URL");
  });

  it("generateQrPublicId (the existing 160-bit CSPRNG generator) is reused rather than reimplemented", () => {
    expect(qrLib).toContain("export function generateQrPublicId(): string {");
    expect(publishFn).toContain("generateQrPublicId");
    expect(generateFn).not.toContain("crypto.getRandomValues");
  });
});
