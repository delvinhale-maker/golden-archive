import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CREATOR_STUDIO_PROJECT_TYPE_LABELS,
  creatorStudioAssetIdSchema,
  creatorStudioCreateProjectSchema,
  creatorStudioProjectIdSchema,
  creatorStudioProjectStatusSchema,
  creatorStudioProjectUpdateSchema,
  creatorStudioSelectProductSchema,
  creatorStudioUploadCompleteSchema,
  creatorStudioUploadRequestSchema,
  type CreatorStudioAsset,
  type CreatorStudioProject,
  type CreatorStudioSourceProduct,
} from "@/lib/creator-studio.schema";

const BUCKET = "creator-studio-assets";
const PROJECT_COLS =
  "id,owner_user_id,source_product_id,project_type,title,product_title,status,duration_seconds,aspect_ratio,style_key,hook,cta,destination_url,price_cents,currency,wizard_step,metadata,created_at,updated_at";
const ASSET_COLS =
  "id,owner_user_id,category,state,storage_path,original_filename,mime_type,byte_size,width,height,metadata,created_at,updated_at";

function projectsTable(supabase: any) {
  return supabase.from("creator_studio_projects" as never) as any;
}
function assetsTable(supabase: any) {
  return supabase.from("creator_studio_assets" as never) as any;
}
function projectAssetsTable(supabase: any) {
  return supabase.from("creator_studio_project_assets" as never) as any;
}

function safeFilename(filename: string) {
  const cleaned = filename
    .trim()
    .replace(/[/\\]/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(-180);
  return cleaned || "asset";
}

function normalizeUploadMime(filename: string, mimeType: string) {
  const clean = mimeType.trim().toLowerCase();
  if (clean && clean !== "application/octet-stream") return clean;
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "mp4") return "video/mp4";
  return clean || "application/octet-stream";
}

function userFacingProjectError(message: string | undefined) {
  if (!message) return "Creator Studio could not save this change.";
  if (message.includes("creator_studio_source_product_not_owned")) {
    return "That AurumVault product is not owned by this creator account.";
  }
  if (message.includes("creator_studio_ready_requires_product_title")) {
    return "Add a product title before marking this project ready.";
  }
  if (message.includes("creator_studio_ready_requires_hook")) {
    return "Add a headline or hook before marking this project ready.";
  }
  if (message.includes("creator_studio_ready_requires_cta")) {
    return "Add a call to action before marking this project ready.";
  }
  if (message.includes("creator_studio_ready_requires_cover")) {
    return "Add a product cover before marking this project ready.";
  }
  if (message.includes("creator_studio_invalid_transition")) {
    return "That project status change is not allowed.";
  }
  return "Creator Studio could not save this change.";
}

function userFacingAssetError(message: string | undefined) {
  if (!message) return "Creator Studio could not reserve this asset.";
  if (message.includes("creator_studio_asset_limit_reached")) {
    return "This project already has the maximum number of assets for that type.";
  }
  if (message.includes("creator_studio_asset_mime_invalid")) {
    return "That file type is not allowed for this asset.";
  }
  if (message.includes("creator_studio_asset_size_invalid")) {
    return "Each Creator Studio asset must be 50 MB or smaller.";
  }
  if (message.includes("creator_studio_project_locked")) {
    return "Assets cannot be changed while this project is locked.";
  }
  return "Creator Studio could not reserve this asset.";
}

async function requireOwnedProject(supabase: any, userId: string, projectId: string) {
  const { data, error } = await projectsTable(supabase)
    .select(PROJECT_COLS)
    .eq("id", projectId)
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("Creator Studio project not found.");
  return data as CreatorStudioProject;
}

export const listCreatorStudioProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorStudioProject[]> => {
    const { data, error } = await projectsTable(context.supabase)
      .select(PROJECT_COLS)
      .eq("owner_user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Creator Studio projects are temporarily unavailable.");
    return (data ?? []) as CreatorStudioProject[];
  });

export const createCreatorStudioProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => creatorStudioCreateProjectSchema.parse(input))
  .handler(async ({ data, context }): Promise<CreatorStudioProject> => {
    const defaultTitle = CREATOR_STUDIO_PROJECT_TYPE_LABELS[data.projectType];
    const { data: row, error } = await projectsTable(context.supabase)
      .insert({
        owner_user_id: context.userId,
        project_type: data.projectType,
        title: data.title ?? defaultTitle,
        status: "DRAFT",
        duration_seconds: 30,
        aspect_ratio: "9:16",
        style_key: "LUXURY_EDITORIAL",
        wizard_step: 1,
      })
      .select(PROJECT_COLS)
      .single();
    if (error || !row) throw new Error("Creator Studio could not create this project.");
    return row as CreatorStudioProject;
  });

