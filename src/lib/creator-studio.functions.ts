import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCreatorStudioEnabled } from "@/lib/creator-studio-feature-flags.middleware";
import {
  createProjectInput,
  updateProjectInput,
  projectIdInput,
  registerAssetInput,
  type CreatorStudioProject,
  type CreatorStudioAsset,
  type CreatorStudioProductPreview,
} from "@/lib/creator-studio.schema";

/**
 * AurumVault Creator Studio™ — CS1 server functions.
 *
 * Every entry point is gated by requireCreatorStudioEnabled FIRST (before
 * requireSupabaseAuth), so a disabled deployment fails closed before any
 * auth or DB work happens — see creator-studio-feature-flags.middleware.ts.
 *
 * Tenancy: the owner is always context.userId from the verified session,
 * never client input. All reads/writes route through context.supabase (the
 * RLS-bound session client from requireSupabaseAuth), so the DB-level
 * owner policies in the proposed migration are the actual enforcement —
 * this file's own scoping is defense-in-depth, not the only guard.
 *
 * No rendering call exists anywhere in this file: CREATOR_STUDIO_RENDERING_
 * ENABLED stays false in CS1, and "Generate" simply moves a project to
 * READY and stops — see generateProjectFn.
 */

const SITE_URL = "https://www.aurumvault.store";

function mapProjectRow(row: Record<string, unknown>): CreatorStudioProject {
  return {
    id: row.id as string,
    ownerUserId: row.owner_user_id as string,
    productId: (row.product_id as string | null) ?? null,
    projectName: row.project_name as string,
    creationType: row.creation_type as CreatorStudioProject["creationType"],
    style: row.style as CreatorStudioProject["style"],
    durationSeconds: row.duration_seconds as CreatorStudioProject["durationSeconds"],
    aspectRatio: row.aspect_ratio as CreatorStudioProject["aspectRatio"],
    status: row.status as CreatorStudioProject["status"],
    headline: (row.headline as string | null) ?? null,
    ctaText: (row.cta_text as string | null) ?? null,
    ctaUrl: (row.cta_url as string | null) ?? null,
    priceText: (row.price_text as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapAssetRow(row: Record<string, unknown>): CreatorStudioAsset {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    assetType: row.asset_type as CreatorStudioAsset["assetType"],
    storagePath: row.storage_path as string,
    sourceType: row.source_type as CreatorStudioAsset["sourceType"],
    sourceProductAssetId: (row.source_product_asset_id as string | null) ?? null,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
  };
}

/**
 * Safe preview of the CALLER'S OWN products, for the "Use an AurumVault
 * Product" wizard step. Scoped to seller_id = context.userId — a creator
 * can only preload a promo video from a product they themselves sell,
 * never another seller's listing. Never duplicates product truth into
 * Creator Studio tables — this is a read-only, point-in-time list the
 * wizard uses to prefill editable fields the creator then owns.
 */
export const listOwnProductsForCreatorStudioFn = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorStudioProductPreview[]> => {
    const { data, error } = await context.supabase
      .from("marketplace_products")
      .select("id,title,cover_url,description,price_cents,creator_name")
      .eq("seller_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Unable to load your products");
    return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      productId: r.id as string,
      title: r.title as string,
      coverUrl: (r.cover_url as string | null) ?? null,
      description: (r.description as string) ?? "",
      priceCents: (r.price_cents as number) ?? 0,
      destinationUrl: `${SITE_URL}/products/${r.id as string}`,
      creatorName: (r.creator_name as string | null) ?? null,
    }));
  });

export const createProjectFn = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => createProjectInput.parse(input))
  .handler(async ({ context, data }): Promise<CreatorStudioProject> => {
    // If a productId was supplied, verify it belongs to the caller before
    // linking it — never trust that the id alone implies ownership.
    let productId: string | null = null;
    let productTitle: string | null = null;
    let productPriceCents: number | null = null;
    if (data.productId) {
      const { data: product, error } = await context.supabase
        .from("marketplace_products")
        .select("id,title,price_cents")
        .eq("id", data.productId)
        .eq("seller_id", context.userId)
        .maybeSingle();
      if (error || !product) throw new Error("Product not found or not owned by you");
      productId = product.id as string;
      productTitle = product.title as string;
      productPriceCents = product.price_cents as number;
    }

    const { data: inserted, error } = await context.supabase
      .from("creator_studio_projects")
      .insert({
        owner_user_id: context.userId,
        product_id: productId,
        creation_type: data.creationType,
        project_name: productTitle ? `${productTitle} — promo video` : "Untitled video project",
        headline: productTitle,
        price_text: productPriceCents !== null ? `$${(productPriceCents / 100).toFixed(2)}` : null,
        cta_url: productId ? `${SITE_URL}/products/${productId}` : null,
        cta_text: "Shop Now",
      })
      .select("*")
      .single();
    if (error || !inserted) throw new Error("Unable to create project");
    return mapProjectRow(inserted as Record<string, unknown>);
  });

