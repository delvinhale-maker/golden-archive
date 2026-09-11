import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCreatorStudioEnabled } from "./feature-flags.middleware";
import {
  registerAssetInput,
  attachAssetInput,
  detachAssetInput,
  projectIdInput,
  type CreatorStudioAsset,
  type CreatorStudioProjectAsset,
} from "./schema";
import { z } from "zod";
import { MAX_SOURCE_ASSET_BYTES, MAX_SCREENSHOTS_PER_PROJECT } from "./abuse-guardrails";

/** V1 accepts still images only -- screenshots/covers/logos, never video. */
const createUploadUrlInput = z.object({
  fileExt: z.enum(["png", "jpg", "jpeg", "webp"]),
});

function mapAssetRow(row: any): CreatorStudioAsset {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    assetType: row.asset_type,
    sourceType: row.source_type,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    mediaType: row.media_type,
    sizeBytes: row.size_bytes,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
  };
}

/**
 * Registers a source asset already uploaded (by the client, directly, using
 * a signed upload target scoped to the caller's own storage folder) to the
 * `creator-studio-source-assets` bucket. This function only records the
 * metadata row -- it never receives file bytes.
 */
export const registerAssetFn = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((data: unknown) => registerAssetInput.parse(data))
  .handler(async ({ data, context }): Promise<CreatorStudioAsset> => {
    if (!data.storagePath.startsWith(`${context.userId}/`)) {
      throw new Error("Invalid storage path");
    }
    if (data.sizeBytes !== undefined && data.sizeBytes > MAX_SOURCE_ASSET_BYTES) {
      throw new Error("That file is too large (max 15MB)");
    }
    const { data: row, error } = await context.supabase
      .from("creator_studio_assets" as any)
      .insert({
        owner_user_id: context.userId,
        asset_type: data.assetType,
        source_type: "UPLOADED",
        storage_bucket: "creator-studio-source-assets",
        storage_path: data.storagePath,
        media_type: data.mediaType,
        size_bytes: data.sizeBytes ?? null,
        width: data.width ?? null,
        height: data.height ?? null,
        checksum: data.checksum ?? null,
      })
      .select(
        "id,owner_user_id,asset_type,source_type,storage_bucket,storage_path,media_type,size_bytes,width,height,created_at",
      )
      .single();
    if (error || !row) throw new Error("Couldn't save this file");
    return mapAssetRow(row);
  });

export const attachAssetToProjectFn = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((data: unknown) => attachAssetInput.parse(data))
  .handler(async ({ data, context }): Promise<CreatorStudioProjectAsset> => {
    if (data.role === "SCREENSHOT") {
      const { count } = await context.supabase
        .from("creator_studio_project_assets" as any)
        .select("id", { count: "exact", head: true })
        .eq("project_id", data.projectId)
        .eq("role", "SCREENSHOT");
      if ((count ?? 0) >= MAX_SCREENSHOTS_PER_PROJECT) {
        throw new Error(`You can add up to ${MAX_SCREENSHOTS_PER_PROJECT} screenshots per video`);
      }
    }
    const { data: row, error } = await context.supabase
      .from("creator_studio_project_assets" as any)
      .insert({
        project_id: data.projectId,
        asset_id: data.assetId,
        owner_user_id: context.userId,
        role: data.role,
        sort_order: data.sortOrder,
      })
      .select("id,project_id,asset_id,role,sort_order")
      .single();
    if (error || !row) throw new Error("Couldn't add this to your project");
    return {
      id: row.id,
      projectId: row.project_id,
      assetId: row.asset_id,
      role: row.role,
      sortOrder: row.sort_order,
    };
  });

export const detachAssetFromProjectFn = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((data: unknown) => detachAssetInput.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("creator_studio_project_assets" as any)
      .delete()
      .eq("id", data.projectAssetId)
      .eq("owner_user_id", context.userId);
    if (error) throw new Error("Couldn't remove this item");
    return { ok: true };
  });

export const listProjectAssetsFn = createServerFn({ method: "GET" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((data: unknown) => projectIdInput.parse(data))
  .handler(async ({ data, context }): Promise<CreatorStudioProjectAsset[]> => {
    const { data: rows, error } = await context.supabase
      .from("creator_studio_project_assets" as any)
      .select(
        "id,project_id,asset_id,role,sort_order,asset:creator_studio_assets(id,owner_user_id,asset_type,source_type,storage_bucket,storage_path,media_type,size_bytes,width,height,created_at)",
      )
      .eq("project_id", data.projectId)
      .eq("owner_user_id", context.userId)
      .order("sort_order", { ascending: true });
    if (error) throw new Error("Couldn't load this project's media");
    return ((rows ?? []) as any[]).map((row) => ({
      id: row.id,
      projectId: row.project_id,
      assetId: row.asset_id,
      role: row.role,
      sortOrder: row.sort_order,
      asset: row.asset ? mapAssetRow(row.asset) : undefined,
    }));
  });

/**
 * Mints a short-lived signed upload URL scoped to the caller's own folder in
 * the private `creator-studio-source-assets` bucket. The client PUTs the
 * file bytes directly to Supabase Storage using this URL -- file bytes never
 * pass through this server function -- then calls registerAssetFn with the
 * resulting path to record the metadata row.
 */
export const createUploadUrlFn = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((data: unknown) => createUploadUrlInput.parse(data))
  .handler(
    async ({ data, context }): Promise<{ signedUrl: string; token: string; path: string }> => {
      const path = `${context.userId}/${crypto.randomUUID()}.${data.fileExt}`;
      const { data: signed, error } = await context.supabase.storage
        .from("creator-studio-source-assets")
        .createSignedUploadUrl(path);
      if (error || !signed) throw new Error("Couldn't prepare an upload slot");
      return { signedUrl: signed.signedUrl, token: signed.token, path };
    },
  );
