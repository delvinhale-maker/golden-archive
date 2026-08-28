import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Authenticated entry points for the Canva integration. Thin wrappers only —
 * all logic lives in canva-oauth.ts, which is dynamically imported inside
 * each handler so the server-only module never enters the client bundle.
 *
 * Tenancy: the user id comes from the verified bearer claims, never from input,
 * so one user can never act on another user's connection.
 */

export const startCanvaConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { beginCanvaAuthorization } = await import("./canva-oauth");
    return beginCanvaAuthorization(context.userId);
  });

export const getCanvaConnectionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { readCanvaStatus } = await import("./canva-oauth");
    return readCanvaStatus(context.userId);
  });

export const disconnectCanvaConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { disconnectCanva } = await import("./canva-oauth");
    await disconnectCanva(context.userId);
    return { ok: true as const };
  });
