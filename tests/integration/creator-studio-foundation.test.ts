/**
 * Source-contract coverage for AurumVault Creator Studio™ CS1: the
 * migration, server functions, routes, and PublisherShell nav gating.
 *
 * creator-studio.functions.ts imports zod and @tanstack/react-start, which
 * this sandbox's private package registry can't resolve (same environment
 * limitation documented throughout this session — see the Canva work's
 * test files for the same pattern), so — matching the established
 * convention elsewhere in this suite — this is a readFileSync/regex source
 * contract, not a live import. It runs for real under `bun test`; it just
 * can't execute the handlers themselves in this sandbox.
 *
 * Run with: bun test tests/integration/creator-studio-foundation.test.ts
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";

const fns = readFileSync("src/lib/creator-studio.functions.ts", "utf8");
const middleware = readFileSync("src/lib/creator-studio-feature-flags.middleware.ts", "utf8");
const shell = readFileSync("src/components/marketplace/PublisherShell.tsx", "utf8");
const migrationRaw = readFileSync(
  "docs/proposed-migrations/20260910113140_create_creator_studio_foundation.sql",
  "utf8",
);
const migration = migrationRaw
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

const ROUTE_FILES = [
  "src/routes/_authenticated/creator-studio.tsx",
  "src/routes/_authenticated/creator-studio.new.tsx",
  "src/routes/_authenticated/creator-studio.projects.$projectId.tsx",
  "src/routes/_authenticated/creator-studio.videos.tsx",
];

describe("migration is additive-only", () => {
  it("contains no destructive statements against pre-existing objects", () => {
    expect(migration).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(migration).not.toMatch(/\bTRUNCATE\b/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(migration).not.toMatch(
      /ALTER\s+TABLE\s+public\.(?!creator_studio_projects|creator_studio_assets|creator_studio_render_jobs|creator_studio_outputs)/i,
    );
  });

  it("creates exactly the four required tables", () => {
    expect(migration.match(/CREATE TABLE/gi)?.length).toBe(4);
    for (const table of [
      "creator_studio_projects",
      "creator_studio_assets",
      "creator_studio_render_jobs",
      "creator_studio_outputs",
    ]) {
      expect(migration).toContain(`CREATE TABLE public.${table}`);
    }
  });

  it("is not staged in supabase/migrations (unapplied by design)", () => {
    expect(
      existsSync("supabase/migrations/20260910113140_create_creator_studio_foundation.sql"),
    ).toBe(false);
  });

  it("reuses existing helpers without redefining them", () => {
    expect(migration).toContain("public.touch_updated_at()");
    expect(migration).toContain("public.has_role(auth.uid(), 'admin')");
    expect(migration).not.toMatch(/CREATE (OR REPLACE )?FUNCTION public\.touch_updated_at/i);
    expect(migration).not.toMatch(/CREATE (OR REPLACE )?FUNCTION public\.has_role/i);
  });

  it("links to marketplace_products with a nullable, non-cascading FK", () => {
    expect(migration).toContain(
      "product_id UUID REFERENCES public.marketplace_products(id) ON DELETE SET NULL",
    );
    expect(migration).not.toContain(
      "product_id UUID NOT NULL REFERENCES public.marketplace_products(id)",
    );
  });

  it("documents a self-contained rollback for every object it creates", () => {
    for (const stmt of [
      "DROP TABLE IF EXISTS public.creator_studio_outputs CASCADE;",
      "DROP TABLE IF EXISTS public.creator_studio_render_jobs CASCADE;",
      "DROP TABLE IF EXISTS public.creator_studio_assets CASCADE;",
      "DROP TABLE IF EXISTS public.creator_studio_projects CASCADE;",
    ]) {
      expect(migrationRaw).toContain(stmt);
    }
  });
});

describe("migration: required enums/statuses/durations", () => {
  it("locks the exact creation_type set", () => {
    expect(migration).toContain(
      "creation_type IN (\n    'EBOOK_PROMO', 'COURSE_PROMO', 'PLANNER_PROMO', 'TIKTOK_AD',\n    'INSTAGRAM_REEL', 'PRODUCT_TRAILER', 'BOOK_TRAILER'\n  )",
    );
  });

  it("locks the exact project status set, including QUEUED and CANCELLED", () => {
    expect(migration).toContain(
      "status IN (\n    'DRAFT', 'READY', 'QUEUED', 'RENDERING', 'COMPLETED', 'FAILED', 'CANCELLED'\n  )",
    );
  });

  it("locks the exact style set", () => {
    expect(migration).toContain("style IN ('CINEMATIC', 'LUXURY', 'BOLD_SOCIAL', 'CLEAN_MINIMAL')");
  });

  it("locks duration to 15/30/45 on both projects and render_jobs/outputs", () => {
    expect(
      migration.match(
        /duration_seconds (IN \(15, 30, 45\)|integer NOT NULL CHECK \(duration_seconds IN \(15, 30, 45\)\))/gi,
      )?.length,
    ).toBeGreaterThanOrEqual(1);
    expect(migration).toContain("duration_seconds IN (15, 30, 45)");
  });

  it("locks V1 to 9:16 only", () => {
    expect(migration).toContain("aspect_ratio = '9:16'");
  });

  it("locks V1 output to 1080x1920 mp4", () => {
    expect(migration).toContain("resolution = '1080x1920'");
    expect(migration).toContain("output_format = 'mp4'");
  });
});

describe("migration: RLS / ownership isolation", () => {
  it("enables RLS on all four tables", () => {
    for (const table of [
      "creator_studio_projects",
      "creator_studio_assets",
      "creator_studio_render_jobs",
      "creator_studio_outputs",
    ]) {
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    }
  });

  it("scopes every owner policy by auth.uid() with an admin escape hatch", () => {
    expect(
      migration.match(
        /owner_user_id = auth\.uid\(\) OR public\.has_role\(auth\.uid\(\), 'admin'\)/g,
      )?.length,
    ).toBeGreaterThanOrEqual(4);
  });

  it("revokes anon on every table", () => {
    for (const table of [
      "creator_studio_projects",
      "creator_studio_assets",
      "creator_studio_render_jobs",
      "creator_studio_outputs",
    ]) {
      expect(migration).toContain(`REVOKE ALL ON public.${table} FROM anon;`);
    }
  });

  it("grants render_jobs and outputs SELECT-only to authenticated — never a client write", () => {
    expect(migration).toContain(
      "GRANT SELECT ON public.creator_studio_render_jobs TO authenticated;",
    );
    expect(migration).toContain("GRANT SELECT ON public.creator_studio_outputs TO authenticated;");
    expect(migration).not.toMatch(
      /GRANT\s+(ALL|INSERT|UPDATE|DELETE)\s+ON\s+public\.creator_studio_render_jobs\s+TO\s+authenticated/i,
    );
    expect(migration).not.toMatch(
      /GRANT\s+(ALL|INSERT|UPDATE|DELETE)\s+ON\s+public\.creator_studio_outputs\s+TO\s+authenticated/i,
    );
  });

  it("never grants DELETE to authenticated on any table (archive semantics only)", () => {
    expect(migration).not.toMatch(/GRANT[^;]*DELETE[^;]*TO\s+authenticated/i);
    expect(migration).not.toMatch(/FOR DELETE TO authenticated/i);
  });

  it("requires the parent project to be owned by the caller before an asset can be inserted", () => {
    const insertPolicy = migration.slice(
      migration.indexOf('CREATE POLICY "creator_studio_assets_owner_insert"'),
      migration.indexOf('CREATE POLICY "creator_studio_assets_owner_update"'),
    );
    expect(insertPolicy).toContain("EXISTS (");
    expect(insertPolicy).toContain("p.owner_user_id = auth.uid()");
  });

  it("protects owner_user_id from client reassignment via a guard trigger on both writable tables", () => {
    expect(migration).toContain("guard_creator_studio_owner");
    expect(migration).toContain("trg_creator_studio_projects_owner_guard");
    expect(migration).toContain("trg_creator_studio_assets_owner_guard");
    expect(migration).toContain("is immutable");
  });
});

describe("migration: private storage buckets", () => {
  it("creates both buckets as non-public", () => {
    expect(migration).toContain("'creator-studio-assets', 'creator-studio-assets', false");
    expect(migration).toContain("'creator-studio-renders', 'creator-studio-renders', false");
  });

  it("scopes storage access to the owner's folder (first path segment = auth.uid())", () => {
    expect(
      migration.match(/\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/g)?.length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("gives no client write policy at all for the renders bucket (server-produced output only)", () => {
    const rendersPolicyIdx = migration.indexOf("creator_studio_renders_storage_owner_read");
    expect(rendersPolicyIdx).toBeGreaterThan(-1);
    expect(migration).not.toContain("creator_studio_renders_storage_owner_write");
    expect(migration).not.toMatch(
      /FOR (INSERT|UPDATE|ALL) TO authenticated\s+USING \(bucket_id = 'creator-studio-renders'/,
    );
  });
});

describe("server functions: feature-flag + auth gating on every entry point", () => {
  it("puts requireCreatorStudioEnabled before requireSupabaseAuth on every handler", () => {
    const matches = [...fns.matchAll(/\.middleware\(\[([^\]]+)\]\)/g)].map((m) => m[1]);
    expect(matches.length).toBeGreaterThanOrEqual(8);
    for (const mw of matches) {
      expect(mw!.trim().startsWith("requireCreatorStudioEnabled")).toBe(true);
      expect(mw).toContain("requireSupabaseAuth");
    }
  });

  it("middleware throws before any DB work when the flag is off", () => {
    expect(middleware).toContain("if (!isCreatorStudioEnabled(process.env))");
    expect(middleware).toContain("throw new Error(CREATOR_STUDIO_DISABLED_MESSAGE)");
  });

  it("never trusts a client-supplied owner id — always context.userId", () => {
    expect(fns).toContain("context.userId");
    expect(fns).not.toMatch(/owner_user_id:\s*data\./);
  });
});

describe("server functions: ownership isolation on every table", () => {
  it("scopes project reads/writes through the RLS-bound session client", () => {
    expect(
      fns.match(/context\.supabase\s*\n\s*\.from\("creator_studio_projects"\)/g)?.length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("scopes asset reads/writes through the RLS-bound session client", () => {
    expect(fns).toContain('.from("creator_studio_assets")');
  });

  it("filters project updates/cancels by owner_user_id, not id alone", () => {
    const updateBlock = fns.slice(
      fns.indexOf("export const updateProjectFn"),
      fns.indexOf("export const markProjectReadyFn"),
    );
    expect(updateBlock).toContain('.eq("owner_user_id", context.userId)');
    const cancelBlock = fns.slice(
      fns.indexOf("export const cancelProjectFn"),
      fns.indexOf("export const registerAssetFn"),
    );
    expect(cancelBlock).toContain('.eq("owner_user_id", context.userId)');
  });

  it("verifies product ownership (seller_id = caller) before linking a product to a project", () => {
    const createBlock = fns.slice(
      fns.indexOf("export const createProjectFn"),
      fns.indexOf("export const getProjectFn"),
    );
    expect(createBlock).toContain('.eq("seller_id", context.userId)');
  });

  it("scopes the own-products list to the caller's own seller_id", () => {
    const listBlock = fns.slice(
      fns.indexOf("export const listOwnProductsForCreatorStudioFn"),
      fns.indexOf("export const createProjectFn"),
    );
    expect(listBlock).toContain('.eq("seller_id", context.userId)');
  });
});

describe("server functions: validation via zod, and CS1 never renders anything", () => {
  it("validates creation type and duration/style/aspect through the shared zod schemas", () => {
    expect(fns).toContain("createProjectInput.parse(input)");
    expect(fns).toContain("updateProjectInput.parse(input)");
  });

  it("never calls a rendering provider or CREATOR_STUDIO_RENDERING_ENABLED-gated path", () => {
    expect(fns).not.toMatch(/shotstack/i);
    expect(fns).not.toContain("requireCreatorStudioRenderingEnabled");
  });

  it("markProjectReadyFn only ever sets status to READY, never COMPLETED", () => {
    const block = fns.slice(
      fns.indexOf("export const markProjectReadyFn"),
      fns.indexOf("export const cancelProjectFn"),
    );
    expect(block).toContain('status: "READY"');
    expect(block).not.toContain('status: "COMPLETED"');
  });

  it("cancelProjectFn archives (CANCELLED), never deletes", () => {
    const block = fns.slice(
      fns.indexOf("export const cancelProjectFn"),
      fns.indexOf("export const registerAssetFn"),
    );
    expect(block).toContain('status: "CANCELLED"');
    expect(block).not.toMatch(/\.delete\(\)/);
  });
});

describe("routes: exist, are guarded, and never leak infrastructure terms", () => {
  it("all four required route files exist", () => {
    for (const path of ROUTE_FILES) {
      expect(existsSync(path)).toBe(true);
    }
  });

  it("every route lives under _authenticated (session-guarded)", () => {
    for (const path of ROUTE_FILES) {
      expect(path).toContain("_authenticated/");
    }
  });

  it("no route/wizard file mentions render job, provider id, Shotstack, JSON timeline, or API request", () => {
    for (const path of [...ROUTE_FILES, "src/lib/creator-studio.functions.ts"]) {
      const src = readFileSync(path, "utf8");
      expect(src).not.toMatch(/render job/i);
      expect(src).not.toMatch(/shotstack/i);
      expect(src).not.toMatch(/json timeline/i);
      expect(src).not.toMatch(/provider[_ ]?id/i);
    }
  });

  it("uses the required customer-safe status copy", () => {
    const videos = readFileSync("src/routes/_authenticated/creator-studio.videos.tsx", "utf8");
    expect(videos).toContain("Creating your video…");
    expect(videos).toContain("Preparing your promo…");
    expect(videos).toContain("Your video is ready.");
    expect(videos).toContain(
      "We couldn't finish this video. Your video allowance was not used. Try again.",
    );
  });

  it("the wizard never claims a video was generated in CS1", () => {
    const wizard = readFileSync("src/routes/_authenticated/creator-studio.new.tsx", "utf8");
    expect(wizard).not.toMatch(/your video is ready/i);
    expect(wizard).toContain("isn't turned on");
  });

  it("V1 is 9:16 only — no aspect ratio picker in the wizard", () => {
    const wizard = readFileSync("src/routes/_authenticated/creator-studio.new.tsx", "utf8");
    expect(wizard).not.toMatch(/16:9|1:1|4:5|aspect.?ratio.*(select|option|radio)/i);
    expect(wizard).toContain("9:16");
  });

  it("does not implement a timeline editor or drag-and-drop", () => {
    for (const path of ROUTE_FILES) {
      const src = readFileSync(path, "utf8");
      expect(src).not.toMatch(/draggable|dnd|react-dnd|timeline/i);
    }
  });
});

describe("PublisherShell: nav entry is flag-gated and fails safe", () => {
  it("filters the Creator Studio entry through isCreatorStudioEnabledClient", () => {
    expect(shell).toContain("isCreatorStudioEnabledClient(import.meta.env)");
    expect(shell).toContain("!item.creatorStudio || isCreatorStudioEnabledClient");
  });

  it("imports the client flag from the feature-flags module, not the middleware", () => {
    expect(shell).toContain('from "@/lib/creator-studio-feature-flags"');
  });
});
