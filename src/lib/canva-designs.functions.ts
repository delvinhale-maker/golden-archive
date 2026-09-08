import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CanvaApiError, type CanvaApiFailureReason, type CanvaDesignSummary } from "./canva-oauth";

/**
 * Canva design discovery / "Turn Into Product" server functions.
 *
 * Thin wrappers only — all Canva API and token logic lives in canva-oauth.ts,
 * dynamically imported inside each handler so the server-only module never
 * enters the client bundle. Tenancy: the user id always comes from the
 * verified session (context.userId), never from client input.
 *
 * These return a discriminated { ok } result instead of throwing for the
 * expected failure modes (not connected, expired auth, rate limited, design
 * gone, export failed/timeout) so the UI can render an honest, specific
 * state for each — never a generic error, never a false success.
 */

export type CanvaListDesignsResult =
  | { ok: true; items: CanvaDesignSummary[]; continuation?: string }
  | { ok: false; reason: CanvaApiFailureReason; retryAfterSeconds?: number };

export type CanvaPreviewDesignResult =
  | { ok: true; design: CanvaDesignSummary }
  | { ok: false; reason: CanvaApiFailureReason; retryAfterSeconds?: number };

export type TurnIntoProductResult =
  | { ok: true; duplicate: false; productId: string; productTypeKey: "other" }
  | { ok: true; duplicate: true; productId: string; productTypeKey: "other" }
  | {
      ok: false;
      reason: CanvaApiFailureReason | "storage_failed" | "draft_failed" | "mapping_failed";
      retryAfterSeconds?: number;
    };

function toFailure(err: unknown): { reason: CanvaApiFailureReason; retryAfterSeconds?: number } {
  if (err instanceof CanvaApiError) {
    return { reason: err.reason, retryAfterSeconds: err.retryAfterSeconds };
  }
  return { reason: "api_error" };
}

const listDesignsInput = z.object({ continuation: z.string().optional() });
const designIdInput = z.object({ designId: z.string().min(1).max(200) });

export const listCanvaDesignsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listDesignsInput.parse(input))
  .handler(async ({ context, data }): Promise<CanvaListDesignsResult> => {
    const { getValidCanvaAccessToken, listCanvaDesigns } = await import("./canva-oauth");
    try {
      const token = await getValidCanvaAccessToken(context.userId);
      const { items, continuation } = await listCanvaDesigns(token, data.continuation);
      return { ok: true, items, continuation };
    } catch (err) {
      return { ok: false, ...toFailure(err) };
    }
  });

export const previewCanvaDesignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => designIdInput.parse(input))
  .handler(async ({ context, data }): Promise<CanvaPreviewDesignResult> => {
    const { getValidCanvaAccessToken, getCanvaDesign } = await import("./canva-oauth");
    try {
      const token = await getValidCanvaAccessToken(context.userId);
      const design = await getCanvaDesign(token, data.designId);
      return { ok: true, design };
    } catch (err) {
      return { ok: false, ...toFailure(err) };
    }
  });

/** Draft product category/type for every Canva import — the creator changes this in the editor. */
const CANVA_IMPORT_CATEGORY = "templates" as const;
const CANVA_IMPORT_PRODUCT_TYPE = "other" as const;

export const turnCanvaDesignIntoProductFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => designIdInput.parse(input))
  .handler(async ({ context, data }): Promise<TurnIntoProductResult> => {
    const designId = data.designId.trim();

    const { integrationAdminClient, getValidCanvaAccessToken, getCanvaDesign, exportCanvaDesign } =
      await import("./canva-oauth");
    const admin = await integrationAdminClient();

    // Duplicate-import protection: one mapping per (creator, design). Checked
    // first so a re-selection of an already-imported design never creates a
    // second product, and so we never spend an export/storage round trip on
    // a design that's already linked.
    const { data: existingMapping } = await admin
      .from("canva_design_products")
      .select("product_id")
      .eq("user_id", context.userId)
      .eq("canva_design_id", designId)
      .maybeSingle();

    if (existingMapping) {
      return {
        ok: true,
        duplicate: true,
        productId: (existingMapping as { product_id: string }).product_id,
        productTypeKey: CANVA_IMPORT_PRODUCT_TYPE,
      };
    }

    let token: string;
    try {
      token = await getValidCanvaAccessToken(context.userId);
    } catch (err) {
      return { ok: false, ...toFailure(err) };
    }

    let design;
    try {
      design = await getCanvaDesign(token, designId);
    } catch (err) {
      return { ok: false, ...toFailure(err) };
    }

    let exported: { url: string };
    try {
      exported = await exportCanvaDesign(token, designId, "png");
    } catch (err) {
      return { ok: false, ...toFailure(err) };
    }

    // Download the exported asset server-side (the URL is a short-lived,
    // pre-signed Canva link — no bearer token needed) and re-host it in
    // AurumVault storage. The Canva token never leaves this handler.
    let assetBytes: ArrayBuffer;
    let contentType = "image/png";
    try {
      const assetRes = await fetch(exported.url);
      if (!assetRes.ok) throw new Error(`download failed (${assetRes.status})`);
      contentType = assetRes.headers.get("content-type") ?? contentType;
      assetBytes = await assetRes.arrayBuffer();
    } catch {
      return { ok: false, reason: "storage_failed" };
    }

    const ts = Date.now();
    const coverPath = `${context.userId}/canva-${designId.replace(/[^a-zA-Z0-9_-]/g, "_")}-${ts}.png`;
    let coverUrl: string;
    try {
      const upload = await admin.storage
        .from("product-covers")
        .upload(coverPath, assetBytes, { upsert: false, contentType });
      if (upload.error) throw upload.error;
      const { data: pub } = admin.storage.from("product-covers").getPublicUrl(coverPath);
      if (!pub?.publicUrl) throw new Error("no public URL returned");
      coverUrl = pub.publicUrl;
    } catch {
      return { ok: false, reason: "storage_failed" };
    }

    // Draft product row via the RLS-bound session client (not the admin
    // client): defense-in-depth so the same seller_id = auth.uid() policy
    // that protects the manual publish flow also protects this path.
    let productId: string;
    try {
      const { data: inserted, error } = await context.supabase
        .from("marketplace_products")
        .insert({
          seller_id: context.userId,
          title: design.title.slice(0, 200),
          description: "Imported from Canva. Add a description before publishing.",
          category: CANVA_IMPORT_CATEGORY,
          product_type: CANVA_IMPORT_PRODUCT_TYPE,
          cover_url: coverUrl,
          price_cents: 0,
          status: "draft",
          published: false,
        })
        .select("id")
        .single();
      if (error || !inserted?.id) throw error ?? new Error("insert returned no id");
      productId = inserted.id as string;
    } catch {
      // Nothing durable was created yet besides the storage object — best
      // effort cleanup, but a stray cover image is harmless (never linked
      // to a product) so we don't fail the whole request over its cleanup.
      await admin.storage
        .from("product-covers")
        .remove([coverPath])
        .catch(() => undefined);
      return { ok: false, reason: "draft_failed" };
    }

    // Mapping row — service-role, explicitly scoped to the verified session
    // user id (never trusting client input). If this fails, roll back the
    // just-created draft so we never leave an unmapped orphan product behind
    // from a partially-failed import.
    try {
      const { error } = await admin.from("canva_design_products").insert({
        user_id: context.userId,
        canva_design_id: designId,
        product_id: productId,
        source_title: design.title,
        canva_updated_at: design.updatedAt,
      });
      if (error) throw error;
    } catch {
      await admin
        .from("marketplace_products")
        .delete()
        .eq("id", productId)
        .catch(() => undefined);
      await admin.storage
        .from("product-covers")
        .remove([coverPath])
        .catch(() => undefined);
      return { ok: false, reason: "mapping_failed" };
    }

    return { ok: true, duplicate: false, productId, productTypeKey: CANVA_IMPORT_PRODUCT_TYPE };
  });
