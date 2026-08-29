/**
 * Digital Rights Readiness Score™ — pure, dependency-free scoring.
 *
 * This is a completeness/gap indicator, not a legal assessment. It never
 * asserts ownership or validity — it only measures how much of a passport's
 * organizational structure is filled in and how many open REVIEW_REQUIRED
 * items remain. Kept pure (no Supabase/zod) so it's directly unit-testable
 * and reusable by both the Passport Home summary and any future export.
 */
import type { AssetRow, ControlBasis, PassportRow } from "@/lib/rights-passport.schema";

export type ReadinessGap = {
  id: string;
  label: string;
  weight: number;
};

export type ReadinessResult = {
  score: number; // 0-100
  gaps: ReadinessGap[];
  primaryGap: ReadinessGap | null;
  openReviewCount: number;
};

const IDENTITY_FIELD_WEIGHT = 6;
const CONTACT_WEIGHT = 10;
const ASSET_PRESENT_WEIGHT = 20;
const ASSET_REVIEW_PENALTY_WEIGHT = 15;
const VERIFICATION_WEIGHT = 10;
const SUCCESSOR_WEIGHT = 8;
const PUBLIC_URL_WEIGHT = 6;

const REVIEW_REQUIRED_BASES: ControlBasis[] = ["REVIEW_REQUIRED"];

/**
 * Scores a passport's organizational completeness out of 100. Never
 * evaluates whether any claim is legally true — only whether the record is
 * filled in, has assets registered, and has no unresolved review items.
 */
export function computeReadinessScore(
  passport: Pick<
    PassportRow,
    | "public_professional_name"
    | "rights_contact_email"
    | "verification_level"
    | "successor_estate_contact"
    | "public_rights_url"
  >,
  assets: Pick<AssetRow, "control_basis" | "status">[],
): ReadinessResult {
  const gaps: ReadinessGap[] = [];
  let earned = 0;
  const maxPoints =
    IDENTITY_FIELD_WEIGHT +
    CONTACT_WEIGHT +
    ASSET_PRESENT_WEIGHT +
    VERIFICATION_WEIGHT +
    SUCCESSOR_WEIGHT +
    PUBLIC_URL_WEIGHT;

  if (passport.public_professional_name?.trim()) {
    earned += IDENTITY_FIELD_WEIGHT;
  } else {
    gaps.push({
      id: "identity_name",
      label: "Add your public/professional name",
      weight: IDENTITY_FIELD_WEIGHT,
    });
  }

  if (passport.rights_contact_email?.trim()) {
    earned += CONTACT_WEIGHT;
  } else {
    gaps.push({
      id: "rights_contact",
      label: "Add a rights contact email",
      weight: CONTACT_WEIGHT,
    });
  }

  if (assets.length > 0) {
    earned += ASSET_PRESENT_WEIGHT;
  } else {
    gaps.push({
      id: "no_assets",
      label: "Register at least one asset in your Rights Asset Registry",
      weight: ASSET_PRESENT_WEIGHT,
    });
  }

  if (passport.verification_level !== "SELF_DECLARED") {
    earned += VERIFICATION_WEIGHT;
  } else {
    gaps.push({
      id: "self_declared_only",
      label: "Your verification level is still self-declared",
      weight: VERIFICATION_WEIGHT,
    });
  }

  if (passport.successor_estate_contact?.trim()) {
    earned += SUCCESSOR_WEIGHT;
  } else {
    gaps.push({
      id: "no_successor",
      label: "Add successor/estate instructions",
      weight: SUCCESSOR_WEIGHT,
    });
  }

  if (passport.public_rights_url?.trim()) {
    earned += PUBLIC_URL_WEIGHT;
  } else {
    gaps.push({
      id: "no_public_url",
      label: "Add a public rights URL",
      weight: PUBLIC_URL_WEIGHT,
    });
  }

  const reviewRequiredAssets = assets.filter(
    (a) => REVIEW_REQUIRED_BASES.includes(a.control_basis) || a.status === "REVIEW_REQUIRED",
  );
  const openReviewCount = reviewRequiredAssets.length;
  if (openReviewCount > 0) {
    const penalty = Math.min(ASSET_REVIEW_PENALTY_WEIGHT, openReviewCount * 3);
    gaps.push({
      id: "open_review_items",
      label: `Resolve ${openReviewCount} item${openReviewCount === 1 ? "" : "s"} marked REVIEW REQUIRED`,
      weight: penalty,
    });
    earned = Math.max(0, earned - penalty);
  }

  const score = Math.round((earned / maxPoints) * 100);
  const primaryGap = gaps.length ? [...gaps].sort((a, b) => b.weight - a.weight)[0]! : null;

  return { score: Math.max(0, Math.min(100, score)), gaps, primaryGap, openReviewCount };
}
