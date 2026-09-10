export const CREATOR_STUDIO_PRICING = {
  FREE: { monthlyPriceCents: 0, includedVideos: 1, cadence: "LIFETIME" },
  PRO: { monthlyPriceCents: 1900, includedVideos: 10, cadence: "MONTHLY" },
  BUSINESS: { monthlyPriceCents: 4900, includedVideos: 50, cadence: "MONTHLY" },
  EXTRA_VIDEO: { unitPriceCents: 300 },
} as const;

export type CreatorStudioPaidPlan = "PRO" | "BUSINESS";

export function creatorStudioIncludedVideos(plan: "FREE" | CreatorStudioPaidPlan) {
  return CREATOR_STUDIO_PRICING[plan].includedVideos;
}
