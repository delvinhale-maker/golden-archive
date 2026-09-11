import { z } from "zod";

/**
 * Internal, provider-neutral video composition model. This is the ONLY
 * shape the scene planner (scene-planner.ts) ever produces and the render
 * adapter (providers/shotstack.server.ts) ever consumes -- neither the
 * client nor any user input ever supplies a composition directly. The
 * Shotstack-specific JSON timeline is built from this shape inside the
 * adapter and nowhere else, so swapping providers later never touches the
 * scene planner or the wizard.
 */

export const SCENE_TYPES = ["HOOK", "COVER_REVEAL", "FEATURE", "BENEFITS", "HERO", "CTA"] as const;
export type SceneType = (typeof SCENE_TYPES)[number];

export const TRANSITIONS = ["CUT", "FADE", "SLIDE"] as const;
export type Transition = (typeof TRANSITIONS)[number];

export const MOTION_PRESETS = [
  "STATIC",
  "KEN_BURNS_IN",
  "KEN_BURNS_OUT",
  "PAN_LEFT",
  "PAN_RIGHT",
] as const;
export type MotionPreset = (typeof MOTION_PRESETS)[number];

export const AUDIO_TRACKS = [
  "NONE",
  "AMBIENT_LUXURY",
  "AMBIENT_ENERGY",
  "AMBIENT_CINEMATIC",
] as const;
export type AudioTrack = (typeof AUDIO_TRACKS)[number];

const assetRefSchema = z.object({
  assetId: z.string().uuid(),
  role: z.enum(["COVER", "SCREENSHOT", "LOGO", "OUTPUT", "THUMBNAIL"]),
  storagePath: z.string().min(1).max(1000),
});

const textStyleSchema = z.object({
  weight: z.enum(["REGULAR", "BOLD"]),
  size: z.enum(["SM", "MD", "LG", "XL"]),
  align: z.enum(["LEFT", "CENTER", "RIGHT"]),
});

const safeZoneSchema = z.object({
  top: z.number().int().min(0),
  bottom: z.number().int().min(0),
  left: z.number().int().min(0),
  right: z.number().int().min(0),
});

export const sceneSchema = z.object({
  id: z.string().min(1).max(60),
  start: z.number().min(0),
  duration: z.number().positive(),
  type: z.enum(SCENE_TYPES),
  assetRef: assetRefSchema.nullable(),
  text: z.object({
    headline: z.string().max(120).optional(),
    body: z.string().max(200).optional(),
  }),
  transition: z.enum(TRANSITIONS),
  motionPreset: z.enum(MOTION_PRESETS),
  textStyle: textStyleSchema,
  safeZone: safeZoneSchema,
});
export type CompositionScene = z.infer<typeof sceneSchema>;

export const compositionSchema = z
  .object({
    version: z.string().min(1).max(20),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().int().positive().max(60),
    duration: z.number().positive(),
    scenes: z.array(sceneSchema).min(1).max(12),
    audio: z.object({ track: z.enum(AUDIO_TRACKS), volume: z.number().min(0).max(1) }).nullable(),
    branding: z.object({
      logoAssetId: z.string().uuid().nullable(),
      ctaText: z.string().min(1).max(60),
      priceText: z.string().max(40).nullable(),
      destinationUrl: z.string().url().max(2000).nullable(),
    }),
    metadata: z.object({
      projectId: z.string().uuid(),
      projectType: z.string(),
      stylePreset: z.string(),
      templateKey: z.string(),
      templateVersion: z.string(),
    }),
  })
  .superRefine(
    (
      composition: { duration: number; scenes: { id: string; start: number; duration: number }[] },
      ctx: z.RefinementCtx,
    ) => {
      // Scenes must tile the full duration contiguously, end to end, with no
      // gap and no overlap -- the render adapter assumes this invariant and
      // never has to reconcile timeline holes itself.
      let cursor = 0;
      for (const scene of composition.scenes) {
        if (Math.abs(scene.start - cursor) > 0.001) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Scene "${scene.id}" starts at ${scene.start} but the timeline cursor is at ${cursor}`,
            path: ["scenes"],
          });
          return;
        }
        cursor += scene.duration;
      }
      if (Math.abs(cursor - composition.duration) > 0.001) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Scenes total ${cursor}s but composition.duration is ${composition.duration}s`,
          path: ["duration"],
        });
      }
    },
  );
export type CreatorVideoComposition = z.infer<typeof compositionSchema>;

/**
 * The only entry point that accepts a composition-shaped value from outside
 * the scene planner (e.g. re-validating a stored composition before
 * resubmission). Never exposed to a route that accepts raw client JSON.
 */
export function validateComposition(candidate: unknown): CreatorVideoComposition {
  return compositionSchema.parse(candidate);
}
