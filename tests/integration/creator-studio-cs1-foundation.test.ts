import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260910120000_creator_studio_cs1_foundation.sql",
  "utf8",
);
const schema = readFileSync("src/lib/creator-studio.schema.ts", "utf8");
const functions = readFileSync("src/lib/creator-studio.functions.ts", "utf8");
const home = readFileSync(
  "src/routes/_authenticated/creator-studio.index.tsx",
  "utf8",
);
const project = readFileSync(
  "src/routes/_authenticated/creator-studio.$projectId.tsx",
  "utf8",
);
const publisherShell = readFileSync(
  "src/components/marketplace/PublisherShell.tsx",
  "utf8",
);

describe("Creator Studio CS1 database isolation", () => {
  it("creates the four CS1 domain tables with RLS", () => {
    for (const table of [
      "creator_studio_projects",
      "creator_studio_assets",
      "creator_studio_project_assets",
      "creator_studio_events",
    ]) {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("does not grant anon access and does not permit direct asset/event writes", () => {
    expect(migration).toContain(
      "revoke all on table public.creator_studio_projects from anon, authenticated",
    );
    expect(migration).toContain(
      "revoke all on table public.creator_studio_assets from anon, authenticated",
    );
    expect(migration).not.toMatch(
      /grant (insert|update|delete)[^;]*creator_studio_assets to authenticated/i,
    );
    expect(migration).not.toMatch(
      /grant (insert|update|delete)[^;]*creator_studio_events to authenticated/i,
    );
  });

  it("enforces source marketplace product ownership in the database", () => {
    expect(migration).toContain("creator_studio_source_product_not_owned");
    expect(migration).toContain("from public.marketplace_products");
    expect(migration).toContain("v_seller <> new.owner_user_id");
  });

  it("makes project ownership immutable", () => {
    expect(migration).toContain("creator_studio_owner_immutable");
    expect(migration).toContain(
      "new.owner_user_id is distinct from old.owner_user_id",
    );
  });

  it("rejects cross-owner project/asset links at the database boundary", () => {
    expect(migration).toContain("creator_studio_cross_owner_asset_link_denied");
    expect(migration).toContain("v_project_owner <> v_asset_owner");
    expect(migration).toContain("new.owner_user_id <> v_project_owner");
  });
});

describe("Creator Studio CS1 lifecycle", () => {
  it("reserves provider states while allowing only safe client states", () => {
    expect(migration).toContain(
      "'DRAFT','READY','RENDERING','COMPLETED','FAILED','CANCELLED'",
    );
    expect(migration).toContain("status in ('DRAFT','READY','CANCELLED')");
    expect(schema).toContain('"RENDERING"');
    expect(schema).toContain('"COMPLETED"');
    expect(schema).toContain('"FAILED"');
  });

  it("validates READY at the database boundary", () => {
    expect(migration).toContain("creator_studio_ready_requires_product_title");
    expect(migration).toContain("creator_studio_ready_requires_hook");
    expect(migration).toContain("creator_studio_ready_requires_cta");
    expect(migration).toContain("creator_studio_ready_requires_cover");
  });

  it("invalidates READY after creative changes", () => {
    expect(migration).toContain("old.status = 'READY' and new.status = 'READY'");
    expect(migration).toContain("new.status := 'DRAFT'");
  });
});

describe("Creator Studio CS1 private assets and abuse controls", () => {
  it("keeps the storage bucket private and has no user storage object policy", () => {
    expect(migration).toContain("'creator-studio-assets'");
    expect(migration).toContain("false,\n  52428800");
    expect(migration).not.toMatch(/create policy[\s\S]*on storage\.objects/i);
  });

  it("enforces file-size, MIME, and category ceilings server-side", () => {
    expect(migration).toContain("_byte_size > 52428800");
    expect(migration).toContain("'video/mp4'");
    expect(migration).toContain("when 'PRODUCT_COVER' then 1");
    expect(migration).toContain("when 'SCREENSHOT' then 8");
    expect(migration).toContain("when 'LOGO' then 1");
    expect(migration).toContain("else 4");
    expect(schema).toContain("MAX_CREATOR_STUDIO_ASSET_BYTES");
  });

  it("serializes quota checks by row-locking the project", () => {
    expect(migration).toMatch(
      /from public\.creator_studio_projects[\s\S]*where id = _project_id[\s\S]*for update;/,
    );
    expect(migration).toContain("PENDING_UPLOAD','READY");
  });

  it("uses server-issued signed upload tokens and signed read URLs", () => {
    expect(functions).toContain("createSignedUploadUrl");
    expect(project).toContain("uploadToSignedUrl");
    expect(functions).toContain("createSignedUrl");
    expect(functions).toContain('const BUCKET = "creator-studio-assets"');
  });
});

describe("Creator Studio CS1 application shell", () => {
  it("is protected by the existing _authenticated route tree", () => {
    expect(home).toContain('createFileRoute("/_authenticated/creator-studio/")');
    expect(project).toContain(
      'createFileRoute("/_authenticated/creator-studio/$projectId")',
    );
  });

  it("adds Creator Studio navigation without editing routeTree.gen.ts", () => {
    expect(publisherShell).toContain(
      '{ label: "Creator Studio", to: "/creator-studio" as const }',
    );
    expect(publisherShell).toContain("overflow-x-auto");
  });

  it("implements the seven guided steps without a timeline editor", () => {
    for (const label of [
      "Create",
      "Product",
      "Assets",
      "Message",
      "Style",
      "Duration",
      "Generate",
    ]) {
      expect(project).toContain(`"${label}"`);
    }
    expect(project).not.toMatch(/timeline editor/i);
    expect(project).not.toMatch(/layer editor/i);
    expect(project).not.toMatch(/clip trimming/i);
  });

  it("keeps Generate disabled and contains no provider integration", () => {
    expect(project).toMatch(/disabled[\s\S]*Generate video/);
    const creatorStudioSources = `${schema}\n${functions}\n${home}\n${project}`.toLowerCase();
    expect(creatorStudioSources).not.toContain("shotstack");
    expect(creatorStudioSources).not.toContain("provider_job_id");
  });
});
