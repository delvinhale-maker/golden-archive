import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

type CheckoutResult = { clientSecret: string } | { error: string };

export const createProductCheckout = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { productId: string; returnUrl: string; environment: StripeEnv }) => {
      if (!/^[a-f0-9-]{36}$/.test(data.productId)) throw new Error("Invalid productId");
      if (data.environment !== "sandbox" && data.environment !== "live") {
        throw new Error("Invalid environment");
      }
      return data;
    },
  )
  .handler(async ({ data }): Promise<CheckoutResult> => {
    try {
      const supabase = createClient<Database>(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_PUBLISHABLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } },
      );

      const { data: product, error } = await supabase
        .from("marketplace_products")
        .select("id,title,price_cents,seller_id,status,description")
        .eq("id", data.productId)
        .eq("status", "approved")
        .maybeSingle();

      if (error || !product) return { error: "Product not available" };

      const stripe = createStripeClient(data.environment);

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: product.title,
                ...(product.description && {
                  description: product.description.slice(0, 500),
                }),
              },
              unit_amount: product.price_cents,
              tax_behavior: "exclusive",
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        payment_intent_data: { description: product.title },
        metadata: {
          product_id: product.id,
          seller_id: product.seller_id,
          environment: data.environment,
        },
        managed_payments: { enabled: true },
      } as any);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const getDownloadInfo = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => {
    if (!/^[a-f0-9]{32,128}$/.test(data.token)) throw new Error("Invalid token");
    return data;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: dl, error } = await supabaseAdmin
      .from("order_downloads")
      .select(
        "id,token,download_count,max_downloads,expires_at,order_item:order_items(product_title,product:marketplace_products(file_path))",
      )
      .eq("token", data.token)
      .maybeSingle();

    if (error || !dl) return { error: "Download link not found" } as const;
    const expired = new Date(dl.expires_at).getTime() < Date.now();
    if (expired) return { error: "This download link has expired" } as const;
    if (dl.download_count >= dl.max_downloads) {
      return { error: "Download limit reached for this link" } as const;
    }

    const orderItem = (dl as any).order_item;
    const filePath: string | undefined = orderItem?.product?.file_path;
    const title: string = orderItem?.product_title ?? "Your purchase";
    if (!filePath) return { error: "File is no longer available" } as const;

    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("product-files")
      .createSignedUrl(filePath, 60 * 10, { download: true });

    if (sErr || !signed?.signedUrl) return { error: "Failed to generate download" } as const;

    await supabaseAdmin
      .from("order_downloads")
      .update({ download_count: dl.download_count + 1 })
      .eq("id", dl.id);

    return {
      ok: true as const,
      url: signed.signedUrl,
      title,
      remaining: dl.max_downloads - dl.download_count - 1,
      expiresAt: dl.expires_at,
    };
  });
