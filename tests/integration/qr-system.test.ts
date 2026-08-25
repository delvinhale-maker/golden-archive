/**
 * AurumVault QR Business System — Phase 1 security/regression guard.
 *
 * qr.functions.ts and q.$publicId.ts cannot be imported directly in this
 * test run — they pull in zod/@supabase/supabase-js/@tanstack/react-start,
 * none of which are installed in this sandbox (the same pre-existing,
 * environment-wide constraint every other tests/integration/*.test.ts file
 * in this repo works around). This suite is therefore source-level
 * verification: it asserts on the actual file contents rather than
 * executing the functions. src/lib/qr.test.ts and src/lib/qr-encode.test.ts
 * cover what genuinely can run in this sandbox (pure validation logic and
 * the real "qrcode" encoder) with real, executed assertions.
 *
 * Run: bun test tests/integration/qr-system.test.ts
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const fn = read("src/lib/qr.functions.ts");
const redirect = read("src/routes/q.$publicId.ts");
const migration = read("supabase/migrations/20260824201319_create_qr_projects.sql");

describe("qr.functions.ts — ownership is always server-derived, never client-supplied", () => {
  it("every mutating function requires requireSupabaseAuth", () => {
    for (const name of ["createQrProject", "updateQrProject", "archiveQrProject"]) {
      const body = fn.slice(
        fn.indexOf(`export const ${name}`),
        fn.indexOf(`export const ${name}`) + 800,
      );
      expect(body).toContain(".middleware([requireSupabaseAuth])");
    }
  });

  it("no input schema ever accepts ownerUserId/owner_user_id from the client", () => {
    expect(fn).not.toMatch(/ownerUserId/);
    expect(fn).not.toMatch(/z\.[^\n]*owner_user_id/);
  });

  it("createQrProject inserts owner_user_id from context.userId, not from input data", () => {
    const body = fn.slice(
      fn.indexOf("export const createQrProject"),
      fn.indexOf("export const updateQrProject"),
    );
    expect(body).toContain("owner_user_id: userId");
    expect(body).toContain("const { supabase, userId } = context");
  });

  it("updateQrProject and archiveQrProject scope every write by both id and owner_user_id", () => {
    for (const name of ["updateQrProject", "archiveQrProject"]) {
      const start = fn.indexOf(`export const ${name}`);
      const end = fn.indexOf("\nexport const", start + 10);
      const body = fn.slice(start, end === -1 ? undefined : end);
      expect(body).toMatch(/\.eq\(\s*"id",\s*data\.id\s*\)/);
      expect(body).toMatch(/\.eq\(\s*"owner_user_id",\s*userId\s*\)/);
    }
  });

  it("public_id is never accepted as a client-writable field", () => {
    expect(fn).not.toMatch(/publicId:\s*data\./);
    expect(fn).not.toContain("public_id: data.");
  });

  it("renderQrProjectImage resolves the payload from the owned row, never from client-supplied destination text", () => {
    const body = fn.slice(fn.indexOf("export const renderQrProjectImage"));
    expect(body).toContain("buildDynamicQrUrl((row as any).public_id)");
    expect(body).not.toMatch(/renderQrImage\(\s*data\.destination/);
  });
});

describe("qr.functions.ts — destination validation happens server-side (Section 12)", () => {
  it("createQrProject and updateQrProject both call validateDestination before any write", () => {
    for (const name of ["createQrProject", "updateQrProject"]) {
      const start = fn.indexOf(`export const ${name}`);
      const end = fn.indexOf("\nexport const", start + 10);
      const body = fn.slice(start, end === -1 ? undefined : end);
      expect(body).toContain("validateDestination(");
      expect(body).toMatch(/if \(!dest\.ok\) throw new Error/);
    }
  });

  it("both reject 'text' as a dynamic destination type — no browser action exists to redirect to plain text", () => {
    for (const name of ["createQrProject", "updateQrProject"]) {
      const start = fn.indexOf(`export const ${name}`);
      const end = fn.indexOf("\nexport const", start + 10);
      const body = fn.slice(start, end === -1 ? undefined : end);
      expect(body).toMatch(/destinationType === "text"/);
    }
  });

  it("colors are validated (scannability, Section 19) before any render or write", () => {
    expect(fn).toContain("validateQrColors(");
  });
});

describe("qr.functions.ts — active dynamic limit is server-authoritative (Section 15)", () => {
  it("createQrProject counts non-archived dynamic projects and enforces MAX_ACTIVE_DYNAMIC_QR before insert", () => {
    const body = fn.slice(
      fn.indexOf("export const createQrProject"),
      fn.indexOf("export const updateQrProject"),
    );
    expect(body).toContain('.neq("status" as never, "archived")');
    expect(body).toContain('.eq("mode" as never, "dynamic")');
    expect(body).toMatch(/count \?\? 0\) >= MAX_ACTIVE_DYNAMIC_QR/);
    // The count check happens before the insert, not after.
    expect(body.indexOf("MAX_ACTIVE_DYNAMIC_QR")).toBeLessThan(body.indexOf(".insert("));
  });
});

describe("q.$publicId.ts — redirect security (Sections 10-13)", () => {
  it("validates the public_id format before any database query", () => {
    const idx = redirect.indexOf("PUBLIC_ID_RE.test(publicId)");
    const dbIdx = redirect.indexOf("supabaseAdmin");
    expect(idx).toBeGreaterThan(-1);
    expect(idx).toBeLessThan(dbIdx);
  });

  it("resolves the project via the service-role client only, never an RLS-bound anon/authenticated client", () => {
    expect(redirect).toContain('await import("@/integrations/supabase/client.server")');
    expect(redirect).toContain("supabaseAdmin");
    expect(redirect).not.toMatch(/from\s+"@\/integrations\/supabase\/client"/);
  });

  it("never reads the request's query string to determine the redirect destination", () => {
    expect(redirect).not.toMatch(/searchParams/);
    expect(redirect).not.toMatch(/\burl\.get\(/);
    expect(redirect).not.toContain('params.get("url")');
  });

  it("redirects only to the stored destination column, and only after checking it's an allowed prefix", () => {
    expect(redirect).toContain("isRedirectableDestination(row.destination)");
    expect(redirect).toContain("Response.redirect(row.destination, 302)");
  });

  it("uses a temporary (302) redirect, not a permanent one, since dynamic destinations are editable", () => {
    expect(redirect).not.toMatch(/Response\.redirect\([^)]*,\s*301\)/);
  });

  it("paused codes do not redirect to the destination", () => {
    const body = redirect.slice(
      redirect.indexOf('row.status === "paused"'),
      redirect.indexOf('row.status === "paused"') + 300,
    );
    expect(body).not.toContain("Response.redirect");
  });

  it("archived and invalid/unknown tokens both fail safe without exposing owner or destination info", () => {
    expect(redirect).toContain('PAGE("QR code not found"');
    expect(redirect).not.toMatch(/owner_user_id/);
    // The 404/410 branches never interpolate row.destination into the response body.
    const notFoundBlocks = redirect.match(/return textResponse\(\s*(404|410)[\s\S]{0,150}/g) ?? [];
    for (const block of notFoundBlocks) {
      expect(block).not.toContain("row.destination");
    }
  });

  it("scan recording is awaited but wrapped so a failure can never block or fail the redirect", () => {
    const scanBlock = redirect.slice(
      redirect.indexOf("try {"),
      redirect.indexOf("Response.redirect(row.destination"),
    );
    expect(scanBlock).toContain("await supabaseAdmin");
    expect(scanBlock).toContain("qr_scan_events");
    expect(scanBlock).toContain("catch");
  });

  it("is a pure server route with no React component — no dashboard bundle loads for a scan", () => {
    expect(redirect).not.toContain("component:");
    expect(redirect).toContain("server: {");
    expect(redirect).toContain("handlers: {");
  });
});

describe("migration — RLS and grants (Section 25)", () => {
  it("qr_projects has no public/anon SELECT policy", () => {
    expect(migration).not.toMatch(/CREATE POLICY[^;]*qr_projects[^;]*TO\s+anon/i);
    expect(migration).not.toContain("GRANT SELECT ON public.qr_projects TO anon");
  });

  it("qr_projects RLS policies are owner-scoped", () => {
    expect(migration).toContain("owner_user_id = auth.uid()");
    expect(migration).toContain("ALTER TABLE public.qr_projects ENABLE ROW LEVEL SECURITY");
  });

  it("qr_scan_events has no anon INSERT grant — only the service-role redirect handler writes to it", () => {
    expect(migration).not.toContain("GRANT INSERT ON public.qr_scan_events TO anon");
    expect(migration).not.toMatch(/GRANT[^;]*qr_scan_events[^;]*TO\s+anon/i);
  });

  it("qr_scan_events read access is scoped through project ownership, not a blanket authenticated SELECT", () => {
    const policy = migration.slice(migration.indexOf("qr_scan_events_owner_read"));
    expect(policy).toContain("EXISTS");
    expect(policy).toContain("p.owner_user_id = auth.uid()");
  });

  it("a guard trigger blocks reassigning ownership or mutating public_id, even for a hypothetical future client-write path", () => {
    expect(migration).toContain("qr_projects_guard_identity");
    expect(migration).toContain("NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id");
    expect(migration).toContain("NEW.public_id IS DISTINCT FROM OLD.public_id");
  });

  it("public_id has a minimum-length constraint consistent with generateQrPublicId's 40-char output", () => {
    expect(migration).toContain("qr_projects_public_id_len");
    expect(migration).toMatch(/BETWEEN 16 AND 64/);
  });

  it("does not touch any unrelated table", () => {
    const tableRefs = [
      ...migration.matchAll(/(?:CREATE TABLE|ALTER TABLE|CREATE POLICY[^;]*ON)\s+public\.(\w+)/g),
    ].map((m) => m[1]);
    for (const t of tableRefs) {
      expect(["qr_projects", "qr_scan_events"]).toContain(t);
    }
  });
});

describe("no regression to previously shipped security corrections", () => {
  it("does not modify seller_applications privacy/RLS migrations or admin-gated read path", () => {
    const privacyMigration = read(
      "supabase/migrations/20260823222232_revoke_seller_applications_sensitive_columns.sql",
    );
    expect(privacyMigration).toContain(
      "REVOKE SELECT (applicant_email, admin_notes, admin_feedback, reapply_after)",
    );
  });

  it("does not modify the storefront owner-save whitelist function", () => {
    const storefrontFn = read("src/lib/storefront.functions.ts");
    expect(storefrontFn).toContain("export const saveMyStorefrontProfile");
    expect(storefrontFn).toContain('.eq("user_id", context.userId)');
  });

  it("does not modify download authorization (cross-product file-id check stays intact)", () => {
    const deliveryFn = read("src/lib/product-delivery.functions.ts");
    expect(deliveryFn).toContain("f.product_id !== orderItem?.product_id");
  });

  it("the redirect handler's service-role import is dynamic, never at module top level (would bundle it client-side)", () => {
    expect(redirect).toContain('await import("@/integrations/supabase/client.server")');
    expect(redirect.split("\n").slice(0, 15).join("\n")).not.toContain("client.server");
  });

  it("qr.functions.ts never needs service-role at all — qr_projects has a real owner RLS policy, unlike seller_applications", () => {
    // Every mutation/read goes through context.supabase (the RLS-bound,
    // per-request authenticated client from requireSupabaseAuth), not
    // supabaseAdmin — the .eq("owner_user_id", userId) scoping in each
    // function is defense-in-depth on top of RLS, not a substitute for it.
    expect(fn).not.toContain("client.server");
    expect(fn).not.toContain("supabaseAdmin");
    expect(fn).toContain("const { supabase, userId } = context");
  });
});