export const getCreatorStudioProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => creatorStudioProjectIdSchema.parse(input))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ project: CreatorStudioProject; assets: CreatorStudioAsset[] }> => {
      const project = await requireOwnedProject(context.supabase, context.userId, data.projectId);
      const { data: links, error: linkError } = await projectAssetsTable(context.supabase)
        .select("asset_id,sort_order")
        .eq("project_id", project.id)
        .eq("owner_user_id", context.userId)
        .order("sort_order", { ascending: true });
      if (linkError) throw new Error("Creator Studio assets are temporarily unavailable.");

      const assetIds = (links ?? []).map((row: any) => String(row.asset_id));
      if (assetIds.length === 0) return { project, assets: [] };

      const { data: rows, error: assetError } = await assetsTable(context.supabase)
        .select(ASSET_COLS)
        .eq("owner_user_id", context.userId)
        .in("id", assetIds);
      if (assetError) throw new Error("Creator Studio assets are temporarily unavailable.");

      const sortById = new Map(
        (links ?? []).map((row: any) => [String(row.asset_id), Number(row.sort_order ?? 0)]),
      );
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const assets = await Promise.all(
        ((rows ?? []) as any[]).map(async (row) => {
          let previewUrl: string | null = null;
          if (row.state === "READY") {
            const signed = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(row.storage_path, 600);
            previewUrl = signed.data?.signedUrl ?? null;
          }
          return {
            ...row,
            sort_order: sortById.get(String(row.id)) ?? 0,
            preview_url: previewUrl,
          } as CreatorStudioAsset;
        }),
      );
      assets.sort((a, b) => a.sort_order - b.sort_order);
      return { project, assets };
    },
  );

export const updateCreatorStudioProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => creatorStudioProjectUpdateSchema.parse(input))
  .handler(async ({ data, context }): Promise<CreatorStudioProject> => {
    const { id, ...input } = data;
    const patch: Record<string, string | number | null> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.productTitle !== undefined) patch.product_title = input.productTitle || null;
    if (input.styleKey !== undefined) patch.style_key = input.styleKey;
    if (input.durationSeconds !== undefined) patch.duration_seconds = input.durationSeconds;
    if (input.hook !== undefined) patch.hook = input.hook || null;
    if (input.cta !== undefined) patch.cta = input.cta || null;
    if (input.destinationUrl !== undefined) patch.destination_url = input.destinationUrl || null;
    if (input.priceCents !== undefined) patch.price_cents = input.priceCents;
    if (input.currency !== undefined) patch.currency = input.currency;
    if (input.wizardStep !== undefined) patch.wizard_step = input.wizardStep;

    const { data: row, error } = await projectsTable(context.supabase)
      .update(patch)
      .eq("id", id)
      .eq("owner_user_id", context.userId)
      .select(PROJECT_COLS)
      .maybeSingle();
    if (error || !row) throw new Error(userFacingProjectError(error?.message));
    return row as CreatorStudioProject;
  });

export const listCreatorStudioSourceProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorStudioSourceProduct[]> => {
    const { data: products, error } = await context.supabase
      .from("marketplace_products")
      .select("id,slug,title,cover_url,price_cents,creator_name")
      .eq("seller_id", context.userId)
      .eq("published", true)
      .eq("status", "approved")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Your AurumVault products are temporarily unavailable.");

    const ids = (products ?? []).map((row) => row.id);
    const { data: previews } = ids.length
      ? await context.supabase
          .from("product_previews")
          .select("product_id,image_url,page_order")
          .in("product_id", ids)
          .order("page_order", { ascending: true })
      : { data: [] as { product_id: string; image_url: string; page_order: number }[] };

    const previewsByProduct = new Map<string, string[]>();
    for (const preview of previews ?? []) {
      const list = previewsByProduct.get(preview.product_id) ?? [];
      if (list.length < 8) list.push(preview.image_url);
      previewsByProduct.set(preview.product_id, list);
    }

    return (products ?? []).map((product) => ({
      id: product.id,
      slug: product.slug,
      title: product.title,
      cover_url: product.cover_url,
      price_cents: product.price_cents,
      creator_name: product.creator_name,
      preview_urls: previewsByProduct.get(product.id) ?? [],
    }));
  });

export const selectCreatorStudioSourceProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => creatorStudioSelectProductSchema.parse(input))
  .handler(async ({ data, context }): Promise<CreatorStudioProject> => {
    await requireOwnedProject(context.supabase, context.userId, data.projectId);

    if (data.productId === null) {
      const { data: row, error } = await projectsTable(context.supabase)
        .update({ source_product_id: null, wizard_step: 2 })
        .eq("id", data.projectId)
        .eq("owner_user_id", context.userId)
        .select(PROJECT_COLS)
        .single();
      if (error || !row) throw new Error(userFacingProjectError(error?.message));
      return row as CreatorStudioProject;
    }

    const { data: product, error: productError } = await context.supabase
      .from("marketplace_products")
      .select("id,slug,title,price_cents,seller_id")
      .eq("id", data.productId)
      .eq("seller_id", context.userId)
      .eq("published", true)
      .eq("status", "approved")
      .maybeSingle();
    if (productError || !product) throw new Error("That AurumVault product is not available.");

    const { data: row, error } = await projectsTable(context.supabase)
      .update({
        source_product_id: product.id,
        product_title: product.title,
        price_cents: product.price_cents,
        destination_url: `/products/${product.slug}`,
        wizard_step: 2,
      })
      .eq("id", data.projectId)
      .eq("owner_user_id", context.userId)
      .select(PROJECT_COLS)
      .single();
    if (error || !row) throw new Error(userFacingProjectError(error?.message));
    return row as CreatorStudioProject;
  });

export const requestCreatorStudioAssetUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => creatorStudioUploadRequestSchema.parse(input))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ assetId: string; path: string; token: string; contentType: string }> => {
      await requireOwnedProject(context.supabase, context.userId, data.projectId);

      const assetId = crypto.randomUUID();
      const filename = safeFilename(data.filename);
      const contentType = normalizeUploadMime(filename, data.mimeType);
      const storagePath = `${context.userId}/${data.projectId}/${assetId}/${filename}`;

      const { error: reserveError } = await (context.supabase.rpc as any)(
        "creator_studio_reserve_asset",
        {
          _project_id: data.projectId,
          _asset_id: assetId,
          _category: data.category,
          _storage_path: storagePath,
          _original_filename: filename,
          _mime_type: contentType,
          _byte_size: data.byteSize,
        },
      );
      if (reserveError) throw new Error(userFacingAssetError(reserveError.message));

      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: signed, error: signError } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUploadUrl(storagePath, { upsert: false });
        if (signError || !signed?.token) throw signError ?? new Error("Signed upload token missing.");
        return { assetId, path: storagePath, token: signed.token, contentType };
      } catch {
        await (context.supabase.rpc as any)("creator_studio_release_reserved_asset", {
          _asset_id: assetId,
        });
        throw new Error("Creator Studio could not start this upload. No asset slot was consumed.");
      }
    },
  );

export const completeCreatorStudioAssetUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => creatorStudioUploadCompleteSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: asset, error } = await assetsTable(context.supabase)
      .select(ASSET_COLS)
      .eq("id", data.assetId)
      .eq("owner_user_id", context.userId)
      .eq("state", "PENDING_UPLOAD")
      .maybeSingle();
    if (error || !asset) throw new Error("That pending Creator Studio upload was not found.");

    const parts = String(asset.storage_path).split("/");
    const filename = parts.pop();
    const folder = parts.join("/");
    if (!filename || !folder) throw new Error("Creator Studio could not verify this upload.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const listed = await supabaseAdmin.storage.from(BUCKET).list(folder, {
      limit: 10,
      search: filename,
    });
    if (listed.error) throw new Error("Creator Studio could not verify this upload yet.");

    const object = (listed.data ?? []).find((item) => item.name === filename);
    if (!object) throw new Error("Upload has not reached secure storage yet. Try again.");

    const metadata = (object.metadata ?? {}) as Record<string, unknown>;
    const actualSize = Number(metadata.size ?? 0);
    const actualMime = String(metadata.mimetype ?? metadata.contentType ?? "");
    const sizeMismatch = actualSize > 0 && actualSize !== Number(asset.byte_size);
    const mimeMismatch = actualMime.length > 0 && actualMime !== String(asset.mime_type);

    if (sizeMismatch || mimeMismatch) {
      await supabaseAdmin.storage.from(BUCKET).remove([asset.storage_path]);
      await (context.supabase.rpc as any)("creator_studio_release_reserved_asset", {
        _asset_id: data.assetId,
      });
      throw new Error("Uploaded file metadata did not match the reserved asset.");
    }

    const { data: completed, error: completeError } = await (context.supabase.rpc as any)(
      "creator_studio_complete_asset",
      {
        _asset_id: data.assetId,
        _width: data.width ?? null,
        _height: data.height ?? null,
      },
    );
    if (completeError || completed !== true) {
      throw new Error("Creator Studio could not finalize this upload.");
    }
    return { ok: true };
  });

export const removeCreatorStudioAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => creatorStudioAssetIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true; storageCleanupPending: boolean }> => {
    const { data: asset, error } = await assetsTable(context.supabase)
      .select("id,owner_user_id")
      .eq("id", data.assetId)
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (error || !asset) throw new Error("Creator Studio asset not found.");

    const { data: storagePath, error: removeError } = await (context.supabase.rpc as any)(
      "creator_studio_remove_asset",
      { _asset_id: data.assetId },
    );
    if (removeError || typeof storagePath !== "string") {
      throw new Error(userFacingAssetError(removeError?.message));
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cleanup = await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
    if (cleanup.error) {
      console.error("[creator-studio] private orphan cleanup pending", {
        assetId: data.assetId,
        path: storagePath,
      });
    }
    return { ok: true, storageCleanupPending: !!cleanup.error };
  });

export const setCreatorStudioProjectStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => creatorStudioProjectStatusSchema.parse(input))
  .handler(async ({ data, context }): Promise<CreatorStudioProject> => {
    const { data: row, error } = await projectsTable(context.supabase)
      .update({ status: data.status })
      .eq("id", data.projectId)
      .eq("owner_user_id", context.userId)
      .select(PROJECT_COLS)
      .maybeSingle();
    if (error || !row) throw new Error(userFacingProjectError(error?.message));
    return row as CreatorStudioProject;
  });
