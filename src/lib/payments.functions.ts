import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
  detectTaxMode,
  applyTaxMode,
  assertTaxModeInvariant,
  extractStripeIds,
  summarizeSessionShape,
} from "@/lib/stripe.server";

type CheckoutResult = { clientSecret: string } | { error: string };

export const createProductCheckout = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { productId: string; returnUrl: string; environment: StripeEnv; referralCode?: string }) => {
      if (!/^[a-f0-9-]{36}$/.test(data.productId)) throw new Error("Invalid productId");
      if (data.environment !== "sandbox" && data.environment !== "live") {
        throw new Error("Invalid environment");
      }
      if (data.referralCode && !/^[A-Z0-9]{6,16}$/.test(data.referralCode.toUpperCase())) {
        delete data.referralCode;
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
      const taxMode = await detectTaxMode(stripe, data.environment);

      const sessionParams = applyTaxMode(
        {
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: product.title,
                  tax_code: "txcd_10000000",
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
            tax_mode: taxMode,
            ...(data.referralCode ? { referral_code: data.referralCode.toUpperCase() } : {}),
          },
        },
        taxMode,
      );

      assertTaxModeInvariant(sessionParams, taxMode);
      let session;
      try {
        session = await stripe.checkout.sessions.create(sessionParams as any);
      } catch (err) {
        console.error("[stripe] createProductCheckout: sessions.create failed", {
          stripe: extractStripeIds(err),
          session_shape: summarizeSessionShape(sessionParams),
          tax_mode: taxMode,
        });
        throw err;
      }

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      console.error("[stripe] createProductCheckout failed", {
        stripe: extractStripeIds(error),
        message: (error as Error)?.message,
      });
      return { error: getStripeErrorMessage(error) };
    }
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROMOS: Record<string, { kind: "pct" | "flat"; value: number }> = {
  AURUM10: { kind: "pct", value: 10 },
  VAULT20: { kind: "pct", value: 20 },
  FIRST5: { kind: "flat", value: 5 },
};

export const createCartCheckout = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      items: { id: string; title: string; priceCents: number; qty: number }[];
      promoCode?: string;
      referralCode?: string;
      returnUrl: string;
      environment: StripeEnv;
    }) => {
      if (!Array.isArray(data.items) || data.items.length === 0) {
        throw new Error("Cart is empty");
      }
      if (data.items.length > 50) throw new Error("Too many items");
      for (const it of data.items) {
        if (!it.id || typeof it.title !== "string") throw new Error("Invalid item");
        if (!Number.isFinite(it.priceCents) || it.priceCents < 50) {
          throw new Error("Invalid price");
        }
        if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > 99) {
          throw new Error("Invalid qty");
        }
      }
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

      // For DB-backed items, re-fetch authoritative price/title.
      const dbIds = data.items.filter((i) => UUID_RE.test(i.id)).map((i) => i.id);
      let dbMap: Record<string, { title: string; price_cents: number; seller_id: string }> = {};
      if (dbIds.length) {
        const { data: rows } = await supabase
          .from("marketplace_products")
          .select("id,title,price_cents,seller_id,status")
          .in("id", dbIds)
          .eq("status", "approved");
        for (const r of rows ?? []) {
          dbMap[r.id] = { title: r.title, price_cents: r.price_cents, seller_id: r.seller_id };
        }
      }

      // Compute promo discount as % off each unit_amount, evenly.
      const promo = data.promoCode ? PROMOS[data.promoCode.toUpperCase()] : null;
      const subtotal = data.items.reduce((n, it) => {
        const cents = dbMap[it.id]?.price_cents ?? it.priceCents;
        return n + cents * it.qty;
      }, 0);
      const discountTotal =
        promo?.kind === "pct"
          ? Math.floor(subtotal * (promo.value / 100))
          : promo
            ? Math.min(promo.value * 100, subtotal)
            : 0;
      const factor = subtotal > 0 ? (subtotal - discountTotal) / subtotal : 1;

      const stripe = createStripeClient(data.environment);

      const line_items = data.items.map((it) => {
        const authoritative = dbMap[it.id];
        const baseCents = authoritative?.price_cents ?? it.priceCents;
        const adjusted = Math.max(50, Math.round(baseCents * factor));
        return {
          price_data: {
            currency: "usd",
            product_data: {
              name: authoritative?.title ?? it.title,
              tax_code: "txcd_10000000",
            },
            unit_amount: adjusted,
            tax_behavior: "exclusive",
          },
          quantity: it.qty,
        };
      });

      const sellerIds = Array.from(
        new Set(Object.values(dbMap).map((d) => d.seller_id).filter(Boolean)),
      );

      const taxMode = await detectTaxMode(stripe, data.environment);
      const sessionParams = applyTaxMode(
        {
          line_items,
          mode: "payment",
          ui_mode: "embedded_page",
          return_url: data.returnUrl,
          payment_intent_data: {
            description: `AurumVault order · ${data.items.length} item${data.items.length > 1 ? "s" : ""}`,
          },
          metadata: {
            cart: "true",
            environment: data.environment,
            item_count: String(data.items.length),
            promo_code: data.promoCode ?? "",
            product_ids: dbIds.join(",").slice(0, 500),
            seller_ids: sellerIds.join(",").slice(0, 500),
            tax_mode: taxMode,
            ...(data.referralCode ? { referral_code: data.referralCode.toUpperCase() } : {}),
          },
        },
        taxMode,
      );
      assertTaxModeInvariant(sessionParams, taxMode);
      let session;
      try {
        session = await stripe.checkout.sessions.create(sessionParams as any);
      } catch (err) {
        console.error("[stripe] createCartCheckout: sessions.create failed", {
          stripe: extractStripeIds(err),
          session_shape: summarizeSessionShape(sessionParams),
          tax_mode: taxMode,
        });
        throw err;
      }

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      console.error("[stripe] createCartCheckout failed", {
        stripe: extractStripeIds(error),
        message: (error as Error)?.message,
      });
      return { error: getStripeErrorMessage(error) };
    }
  });

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// In-memory throttle: per (userId, token) cache the most recent mint until
// remaining uses changes or TTL expires. Prevents excessive signed-URL minting
// from repeated tab refreshes / retries.
type CachedMint = {
  url: string;
  title: string;
  remaining: number;
  expiresAt: string;
  mintedAt: number;
};
const MINT_TTL_MS = 30_000;
const mintCache = new Map<string, CachedMint>();

