import { z } from "zod";

export const intentChannelSchema = z.enum(["text", "voice"]);
export const intentStageSchema = z.enum(["exploring", "planning", "buying", "executing"]);
export const intentSchema = z.object({
  sessionId: z.string().uuid(),
  channel: intentChannelSchema,
  rawInput: z.string().trim().min(2).max(4000),
  objective: z.string().trim().min(2).max(500),
  needs: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
  constraints: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
  stage: intentStageSchema.default("exploring"),
  categoryHints: z.array(z.string().trim().min(1).max(120)).max(8).default([]),
  confidence: z.number().min(0).max(1),
  consent: z.object({
    analytics: z.boolean().default(false),
    personalization: z.boolean().default(false),
  }),
});
export type AurumIntent = z.infer<typeof intentSchema>;

export const recommendationSchema = z.object({
  productId: z.string().uuid(),
  reason: z.string().min(1).max(500),
  matchedNeeds: z.array(z.string()).max(12),
  confidence: z.number().min(0).max(1),
});
export type AurumRecommendation = z.infer<typeof recommendationSchema>;

export const proofSchema = z.object({
  productId: z.string().uuid(),
  creatorVerified: z.boolean(),
  productReviewed: z.boolean(),
  aiReviewStatus: z.enum(["pass", "warn", "fail", "pending"]).nullable(),
  aiReviewScore: z.number().nullable(),
  publishedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime().nullable(),
  version: z.string().nullable(),
  evidence: z.array(z.object({
    key: z.string(),
    label: z.string(),
    value: z.string(),
    source: z.enum(["platform", "creator", "customer", "system"]),
  })),
});
export type AurumProof = z.infer<typeof proofSchema>;

export const gapSignalSchema = z.object({
  objectiveKey: z.string().min(1).max(180),
  categoryHint: z.string().nullable(),
  requestCount: z.number().int().nonnegative(),
  resultCount: z.number().int().nonnegative(),
  noResultCount: z.number().int().nonnegative(),
  lowConfidenceCount: z.number().int().nonnegative(),
  conversionCount: z.number().int().nonnegative(),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
});
export type MarketplaceGapSignal = z.infer<typeof gapSignalSchema>;

export const merchantSignalSchema = z.object({
  kind: z.enum(["missing_product", "weak_category", "emerging_demand", "conversion_gap"]),
  title: z.string().min(1).max(180),
  summary: z.string().min(1).max(1000),
  demandScore: z.number().min(0).max(100),
  evidence: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  generatedAt: z.string().datetime(),
});
export type MerchantSignal = z.infer<typeof merchantSignalSchema>;
