import { z } from "zod";

export type CreatorStudioJson =
  | string
  | number
  | boolean
  | null
  | CreatorStudioJson[]
  | { [key: string]: CreatorStudioJson };

export const CREATOR_STUDIO_PROJECT_TYPES = [
  "PROMOTE_EBOOK",
  "PROMOTE_COURSE",
  "PROMOTE_PLANNER",
  "TIKTOK_AD",
  "INSTAGRAM_REEL",
  "PRODUCT_TRAILER",
  "BOOK_TRAILER",
] as const;

export const CREATOR_STUDIO_STYLES = [
  "LUXURY_EDITORIAL",
  "BOLD_SOCIAL",
  "CINEMATIC",
  "CLEAN_MINIMAL",
  "CREATOR_ENERGY",
  "BOOK_TRAILER",
] as const;

export const CREATOR_STUDIO_DURATIONS = [15, 30, 45] as const;
export const CREATOR_STUDIO_ASSET_CATEGORIES = [
  "PRODUCT_COVER",
  "SCREENSHOT",
  "LOGO",
  "ADDITIONAL_MEDIA",
] as const;

export const CREATOR_STUDIO_ASSET_LIMITS = {
  PRODUCT_COVER: 1,
  SCREENSHOT: 8,
  LOGO: 1,
  ADDITIONAL_MEDIA: 4,
} as const;

export const MAX_CREATOR_STUDIO_ASSET_BYTES = 50 * 1024 * 1024;

export const creatorStudioProjectTypeSchema = z.enum(CREATOR_STUDIO_PROJECT_TYPES);
export const creatorStudioStyleSchema = z.enum(CREATOR_STUDIO_STYLES);
export const creatorStudioDurationSchema = z.union([
  z.literal(15),
  z.literal(30),
  z.literal(45),
]);
export const creatorStudioAssetCategorySchema = z.enum(CREATOR_STUDIO_ASSET_CATEGORIES);

const optionalDestinationSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) =>
      value === "" ||
      value.startsWith("/") ||
      /^https?:\/\/[^\s]+$/i.test(value),
    "Use an https:// URL or an AurumVault relative path.",
  )
  .optional()
  .nullable();

export const creatorStudioCreateProjectSchema = z.object({
  projectType: creatorStudioProjectTypeSchema,
  title: z.string().trim().min(1).max(160).optional(),
});

export const creatorStudioProjectUpdateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(160).optional(),
  productTitle: z.string().trim().max(180).optional().nullable(),
  styleKey: creatorStudioStyleSchema.optional(),
  durationSeconds: creatorStudioDurationSchema.optional(),
  hook: z.string().trim().max(240).optional().nullable(),
  cta: z.string().trim().max(120).optional().nullable(),
  destinationUrl: optionalDestinationSchema,
  priceCents: z.number().int().min(0).max(100_000_000).optional().nullable(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
  wizardStep: z.number().int().min(1).max(7).optional(),
});

export const creatorStudioSelectProductSchema = z.object({
  projectId: z.string().uuid(),
  productId: z.string().uuid().nullable(),
});

export const creatorStudioProjectIdSchema = z.object({
  projectId: z.string().uuid(),
});

export const creatorStudioProjectStatusSchema = z.object({
  projectId: z.string().uuid(),
  status: z.enum(["DRAFT", "READY", "CANCELLED"]),
});

export const creatorStudioUploadRequestSchema = z.object({
  projectId: z.string().uuid(),
  category: creatorStudioAssetCategorySchema,
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(3).max(120),
  byteSize: z.number().int().min(1).max(MAX_CREATOR_STUDIO_ASSET_BYTES),
});

export const creatorStudioUploadCompleteSchema = z.object({
  assetId: z.string().uuid(),
  width: z.number().int().positive().max(50_000).optional().nullable(),
  height: z.number().int().positive().max(50_000).optional().nullable(),
});

export const creatorStudioAssetIdSchema = z.object({
  assetId: z.string().uuid(),
});

export type CreatorStudioProjectType = z.infer<typeof creatorStudioProjectTypeSchema>;
export type CreatorStudioStyle = z.infer<typeof creatorStudioStyleSchema>;
export type CreatorStudioAssetCategory = z.infer<typeof creatorStudioAssetCategorySchema>;
export type CreatorStudioProjectStatus =
  | "DRAFT"
  | "READY"
  | "RENDERING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type CreatorStudioProject = {
  id: string;
  owner_user_id: string;
  source_product_id: string | null;
  project_type: CreatorStudioProjectType;
  title: string;
  product_title: string | null;
  status: CreatorStudioProjectStatus;
  duration_seconds: 15 | 30 | 45;
  aspect_ratio: "9:16";
  style_key: CreatorStudioStyle;
  hook: string | null;
  cta: string | null;
  destination_url: string | null;
  price_cents: number | null;
  currency: string;
  wizard_step: number;
  metadata: CreatorStudioJson;
  created_at: string;
  updated_at: string;
};

export type CreatorStudioAsset = {
  id: string;
  owner_user_id: string;
  category: CreatorStudioAssetCategory;
  state: "PENDING_UPLOAD" | "READY" | "FAILED";
  storage_path: string;
  original_filename: string;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  metadata: CreatorStudioJson;
  created_at: string;
  updated_at: string;
  sort_order: number;
  preview_url: string | null;
};

export type CreatorStudioSourceProduct = {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  price_cents: number;
  creator_name: string | null;
  preview_urls: string[];
};

export const CREATOR_STUDIO_PROJECT_TYPE_LABELS: Record<CreatorStudioProjectType, string> = {
  PROMOTE_EBOOK: "Promote My eBook",
  PROMOTE_COURSE: "Promote My Course",
  PROMOTE_PLANNER: "Promote My Planner",
  TIKTOK_AD: "TikTok Product Ad",
  INSTAGRAM_REEL: "Instagram Reel",
  PRODUCT_TRAILER: "Product Trailer",
  BOOK_TRAILER: "Book Trailer",
};

export const CREATOR_STUDIO_STYLE_LABELS: Record<CreatorStudioStyle, string> = {
  LUXURY_EDITORIAL: "Luxury Editorial",
  BOLD_SOCIAL: "Bold Social",
  CINEMATIC: "Cinematic",
  CLEAN_MINIMAL: "Clean Minimal",
  CREATOR_ENERGY: "Creator Energy",
  BOOK_TRAILER: "Book Trailer",
};
