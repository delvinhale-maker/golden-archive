import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCreatorStudioEnabled } from "@/lib/creator-studio-feature-flags.middleware";
import {
  creatorStudioAssetInputSchema,
  creatorStudioProjectInputSchema,
  creatorStudioProjectUpdateSchema,
  type CreatorStudioAsset,
  type CreatorStudioProject,
} from "@/lib/creator-studio.schema";

const PROJECT_COLS = "id,owner_user_id,title,goal,status,duration_seconds,aspect_ratio,style_key,product_title,call_to_action,destination_url,price_label,wizard_step,created_at,updated_at,archived_at";
const ASSET_COLS = "id,owner_user_id,project_id,kind,storage_path,mime_type,byte_size,width,height,sort_order,created_at";

function projectPatch(input: Record<string, unknown>) {
  const map: Record<string, string> = {
    title: "title",
    goal: "goal",
    durationSeconds: "duration_seconds",
    styleKey: "style_key",
    productTitle: "product_title",
    callToAction: "call_to_action",
    destinationUrl: "destination_url",
    priceLabel: "price_label",
    wizardStep: "wizard_step",
  };
  const patch: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(map)) if (input[key] !== undefined) patch[column] = input[key] || null;
  patch.updated_at = new Date().toISOString();
  return patch;
}

export const listCreatorStudioProjects = createServerFn({ method: "GET" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorStudioProject[]> => {
    const { data, error } = await (context.supabase.from("creator_studio_projects" as never) as any)
      .select(PROJECT_COLS)
      .eq("owner_user_id", context.userId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false });
    if (error) throw new Error("Couldn't load Creator Studio projects");
    return (data ?? []) as CreatorStudioProject[];
  });

export const createCreatorStudioProject = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => creatorStudioProjectInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<CreatorStudioProject> => {
    const { data: row, error } = await (context.supabase.from("creator_studio_projects" as never) as any)
      .insert({ owner_user_id: context.userId, ...projectPatch(data as any), aspect_ratio: "9:16", status: "DRAFT" })
      .select(PROJECT_COLS)
      .single();
    if (error || !row) throw new Error("Couldn't create Creator Studio project");
    return row as CreatorStudioProject;
  });

export const getCreatorStudioProject = createServerFn({ method: "GET" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ project: CreatorStudioProject; assets: CreatorStudioAsset[] }> => {
    const { data: project, error } = await (context.supabase.from("creator_studio_projects" as never) as any)
      .select(PROJECT_COLS).eq("id", data.id).eq("owner_user_id", context.userId).maybeSingle();
    if (error || !project) throw new Error("Creator Studio project not found");
    const { data: assets, error: assetError } = await (context.supabase.from("creator_studio_assets" as never) as any)
      .select(ASSET_COLS).eq("project_id", data.id).eq("owner_user_id", context.userId).order("sort_order");
    if (assetError) throw new Error("Couldn't load project assets");
    return { project, assets: assets ?? [] } as any;
  });

export const updateCreatorStudioProject = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => creatorStudioProjectUpdateSchema.parse(input))
  .handler(async ({ data, context }): Promise<CreatorStudioProject> => {
    const { id, ...rest } = data;
    const { data: row, error } = await (context.supabase.from("creator_studio_projects" as never) as any)
      .update(projectPatch(rest as any)).eq("id", id).eq("owner_user_id", context.userId)
      .select(PROJECT_COLS).maybeSingle();
    if (error || !row) throw new Error("Couldn't update Creator Studio project");
    return row as CreatorStudioProject;
  });

export const archiveCreatorStudioProject = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const { error } = await (context.supabase.from("creator_studio_projects" as never) as any)
      .update({ status: "ARCHIVED", archived_at: now, updated_at: now })
      .eq("id", data.id).eq("owner_user_id", context.userId);
    if (error) throw new Error("Couldn't archive Creator Studio project");
    return { ok: true };
  });

export const registerCreatorStudioAsset = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => creatorStudioAssetInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<CreatorStudioAsset> => {
    const ownerPrefix = `${context.userId}/`;
    if (!data.storagePath.startsWith(ownerPrefix)) throw new Error("Invalid asset path");
    const { data: row, error } = await (context.supabase.from("creator_studio_assets" as never) as any)
      .insert({
        owner_user_id: context.userId,
        project_id: data.projectId,
        kind: data.kind,
        storage_path: data.storagePath,
        mime_type: data.mimeType,
        byte_size: data.byteSize,
        width: data.width ?? null,
        height: data.height ?? null,
        sort_order: data.sortOrder,
      }).select(ASSET_COLS).single();
    if (error || !row) throw new Error("Couldn't register Creator Studio asset");
    return row as CreatorStudioAsset;
  });
