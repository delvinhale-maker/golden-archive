import { z } from "zod";

// ---------------------------------------------------------------------------
// Enumerations -- kept in exact sync with the CHECK constraints in
// docs/proposed-migrations/20260910130000_create_creator_studio_master_schema.sql.
// ---------------------------------------------------------------------------

export const PROJECT_TYPES = [
  "EBOOK_PROMO",
  "COURSE_PROMO",
  "PLANNER_PROMO",
  "TIKTOK_AD",
  "INSTAGRAM_REEL",
  "PRODUCT_TRAILER",
  "BOOK_TRAILER",
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_TYPE_LABELS: Record<ProjectType, { label: string; blurb: string }> = {
  EBOOK_PROMO: {
    label: "Promote My eBook",
    blurb: "Turn your eBook cover into a scroll-stopping promo.",
  },
  COURSE_PROMO: {
    label: "Promote My Course",
    blurb: "Showcase your course and drive enrollments.",
  },
  PLANNER_PROMO: {
    label: "Promote My Planner",
    blurb: "Show off your planner's pages and layout.",
  },
  TIKTOK_AD: {
    label: "Create TikTok Ad",
    blurb: "A fast, native-feeling ad built for the TikTok feed.",
  },
  INSTAGRAM_REEL: { label: "Create Instagram Reel", blurb: "A polished Reel sized for Instagram." },
  PRODUCT_TRAILER: {
    label: "Create Product Trailer",
    blurb: "A cinematic trailer for any digital product.",
  },
  BOOK_TRAILER: {
    label: "Create Book Trailer",
    blurb: "A dramatic trailer built for a book launch.",
  },
};

export const STYLE_PRESETS = [
  "LUXURY_EDITORIAL",
  "BOLD_SOCIAL",
  "CINEMATIC",
  "CLEAN_MINIMAL",
  "CREATOR_ENERGY",
  "BOOK_TRAILER",
] as const;
export type StylePreset = (typeof STYLE_PRESETS)[number];

export const STYLE_PRESET_LABELS: Record<StylePreset, { label: string; blurb: string }> = {
  LUXURY_EDITORIAL: {
    label: "Luxury Editorial",
    blurb: "Elegant serif type, restrained motion, gold accents.",
  },
  BOLD_SOCIAL: {
    label: "Bold Social",
    blurb: "High-contrast, punchy captions built for the feed.",
  },
  CINEMATIC: { label: "Cinematic", blurb: "Widescreen bars, slow push-ins, dramatic pacing." },
  CLEAN_MINIMAL: { label: "Clean Minimal", blurb: "Whitespace, quiet motion, one idea at a time." },
  CREATOR_ENERGY: {
    label: "Creator Energy",
    blurb: "Fast cuts, upbeat pacing, vlog-style energy.",
  },
  BOOK_TRAILER: { label: "Book Trailer", blurb: "Moody type reveals built for a launch trailer." },
};

export const DURATIONS = [15, 30, 45] as const;
export type Duration = (typeof DURATIONS)[number];

export const ASPECT_RATIOS = ["9:16"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const PROJECT_STATUSES = [
  "DRAFT",
  "READY",
  "GENERATING",
  "COMPLETE",
  "FAILED",
  "ARCHIVED",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const ASSET_TYPES = [
  "COVER",
  "SCREENSHOT",
  "LOGO",
  "OTHER_IMAGE",
  "VIDEO_OUTPUT",
  "THUMBNAIL",
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_SOURCE_TYPES = ["UPLOADED", "FROM_PRODUCT", "PROVIDER_OUTPUT"] as const;
export type AssetSourceType = (typeof ASSET_SOURCE_TYPES)[number];

export const PROJECT_ASSET_ROLES = ["COVER", "SCREENSHOT", "LOGO", "OUTPUT", "THUMBNAIL"] as const;
export type ProjectAssetRole = (typeof PROJECT_ASSET_ROLES)[number];

// ---------------------------------------------------------------------------
// Zod input schemas for server functions (trust-boundary validation).
// ---------------------------------------------------------------------------

export const createProjectInput = z.object({
  sourceProductId: z.string().uuid().optional(),
  projectType: z.enum(PROJECT_TYPES),
  title: z.string().trim().min(1).max(200),
});
export type CreateProjectInput = z.infer<typeof createProjectInput>;

export const updateProjectInput = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  ctaText: z.string().trim().min(1).max(60).optional(),
  priceText: z.string().trim().max(40).nullable().optional(),
  destinationUrl: z.string().trim().url().max(2000).nullable().optional(),
  stylePreset: z.enum(STYLE_PRESETS).optional(),
  durationSeconds: z.union([z.literal(15), z.literal(30), z.literal(45)]).optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectInput>;

export const projectIdInput = z.object({ projectId: z.string().uuid() });

export const registerAssetInput = z.object({
  assetType: z.enum(["COVER", "SCREENSHOT", "LOGO", "OTHER_IMAGE"]),
  storagePath: z.string().min(1).max(1000),
  mediaType: z.string().min(1).max(100),
  sizeBytes: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  checksum: z.string().optional(),
});
export type RegisterAssetInput = z.infer<typeof registerAssetInput>;

export const attachAssetInput = z.object({
  projectId: z.string().uuid(),
  assetId: z.string().uuid(),
  role: z.enum(PROJECT_ASSET_ROLES),
  sortOrder: z.number().int().min(0).max(50).default(0),
});
export type AttachAssetInput = z.infer<typeof attachAssetInput>;

export const detachAssetInput = z.object({
  projectAssetId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Domain types mapped from DB rows.
// ---------------------------------------------------------------------------

export type CreatorStudioProject = {
  id: string;
  ownerUserId: string;
  sourceProductId: string | null;
  projectType: ProjectType;
  title: string;
  ctaText: string;
  priceText: string | null;
  destinationUrl: string | null;
  stylePreset: StylePreset | null;
  durationSeconds: Duration | null;
  aspectRatio: AspectRatio;
  status: ProjectStatus;
  currentTemplateVersion: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatorStudioAsset = {
  id: string;
  ownerUserId: string;
  assetType: AssetType;
  sourceType: AssetSourceType;
  storageBucket: string;
  storagePath: string;
  mediaType: string;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
};

export type CreatorStudioProjectAsset = {
  id: string;
  projectId: string;
  assetId: string;
  role: ProjectAssetRole;
  sortOrder: number;
  asset?: CreatorStudioAsset;
};

export type CreatorStudioProductPreview = {
  productId: string;
  title: string;
  coverUrl: string | null;
  description: string;
  priceCents: number;
  destinationUrl: string;
  creatorName: string | null;
};

// Note: the output resolution lookup for AspectRatio lives in templates.ts
// (RESOLUTION_BY_ASPECT_RATIO), not here -- this file imports zod, and
// scene-planner.ts needs that constant as a value import while staying
// zod-free itself (see the header comment in scene-planner.ts).
