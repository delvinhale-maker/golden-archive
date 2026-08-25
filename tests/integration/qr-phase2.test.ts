/**
 * AurumVault QR Business System — Phase 2 security/regression guard.
 *
 * Same constraint as qr-system.test.ts: the *.functions.ts modules can't be
 * imported here (zod / @supabase / @tanstack aren't resolvable in this test
 * run), so campaign/placement/shortcut security is verified at source level,
 * while the pure Phase 2 configuration logic in src/lib/qr-usecases.ts is
 * genuinely executed in src/lib/qr-usecases.test.ts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const businessFn = read("src/lib/qr-business.functions.ts");
const businessServer = read("src/lib/qr-business.server.ts");
const shortcuts = read("src/lib/qr-shortcuts.server.ts");
const qrFn = read("src/lib/qr.functions.ts");

function fnBody(source: string, name: string): string {
  const start = source.indexOf(`export const ${name}`);
  expect(start, `${name} should exist`).toBeGreaterThan(-1);
  const end = source.indexOf("\nexport const", start + 10);
  return source.slice(start, end === -1 ? undefined : end);
}

describe("Phase 2 server functions are all authenticated and owner-scoped", () => {
  const mutating = [
    "createQrCampaign",
    "updateQrCampaign",
    "createQrShortcut",
    "duplicateQrProject",
    "getCampaignPlacements",
    "listMyQrCampaigns",
    "listMyQrShortcutTargets",
  ];

  it("every Phase 2 function requires requireSupabaseAuth", () => {
    for (const name of mutating) {
      expect(fnBody(businessFn, name)).toContain(".middleware([requireSupabaseAuth])");
    }
  });

  it("no Phase 2 input schema ever accepts an owner id from the client", () => {
    expect(businessFn).not.toMatch(/ownerUserId/);
    expect(businessFn).not.toMatch(/owner_user_id:\s*data\./);
  });

  it("campaign writes and reads are scoped by owner_user_id", () => {
    for (const name of ["updateQrCampaign", "getCampaignPlacements", "listMyQrCampaigns"]) {
      expect(fnBody(businessFn, name)).toMatch(/owner_user_id[^\n]*userId/);
    }
    expect(fnBody(businessFn, "createQrCampaign")).toContain("owner_user_id: userId");
  });

  it("duplication reads the source row scoped to the caller before copying it", () => {
    const body = fnBody(businessFn, "duplicateQrProject");
    expect(body).toMatch(/\.eq\("id" as never, data\.id\)/);
    expect(body).toMatch(/\.eq\("owner_user_id" as never, userId\)/);
    expect(body).toContain('if (!source) throw new Error("QR code not found")');
  });

  it("a duplicate never inherits the source's public_id — it gets a fresh one", () => {
    expect(businessFn).not.toMatch(/public_id:\s*src\./);
    // Every creation path funnels through the one insert helper, which always
    // generates its own public_id.
    expect(businessServer).toContain("public_id: generateQrPublicId()");
  });

  it("campaign assignment is always verified against the caller's own campaigns", () => {
    expect(businessServer).toContain("export async function assertOwnedCampaign");
    const guard = businessServer.slice(businessServer.indexOf("assertOwnedCampaign"));
    expect(guard).toMatch(/\.eq\("owner_user_id", userId\)/);
    expect(guard).toContain('throw new Error("Campaign not found")');
    // Both the Phase 1 create path and the shared insert helper use it.
    expect(qrFn).toContain("assertOwnedCampaign(supabase as never, userId, data.campaignId)");
    expect(businessServer).toContain("await assertOwnedCampaign(supabase, userId, input.campaignId)");
  });
});

describe("shortcuts cannot become an open redirect", () => {
  it("createQrShortcut accepts a product id, never a URL or destination string", () => {
    const body = fnBody(businessFn, "createQrShortcut");
    expect(body).toContain('kind: z.enum(["storefront", "product"])');
    expect(body).not.toMatch(/destination:\s*z\./);
    expect(body).not.toMatch(/url:\s*z\.string/);
  });

  it("the shortcut destination is always built server-side from SITE_URL", () => {
    expect(shortcuts).toContain('import { SITE_URL } from "./qr"');
    expect(shortcuts).toContain("`${SITE_URL}/store/${slug}`");
    expect(shortcuts).toContain("`${SITE_URL}/products/${productId}`");
    expect(shortcuts).not.toMatch(/https?:\/\/(?!www\.aurumvault)/);
  });

  it("a product shortcut only resolves the caller's own live product", () => {
    const body = shortcuts.slice(shortcuts.indexOf("resolveOwnProductTarget"));
    expect(body).toContain('.eq("seller_id", userId)');
    expect(body).toContain('(data as any).status !== "approved"');
    expect(body).toContain("published");
  });

  it("a storefront shortcut requires an approved seller application", () => {
    const body = shortcuts.slice(
      shortcuts.indexOf("resolveOwnStorefrontTarget"),
      shortcuts.indexOf("resolveOwnProductTarget"),
    );
    expect(body).toContain('.eq("user_id", userId)');
    expect(body).toContain('.eq("status", "approved")');
  });

  it("shortcut resolution never uses the service-role client", () => {
    expect(shortcuts).not.toContain("supabaseAdmin");
    expect(shortcuts).not.toContain("client.server");
    expect(businessFn).not.toContain("supabaseAdmin");
  });
});

describe("Phase 2 keeps the Phase 1 guarantees", () => {
  it("the dynamic-QR limit is enforced on every creation path, including duplication", () => {
    expect(businessServer).toContain("export async function assertDynamicQuota");
    const quota = businessServer.slice(
      businessServer.indexOf("assertDynamicQuota(supabase: Client"),
    );
    expect(quota).toContain('.neq("status", "archived")');
    expect(quota).toContain('.eq("mode", "dynamic")');
    expect(quota).toMatch(/count \?\? 0\) >= MAX_ACTIVE_DYNAMIC_QR/);
    const insert = businessServer.slice(businessServer.indexOf("insertDynamicQrProject"));
    expect(insert.indexOf("assertDynamicQuota")).toBeLessThan(insert.indexOf(".insert("));
  });

  it("every creation path re-validates the destination and colors server-side", () => {
    const insert = businessServer.slice(businessServer.indexOf("export async function insertDynamicQrProject"));
    expect(insert).toContain("validateDestination(input.destinationType, input.destination)");
    expect(insert).toContain("validateQrColors(input.foreground, input.background)");
    expect(insert).toContain('input.destinationType === "text"');
  });

  it("a duplicated destination is re-validated, not copied blind", () => {
    expect(businessFn).toContain(
      "rawFromStoredDestination(src.destination_type, src.destination)",
    );
    expect(businessServer).toContain("export function rawFromStoredDestination");
  });

  it("mode is always forced to 'dynamic' on the saved-project path", () => {
    expect(businessServer).toContain('mode: "dynamic"');
    expect(businessServer).not.toMatch(/mode:\s*input\./);
  });
});

describe("Phase 2 migration — additive, owner-scoped, no anon exposure", () => {
  const migration = (() => {
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    const dir = join(ROOT, "supabase/migrations");
    const file = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .find((f) => readFileSync(join(dir, f), "utf8").includes("CREATE TABLE public.qr_campaigns"));
    expect(file, "a QR campaigns migration should exist").toBeTruthy();
    return readFileSync(join(dir, file as string), "utf8");
  })();

  it("creates qr_campaigns with RLS enabled and no anon grant", () => {
    expect(migration).toContain("CREATE TABLE public.qr_campaigns");
    expect(migration).toContain("ALTER TABLE public.qr_campaigns ENABLE ROW LEVEL SECURITY");
    expect(migration).not.toMatch(/GRANT[^;]*qr_campaigns[^;]*TO\s+anon/i);
  });

  it("qr_campaigns policies are owner-scoped", () => {
    expect(migration).toContain("owner_user_id = auth.uid()");
  });

  it("only adds nullable columns to qr_projects — Phase 1 rows stay valid", () => {
    const alterStart = migration.indexOf("ALTER TABLE public.qr_projects");
    const alter = migration.slice(alterStart, migration.indexOf(";", alterStart));
    expect(alter).not.toMatch(/NOT NULL/);
    expect(alter).not.toMatch(/DROP (COLUMN|CONSTRAINT|TABLE)/i);
    for (const col of [
      "use_case",
      "niche",
      "placement_label",
      "campaign_id",
      "duplicated_from",
    ]) {
      expect(alter).toContain(`ADD COLUMN ${col}`);
    }
  });

  it("a database trigger blocks putting a QR code into someone else's campaign", () => {
    expect(migration).toContain("qr_projects_guard_campaign_owner");
    expect(migration).toContain("campaign_owner IS DISTINCT FROM NEW.owner_user_id");
  });

  it("touches only QR tables", () => {
    const refs = [
      ...migration.matchAll(/(?:CREATE TABLE|ALTER TABLE|CREATE POLICY[^;]*ON)\s+public\.(\w+)/g),
    ].map((m) => m[1]);
    for (const t of refs) expect(["qr_projects", "qr_campaigns"]).toContain(t);
  });
});
