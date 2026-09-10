import { z } from "zod";
import {
  creatorStudioDurationSchema,
  creatorStudioProjectTypeSchema,
  creatorStudioStyleSchema,
} from "@/lib/creator-studio.schema";

export const CREATOR_STUDIO_RENDER_PLAN_VERSION = "1.0" as const;
export const CREATOR_STUDIO_OUTPUT_WIDTH = 1080 as const;
export const CREATOR_STUDIO_OUTPUT_HEIGHT = 1920 as const;
export const CREATOR_STUDIO_OUTPUT_FPS = 30 as const;

export const creatorStudioTemplateFamilySchema = z.enum([
  "EBOOK",
  "COURSE",
  "PLANNER",
  "TIKTOK_PRODUCT_AD",
  "INSTAGRAM_REEL",
  "PRODUCT_TRAILER",
  "BOOK_TRAILER",
]);

export const creatorStudioScenePurposeSchema = z.enum([
  "HOOK",
  "COVER_REVEAL",
  "PRODUCT_PROOF",
  "BENEFIT",
  "HERO",
  "CTA",
]);

export const creatorStudioPositionSchema = z.enum([
  "TOP",
  "UPPER_CENTER",
  "CENTER",
  "LOWER_CENTER",
  "BOTTOM",
]);

export const creatorStudioTransitionSchema = z
  .object({
    kind: z.enum(["NONE", "FADE", "SLIDE", "ZOOM"]),
    duration_ms: z.number().int().min(0).max(1500),
  })
  .strict();

const layerBaseSchema = z.object({
  id: z.string().min(1).max(100),
  start_ms: z.number().int().min(0),
  duration_ms: z.number().int().positive(),
  z_index: z.number().int().min(0).max(100),
});

export const creatorStudioTextLayerSchema = layerBaseSchema
  .extend({
    type: z.literal("TEXT"),
    text: z.string().min(1).max(500),
    role: z.enum(["HOOK", "TITLE", "SUPPORTING", "PRICE", "CTA", "WATERMARK"]),
    position: creatorStudioPositionSchema,
    align: z.enum(["LEFT", "CENTER", "RIGHT"]),
    style_token: z.enum([
      "DISPLAY_PRIMARY",
      "DISPLAY_SECONDARY",
      "BODY_PRIMARY",
      "PRICE_PRIMARY",
      "CTA_PRIMARY",
      "WATERMARK_SUBTLE",
    ]),
  })
  .strict();

const logicalMediaRefSchema = z
  .string()
  .max(100)
  .refine(
    (value) =>
      /^asset:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ) ||
      value === "source:cover" ||
      /^source:preview:[0-7]$/.test(value),
    "Render plans may reference only normalized Creator Studio media IDs.",
  );

export const creatorStudioImageLayerSchema = layerBaseSchema
  .extend({
    type: z.literal("IMAGE"),
    media_ref: logicalMediaRefSchema,
    fit: z.enum(["COVER", "CONTAIN"]),
    position: creatorStudioPositionSchema,
    motion: z.enum(["NONE", "PUSH_IN", "PULL_OUT", "PAN_UP", "PAN_DOWN"]),
    corner_radius: z.number().int().min(0).max(120).default(0),
  })
  .strict();

export const creatorStudioVideoLayerSchema = layerBaseSchema
  .extend({
    type: z.literal("VIDEO"),
    media_ref: logicalMediaRefSchema,
    fit: z.enum(["COVER", "CONTAIN"]),
    position: creatorStudioPositionSchema,
    muted: z.boolean().default(true),
    trim_start_ms: z.number().int().min(0).default(0),
  })
  .strict();

export const creatorStudioAudioLayerSchema = layerBaseSchema
  .extend({
    type: z.literal("AUDIO"),
    media_ref: logicalMediaRefSchema,
    volume: z.number().min(0).max(1),
    trim_start_ms: z.number().int().min(0).default(0),
  })
  .strict();

export const creatorStudioLayerSchema = z.discriminatedUnion("type", [
  creatorStudioTextLayerSchema,
  creatorStudioImageLayerSchema,
  creatorStudioVideoLayerSchema,
  creatorStudioAudioLayerSchema,
]);

