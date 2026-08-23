/**
 * Static regression guard for the seller_applications privacy fix.
 * No live DB in this sandbox, so these are migration/source-level checks,
 * not executed-query checks — see the accompanying report for exactly
 * which claims are/aren't runtime-verified.
 *
 * Run: bun test tests/integration/seller-application-privacy-fix.test.ts
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const SENSITIVE = ["applicant_email", "admin_notes", "admin_feedback", "reapply_after"];

function findMigration(): string {
  const dir = join(ROOT, "supabase/migrations");
  const match = readdirSync(dir).find((f) => f.includes("revoke_seller_applications_sensitive_columns"));
  if (!match) throw new Error("privacy-fix migration file not found");
  return readFileSync(join(dir, match), "utf8");
}

describe("migration: revoke sensitive columns from authenticated", () => {
  const migration = findMigration();

  it("revokes exactly the four sensitive columns, and only from authenticated", () => {
    const m = migration.match(/REVOKE SELECT \(([^)]+)\)\s*\n?\s*ON public\.seller_applications\s*\n?\s*FROM\s+(\w+);/);
    expect(m, "REVOKE statement not found").not.toBeNull();
    const cols = m![1].split(",").map((c) => c.trim()).sort();
    expect(cols).toEqual([...SENSITIVE].sort());
    expect(m![2]).toBe("authenticated");
  });

  it("does not touch service_role access", () => {
    expect(migration).not.toMatch(/REVOKE[^;]*service_role/i);
  });

  it("does not touch anon (anon never had these columns)", () => {
    const sqlOnly = migration
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    expect(sqlOnly).not.toMatch(/anon/);
  });

  it("does not touch any public-safe column", () => {
    const publicCols = [
      "brand_name", "brand_slug", "pitch", "product_types", "website", "country",
      "social_links", "categories", "price_range", "cover_url", "extended_bio",
      "story", "credentials", "featured_media_url",
    ];
    const revokeLine = migration.match(/REVOKE SELECT \([^)]+\)/)?.[0] ?? "";
    for (const col of publicCols) expect(revokeLine).not.toContain(col);
  });

  it("is a single, minimal, reversible statement (no DROP/schema changes)", () => {
    const sqlOnly = migration
      .split("\n")
      .filter((l) => !l.trim().startsWith("--") && l.trim().length > 0)
      .join("\n");
    const statements = sqlOnly.split(";").map((s) => s.trim()).filter(Boolean);
    expect(statements.length).toBe(1);
    expect(migration).not.toMatch(/DROP TABLE|DROP COLUMN|ALTER TABLE.*DROP/i);
  });

  it("is ordered after every other migration touching seller_applications (won't be superseded)", () => {
    const dir = join(ROOT, "supabase/migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql"));
    const thisFile = files.find((f) => f.includes("revoke_seller_applications_sensitive_columns"))!;
    const others = files.filter(
      (f) => f !== thisFile && read(`supabase/migrations/${f}`).includes("seller_applications"),
    );
    for (const other of others) expect(thisFile > other).toBe(true);
  });
});

describe("admin server function", () => {
  const fn = read("src/lib/admin-seller-applications.functions.ts");

  it("authenticates the caller before doing anything else", () => {
    expect(fn).toContain("requireSupabaseAuth");
    expect(fn).toContain(".middleware([requireSupabaseAuth])");
  });

  it("verifies admin role via the existing has_role-equivalent mechanism before any privileged read", () => {
    expect(fn).toMatch(/await assertAdmin\(context\.userId\)/);
    const assertAdminBody = fn.slice(fn.indexOf("async function assertAdmin"), fn.indexOf("export const getSellerApplicationsForAdmin"));
    expect(assertAdminBody).toContain('.from("user_roles")');
    expect(assertAdminBody).toContain('.eq("role", "admin")');
    expect(assertAdminBody).toContain('throw new Error("forbidden")');
  });

  it("rejects non-admin callers (assertAdmin runs before the seller_applications query)", () => {
    const handlerBody = fn.slice(fn.indexOf("export const getSellerApplicationsForAdmin"));
    const assertIdx = handlerBody.indexOf("assertAdmin(context.userId)");
    const queryIdx = handlerBody.indexOf('.from("seller_applications")');
    expect(assertIdx).toBeGreaterThan(-1);
    expect(queryIdx).toBeGreaterThan(assertIdx);
  });

  it("only uses the service-role client via dynamic import, never a top-level import (keeps the key out of the client bundle)", () => {
    expect(fn).not.toMatch(/^import\s*\{[^}]*supabaseAdmin/m);
    expect(fn).toContain('await import("@/integrations/supabase/client.server")');
  });

  it("selects an explicit column list, not select(\"*\")", () => {
    expect(fn).not.toContain('select("*")');
    const selectMatch = fn.match(/\.from\("seller_applications"\)\s*\.select\(\s*"([^"]+)"/);
    expect(selectMatch).not.toBeNull();
    for (const col of SENSITIVE) expect(selectMatch![1]).toContain(col);
  });
});

describe("admin components no longer read sensitive columns via the client role", () => {
  const adminIndex = read("src/routes/_authenticated/admin.index.tsx");
  const board = read("src/components/admin/CreatorApplicationsBoard.tsx");

  it("admin.index.tsx no longer selects seller_applications via the client authenticated role", () => {
    expect(adminIndex).not.toMatch(/supabase\.from\("seller_applications"\)\.select/);
    expect(adminIndex).toContain("getSellerApplicationsForAdmin");
    expect(adminIndex).toContain("fetchSellerApplications()");
  });

  it("CreatorApplicationsBoard.tsx no longer selects seller_applications via the client authenticated role", () => {
    // ensureBrandSlug's `.select("id")` (uniqueness check) is fine — only
    // the *,sensitive-field-bearing select("*") must be gone.
    expect(board).not.toMatch(/\.from\("seller_applications"\)\s*\.select\("\*"\)/);
    expect(board).toContain("getSellerApplicationsForAdmin");
    expect(board).toContain("fetchSellerApplications()");
  });

  it("write paths (approve/reject/update) are untouched — still direct client .update() calls through apps_admin_all", () => {
    expect(adminIndex).toContain('supabase.from("seller_applications").update({ status: "approved"');
    expect(adminIndex).toContain('supabase.from("seller_applications").update({ status: "rejected"');
    expect(board).toContain('supabase.from("seller_applications").update(patch)');
  });

  it("approve/reject email flow still has applicant_email available (from the admin-gated function's return type)", () => {
    expect(adminIndex).toContain("a.applicant_email");
    expect(adminIndex).toContain("recipientEmail: a.applicant_email");
  });

  it("Founding Creator acceptance flow is untouched and stays on the service-role path (unaffected by the authenticated-role revoke)", () => {
    // founding.server.ts reads applicant_email via adminClient() (service
    // role, imported from starter-pack.server.ts) inside acceptFoundingCreator,
    // called only from founding.functions.ts's admin-gated server function —
    // never via the client `authenticated` role, so the REVOKE doesn't touch it.
    const foundingServer = read("src/lib/founding.server.ts");
    const foundingFn = read("src/lib/founding.functions.ts");
    expect(foundingServer).toContain("adminClient()");
    expect(foundingServer).toMatch(/adminClient\(\)[\s\S]{0,80}\.from\("seller_applications"\)/);
    expect(foundingFn).toContain('_role: "admin"');
  });
});

describe("no owner-read path was added (nothing currently needs one)", () => {
  const sell = read("src/routes/sell.tsx");

  it("sell.tsx only writes applicant_email (insert), never reads it back", () => {
    expect(sell).toContain("applicant_email: user.email");
    expect(sell).not.toMatch(/\.select\([^)]*applicant_email/);
  });

  it("no non-admin, non-service-role client code reads the four sensitive columns", () => {
    // Full-repo scan: every file that mentions any sensitive column name,
    // excluding the admin-gated server function/components and the
    // service-role founding-acceptance path already verified above.
    const allowlist = [
      "src/lib/admin-seller-applications.functions.ts",
      "src/routes/_authenticated/admin.index.tsx",
      "src/components/admin/CreatorApplicationsBoard.tsx",
      "src/lib/founding.server.ts",
      "src/routes/sell.tsx", // write-only, checked above
      "src/lib/marketplace.whats-included.test.ts", // marketplace_products.admin_notes, unrelated column
      "src/integrations/supabase/types.ts", // generated DB type defs
      "src/lib/marketplace.functions.ts", // marketplace_products.admin_notes, unrelated column
      "src/routes/_authenticated/dashboard.new.tsx", // marketplace_products.admin_notes, unrelated column
      "tests/integration/seller-application-privacy-fix.test.ts", // this file
    ];
    const grepOutput = execSync(
      `grep -rl "applicant_email\\|admin_feedback\\|reapply_after" --include="*.ts" --include="*.tsx" src`,
      { cwd: ROOT, encoding: "utf8" },
    );
    const hits = grepOutput.split("\n").filter(Boolean);
    const unexpected = hits.filter((h) => !allowlist.includes(h));
    expect(unexpected, `unexpected sensitive-field references: ${unexpected.join(", ")}`).toEqual([]);
  });
});

describe("public creator surfaces (regression guard)", () => {
  it("no public/customer-facing route or lib file selects the four sensitive columns", () => {
    const publicFiles = [
      "src/lib/creators.functions.ts",
      "src/lib/leaderboard.functions.ts",
      "src/lib/spotlights.functions.ts",
      "src/routes/store.$slug.tsx",
    ].filter((p) => {
      try {
        readFileSync(join(ROOT, p), "utf8");
        return true;
      } catch {
        return false;
      }
    });
    expect(publicFiles.length).toBeGreaterThan(0);
    for (const p of publicFiles) {
      const src = read(p);
      for (const col of SENSITIVE) {
        expect(src, `${p} unexpectedly references ${col}`).not.toContain(col);
      }
    }
  });
});
