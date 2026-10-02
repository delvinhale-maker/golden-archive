import type { AurumProof } from "./contracts";

export function buildAurumProof(input: {
  productId: string;
  creatorVerified: boolean;
  aiReviewStatus: AurumProof["aiReviewStatus"];
  aiReviewScore: number | null;
  version?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  evidence?: AurumProof["evidence"];
}): AurumProof {
  return {
    productId: input.productId,
    creatorVerified: input.creatorVerified,
    productReviewed: input.aiReviewStatus === "pass",
    aiReviewStatus: input.aiReviewStatus,
    aiReviewScore: input.aiReviewScore,
    publishedAt: input.publishedAt ?? null,
    updatedAt: input.updatedAt ?? null,
    version: input.version ?? null,
    evidence: input.evidence ?? [],
  };
}
