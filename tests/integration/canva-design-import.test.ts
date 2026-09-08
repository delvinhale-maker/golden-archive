/**
 * Source-contract coverage for the Canva "browse -> preview -> Turn Into
 * Product" workflow: src/lib/canva-designs.functions.ts,
 * src/components/dashboard/CanvaDesignPicker.tsx, and the
 * canva_design_products migration.
 *
 * canva-designs.functions.ts imports zod and @tanstack/react-start, which
 * this sandbox's private package registry can't resolve (see
 * docs/proposed-migrations/ note and the session's build/test findings), so
 * — matching the established pattern elsewhere in this suite (e.g.
 * tests/integration/dashboard-routes.test.ts, publish-flow-product-label.
 * test.ts) — this is a readFileSync/regex source contract, not a live
 * import. It runs for real under `bun test`; it just can't execute the
 * handlers themselves in this sandbox.
 *
 * Run with: bun test tests/integration/canva-design-import.test.ts
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

const fns = readFileSync("src/lib/canva-designs.functions.ts", "utf8");
const picker = readFileSync("src/components/dashboard/CanvaDesignPicker.tsx", "utf8");
const banner = readFileSync("src/components/dashboard/CanvaConnectBanner.tsx", "utf8");
const callback = readFileSync("src/routes/api/public/integrations/canva/callback.ts", "utf8");
const migrationRaw = readFileSync(
  "docs/proposed-migrations/20260908142659_create_canva_design_products.sql",
  "utf8",
);
const migration = migrationRaw
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("canva-designs.functions.ts: auth and tenancy", () => {
  it("requires auth on every entry point", () => {
    expect(fns.match(/\.middleware\(\[requireSupabaseAuth\]\)/g)?.length).toBe(3);
  });

  it("never trusts a client-supplied user id — always context.userId", () => {
    expect(fns).toContain("context.userId");
    expect(fns).not.toMatch(/user_id:\s*data\./);
  });

  it("validates every input through zod, not a raw passthrough", () => {
    expect(fns).toContain("z.object({ continuation: z.string().optional() })");
    expect(fns).toContain("z.object({ designId: z.string()");
  });
});

describe("canva-designs.functions.ts: no token ever reaches the return value", () => {
  it("never returns an access/refresh token in any result shape", () => {
    expect(fns).not.toMatch(/access_token|refresh_token/);
  });

  it("loads canva-oauth dynamically inside each handler (server-only)", () => {
    expect(fns.match(/await import\("\.\/canva-oauth"\)/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

describe("canva-designs.functions.ts: duplicate-import protection", () => {
  it("checks for an existing mapping before calling any Canva API", () => {
    const dupIdx = fns.indexOf('.from("canva_design_products")\n      .select("product_id")');
    const exportIdx = fns.indexOf("exportCanvaDesign(token");
    expect(dupIdx).toBeGreaterThan(-1);
    expect(exportIdx).toBeGreaterThan(-1);
    expect(dupIdx).toBeLessThan(exportIdx);
  });

  it("returns the existing product id instead of creating a new draft", () => {
    expect(fns).toContain("duplicate: true");
    expect(fns).toContain("productId: (existingMapping as { product_id: string }).product_id");
  });

  it("scopes the duplicate check by user_id AND canva_design_id together", () => {
    const block = fns.slice(fns.indexOf('.from("canva_design_products")\n      .select'), fns.indexOf("existingMapping) {"));
    expect(block).toContain('.eq("user_id", context.userId)');
    expect(block).toContain('.eq("canva_design_id", designId)');
  });
});

describe("canva-designs.functions.ts: never a false success / draft never published", () => {
  it("always creates the product as an unpublished draft", () => {
    expect(fns).toContain('status: "draft"');
    expect(fns).toContain("published: false");
    expect(fns).not.toMatch(/published:\s*true/);
  });

  it("uses the RLS-bound session client for the product insert, not the admin client", () => {
    expect(fns).toContain("context.supabase\n        .from(\"marketplace_products\")\n        .insert(");
  });

  it("rolls back the draft product if the mapping insert fails (no orphan product)", () => {
    const mappingCatchIdx = fns.lastIndexOf("mapping_failed");
    const rollbackIdx = fns.lastIndexOf('.from("marketplace_products")\n        .delete()');
    expect(rollbackIdx).toBeGreaterThan(-1);
    expect(rollbackIdx).toBeLessThan(mappingCatchIdx);
  });

  it("cleans up the uploaded cover if the draft insert fails", () => {
    const draftCatchIdx = fns.indexOf('reason: "draft_failed"');
    const cleanupIdx = fns.lastIndexOf('.storage\n        .from("product-covers")', draftCatchIdx);
    expect(cleanupIdx).toBeGreaterThan(-1);
  });

  it("classifies every failure into a specific, non-generic reason", () => {
    for (const reason of ["storage_failed", "draft_failed", "mapping_failed"]) {
      expect(fns).toContain(`reason: "${reason}"`);
    }
  });
});

describe("canva-designs.functions.ts: safe default product type", () => {
  it("defaults new drafts to the generic 'templates' category / 'other' type", () => {
    expect(fns).toContain('const CANVA_IMPORT_CATEGORY = "templates" as const');
    expect(fns).toContain('const CANVA_IMPORT_PRODUCT_TYPE = "other" as const');
  });

  it("sets price to 0 — the creator sets real pricing in the editor", () => {
    expect(fns).toContain("price_cents: 0");
  });
});

describe("CanvaDesignPicker.tsx: no secrets, honest states, correct routing", () => {
  it("never references a Canva token or secret in the client component", () => {
    expect(picker).not.toMatch(/access_token|refresh_token|client_secret|code_verifier/);
  });

  it("renders a distinct message for every CanvaApiFailureReason", () => {
    for (const reason of [
      "not_connected",
      "reauth_required",
      "rate_limited",
      "design_unavailable",
      "export_failed",
      "export_timeout",
      "api_error",
    ]) {
      expect(picker).toContain(`${reason}:`);
    }
  });

  it("routes Turn Into Product success into the existing product editor with id + type", () => {
    expect(picker).toContain('to: "/dashboard/new"');
    expect(picker).toContain("search: { id: result.productId, type: result.productTypeKey");
  });

  it("never auto-navigates to a published product view — only the draft editor", () => {
    expect(picker).not.toMatch(/to:\s*"\/products\//);
  });

  it("shows a duplicate-import message with a link to the existing draft, not a silent duplicate", () => {
    expect(picker).toContain("already linked to an AurumVault product");
    expect(picker).toContain("Open existing draft");
  });

  it("is a responsive grid (mobile 2-col up to desktop 4-col), not desktop-only", () => {
    expect(picker).toMatch(/grid-cols-2\s+gap-3\s+sm:grid-cols-3\s+md:grid-cols-4/);
  });
});

describe("CanvaConnectBanner.tsx: placeholder replaced with the real picker", () => {
  it("no longer renders the old placeholder ImportDialog", () => {
    expect(banner).not.toContain("Direct design import is the next step");
    expect(banner).not.toContain("function ImportDialog");
  });

  it("opens the real CanvaDesignPicker component", () => {
    expect(banner).toContain("<CanvaDesignPicker");
    expect(banner).toContain('from "./CanvaDesignPicker"');
  });
});

describe("callback route: profile lookup is best-effort and never blocks the connection", () => {
  it("fetches the profile after token exchange but never lets it throw past a .catch", () => {
    expect(callback).toContain("getCanvaProfile(accessToken).catch(");
  });

  it("still stores the connection even when the profile lookup is unavailable", () => {
    const catchIdx = callback.indexOf("getCanvaProfile(accessToken).catch(");
    const storeIdx = callback.indexOf("await storeCanvaConnection(supabase, {");
    expect(catchIdx).toBeGreaterThan(-1);
    expect(storeIdx).toBeGreaterThan(catchIdx);
  });

  it("references the token exactly once, via a single local binding", () => {
    expect(callback.match(/tokens\.access_token/g)?.length).toBe(1);
    expect(callback).toContain("const accessToken = tokens.access_token");
  });
});

describe("canva_design_products migration is additive-only", () => {
  it("contains no destructive statements against existing objects", () => {
    expect(migration).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(migration).not.toMatch(/\bTRUNCATE\b/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(migration).not.toMatch(/ALTER\s+TABLE\s+public\.(?!canva_design_products)/i);
  });

  it("creates exactly one new table", () => {
    expect(migration.match(/CREATE TABLE/gi)?.length).toBe(1);
    expect(migration).toContain("CREATE TABLE public.canva_design_products");
  });

  it("is not staged in supabase/migrations (unapplied by design)", () => {
    const { existsSync } = require("node:fs");
    expect(
      existsSync("supabase/migrations/20260908142659_create_canva_design_products.sql"),
    ).toBe(false);
  });

  it("reuses existing helpers without redefining them", () => {
    expect(migration).toContain("public.touch_updated_at()");
    expect(migration).toContain("public.has_role(auth.uid(), 'admin')");
    expect(migration).not.toMatch(/CREATE (OR REPLACE )?FUNCTION public\.touch_updated_at/i);
    expect(migration).not.toMatch(/CREATE (OR REPLACE )?FUNCTION public\.has_role/i);
  });
});

describe("canva_design_products migration security model", () => {
  it("enables RLS", () => {
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
  });

  it("grants full access to service_role and revokes anon", () => {
    expect(migration).toContain("GRANT ALL ON public.canva_design_products TO service_role;");
    expect(migration).not.toMatch(/GRANT[^;]+TO\s+anon/i);
    expect(migration).toContain("REVOKE ALL ON public.canva_design_products FROM anon;");
  });

  it("grants authenticated read-only access, never INSERT/UPDATE", () => {
    expect(migration).toContain("GRANT SELECT ON public.canva_design_products TO authenticated;");
    expect(migration).not.toMatch(/GRANT\s+(ALL|INSERT|UPDATE)\s+ON\s+public\.canva_design_products\s+TO\s+authenticated/i);
  });

  it("scopes owner policies by auth.uid() with an admin escape hatch", () => {
    expect(migration).toContain("USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))");
  });

  it("protects owner and design-id reassignment with a guard trigger", () => {
    expect(migration).toContain("guard_canva_design_product_owner");
    expect(migration).toContain("trg_canva_design_products_owner_guard");
    expect(migration).toContain("is immutable");
  });

  it("enforces one mapping per (creator, design) and one mapping per product", () => {
    expect(migration).toContain("CREATE UNIQUE INDEX canva_design_products_user_design_key");
    expect(migration).toContain("ON public.canva_design_products (user_id, canva_design_id)");
    expect(migration).toContain("CREATE UNIQUE INDEX canva_design_products_product_key");
  });

  it("cascades delete from the product it maps to", () => {
    expect(migration).toContain(
      "product_id UUID NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE",
    );
  });

  it("documents a self-contained rollback", () => {
    expect(migrationRaw).toContain("DROP TABLE IF EXISTS public.canva_design_products CASCADE;");
  });
});
