import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { RotationReport } from "./payout-key-rotation.server";

export type { RotationReport };

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("forbidden");
}

/** Read-only: which key is active and how many rows still use an older key. */
export const getPayoutKeyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RotationReport> => {
    await assertAdmin(context.userId);
    const { scanAndRotatePayoutKeys } = await import("./payout-key-rotation.server");
    return scanAndRotatePayoutKeys({ dryRun: true });
  });

/** Re-encrypts stale payout secrets with the active key. Idempotent. */
export const rotatePayoutEncryptionKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ dry_run: z.boolean().default(false) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<RotationReport> => {
    await assertAdmin(context.userId);
    const { scanAndRotatePayoutKeys } = await import("./payout-key-rotation.server");
    return scanAndRotatePayoutKeys({ dryRun: data.dry_run });
  });
