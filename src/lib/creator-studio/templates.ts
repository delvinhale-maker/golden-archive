import type { ProjectType, StylePreset, AspectRatio } from "./schema";
import type { SceneType, Transition, MotionPreset, AudioTrack } from "./composition.schema";

/** Output resolution lookup for the one supported V1 aspect ratio. Lives here (not schema.ts) so scene-planner.ts can import it as a value without pulling in zod. */
export const RESOLUTION_BY_ASPECT_RATIO: Record<AspectRatio, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
};

/**
 * Versioned, reusable scene-structure blueprints. Deliberately few: three
 * blueprints cover all seven project types (per the CS2 instruction "do not
 * multiply templates unnecessarily"). Visual treatment (motion, transition,
 * type weight, audio) is a SEPARATE, orthogonal concern -- see STYLE_CONFIG
 * below -- so a style change never requires a new blueprint.
 */
export const TEMPLATE_VERSION = "v1";

export type SceneBlueprintEntry = {
  type: SceneType;
  assetRole: "COVER" | "SCREENSHOT" | "LOGO" | null;
  textSource: "HEADLINE" | "CTA" | "PRICE" | null;
  fractionOfDuration: number;
  /** If set, this entry expands into one scene per available screenshot (up to `maxRepeats`), splitting its fraction evenly across them. */
  repeatForEachScreenshot?: boolean;
  maxRepeats?: number;
};

export type TemplateBlueprint = {
  key: string;
  scenes: SceneBlueprintEntry[];
};

const STANDARD_PROMO: TemplateBlueprint = {
  key: "standard_promo",
  scenes: [
    { type: "HOOK", assetRole: "COVER", textSource: "HEADLINE", fractionOfDuration: 0.1 },
    { type: "COVER_REVEAL", assetRole: "COVER", textSource: null, fractionOfDuration: 0.1667 },
    {
      type: "FEATURE",
      assetRole: "SCREENSHOT",
      textSource: null,
      fractionOfDuration: 0.2667,
      repeatForEachScreenshot: true,
      maxRepeats: 3,
    },
    { type: "BENEFITS", assetRole: null, textSource: "HEADLINE", fractionOfDuration: 0.2333 },
    { type: "HERO", assetRole: "COVER", textSource: "PRICE", fractionOfDuration: 0.1333 },
    { type: "CTA", assetRole: "LOGO", textSource: "CTA", fractionOfDuration: 0.1 },
  ],
};

const SOCIAL_AD: TemplateBlueprint = {
  key: "social_ad",
  scenes: [
    { type: "HOOK", assetRole: "COVER", textSource: "HEADLINE", fractionOfDuration: 0.15 },
    {
      type: "FEATURE",
      assetRole: "SCREENSHOT",
      textSource: null,
      fractionOfDuration: 0.55,
      repeatForEachScreenshot: true,
      maxRepeats: 4,
    },
    { type: "CTA", assetRole: "LOGO", textSource: "CTA", fractionOfDuration: 0.3 },
  ],
};

const BOOK_TRAILER_BLUEPRINT: TemplateBlueprint = {
  key: "book_trailer",
  scenes: [
    { type: "HOOK", assetRole: "COVER", textSource: "HEADLINE", fractionOfDuration: 0.15 },
    { type: "COVER_REVEAL", assetRole: "COVER", textSource: null, fractionOfDuration: 0.25 },
    {
      type: "BENEFITS",
      assetRole: "SCREENSHOT",
      textSource: null,
      fractionOfDuration: 0.35,
      repeatForEachScreenshot: true,
      maxRepeats: 2,
    },
    { type: "HERO", assetRole: "COVER", textSource: "PRICE", fractionOfDuration: 0.15 },
    { type: "CTA", assetRole: "LOGO", textSource: "CTA", fractionOfDuration: 0.1 },
  ],
};

const BLUEPRINT_BY_PROJECT_TYPE: Record<ProjectType, TemplateBlueprint> = {
  EBOOK_PROMO: STANDARD_PROMO,
  COURSE_PROMO: STANDARD_PROMO,
  PLANNER_PROMO: STANDARD_PROMO,
  PRODUCT_TRAILER: STANDARD_PROMO,
  TIKTOK_AD: SOCIAL_AD,
  INSTAGRAM_REEL: SOCIAL_AD,
  BOOK_TRAILER: BOOK_TRAILER_BLUEPRINT,
};

export function getTemplateBlueprint(projectType: ProjectType): TemplateBlueprint {
  return BLUEPRINT_BY_PROJECT_TYPE[projectType];
}

// ---------------------------------------------------------------------------
// Style presets as data -- never scattered conditionals in UI or planner code.
// ---------------------------------------------------------------------------
export type StyleConfig = {
  motionPreset: MotionPreset;
  transition: Transition;
  textWeight: "REGULAR" | "BOLD";
  textSize: "SM" | "MD" | "LG" | "XL";
  audioTrack: AudioTrack;
};

export const STYLE_CONFIG: Record<StylePreset, StyleConfig> = {
  LUXURY_EDITORIAL: {
    motionPreset: "KEN_BURNS_IN",
    transition: "FADE",
    textWeight: "REGULAR",
    textSize: "MD",
    audioTrack: "AMBIENT_LUXURY",
  },
  BOLD_SOCIAL: {
    motionPreset: "PAN_LEFT",
    transition: "CUT",
    textWeight: "BOLD",
    textSize: "LG",
    audioTrack: "AMBIENT_ENERGY",
  },
  CINEMATIC: {
    motionPreset: "KEN_BURNS_OUT",
    transition: "FADE",
    textWeight: "REGULAR",
    textSize: "MD",
    audioTrack: "AMBIENT_CINEMATIC",
  },
  CLEAN_MINIMAL: {
    motionPreset: "STATIC",
    transition: "CUT",
    textWeight: "REGULAR",
    textSize: "SM",
    audioTrack: "NONE",
  },
  CREATOR_ENERGY: {
    motionPreset: "PAN_RIGHT",
    transition: "CUT",
    textWeight: "BOLD",
    textSize: "LG",
    audioTrack: "AMBIENT_ENERGY",
  },
  BOOK_TRAILER: {
    motionPreset: "KEN_BURNS_IN",
    transition: "FADE",
    textWeight: "BOLD",
    textSize: "XL",
    audioTrack: "AMBIENT_CINEMATIC",
  },
};

/** Fixed safe-zone insets (px) for the one supported V1 resolution, 1080x1920 -- keeps captions/logos clear of platform UI chrome on TikTok/Reels. */
export const SAFE_ZONE_9_16 = { top: 220, bottom: 340, left: 64, right: 64 };

/** Per-scene-type max caption length before the planner truncates, matched to how much text each scene actually has room for at its safe zone width. */
export const MAX_TEXT_CHARS: Record<SceneType, number> = {
  HOOK: 60,
  COVER_REVEAL: 0,
  FEATURE: 0,
  BENEFITS: 90,
  HERO: 40,
  CTA: 60,
};
