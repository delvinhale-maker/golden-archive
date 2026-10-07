import { z } from "zod";

export const CreatorStudioGoalSchema = z.enum([
  "PROMOTE_EBOOK",
  "PROMOTE_COURSE",
  "PROMOTE_PLANNER",
  "TIKTOK_AD",
  "INSTAGRAM_REEL",
  "PRODUCT_TRAILER",
  "BOOK_TRAILER",
]);

export const CreatorStudioStyleSchema = z.enum([
  "LUXURY_EDITORIAL",
  "BOLD_SOCIAL",
  "CINEMATIC",
  "CLEAN_MINIMAL",
  "CREATOR_ENERGY",
  "BOOK_TRAILER",
]);

export const CreatorStudioDurationSchema = z.union([
  z.literal(15),
  z.literal(30),
  z.literal(45),
]);

export const CreatorStudioAssetSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["COVER", "SCREENSHOT", "LOGO", "OTHER"]),
  signedUrl: z.string().url(),
  mimeType: z.string().min(1),
});

export const CreatorStudioBriefSchema = z.object({
  goal: CreatorStudioGoalSchema,
  style: CreatorStudioStyleSchema,
  durationSeconds: CreatorStudioDurationSchema,
  productTitle: z.string().trim().min(1).max(160),
  callToAction: z.string().trim().min(1).max(120),
  destinationUrl: z.string().url().optional(),
  priceLabel: z.string().trim().max(40).optional(),
  assets: z.array(CreatorStudioAssetSchema).min(1).max(8),
});

export const CreatorStudioSceneSchema = z.object({
  key: z.string().min(1),
  startSeconds: z.number().nonnegative(),
  durationSeconds: z.number().positive(),
  role: z.enum(["HOOK", "COVER", "FEATURE", "SOCIAL_PROOF", "BENEFIT", "CTA"]),
  headline: z.string().max(180).optional(),
  assetId: z.string().uuid().optional(),
});

export const CreatorStudioRenderPlanSchema = z.object({
  schemaVersion: z.literal(1),
  templateKey: z.string().min(1),
  templateRevision: z.number().int().positive(),
  durationSeconds: CreatorStudioDurationSchema,
  aspectRatio: z.literal("9:16"),
  scenes: z.array(CreatorStudioSceneSchema).min(2).max(12),
});

export type CreatorStudioBrief = z.infer<typeof CreatorStudioBriefSchema>;
export type CreatorStudioRenderPlan = z.infer<typeof CreatorStudioRenderPlanSchema>;
