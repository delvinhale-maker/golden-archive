import { creatorStudioRenderPlanSchema, type CreatorStudioRenderPlan } from "@/lib/creator-studio-render.schema";
import { findCreatorStudioTemplate } from "@/lib/creator-studio-templates";
import type { CreatorStudioGoal, CreatorStudioStyle } from "@/lib/creator-studio.schema";

export type ScenePlannerInput = {
  goal: CreatorStudioGoal;
  style: CreatorStudioStyle;
  durationSeconds: 15 | 30 | 45;
  productTitle?: string | null;
  callToAction?: string | null;
};

export function planCreatorStudioScenes(input: ScenePlannerInput): CreatorStudioRenderPlan {
  const template = findCreatorStudioTemplate(input.goal, input.style);
  const weights = input.durationSeconds === 15 ? [3, 3, 3, 3, 3] : input.durationSeconds === 30 ? [4, 6, 7, 7, 6] : [5, 9, 11, 11, 9];
  let cursor = 0;
  const scenes = template.sceneKinds.map((kind, index) => {
    const durationSeconds = weights[index] ?? 3;
    const scene = {
      id: `${kind.toLowerCase()}-${index + 1}`,
      kind,
      startSeconds: cursor,
      durationSeconds,
      headline: kind === "HOOK" ? input.productTitle || "Make your next move stand out" : kind === "CTA" ? input.callToAction || "Learn more" : undefined,
      assetSlots: kind === "PRODUCT_HERO" ? ["COVER" as const] : kind === "SCREENSHOTS" ? ["SCREENSHOT" as const] : kind === "CTA" ? ["LOGO" as const] : [],
      transition: input.style === "BOLD_SOCIAL" ? ("SLIDE" as const) : input.style === "CINEMATIC" ? ("FADE" as const) : ("ZOOM" as const),
    };
    cursor += durationSeconds;
    return scene;
  });

  return creatorStudioRenderPlanSchema.parse({
    schemaVersion: 1,
    templateId: template.id,
    templateRevision: template.revision,
    goal: input.goal,
    style: template.style,
    output: { format: "mp4", aspectRatio: "9:16", width: 1080, height: 1920, durationSeconds: input.durationSeconds },
    scenes,
    generatedAt: new Date().toISOString(),
  });
}