export const creatorStudioSceneSchema = z
  .object({
    id: z.string().min(1).max(100),
    purpose: creatorStudioScenePurposeSchema,
    start_ms: z.number().int().min(0),
    duration_ms: z.number().int().positive(),
    background_token: z.enum([
      "INK",
      "NAVY",
      "IVORY",
      "WHITE",
      "GOLD_WASH",
      "MEDIA",
    ]),
    transition_in: creatorStudioTransitionSchema,
    layers: z.array(creatorStudioLayerSchema).min(1).max(20),
  })
  .strict()
  .superRefine((scene, ctx) => {
    for (const layer of scene.layers) {
      if (layer.start_ms + layer.duration_ms > scene.duration_ms) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["layers"],
          message: `Layer ${layer.id} exceeds its scene boundary.`,
        });
      }
    }
  });

export const creatorStudioMergeFieldSchema = z
  .object({
    key: z.enum(["PRODUCT_TITLE", "HOOK", "CTA", "PRICE", "DESTINATION_URL"]),
    value: z.string().max(2048),
  })
  .strict();

export const creatorStudioOutputSpecSchema = z
  .object({
    format: z.literal("MP4"),
    width: z.literal(CREATOR_STUDIO_OUTPUT_WIDTH),
    height: z.literal(CREATOR_STUDIO_OUTPUT_HEIGHT),
    fps: z.literal(CREATOR_STUDIO_OUTPUT_FPS),
    aspect_ratio: z.literal("9:16"),
    duration_ms: z.union([z.literal(15_000), z.literal(30_000), z.literal(45_000)]),
    quality: z.enum(["PREVIEW", "STANDARD"]),
  })
  .strict();

export const creatorStudioRenderPlanSchema = z
  .object({
    schema_version: z.literal(CREATOR_STUDIO_RENDER_PLAN_VERSION),
    project_id: z.string().uuid(),
    project_type: creatorStudioProjectTypeSchema,
    style_key: creatorStudioStyleSchema,
    template: z
      .object({
        family: creatorStudioTemplateFamilySchema,
        version: z.string().regex(/^\d+\.\d+\.\d+$/),
      })
      .strict(),
    output: creatorStudioOutputSpecSchema,
    merge_fields: z.array(creatorStudioMergeFieldSchema).max(5),
    scenes: z.array(creatorStudioSceneSchema).min(1).max(12),
  })
  .strict()
  .superRefine((plan, ctx) => {
    let expectedStart = 0;
    for (const [index, scene] of plan.scenes.entries()) {
      if (scene.start_ms !== expectedStart) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scenes", index, "start_ms"],
          message: "Scenes must be contiguous and ordered.",
        });
      }
      expectedStart += scene.duration_ms;
    }
    if (expectedStart !== plan.output.duration_ms) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scenes"],
        message: "Scene durations must exactly fill the requested output duration.",
      });
    }
  });

export const creatorStudioPlannerProjectSchema = z
  .object({
    id: z.string().uuid(),
    project_type: creatorStudioProjectTypeSchema,
    status: z.literal("READY"),
    duration_seconds: creatorStudioDurationSchema,
    aspect_ratio: z.literal("9:16"),
    style_key: creatorStudioStyleSchema,
    product_title: z.string().trim().min(1).max(180),
    hook: z.string().trim().min(1).max(240),
    cta: z.string().trim().min(1).max(120),
    destination_url: z.string().max(2048).nullable(),
    price_cents: z.number().int().min(0).nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/),
  })
  .strict();

export const creatorStudioPlannerAssetSchema = z
  .object({
    id: z.string().uuid(),
    category: z.enum(["PRODUCT_COVER", "SCREENSHOT", "LOGO", "ADDITIONAL_MEDIA"]),
    state: z.literal("READY"),
    mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4"]),
    sort_order: z.number().int().min(0).max(100),
  })
  .strict();

export const creatorStudioPlannerInputSchema = z
  .object({
    project: creatorStudioPlannerProjectSchema,
    assets: z.array(creatorStudioPlannerAssetSchema).max(14),
    source_product_media: z
      .object({
        has_cover: z.boolean(),
        preview_count: z.number().int().min(0).max(8),
      })
      .strict()
      .default({ has_cover: false, preview_count: 0 }),
    quality: z.enum(["PREVIEW", "STANDARD"]).default("STANDARD"),
  })
  .strict();

export type CreatorStudioTemplateFamily = z.infer<typeof creatorStudioTemplateFamilySchema>;
export type CreatorStudioRenderPlan = z.infer<typeof creatorStudioRenderPlanSchema>;
export type CreatorStudioRenderScene = z.infer<typeof creatorStudioSceneSchema>;
export type CreatorStudioRenderLayer = z.infer<typeof creatorStudioLayerSchema>;
export type CreatorStudioPlannerInput = z.input<typeof creatorStudioPlannerInputSchema>;