export const getDownloadInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { token: string }) => {
    if (!/^[a-f0-9]{32,128}$/.test(data.token)) throw new Error("Invalid token");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const buyerEmail = (context.claims as { email?: string })?.email?.toLowerCase();
    if (!buyerEmail) return { error: "Sign in to access your download" } as const;

    const cacheKey = `${context.userId}:${data.token}`;
    const cached = mintCache.get(cacheKey);
    if (cached && Date.now() - cached.mintedAt < MINT_TTL_MS) {
      return {
        ok: true as const,
        url: cached.url,
        title: cached.title,
        remaining: cached.remaining,
        expiresAt: cached.expiresAt,
        throttled: true as const,
      };
    }

    const { data: dl, error } = await supabaseAdmin
      .from("order_downloads")
      .select(
        "id,token,download_count,max_downloads,expires_at,order_item:order_items(product_title,product:marketplace_products(file_path),order:orders(buyer_email))",
      )
      .eq("token", data.token)
      .maybeSingle();

    if (error || !dl) return { error: "Download link not found" } as const;

    const orderBuyerEmail: string | undefined = (dl as any).order_item?.order?.buyer_email;
    if (!orderBuyerEmail || orderBuyerEmail.toLowerCase() !== buyerEmail) {
      return { error: "This download link belongs to a different account" } as const;
    }
    const expired = new Date(dl.expires_at).getTime() < Date.now();
    if (expired) return { error: "This download link has expired" } as const;
    if (dl.download_count >= dl.max_downloads) {
      mintCache.delete(cacheKey);
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

    const result = {
      ok: true as const,
      url: signed.signedUrl,
      title,
      remaining: dl.max_downloads - dl.download_count - 1,
      expiresAt: dl.expires_at,
    };
    mintCache.set(cacheKey, { ...result, mintedAt: Date.now() });
    // Opportunistic GC
    if (mintCache.size > 500) {
      const now = Date.now();
      for (const [k, v] of mintCache) {
        if (now - v.mintedAt > MINT_TTL_MS) mintCache.delete(k);
      }
    }
    return result;
  });

