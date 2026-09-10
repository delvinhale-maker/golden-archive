import { z } from "zod";
import { creatorStudioGoalSchema, creatorStudioStyleSchema } from "@/lib/creator-studio.schema";

export const creatorStudioSceneSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["HOOK", "PRODUCT_HERO", "SCREENSHOTS", "BENEFITS", "SOCIAL_PROOF", "CTA"]),
  startSeconds: z.number().nonnegative(),
  durationSeconds: z.number().positive(),
  headline: z.string().max(160).optional(),
  body: z.string().max(300).optional(),
  assetSlots: z.array(z.enum(["COVER", "SCREENSHOT", "LOGO"])).default([]),
  transition: z.enum(["CUT", "FADE", "SLIDE", "ZOOM"]).default("FADE"),
});

export const creatorStudioRenderPlanSchema = z.object({
  schemaVersion: z.literal(1),
  templateId: z.string().min(1),
  templateRevision: z.number().int().positive(),
  goal: creatorStudioGoalSchema,
  style: creatorStudioStyleSchema,
  output: z.object({
    format: z.literal("mp4"),
    aspectRatio: z.literal("9:16"),
    width: z.literal(1080),
    height: z.literal(1920),
    durationSeconds: z.union([z.literal(15), z.literal(30), z.literal(45)]),
  }),
  scenes: z.array(creatorStudioSceneSchema).min(3).max(8),
  generatedAt: z.string().datetime(),
});

export type CreatorStudioScene = z.infer<typeof creatorStudioSceneSchema>;
export type CreatorStudioRenderPlan = z.infer<typeof creatorStudioRenderPlanSchema>;
