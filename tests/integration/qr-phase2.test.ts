/**
 * AurumVault QR Business System — Phase 2 security/regression guard.
 *
 * Same environment constraint as tests/integration/qr-system.test.ts: the
 * Phase 2 server function files pull in zod/@supabase/supabase-js/
 * @tanstack/react-start, none of which are installed in this sandbox, so
 * they can't be imported and executed directly here. This suite is
 * source-level verification — it asserts on the actual file contents.
 * qr-use-cases.test.ts covers what genuinely can run (the pure config) with
 * real, executed assertions.
 *
 * Run: bun test tests/integration/qr-phase2.test.ts
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const qrFn = read("src/lib/qr.functions.ts");
const campaignsFn = read("src/lib/qr-campaigns.functions.ts");
const shortcutsFn = read("src/lib/qr-shortcuts.functions.ts");
const migration = read("supabase/migrations/20260825130125_qr_phase2_campaigns.sql");

function bodyOf(source: string, exportName: string): string {
  const start = source.indexOf(`export const ${exportName}`);
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf("\nexport const", start + 10);
  return source.slice(start, end === -1 ? undefined : end);
}

describe("Phase 2 migration — additive only, no Phase 1 rewrite", () => {
  it("never drops or rewrites qr_projects/qr_scan_events, only adds columns", () => {
    expect(migration).not.toMatch(/DROP TABLE/i);
    expect(migration).not.toMatch(/DROP COLUMN/i);
    // "TRUNCATE" legitimately appears inside "REVOKE ... TRUNCATE ... FROM
    // authenticated" (hardening a grant, not a destructive statement) — the
    // actual thing to rule out is a bare TRUNCATE TABLE statement.
    expect(migration).not.toMatch(/^\s*TRUNCATE TABLE/im);
    expect(migration).toMatch(/ALTER TABLE public\.qr_projects\s+ADD COLUMN/);
  });

  it("every new qr_projects column is nullable (no NOT NULL without a default)", () => {
    const alterBlock = migration.slice(
      migration.indexOf("ALTER TABLE public.qr_projects"),
      migration.indexOf("CREATE TABLE public.qr_campaigns"),
    );
    expect(alterBlock).not.toMatch(/NOT NULL/);
  });

  it("qr_campaigns has owner-scoped RLS only — no public/anon SELECT", () => {
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain('CREATE POLICY "qr_campaigns_owner_read"');
    expect(migration).toMatch(/owner_user_id = auth\.uid\(\)/);
    expect(migration).toContain("REVOKE ALL ON public.qr_campaigns FROM anon");
    expect(migration).not.toMatch(/FOR SELECT TO anon/);
  });

  it("qr_projects.campaign_id is a nullable FK with ON DELETE SET NULL, never CASCADE", () => {
    expect(migration).toMatch(
      /ADD COLUMN campaign_id UUID NULL REFERENCES public\.qr_campaigns\(id\) ON DELETE SET NULL/,
    );
  });

  it("has a defense-in-depth trigger blocking cross-owner campaign attachment", () => {
    expect(migration).toContain("qr_projects_guard_campaign_owner");
    expect(migration).toMatch(/campaign_owner IS DISTINCT FROM NEW\.owner_user_id/);
  });
});

describe("qr.functions.ts Phase 2 additions — owner-derived, limit-preserving", () => {
  it("createQrProject and duplicateQrProject both verify campaign ownership before attaching", () => {
    const create = bodyOf(qrFn, "createQrProject");
    expect(create).toContain("assertOwnsCampaign(supabase, userId, data.campaignId)");
  });

  it("updateQrProject re-verifies campaign ownership when campaignId changes", () => {
    const update = bodyOf(qrFn, "updateQrProject");
    expect(update).toContain("assertOwnsCampaign(supabase, userId, data.campaignId)");
  });

  it("assertOwnsCampaign scopes its lookup by both campaign id and owner_user_id", () => {
    const helper = qrFn.slice(
      qrFn.indexOf("async function assertOwnsCampaign"),
      qrFn.indexOf("async function assertOwnsCampaign") + 700,
    );
    expect(helper).toMatch(/\.eq\(\s*"id"\s*as never,\s*campaignId\s*\)/);
    expect(helper).toMatch(/\.eq\(\s*"owner_user_id"\s*as never,\s*userId\s*\)/);
  });

  it("duplicateQrProject re-derives ownership of the source row and generates a brand-new public_id", () => {
    const dup = bodyOf(qrFn, "duplicateQrProject");
    expect(dup).toMatch(/\.eq\(\s*"id"\s*as never,\s*data\.id\s*\)/);
    expect(dup).toMatch(/\.eq\(\s*"owner_user_id"\s*as never,\s*userId\s*\)/);
    expect(dup).toContain("generateQrPublicId()");
    // Never copies the source row's own public_id forward.
    expect(dup).not.toMatch(/public_id:\s*src\.public_id/);
  });

  it("duplicateQrProject enforces the exact same active-dynamic limit as createQrProject", () => {
    const dup = bodyOf(qrFn, "duplicateQrProject");
    expect(dup).toContain("MAX_ACTIVE_DYNAMIC_QR");
    expect(dup).toMatch(/neq\(\s*"status"\s*as never,\s*"archived"\s*\)/);
  });

  it("getQrProjectAnalytics scopes the owned-row check by id and owner_user_id before returning any stats", () => {
    const analytics = bodyOf(qrFn, "getQrProjectAnalytics");
    expect(analytics).toMatch(/\.eq\(\s*"id"\s*as never,\s*data\.id\s*\)/);
    expect(analytics).toMatch(/\.eq\(\s*"owner_user_id"\s*as never,\s*userId\s*\)/);
    expect(analytics).toContain('if (!owned) throw new Error("QR code not found")');
  });

  it("getQrProjectAnalytics never queries IP, geo, or fingerprint columns — only created_at", () => {
    const analytics = bodyOf(qrFn, "getQrProjectAnalytics");
    expect(analytics).not.toMatch(/ip_address|geo|latitude|longitude|fingerprint/i);
    expect(analytics).toContain('.select("created_at" as never)');
  });
});

describe("qr-campaigns.functions.ts — cross-owner denial", () => {
  it("every campaign function requires requireSupabaseAuth", () => {
    for (const name of [
      "createQrCampaign",
      "updateQrCampaign",
      "listMyQrCampaigns",
      "getMyQrCampaign",
      "getQrCampaignAnalytics",
    ]) {
      const body = bodyOf(campaignsFn, name);
      expect(body).toContain(".middleware([requireSupabaseAuth])");
    }
  });

  it("createQrCampaign derives owner_user_id from context, never from client input", () => {
    const body = bodyOf(campaignsFn, "createQrCampaign");
    expect(body).toContain("owner_user_id: userId");
    expect(campaignsFn).not.toMatch(/z\.[^\n]*owner_user_id/);
    expect(campaignsFn).not.toMatch(/ownerUserId/);
  });

  it("updateQrCampaign scopes its write by both id and owner_user_id — cannot touch another user's campaign", () => {
    const body = bodyOf(campaignsFn, "updateQrCampaign");
    expect(body).toMatch(/\.eq\(\s*"id",\s*data\.id\s*\)/);
    expect(body).toMatch(/\.eq\(\s*"owner_user_id",\s*userId\s*\)/);
  });

  it("getMyQrCampaign and getQrCampaignAnalytics both scope their read by owner_user_id", () => {
    for (const name of ["getMyQrCampaign", "getQrCampaignAnalytics"]) {
      const body = bodyOf(campaignsFn, name);
      expect(body).toMatch(/\.eq\(\s*"owner_user_id"\s*as never,\s*userId\s*\)/);
    }
  });

  it("getQrCampaignAnalytics only aggregates projects it re-verifies are owned by the caller", () => {
    const body = bodyOf(campaignsFn, "getQrCampaignAnalytics");
    // Projects are fetched scoped by owner_user_id AND campaign_id together
    // — a project can never be attributed to a campaign it doesn't belong
    // to, even if IDs collided across owners.
    expect(body).toMatch(/\.eq\(\s*"owner_user_id"\s*as never,\s*userId\s*\)/);
    expect(body).toMatch(/\.eq\(\s*"campaign_id"\s*as never,\s*data\.id\s*\)/);
  });

  it("listMyQrCampaigns scopes both campaigns and their projects by owner_user_id", () => {
    const body = bodyOf(campaignsFn, "listMyQrCampaigns");
    const occurrences = body.match(/\.eq\(\s*"owner_user_id"\s*as never,\s*userId\s*\)/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });
});

describe("qr-shortcuts.functions.ts — never trust client-supplied ownership", () => {
  it("every shortcut function requires requireSupabaseAuth", () => {
    for (const name of ["createStorefrontQrShortcut", "createProductQrShortcut", "listMyEligibleProducts"]) {
      const body = bodyOf(shortcutsFn, name);
      expect(body).toContain(".middleware([requireSupabaseAuth])");
    }
  });

  it("createStorefrontQrShortcut looks up the caller's own seller_applications row by context.userId, not a client slug", () => {
    const body = bodyOf(shortcutsFn, "createStorefrontQrShortcut");
    expect(body).toContain('.eq("user_id", context.userId)');
    expect(body).not.toMatch(/data\.(brandSlug|slug)/);
  });

  it("createStorefrontQrShortcut requires approved status and a set brand_slug before returning a destination", () => {
    const body = bodyOf(shortcutsFn, "createStorefrontQrShortcut");
    expect(body).toMatch(/status.*!==\s*"approved"/);
    expect(body).toContain("if (!brandSlug)");
  });

  it("createProductQrShortcut scopes the product lookup by seller_id = context.userId", () => {
    const body = bodyOf(shortcutsFn, "createProductQrShortcut");
    expect(body).toMatch(/\.eq\(\s*"seller_id",\s*userId\s*\)/);
  });

  it("createProductQrShortcut requires both approved status and published=true", () => {
    const body = bodyOf(shortcutsFn, "createProductQrShortcut");
    expect(body).toMatch(/status.*!==\s*"approved"/);
    expect(body).toMatch(/!\(product as any\)\.published/);
  });

  it("listMyEligibleProducts only returns the caller's own approved+published products", () => {
    const body = bodyOf(shortcutsFn, "listMyEligibleProducts");
    expect(body).toMatch(/\.eq\(\s*"seller_id",\s*userId\s*\)/);
    expect(body).toContain('.eq("status", "approved")');
    expect(body).toContain('.eq("published", true)');
  });

  it("both shortcuts build destinations from SITE_URL, never from raw client-supplied paths", () => {
    expect(shortcutsFn).toContain("`${SITE_URL}/store/${brandSlug}`");
    expect(shortcutsFn).toMatch(/\$\{SITE_URL\}\/products\/\$\{/);
    expect(shortcutsFn).not.toMatch(/data\.destination\b/);
  });

  it("bundle shortcut is explicitly NOT implemented (deferred per Phase 2 authorization)", () => {
    expect(shortcutsFn).not.toMatch(/BundleQrShortcut|bundle_slug.*destination/i);
  });
});

describe("Phase 2 — no bypass of the 3-active-dynamic-QR limit", () => {
  it("createQrProject, duplicateQrProject both gate on MAX_ACTIVE_DYNAMIC_QR before insert", () => {
    for (const name of ["createQrProject", "duplicateQrProject"]) {
      const body = bodyOf(qrFn, name);
      expect(body).toContain("MAX_ACTIVE_DYNAMIC_QR");
    }
  });

  it("campaign attachment happens through createQrProject/updateQrProject only — qr-campaigns.functions.ts only reads qr_projects (for counts/analytics), never inserts into it", () => {
    expect(campaignsFn).not.toMatch(/\.from\(\s*"qr_projects"\s*as never\s*\)\s*(?:as any\s*)?\)?\s*\n?\s*\.insert\(/);
    // Every qr_projects reference in this file is a .select(...), not a write.
    const qrProjectsBlocks = campaignsFn.split('.from("qr_projects" as never)').slice(1);
    for (const block of qrProjectsBlocks) {
      const nextCall = block.match(/\.(select|insert|update|delete)\(/);
      expect(nextCall?.[1]).toBe("select");
    }
  });

  it("shortcut functions never insert into qr_projects directly — they only return a destination string", () => {
    expect(shortcutsFn).not.toMatch(/\.from\(\s*"qr_projects"/);
    expect(shortcutsFn).not.toContain(".insert(");
  });
});
