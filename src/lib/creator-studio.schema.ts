import { z } from "zod";

export const CREATOR_STUDIO_GOALS = [
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

export const creatorStudioGoalSchema = z.enum(CREATOR_STUDIO_GOALS);
export const creatorStudioStyleSchema = z.enum(CREATOR_STUDIO_STYLES);
export const creatorStudioDurationSchema = z.union([z.literal(15), z.literal(30), z.literal(45)]);

export const creatorStudioProjectInputSchema = z.object({
  title: z.string().trim().min(1).max(120).default("Untitled video project"),
  goal: creatorStudioGoalSchema,
  durationSeconds: creatorStudioDurationSchema.default(30),
  styleKey: creatorStudioStyleSchema.default("LUXURY_EDITORIAL"),
  productTitle: z.string().trim().max(160).optional().nullable(),
  callToAction: z.string().trim().max(120).optional().nullable(),
  destinationUrl: z.string().url().max(2048).optional().nullable().or(z.literal("")),
  priceLabel: z.string().trim().max(40).optional().nullable(),
  wizardStep: z.number().int().min(1).max(5).default(1),
});

export const creatorStudioProjectUpdateSchema = creatorStudioProjectInputSchema.partial().extend({
  id: z.string().uuid(),
});

export const creatorStudioAssetInputSchema = z.object({
  projectId: z.string().uuid(),
  kind: z.enum(["COVER", "SCREENSHOT", "LOGO", "OTHER"]),
  storagePath: z.string().min(3).max(1024),
  mimeType: z.string().min(3).max(120),
  byteSize: z.number().int().min(0).max(50 * 1024 * 1024),
  width: z.number().int().positive().optional().nullable(),
  height: z.number().int().positive().optional().nullable(),
  sortOrder: z.number().int().min(0).max(100).default(0),
});

export type CreatorStudioGoal = z.infer<typeof creatorStudioGoalSchema>;
export type CreatorStudioStyle = z.infer<typeof creatorStudioStyleSchema>;

export type CreatorStudioProject = {
  id: string;
  owner_user_id: string;
  title: string;
  goal: CreatorStudioGoal;
  status: "DRAFT" | "READY" | "RENDERING" | "COMPLETED" | "FAILED" | "ARCHIVED";
  duration_seconds: 15 | 30 | 45;
  aspect_ratio: "9:16";
  style_key: string;
  product_title: string | null;
  call_to_action: string | null;
  destination_url: string | null;
  price_label: string | null;
  wizard_step: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type CreatorStudioAsset = {
  id: string;
  owner_user_id: string;
  project_id: string;
  kind: "COVER" | "SCREENSHOT" | "LOGO" | "OTHER";
  storage_path: string;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  sort_order: number;
  created_at: string;
};

export const CREATOR_STUDIO_GOAL_LABELS: Record<CreatorStudioGoal, string> = {
  PROMOTE_EBOOK: "Promote my ebook",
  PROMOTE_COURSE: "Promote my course",
  PROMOTE_PLANNER: "Promote my planner",
  TIKTOK_AD: "Create TikTok ad",
  INSTAGRAM_REEL: "Create Instagram Reel",
  PRODUCT_TRAILER: "Create product trailer",
  BOOK_TRAILER: "Create book trailer",
};
