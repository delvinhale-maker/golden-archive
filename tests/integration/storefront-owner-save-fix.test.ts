/**
 * Static regression guard for the creator storefront owner-save security fix.
 *
 * seller_applications has no owner-scoped RLS UPDATE policy (only the
 * admin-only `apps_admin_all` permits UPDATE), so `dashboard.storefront.tsx`'s
 * direct authenticated-client `.update()` calls against cover_url/
 * extended_bio/story/credentials/featured_media_url were failing under RLS
 * for every approved creator. The fix routes those writes through a new
 * server function, `saveMyStorefrontProfile`, that authenticates the caller,
 * re-derives ownership + approval status server-side, applies an explicit
 * field whitelist, and writes via the service-role client — never a broad
 * owner RLS policy, since this table also holds admin/moderation fields,
 * the privacy-protected applicant_email, and campaign-attribution columns
 * that must never become owner-writable.
 *
 * No live Supabase/RLS engine is available in this sandbox, so this suite is
 * source-level verification only — it does NOT execute a real RLS policy or
 * a real database write. It confirms the field whitelist, the ownership/
 * approval derivation, and the call-site wiring are present in source.
 *
 * Run: bun test tests/integration/storefront-owner-save-fix.test.ts
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const fn = read("src/lib/storefront.functions.ts");
const page = read("src/routes/_authenticated/dashboard.storefront.tsx");
const adminIndex = read("src/routes/_authenticated/admin.index.tsx");
const board = read("src/components/admin/CreatorApplicationsBoard.tsx");
const store = read("src/routes/store.$slug.tsx");

const saveFnBody = fn.slice(
  fn.indexOf("export const saveMyStorefrontProfile"),
  fn.indexOf("export const logStorefrontEvent"),
);

describe("saveMyStorefrontProfile — owner success path", () => {
  it("requires authentication via the same middleware as the rest of the server-fn layer", () => {
    expect(saveFnBody).toContain(".middleware([requireSupabaseAuth])");
  });

  it("writes exactly the five legitimate storefront-profile fields, snake_cased for the DB", () => {
    expect(saveFnBody).toMatch(/patch\.cover_url\s*=/);
    expect(saveFnBody).toMatch(/patch\.extended_bio\s*=/);
    expect(saveFnBody).toMatch(/patch\.story\s*=/);
    expect(saveFnBody).toMatch(/patch\.credentials\s*=/);
    expect(saveFnBody).toMatch(/patch\.featured_media_url\s*=/);
  });

  it("only ever builds the update payload through the local `patch` object (no spread of raw client input)", () => {
    expect(saveFnBody).not.toMatch(/\.update\(\s*data\s*\)/);
    expect(saveFnBody).not.toMatch(/\.update\(\{\s*\.\.\.data/);
  });

  it("validates cover and featured-media URLs through the shared safe-URL guard", () => {
    expect(saveFnBody).toContain("safeExternalUrl(data.coverUrl)");
    expect(saveFnBody).toContain("safeExternalUrl(data.featuredMediaUrl)");
  });
});

describe("saveMyStorefrontProfile — protected-field failure (owner cannot escalate)", () => {
  it("never references any admin/moderation/governance/campaign column in the writable patch", () => {
    const protectedCols = [
      "status",
      "admin_notes",
      "admin_feedback",
      "reviewed_at",
      "reapply_after",
      "user_id",
      "brand_slug",
      "applicant_email",
      "campaign",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "creator_lead_id",
    ];
    for (const col of protectedCols) {
      expect(saveFnBody).not.toContain(`patch.${col}`);
    }
  });

  it("the input validator only accepts the five whitelisted keys (zod object schema)", () => {
    const schemaMatch = saveFnBody.match(/z\s*\.object\(\{([\s\S]*?)\}\)/);
    expect(schemaMatch, "zod object schema not found").not.toBeNull();
    const schema = schemaMatch![1];
    for (const key of ["coverUrl", "extendedBio", "story", "credentials", "featuredMediaUrl"]) {
      expect(schema).toContain(key);
    }
    // exactly 5 fields declared (5 top-level `:` field separators in the schema block)
    const fieldCount = (schema.match(/^\s*\w+:/gm) ?? []).length;
    expect(fieldCount).toBe(5);
  });

  it("the existing admin-fields guard trigger's protected columns are a documented, not silently-relied-on, backstop", () => {
    // The fix doesn't touch RLS/grants at all — it bypasses RLS via the
    // service-role client instead of relying on the trigger's (incomplete,
    // for this purpose) blocklist. Document that reasoning stays in source.
    expect(fn).toMatch(/no owner-scoped RLS UPDATE policy/);
  });
});

describe("saveMyStorefrontProfile — cross-owner protection", () => {
  it("derives the target row from the authenticated context, never from client-supplied data", () => {
    expect(saveFnBody).toContain(".eq(\"user_id\", context.userId)");
    expect(saveFnBody).not.toMatch(/\.eq\(\s*"user_id"\s*,\s*data\./);
  });

  it("scopes the update by both the server-looked-up row id and user_id (defense in depth)", () => {
    expect(saveFnBody).toMatch(/\.update\(patch\)\s*\n?\s*\.eq\(\s*"id",\s*\(app as any\)\.id\s*\)\s*\n?\s*\.eq\(\s*"user_id",\s*context\.userId\s*\)/);
  });

  it("only proceeds for the caller's own approved application (matches existing dashboard UX gate)", () => {
    expect(saveFnBody).toContain('.eq("user_id", context.userId)');
    expect(saveFnBody).toMatch(/status\s*!==\s*"approved"/);
  });

  it("uses the service-role client, not the caller's own RLS-bound client, for the write", () => {
    expect(saveFnBody).toContain('await import("@/integrations/supabase/client.server")');
    expect(saveFnBody).toContain("supabaseAdmin");
    // service-role import must be inside the handler, never hoisted to module scope
    // (which would bundle it into client code).
    const topOfFile = fn.slice(0, fn.indexOf("export const getStorefrontSettings"));
    expect(topOfFile).not.toContain("client.server");
  });
});

describe("privacy regression: the four-column fix from the prior release remains intact", () => {
  it("saveMyStorefrontProfile never selects or writes applicant_email/admin_notes/admin_feedback/reapply_after", () => {
    for (const col of ["applicant_email", "admin_notes", "admin_feedback", "reapply_after"]) {
      expect(saveFnBody).not.toContain(col);
    }
  });

  it("the privacy-fix migration file is untouched by this pass", () => {
    // This test only proves the file still exists with its REVOKE intact;
    // full migration-history verification was performed in the release-gate
    // audit and is not re-derived here.
    const migration = read(
      "supabase/migrations/20260823222232_revoke_seller_applications_sensitive_columns.sql",
    );
    expect(migration).toContain(
      "REVOKE SELECT (applicant_email, admin_notes, admin_feedback, reapply_after)",
    );
    expect(migration).toContain("FROM authenticated");
  });
});

describe("admin regression: existing admin review/update flows untouched", () => {
  it("admin approve/reject still write status/reviewed_at directly (admin path, unaffected)", () => {
    expect(adminIndex).toContain('.update({ status: "approved", reviewed_at: new Date().toISOString() })');
    expect(adminIndex).toContain('.update({ status: "rejected", reviewed_at: new Date().toISOString() })');
  });

  it("CreatorApplicationsBoard's admin setStatus patch path is unchanged", () => {
    expect(board).toContain('supabase.from("seller_applications").update(patch).eq("id", a.id)');
  });
});

describe("public storefront regression: /store/$slug still reads the five fields", () => {
  it("selects cover_url, extended_bio, story, credentials, featured_media_url", () => {
    for (const col of ["cover_url", "extended_bio", "story", "credentials", "featured_media_url"]) {
      expect(store).toContain(col);
    }
  });
});

describe("cover upload: dashboard.storefront.tsx no longer writes seller_applications directly", () => {
  it("uploadCover() and saveProfile() route through saveMyStorefrontProfile, not a raw client .update()", () => {
    expect(page).toContain("saveMyStorefrontProfile");
    expect(page).toContain("const saveProfileFn = useServerFn(saveMyStorefrontProfile)");
    expect(page).not.toMatch(/supabase\.from\("seller_applications"\) as any\)\s*\n\s*\.update/);
  });

  it("uploadCover() still uploads to the per-user storage path before saving the URL", () => {
    const uploadCoverBody = page.slice(page.indexOf("const uploadCover ="), page.indexOf("const saveProfile ="));
    expect(uploadCoverBody).toContain('`${user.id}/cover-${Date.now()}.${ext}`');
    expect(uploadCoverBody).toContain("saveProfileFn({ data: { coverUrl: pub.publicUrl } })");
  });

  it("saveProfile() sends all four About-form fields in one call", () => {
    const saveProfileBody = page.slice(page.indexOf("const saveProfile = async"), page.indexOf("if (loading)"));
    expect(saveProfileBody).toContain("extendedBio: extendedBio || null");
    expect(saveProfileBody).toContain("story: story || null");
    expect(saveProfileBody).toContain("credentials: creds.length ? creds : null");
    expect(saveProfileBody).toContain("featuredMediaUrl: featuredMediaUrl || null");
  });
});
