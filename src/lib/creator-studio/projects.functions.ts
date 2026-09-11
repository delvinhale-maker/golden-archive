import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCreatorStudioEnabled } from "./feature-flags.middleware";
import {
  createProjectInput,
  updateProjectInput,
  projectIdInput,
  type CreatorStudioProject,
} from "./schema";
import { toProductPreview } from "./product-adapter";

function mapProjectRow(row: any): CreatorStudioProject {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    sourceProductId: row.source_product_id,
    projectType: row.project_type,
    title: row.title,
    ctaText: row.cta_text,
    priceText: row.price_text,
    destinationUrl: row.destination_url,
    stylePreset: row.style_preset,
    durationSeconds: row.duration_seconds,
    aspectRatio: row.aspect_ratio,
    status: row.status,
    currentTemplateVersion: row.current_template_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const PROJECT_COLUMNS =
  "id,owner_user_id,source_product_id,project_type,title,cta_text,price_text,destination_url,style_preset,duration_seconds,aspect_ratio,status,current_template_version,created_at,updated_at";

/**
 * Creates a project. If `sourceProductId` is supplied it is re-verified as
 * belonging to the caller (never trusted from the client) and used to
 * preload title/CTA/price/URL via the product adapter -- the project only
 * stores a snapshot of those fields plus a reference id, never a copy of the
 * product's other columns.
 */
export const createProjectFn = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((data: unknown) => createProjectInput.parse(data))
  .handler(async ({ data, context }): Promise<CreatorStudioProject> => {
    let preload: { title: string; priceText: string | null; destinationUrl: string | null } | null =
      null;

    if (data.sourceProductId) {
      const { data: product } = await context.supabase
        .from("marketplace_products")
        .select("id,title,cover_url,description,price_cents,slug,creator_name")
        .eq("id", data.sourceProductId)
        .eq("seller_id", context.userId)
        .maybeSingle();
      if (!product) throw new Error("That product isn't available to use");
      const preview = toProductPreview(product);
      preload = {
        title: preview.title,
        priceText: `$${(preview.priceCents / 100).toFixed(2)}`,
        destinationUrl: preview.destinationUrl,
      };
    }

    const { data: row, error } = await context.supabase
      .from("creator_studio_projects" as any)
      .insert({
        owner_user_id: context.userId,
        source_product_id: data.sourceProductId ?? null,
        project_type: data.projectType,
        title: preload?.title ?? data.title,
        price_text: preload?.priceText ?? null,
        destination_url: preload?.destinationUrl ?? null,
        style_preset: "CLEAN_MINIMAL",
        status: "DRAFT",
      })
      .select(PROJECT_COLUMNS)
      .single();

    if (error || !row) throw new Error("Couldn't start your project");
    return mapProjectRow(row);
  });

export const getProjectFn = createServerFn({ method: "GET" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((data: unknown) => projectIdInput.parse(data))
  .handler(async ({ data, context }): Promise<CreatorStudioProject> => {
    const { data: row, error } = await context.supabase
      .from("creator_studio_projects" as any)
      .select(PROJECT_COLUMNS)
      .eq("id", data.projectId)
      .maybeSingle();
    if (error || !row) throw new Error("Project not found");
    return mapProjectRow(row);
  });

export const listMyProjectsFn = createServerFn({ method: "GET" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorStudioProject[]> => {
    const { data, error } = await context.supabase
      .from("creator_studio_projects" as any)
      .select(PROJECT_COLUMNS)
      .eq("owner_user_id", context.userId)
      .neq("status", "ARCHIVED")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Couldn't load your videos");
    return (data ?? []).map(mapProjectRow);
  });

export const updateProjectFn = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((data: unknown) => updateProjectInput.parse(data))
  .handler(async ({ data, context }): Promise<CreatorStudioProject> => {
    const { projectId, ...rest } = data;
    const patch: Record<string, unknown> = {};
    if (rest.title !== undefined) patch.title = rest.title;
    if (rest.ctaText !== undefined) patch.cta_text = rest.ctaText;
    if (rest.priceText !== undefined) patch.price_text = rest.priceText;
    if (rest.destinationUrl !== undefined) patch.destination_url = rest.destinationUrl;
    if (rest.stylePreset !== undefined) patch.style_preset = rest.stylePreset;
    if (rest.durationSeconds !== undefined) patch.duration_seconds = rest.durationSeconds;

    const { data: row, error } = await context.supabase
      .from("creator_studio_projects" as any)
      .update(patch)
      .eq("id", projectId)
      .eq("owner_user_id", context.userId)
      .select(PROJECT_COLUMNS)
      .single();

    if (error || !row) throw new Error("Couldn't save your changes");
    return mapProjectRow(row);
  });

/** Marks a project READY once assets/style/duration are set -- never COMPLETE (only the render pipeline sets that). */
export const markProjectReadyFn = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((data: unknown) => projectIdInput.parse(data))
  .handler(async ({ data, context }): Promise<CreatorStudioProject> => {
    const { data: row, error } = await context.supabase
      .from("creator_studio_projects" as any)
      .update({ status: "READY" })
      .eq("id", data.projectId)
      .eq("owner_user_id", context.userId)
      .in("status", ["DRAFT", "READY", "FAILED"])
      .select(PROJECT_COLUMNS)
      .single();
    if (error || !row) throw new Error("Couldn't mark this project ready");
    return mapProjectRow(row);
  });

/** Archives a project (soft delete -- see the migration's no-DELETE-grant design). */
export const archiveProjectFn = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((data: unknown) => projectIdInput.parse(data))
  .handler(async ({ data, context }): Promise<CreatorStudioProject> => {
    const { data: row, error } = await context.supabase
      .from("creator_studio_projects" as any)
      .update({ status: "ARCHIVED" })
      .eq("id", data.projectId)
      .eq("owner_user_id", context.userId)
      .select(PROJECT_COLUMNS)
      .single();
    if (error || !row) throw new Error("Couldn't archive this project");
    return mapProjectRow(row);
  });
