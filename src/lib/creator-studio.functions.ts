import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCreatorStudioEnabled } from "@/lib/creator-studio-feature-flags.middleware";
import {
  CreatorStudioDurationSchema,
  CreatorStudioGoalSchema,
  CreatorStudioStyleSchema,
} from "@/lib/creator-studio.schema";

const PROJECT_COLS =
  "id,owner_user_id,title,goal,status,duration_seconds,aspect_ratio,style_key,product_title,call_to_action,destination_url,price_label,wizard_step,created_at,updated_at,archived_at";
const ASSET_COLS =
  "id,owner_user_id,project_id,kind,storage_path,mime_type,byte_size,width,height,sort_order,created_at";

export type CreatorStudioProjectRow = {
  id: string;
  owner_user_id: string;
  title: string;
  goal: string;
  status: string;
  duration_seconds: number;
  aspect_ratio: "9:16";
  style_key: string;
  product_title: string | null;
  call_to_action: string | null;
  destination_url: string | null;
  price_label: string | null;
  wizard_step: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type CreatorStudioAssetRow = {
  id: string;
  owner_user_id: string;
  project_id: string;
  kind: string;
  storage_path: string;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  sort_order: number;
  created_at: string;
};

const createProjectSchema = z.object({
  goal: CreatorStudioGoalSchema,
  title: z.string().trim().min(1).max(160).optional(),
});

export const listCreatorStudioProjects = createServerFn({ method: "GET" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorStudioProjectRow[]> => {
    const { data, error } = await (context.supabase.from("creator_studio_projects" as never) as any)
      .select(PROJECT_COLS)
      .eq("owner_user_id", context.userId)
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Couldn't load Creator Studio projects");
    return (data ?? []) as CreatorStudioProjectRow[];
  });

export const createCreatorStudioProject = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => createProjectSchema.parse(input))
  .handler(async ({ data, context }): Promise<CreatorStudioProjectRow> => {
    const { data: row, error } = await (context.supabase.from("creator_studio_projects" as never) as any)
      .insert({
        owner_user_id: context.userId,
        goal: data.goal,
        title: data.title ?? "Untitled video project",
      })
      .select(PROJECT_COLS)
      .single();
    if (error || !row) throw new Error("Couldn't create Creator Studio project");
    return row as CreatorStudioProjectRow;
  });

const updateProjectSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(160).optional(),
  goal: CreatorStudioGoalSchema.optional(),
  durationSeconds: CreatorStudioDurationSchema.optional(),
  style: CreatorStudioStyleSchema.optional(),
  productTitle: z.string().trim().max(160).nullable().optional(),
  callToAction: z.string().trim().max(120).nullable().optional(),
  destinationUrl: z.string().url().nullable().optional(),
  priceLabel: z.string().trim().max(40).nullable().optional(),
  wizardStep: z.number().int().min(1).max(5).optional(),
});

export const updateCreatorStudioProject = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => updateProjectSchema.parse(input))
  .handler(async ({ data, context }): Promise<CreatorStudioProjectRow> => {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) patch.title = data.title;
    if (data.goal !== undefined) patch.goal = data.goal;
    if (data.durationSeconds !== undefined) patch.duration_seconds = data.durationSeconds;
    if (data.style !== undefined) patch.style_key = data.style;
    if (data.productTitle !== undefined) patch.product_title = data.productTitle;
    if (data.callToAction !== undefined) patch.call_to_action = data.callToAction;
    if (data.destinationUrl !== undefined) patch.destination_url = data.destinationUrl;
    if (data.priceLabel !== undefined) patch.price_label = data.priceLabel;
    if (data.wizardStep !== undefined) patch.wizard_step = data.wizardStep;

    const { data: row, error } = await (context.supabase.from("creator_studio_projects" as never) as any)
      .update(patch)
      .eq("id", data.id)
      .eq("owner_user_id", context.userId)
      .select(PROJECT_COLS)
      .maybeSingle();
    if (error) throw new Error("Couldn't update Creator Studio project");
    if (!row) throw new Error("Creator Studio project not found");
    return row as CreatorStudioProjectRow;
  });

export const archiveCreatorStudioProject = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.from("creator_studio_projects" as never) as any)
      .update({ status: "ARCHIVED", archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("owner_user_id", context.userId);
    if (error) throw new Error("Couldn't archive Creator Studio project");
    return { ok: true as const };
  });

const uploadSchema = z.object({
  projectId: z.string().uuid(),
  kind: z.enum(["COVER", "SCREENSHOT", "LOGO", "OTHER"]),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  byteSize: z.number().int().positive().max(15 * 1024 * 1024),
});

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const createCreatorStudioAssetUpload = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => uploadSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: project } = await (context.supabase.from("creator_studio_projects" as never) as any)
      .select("id")
      .eq("id", data.projectId)
      .eq("owner_user_id", context.userId)
      .is("archived_at", null)
      .maybeSingle();
    if (!project) throw new Error("Creator Studio project not found");

    const assetId = crypto.randomUUID();
    const storagePath = `${context.userId}/${data.projectId}/${assetId}.${EXTENSIONS[data.mimeType]}`;
    const { data: upload, error: uploadError } = await context.supabase.storage
      .from("creator-studio-assets")
      .createSignedUploadUrl(storagePath);
    if (uploadError || !upload) throw new Error("Couldn't prepare secure asset upload");

    const { data: asset, error } = await (context.supabase.from("creator_studio_assets" as never) as any)
      .insert({
        id: assetId,
        owner_user_id: context.userId,
        project_id: data.projectId,
        kind: data.kind,
        storage_path: storagePath,
        mime_type: data.mimeType,
        byte_size: data.byteSize,
      })
      .select(ASSET_COLS)
      .single();
    if (error || !asset) throw new Error("Couldn't register Creator Studio asset");

    return { asset: asset as CreatorStudioAssetRow, uploadToken: upload.token, storagePath };
  });

export const getCreatorStudioAssetPreviewUrl = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ assetId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: asset } = await (context.supabase.from("creator_studio_assets" as never) as any)
      .select(ASSET_COLS)
      .eq("id", data.assetId)
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (!asset) throw new Error("Creator Studio asset not found");
    const { data: signed, error } = await context.supabase.storage
      .from("creator-studio-assets")
      .createSignedUrl((asset as any).storage_path, 300);
    if (error || !signed?.signedUrl) throw new Error("Couldn't prepare secure asset preview");
    return { url: signed.signedUrl, expiresInSeconds: 300 };
  });
