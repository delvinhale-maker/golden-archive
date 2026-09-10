import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCreatorStudioEnabled } from "@/lib/creator-studio-feature-flags.middleware";

export const getCreatorStudioAllowance = createServerFn({ method: "GET" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getCreatorStudioEntitlement } = await import("@/lib/creator-studio-entitlements.server");
    return getCreatorStudioEntitlement(context.userId);
  });