export const getProjectFn = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => projectIdInput.parse(input))
  .handler(async ({ context, data }): Promise<CreatorStudioProject | null> => {
    const { data: row, error } = await context.supabase
      .from("creator_studio_projects")
      .select("*")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw new Error("Unable to load project");
    return row ? mapProjectRow(row as Record<string, unknown>) : null;
  });

export const listMyProjectsFn = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorStudioProject[]> => {
    const { data, error } = await context.supabase
      .from("creator_studio_projects")
      .select("*")
      .eq("owner_user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Unable to load your videos");
    return ((data ?? []) as Record<string, unknown>[]).map(mapProjectRow);
  });

export const updateProjectFn = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => updateProjectInput.parse(input))
  .handler(async ({ context, data }): Promise<CreatorStudioProject> => {
    const { projectId, ...rest } = data;
    const patch: Record<string, unknown> = {};
    if (rest.projectName !== undefined) patch.project_name = rest.projectName;
    if (rest.style !== undefined) patch.style = rest.style;
    if (rest.durationSeconds !== undefined) patch.duration_seconds = rest.durationSeconds;
    if (rest.headline !== undefined) patch.headline = rest.headline;
    if (rest.ctaText !== undefined) patch.cta_text = rest.ctaText;
    if (rest.ctaUrl !== undefined) patch.cta_url = rest.ctaUrl;
    if (rest.priceText !== undefined) patch.price_text = rest.priceText;

    const { data: updated, error } = await context.supabase
      .from("creator_studio_projects")
      .update(patch)
      .eq("id", projectId)
      .eq("owner_user_id", context.userId)
      .select("*")
      .single();
    if (error || !updated) throw new Error("Unable to update project");
    return mapProjectRow(updated as Record<string, unknown>);
  });

/**
 * Wizard's final step. CS1 never renders anything — there is no
 * CREATOR_STUDIO_RENDERING_ENABLED-gated call here at all, by design (see
 * the module doc comment). Moves the project to READY only, so the
 * creator's work is saved and the UI can show "you're all set — rendering
 * isn't turned on yet" honestly instead of pretending a video was made.
 */
export const markProjectReadyFn = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => projectIdInput.parse(input))
  .handler(async ({ context, data }): Promise<CreatorStudioProject> => {
    const { data: updated, error } = await context.supabase
      .from("creator_studio_projects")
      .update({ status: "READY" })
      .eq("id", data.projectId)
      .eq("owner_user_id", context.userId)
      .select("*")
      .single();
    if (error || !updated) throw new Error("Unable to update project");
    return mapProjectRow(updated as Record<string, unknown>);
  });

/** Archive semantics, not destructive deletion — see the migration header. */
export const cancelProjectFn = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => projectIdInput.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("creator_studio_projects")
      .update({ status: "CANCELLED" })
      .eq("id", data.projectId)
      .eq("owner_user_id", context.userId);
    if (error) throw new Error("Unable to cancel project");
    return { ok: true };
  });

export const registerAssetFn = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => registerAssetInput.parse(input))
  .handler(async ({ context, data }): Promise<CreatorStudioAsset> => {
    const { data: inserted, error } = await context.supabase
      .from("creator_studio_assets")
      .insert({
        project_id: data.projectId,
        owner_user_id: context.userId,
        asset_type: data.assetType,
        storage_path: data.storagePath,
        source_type: data.sourceType,
        source_product_asset_id: data.sourceProductAssetId ?? null,
        sort_order: data.sortOrder ?? 0,
      })
      .select("*")
      .single();
    if (error || !inserted) throw new Error("Unable to save asset");
    return mapAssetRow(inserted as Record<string, unknown>);
  });

export const listProjectAssetsFn = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => projectIdInput.parse(input))
  .handler(async ({ context, data }): Promise<CreatorStudioAsset[]> => {
    const { data: rows, error } = await context.supabase
      .from("creator_studio_assets")
      .select("*")
      .eq("project_id", data.projectId)
      .eq("owner_user_id", context.userId)
      .order("sort_order", { ascending: true });
    if (error) throw new Error("Unable to load assets");
    return ((rows ?? []) as Record<string, unknown>[]).map(mapAssetRow);
  });
