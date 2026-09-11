import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCreatorStudioEnabled } from "@/lib/creator-studio-feature-flags.middleware";
import {
  createCreatorStudioExtraRenderCheckout,
  createCreatorStudioPlanCheckout,
} from "./creator-studio-billing.server";

export const startCreatorStudioPlanCheckout = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ plan: z.enum(["CREATOR_PRO", "CREATOR_BUSINESS"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    return createCreatorStudioPlanCheckout(context.userId, data.plan);
  });

export const startCreatorStudioExtraRenderCheckout = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ quantity: z.number().int().min(1).max(50).default(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    return createCreatorStudioExtraRenderCheckout(context.userId, data.quantity);
  });
