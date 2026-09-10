import type { CreatorStudioGoal, CreatorStudioStyle } from "@/lib/creator-studio.schema";

export type CreatorStudioTemplateDefinition = {
  id: string;
  revision: number;
  name: string;
  supportedGoals: readonly CreatorStudioGoal[];
  style: CreatorStudioStyle;
  sceneKinds: readonly ("HOOK" | "PRODUCT_HERO" | "SCREENSHOTS" | "BENEFITS" | "CTA")[];
};

const ALL_GOALS: readonly CreatorStudioGoal[] = [
  "PROMOTE_EBOOK", "PROMOTE_COURSE", "PROMOTE_PLANNER", "TIKTOK_AD", "INSTAGRAM_REEL", "PRODUCT_TRAILER", "BOOK_TRAILER",
];

export const CREATOR_STUDIO_TEMPLATES: readonly CreatorStudioTemplateDefinition[] = [
  { id: "av-luxury-editorial", revision: 1, name: "Luxury Editorial", supportedGoals: ALL_GOALS, style: "LUXURY_EDITORIAL", sceneKinds: ["HOOK", "PRODUCT_HERO", "SCREENSHOTS", "BENEFITS", "CTA"] },
  { id: "av-bold-social", revision: 1, name: "Bold Social", supportedGoals: ALL_GOALS, style: "BOLD_SOCIAL", sceneKinds: ["HOOK", "BENEFITS", "SCREENSHOTS", "PRODUCT_HERO", "CTA"] },
  { id: "av-cinematic", revision: 1, name: "Cinematic", supportedGoals: ALL_GOALS, style: "CINEMATIC", sceneKinds: ["HOOK", "PRODUCT_HERO", "SCREENSHOTS", "BENEFITS", "CTA"] },
  { id: "av-clean-minimal", revision: 1, name: "Clean Minimal", supportedGoals: ALL_GOALS, style: "CLEAN_MINIMAL", sceneKinds: ["HOOK", "PRODUCT_HERO", "BENEFITS", "SCREENSHOTS", "CTA"] },
  { id: "av-creator-energy", revision: 1, name: "Creator Energy", supportedGoals: ALL_GOALS, style: "CREATOR_ENERGY", sceneKinds: ["HOOK", "SCREENSHOTS", "BENEFITS", "PRODUCT_HERO", "CTA"] },
  { id: "av-book-trailer", revision: 1, name: "Book Trailer", supportedGoals: ["PROMOTE_EBOOK", "BOOK_TRAILER"], style: "BOOK_TRAILER", sceneKinds: ["HOOK", "PRODUCT_HERO", "SCREENSHOTS", "BENEFITS", "CTA"] },
] as const;

export function findCreatorStudioTemplate(goal: CreatorStudioGoal, style: CreatorStudioStyle) {
  return CREATOR_STUDIO_TEMPLATES.find((template) => template.style === style && template.supportedGoals.includes(goal))
    ?? CREATOR_STUDIO_TEMPLATES.find((template) => template.style === "LUXURY_EDITORIAL" && template.supportedGoals.includes(goal))!;
}
