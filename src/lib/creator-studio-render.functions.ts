import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCreatorStudioEnabled } from "@/lib/creator-studio-feature-flags.middleware";
import { requireCreatorStudioRenderingEnabled } from "@/lib/creator-studio-rendering.middleware";

const submitSchema = z.object({
  projectId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8).max(128),
});

export const submitCreatorStudioRender = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireCreatorStudioRenderingEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { submitCreatorStudioRenderJob } = await import("@/lib/creator-studio-render-service.server");
    return submitCreatorStudioRenderJob({ ownerUserId: context.userId, projectId: data.projectId, idempotencyKey: data.idempotencyKey });
  });

export const refreshCreatorStudioRender = createServerFn({ method: "POST" })
  .middleware([requireCreatorStudioEnabled, requireCreatorStudioRenderingEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { refreshCreatorStudioRenderJob } = await import("@/lib/creator-studio-render-service.server");
    return refreshCreatorStudioRenderJob({ ownerUserId: context.userId, jobId: data.jobId });
  });
