import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccountOrder = {
  id: string;
  created_at: string;
  amount_cents: number;
  status: string;
  items: {
    id: string;
    product_id: string;
    product_title: string;
    unit_amount_cents: number;
    cover_url: string | null;
    file_path: string | null;
    file_size_bytes: number | null;
    creator_name: string | null;
    download_token: string | null;
  }[];
};

export const getMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountOrder[]> => {
    const email = (context.claims as { email?: string })?.email;
    if (!email) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id,created_at,amount_cents,status,buyer_email")
      .ilike("buyer_email", email)
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!orders?.length) return [];

    const orderIds = orders.map((o) => o.id);
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select(
        "id,order_id,product_id,product_title,unit_amount_cents,marketplace_products(cover_url,file_path)",
      )
      .in("order_id", orderIds);

    const itemIds = (items ?? []).map((i) => i.id);
    const { data: downloads } = itemIds.length
      ? await supabaseAdmin
          .from("order_downloads")
          .select("order_item_id,token,expires_at")
          .in("order_item_id", itemIds)
      : { data: [] as { order_item_id: string; token: string; expires_at: string }[] };

    const tokenByItem = new Map<string, string>();
    for (const d of downloads ?? []) {
      if (new Date(d.expires_at).getTime() > Date.now()) tokenByItem.set(d.order_item_id, d.token);
    }

    return orders.map((o) => ({
      id: o.id,
      created_at: o.created_at,
      amount_cents: o.amount_cents,
      status: o.status,
      items: (items ?? [])
        .filter((i) => i.order_id === o.id)
        .map((i) => {
          const mp = (i.marketplace_products ?? null) as
            | { cover_url: string | null; file_path: string | null }
            | null;
          return {
            id: i.id,
            product_id: i.product_id,
            product_title: i.product_title,
            unit_amount_cents: i.unit_amount_cents,
            cover_url: mp?.cover_url ?? null,
            file_path: mp?.file_path ?? null,
            download_token: tokenByItem.get(i.id) ?? null,
          };
        }),
    }));
  });
