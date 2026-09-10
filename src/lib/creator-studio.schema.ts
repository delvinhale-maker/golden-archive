/**
 * AurumVault Creator Studio™ — CS1 shared types and Zod validation.
 * Pure aside from the zod dependency (no Supabase, no @tanstack/react-start)
 * so the enums/labels are safely importable from client UI code too.
 */
import { z } from "zod";

export const CREATION_TYPES = [
  "EBOOK_PROMO",
  "COURSE_PROMO",
  "PLANNER_PROMO",
  "TIKTOK_AD",
  "INSTAGRAM_REEL",
  "PRODUCT_TRAILER",
  "BOOK_TRAILER",
] as const;
export type CreationType = (typeof CREATION_TYPES)[number];

export const CREATION_TYPE_LABELS: Record<CreationType, { label: string; blurb: string }> = {
  EBOOK_PROMO: { label: "Promote My eBook", blurb: "A promo video built to sell your eBook." },
  COURSE_PROMO: {
    label: "Promote My Course",
    blurb: "Showcase your course and drive enrollments.",
  },
  PLANNER_PROMO: {
    label: "Promote My Planner",
    blurb: "Show off your planner's pages and layout.",
  },
  TIKTOK_AD: { label: "TikTok Product Ad", blurb: "Fast, scroll-stopping vertical ad for TikTok." },
  INSTAGRAM_REEL: { label: "Instagram Reel", blurb: "A polished Reel to promote your product." },
  PRODUCT_TRAILER: {
    label: "Product Trailer",
    blurb: "A cinematic trailer for any digital product.",
  },
  BOOK_TRAILER: { label: "Book Trailer", blurb: "A dramatic trailer built for a book launch." },
};

export const STYLES = ["CINEMATIC", "LUXURY", "BOLD_SOCIAL", "CLEAN_MINIMAL"] as const;
export type CreatorStudioStyle = (typeof STYLES)[number];

export const STYLE_LABELS: Record<CreatorStudioStyle, { label: string; blurb: string }> = {
  CINEMATIC: { label: "Cinematic", blurb: "Moody, widescreen, dramatic pacing." },
  LUXURY: { label: "Luxury", blurb: "Gold accents, elegant type, premium feel." },
  BOLD_SOCIAL: { label: "Bold Social", blurb: "High-contrast, punchy, built to stop a scroll." },
  CLEAN_MINIMAL: { label: "Clean Minimal", blurb: "Simple, airy, lets the product speak." },
};

export const DURATIONS = [15, 30, 45] as const;
export type CreatorStudioDuration = (typeof DURATIONS)[number];

export const ASPECT_RATIOS = ["9:16"] as const;
export type CreatorStudioAspectRatio = (typeof ASPECT_RATIOS)[number];

export const PROJECT_STATUSES = [
  "DRAFT",
  "READY",
  "QUEUED",
  "RENDERING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const ASSET_TYPES = ["PRODUCT_COVER", "SCREENSHOT", "LOGO"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_SOURCE_TYPES = ["UPLOADED", "FROM_PRODUCT"] as const;
export type AssetSourceType = (typeof ASSET_SOURCE_TYPES)[number];

/** Wizard step 1: create a project, optionally seeded from an AurumVault product. */
export const createProjectInput = z.object({
  productId: z.string().uuid().optional(),
  creationType: z.enum(CREATION_TYPES),
});
export type CreateProjectInput = z.infer<typeof createProjectInput>;

/** Wizard steps 2-4: style/duration + the editable promo copy. */
export const updateProjectInput = z.object({
  projectId: z.string().uuid(),
  projectName: z.string().trim().min(1).max(200).optional(),
  style: z.enum(STYLES).optional(),
  durationSeconds: z.union([z.literal(15), z.literal(30), z.literal(45)]).optional(),
  headline: z.string().trim().max(200).nullable().optional(),
  ctaText: z.string().trim().max(60).nullable().optional(),
  ctaUrl: z.string().trim().max(2000).nullable().optional(),
  priceText: z.string().trim().max(40).nullable().optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectInput>;

export const projectIdInput = z.object({ projectId: z.string().uuid() });

export const registerAssetInput = z.object({
  projectId: z.string().uuid(),
  assetType: z.enum(ASSET_TYPES),
  storagePath: z.string().min(1).max(500),
  sourceType: z.enum(ASSET_SOURCE_TYPES),
  sourceProductAssetId: z.string().max(200).nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});
export type RegisterAssetInput = z.infer<typeof registerAssetInput>;

export type CreatorStudioProject = {
  id: string;
  ownerUserId: string;
  productId: string | null;
  projectName: string;
  creationType: CreationType;
  style: CreatorStudioStyle;
  durationSeconds: CreatorStudioDuration;
  aspectRatio: CreatorStudioAspectRatio;
  status: ProjectStatus;
  headline: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  priceText: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatorStudioAsset = {
  id: string;
  projectId: string;
  assetType: AssetType;
  storagePath: string;
  sourceType: AssetSourceType;
  sourceProductAssetId: string | null;
  sortOrder: number;
  createdAt: string;
};

/** Safe, customer-facing product preview available to seed a new project. */
export type CreatorStudioProductPreview = {
  productId: string;
  title: string;
  coverUrl: string | null;
  description: string;
  priceCents: number;
  destinationUrl: string;
  creatorName: string | null;
};
