import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Authenticated entry points for the TikTok Shop integration. Thin wrappers only —
 * all logic lives in tiktok-shop-oauth.ts, dynamically imported inside each
 * handler so the server-only module never enters the client bundle.
 *
 * Tenancy: the user id comes from the verified bearer claims, never from input.
 */

export const startTikTokShopConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { beginTikTokShopAuthorization } = await import("./tiktok-shop-oauth");
    return beginTikTokShopAuthorization(context.userId);
  });

export const getTikTokShopConnectionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { readTikTokShopStatus } = await import("./tiktok-shop-oauth");
    return readTikTokShopStatus(context.userId, context.supabase as never);
  });

export const disconnectTikTokShopConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { disconnectTikTokShop } = await import("./tiktok-shop-oauth");
    await disconnectTikTokShop(context.userId);
    return { ok: true as const };
  });
