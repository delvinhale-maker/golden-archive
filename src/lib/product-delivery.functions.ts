import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Mints a short-lived signed URL for one of a purchased product's delivery
 * files (ZIP bundle, individual PDF, spreadsheet, ...).
 *
 * Security: the caller must present a valid, unexpired order download token
 * that belongs to the signed-in buyer's email, and the requested file must
 * belong to the exact product on that order line. Extra delivery files do NOT
 * consume the order's primary download counter — they are part of the same
 * purchase.
 */
export const getDeliveryFileDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { token: string; fileId: string }) => {
    if (!/^[a-f0-9]{32,128}$/.test(data.token)) throw new Error("Invalid token");
    if (!/^[0-9a-f-]{36}$/i.test(data.fileId)) throw new Error("Invalid file id");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const buyerEmail = (context.claims as { email?: string })?.email?.toLowerCase();
    if (!buyerEmail) return { error: "Sign in to access your download" } as const;

    const { data: dl, error } = await supabaseAdmin
      .from("order_downloads")
      .select(
        "id,expires_at,order_item:order_items(product_id,is_preorder_at_purchase,product:marketplace_products(is_preorder,release_date,released_at),order:orders(buyer_email))",
      )
      .eq("token", data.token)
      .maybeSingle();

    if (error || !dl) return { error: "Download link not found" } as const;

    const orderItem = (dl as any).order_item;
    const orderBuyerEmail: string | undefined = orderItem?.order?.buyer_email;
    if (!orderBuyerEmail || orderBuyerEmail.toLowerCase() !== buyerEmail) {
      return { error: "This download link belongs to a different account" } as const;
    }
    if (new Date(dl.expires_at).getTime() < Date.now()) {
      return { error: "This download link has expired" } as const;
    }

    const p = orderItem?.product;
    if (orderItem?.is_preorder_at_purchase && p?.is_preorder && !p?.released_at) {
      const rd = p?.release_date ? new Date(p.release_date) : null;
      if (!rd || rd.getTime() > Date.now()) {
        return { error: "This pre-order hasn't been released yet." } as const;
      }
    }

    const { data: file } = await supabaseAdmin
      .from("product_download_files" as any)
      .select("id,label,file_path,product_id")
      .eq("id", data.fileId)
      .maybeSingle();

    const f = file as { file_path?: string; label?: string; product_id?: string } | null;
    if (!f?.file_path) return { error: "File is no longer available" } as const;
    if (f.product_id !== orderItem?.product_id) {
      return { error: "This file isn't part of that purchase" } as const;
    }

    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("product-files")
      .createSignedUrl(f.file_path, 60 * 10, { download: true });

    if (sErr || !signed?.signedUrl) return { error: "Failed to generate download" } as const;

    return { ok: true as const, url: signed.signedUrl, label: f.label ?? "Download" };
  });
