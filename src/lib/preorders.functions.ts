import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PreorderConfig = {
  isPreorder: boolean;
  releaseDate: string | null;
  preorderNote: string | null;
  releasedAt: string | null;
};

export const getPreorderConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string }) => {
    if (!UUID_RE.test(input.productId)) throw new Error("Invalid productId");
    return input;
  })
  .handler(async ({ data, context }): Promise<PreorderConfig> => {
    const { data: row, error } = await context.supabase
      .from("marketplace_products")
      .select("is_preorder,release_date,preorder_note,released_at,seller_id" as any)
      .eq("id", data.productId)
      .maybeSingle();
    if (error || !row) throw new Error("Product not found");
    const r = row as any;
    if (r.seller_id !== context.userId) throw new Error("Forbidden");
    return {
      isPreorder: !!r.is_preorder,
      releaseDate: r.release_date ?? null,
      preorderNote: r.preorder_note ?? null,
      releasedAt: r.released_at ?? null,
    };
  });

export const updatePreorderConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      productId: string;
      isPreorder: boolean;
      releaseDate?: string | null;
      preorderNote?: string | null;
    }) => {
      if (!UUID_RE.test(input.productId)) throw new Error("Invalid productId");
      if (input.isPreorder && !input.releaseDate) {
        throw new Error("Release date is required for pre-orders");
      }
      if (input.preorderNote && input.preorderNote.length > 300) {
        throw new Error("Note is too long (max 300 chars)");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { data: owned } = await context.supabase
      .from("marketplace_products")
      .select("seller_id")
      .eq("id", data.productId)
      .maybeSingle();
    if (!owned || (owned as any).seller_id !== context.userId) {
      throw new Error("Forbidden");
    }
    const patch: any = {
      is_preorder: data.isPreorder,
      release_date: data.isPreorder ? data.releaseDate : null,
      preorder_note: data.isPreorder ? data.preorderNote ?? null : null,
    };
    // Turning pre-order off does NOT auto-set released_at; the creator uses
    // "Release now" or the cron to explicitly release.
    const { error } = await context.supabase
      .from("marketplace_products")
      .update(patch)
      .eq("id", data.productId)
      .eq("seller_id", context.userId);
    if (error) throw error;
    return { ok: true as const };
  });

export const releaseNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string }) => {
    if (!UUID_RE.test(input.productId)) throw new Error("Invalid productId");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: owned } = await context.supabase
      .from("marketplace_products")
      .select("seller_id,is_preorder,released_at" as any)
      .eq("id", data.productId)
      .maybeSingle();
    const r = owned as any;
    if (!r || r.seller_id !== context.userId) throw new Error("Forbidden");
    if (!r.is_preorder) throw new Error("This product is not a pre-order");
    if (r.released_at) return { ok: true as const, alreadyReleased: true };

    // Use admin client to enqueue delivery emails for existing pre-order buyers.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("marketplace_products")
      .update({ released_at: new Date().toISOString() } as any)
      .eq("id", data.productId);
    await enqueuePreorderDeliveries(data.productId);
    return { ok: true as const, alreadyReleased: false };
  });

async function enqueuePreorderDeliveries(productId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Find all paid order items for this product that were pre-orders.
  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("id,product_title,order:orders(id,buyer_email,status)")
    .eq("product_id", productId)
    .eq("is_preorder_at_purchase", true as any);
  if (!items?.length) return;
  const paid = (items as any[]).filter((i) => i.order?.status === "paid");
  if (!paid.length) return;

  const { data: tokens } = await supabaseAdmin
    .from("order_downloads")
    .select("order_item_id,token")
    .in("order_item_id", paid.map((p) => p.id));
  const tokMap = new Map((tokens ?? []).map((t: any) => [t.order_item_id, t.token]));

  for (const it of paid) {
    const token = tokMap.get(it.id);
    if (!token) continue;
    try {
      await supabaseAdmin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          to: it.order.buyer_email,
          from: "AurumVault <noreply@www.aurumvault.store>",
          sender_domain: "notify.www.aurumvault.store",
          subject: `Your pre-order is ready: ${it.product_title}`,
          html: `<p>Great news — your pre-order for <strong>${it.product_title}</strong> is now available.</p><p><a href="https://www.aurumvault.store/download/${token}">Download it here</a>.</p>`,
          text: `Your pre-order for ${it.product_title} is now available. Download: https://www.aurumvault.store/download/${token}`,
          purpose: "transactional",
          label: "preorder-release",
          idempotency_key: `preorder-release-${it.id}`,
          queued_at: new Date().toISOString(),
        },
      });
    } catch (e) {
      console.error("Failed to enqueue preorder delivery", e);
    }
  }
}

// Called by the /api/public/cron/release-preorders route handler.
export async function releaseDuePreorders(): Promise<{ released: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: due } = await supabaseAdmin
    .from("marketplace_products")
    .select("id" as any)
    .eq("is_preorder", true as any)
    .is("released_at", null as any)
    .lte("release_date", new Date().toISOString() as any);
  const rows = (due as any[]) ?? [];
  if (rows.length === 0) return { released: 0 };
  await supabaseAdmin
    .from("marketplace_products")
    .update({ released_at: new Date().toISOString() } as any)
    .in("id", rows.map((r) => r.id));
  for (const r of rows) {
    try {
      await enqueuePreorderDeliveries(r.id);
    } catch (e) {
      console.error("preorder cron enqueue failed", e);
    }
  }
  return { released: rows.length };
}
