export type CreatorStudioPlan = "FREE" | "CREATOR_PRO" | "CREATOR_BUSINESS";

export const CREATOR_STUDIO_INCLUDED_VIDEOS: Record<CreatorStudioPlan, number> = {
  FREE: 1,
  CREATOR_PRO: 10,
  CREATOR_BUSINESS: 50,
};

export type CreatorStudioUsageSnapshot = {
  plan: CreatorStudioPlan;
  includedSettled: number;
  includedReserved: number;
  extraCreditsAvailable: number;
  freePreviewConsumed: boolean;
};

export type CreatorStudioReservationDecision =
  | { allowed: true; source: "FREE_PREVIEW" | "INCLUDED" | "EXTRA_CREDIT" }
  | { allowed: false; reason: "FREE_PREVIEW_USED" | "MONTHLY_ALLOWANCE_EXHAUSTED" };

export function decideCreatorStudioReservation(
  input: CreatorStudioUsageSnapshot,
): CreatorStudioReservationDecision {
  if (input.plan === "FREE") {
    return input.freePreviewConsumed
      ? { allowed: false, reason: "FREE_PREVIEW_USED" }
      : { allowed: true, source: "FREE_PREVIEW" };
  }

  const includedLimit = CREATOR_STUDIO_INCLUDED_VIDEOS[input.plan];
  const committed = input.includedSettled + input.includedReserved;
  if (committed < includedLimit) return { allowed: true, source: "INCLUDED" };
  if (input.extraCreditsAvailable > 0) return { allowed: true, source: "EXTRA_CREDIT" };
  return { allowed: false, reason: "MONTHLY_ALLOWANCE_EXHAUSTED" };
}

export const CREATOR_STUDIO_EXTRA_RENDER_RETAIL_USD = 3;
