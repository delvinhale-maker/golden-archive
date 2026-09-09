import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCreatorStudioRenderingEnabled } from "@/lib/creator-studio-feature-flags.middleware";
import { refreshCreatorStudioRender, submitCreatorStudioRender } from "./creator-studio-rendering.server";

export const startCreatorStudioRender = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioRenderingEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      projectId: z.string().uuid(),
      idempotencyKey: z.string().trim().min(8).max(128),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    return submitCreatorStudioRender({
      ownerUserId: context.userId,
      projectId: data.projectId,
      idempotencyKey: data.idempotencyKey,
    });
  });

export const refreshCreatorStudioRenderStatus = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioRenderingEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    return refreshCreatorStudioRender({ ownerUserId: context.userId, jobId: data.jobId });
  });
