import type { CreatorVideoComposition, CompositionScene } from "./composition.schema";
import type { ProjectType, StylePreset, Duration, ProjectAssetRole } from "./schema";
import {
  getTemplateBlueprint,
  STYLE_CONFIG,
  SAFE_ZONE_9_16,
  MAX_TEXT_CHARS,
  TEMPLATE_VERSION,
  RESOLUTION_BY_ASPECT_RATIO,
} from "./templates";

/**
 * Deterministic scene planner: (project type + style + duration + assets +
 * CTA) -> internal composition. Same input always produces the exact same
 * output (no randomness, no wall-clock dependence) -- required so a stored
 * template key/version stays reproducible/auditable, and so this module is
 * directly unit-testable without a database. Intentionally has zero runtime
 * imports from zod/Supabase/TanStack -- only type-only imports from
 * composition.schema.ts -- so it can be exercised with a plain `bun:test`
 * import in this sandbox (composition.schema.ts's zod dependency is not
 * installed here; see tests/unit/creator-studio-scene-planner.test.ts).
 */

export class SceneValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SceneValidationError";
  }
}

export type PlannerAsset = {
  id: string;
  role: ProjectAssetRole;
  storagePath: string;
  sortOrder: number;
};

export type PlanScenesInput = {
  projectId: string;
  projectType: ProjectType;
  stylePreset: StylePreset;
  durationSeconds: Duration;
  headline: string;
  ctaText: string;
  priceText: string | null;
  destinationUrl: string | null;
  assets: PlannerAsset[];
};

function truncate(text: string, max: number): string | undefined {
  if (max <= 0) return undefined;
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 1))}…`;
}

export function planScenes(input: PlanScenesInput): CreatorVideoComposition {
  if (
    input.durationSeconds !== 15 &&
    input.durationSeconds !== 30 &&
    input.durationSeconds !== 45
  ) {
    throw new SceneValidationError(
      "creator_studio_invalid_duration",
      "Duration must be 15, 30, or 45 seconds",
    );
  }

  const cover = input.assets.find((a) => a.role === "COVER");
  if (!cover) {
    throw new SceneValidationError(
      "creator_studio_missing_cover",
      "A cover image is required to build a video",
    );
  }
  const logo = input.assets.find((a) => a.role === "LOGO");
  const screenshots = input.assets
    .filter((a) => a.role === "SCREENSHOT")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

  const blueprint = getTemplateBlueprint(input.projectType);
  const styleConfig = STYLE_CONFIG[input.stylePreset];
  const resolution = RESOLUTION_BY_ASPECT_RATIO["9:16"];

  // Expand repeat entries against actually-available screenshots, then drop
  // any entry left with zero concrete scenes and renormalize the remaining
  // fractions so the timeline still tiles exactly to 1.0 regardless of how
  // many screenshots (0..cap) the project actually has.
  type ExpandedEntry = {
    type: CompositionScene["type"];
    assetId: string | null;
    assetPath: string | null;
    assetRole: "COVER" | "SCREENSHOT" | "LOGO" | null;
    textSource: "HEADLINE" | "CTA" | "PRICE" | null;
    fraction: number;
  };
  const expanded: ExpandedEntry[] = [];
  for (const entry of blueprint.scenes) {
    if (entry.repeatForEachScreenshot) {
      const take = screenshots.slice(0, entry.maxRepeats ?? screenshots.length);
      if (take.length === 0) continue;
      const perScene = entry.fractionOfDuration / take.length;
      for (const shot of take) {
        expanded.push({
          type: entry.type,
          assetId: shot.id,
          assetPath: shot.storagePath,
          assetRole: "SCREENSHOT",
          textSource: entry.textSource,
          fraction: perScene,
        });
      }
      continue;
    }
    const usedLogoFallback = entry.assetRole === "LOGO" && !logo;
    const asset =
      entry.assetRole === "COVER"
        ? cover
        : entry.assetRole === "LOGO"
          ? (logo ?? cover) // fall back to the cover so a CTA/hero scene never renders with no image at all
          : null;
    expanded.push({
      type: entry.type,
      assetId: asset?.id ?? null,
      assetPath: asset?.storagePath ?? null,
      assetRole: asset
        ? usedLogoFallback
          ? "COVER"
          : (entry.assetRole as "COVER" | "LOGO")
        : null,
      textSource: entry.textSource,
      fraction: entry.fractionOfDuration,
    });
  }

  const fractionSum = expanded.reduce((sum, e) => sum + e.fraction, 0);
  const normalized = expanded.map((e) => ({ ...e, fraction: e.fraction / fractionSum }));

  const scenes: CompositionScene[] = [];
  let cursor = 0;
  normalized.forEach((entry, i) => {
    const isLast = i === normalized.length - 1;
    const rawDuration = Math.round(entry.fraction * input.durationSeconds * 100) / 100;
    const duration = isLast
      ? Math.round((input.durationSeconds - cursor) * 100) / 100
      : rawDuration;

    let text: { headline?: string; body?: string } = {};
    const maxChars = MAX_TEXT_CHARS[entry.type as keyof typeof MAX_TEXT_CHARS];
    if (entry.textSource === "HEADLINE") {
      text = { headline: truncate(input.headline, maxChars) };
    } else if (entry.textSource === "CTA") {
      text = { headline: truncate(input.ctaText, maxChars) };
    } else if (entry.textSource === "PRICE" && input.priceText) {
      text = { headline: truncate(input.priceText, maxChars) };
    }

    scenes.push({
      id: `${entry.type.toLowerCase()}-${i}`,
      start: cursor,
      duration,
      type: entry.type,
      assetRef: entry.assetId
        ? { assetId: entry.assetId, role: entry.assetRole!, storagePath: entry.assetPath! }
        : null,
      text,
      transition: styleConfig.transition,
      motionPreset: entry.assetId ? styleConfig.motionPreset : "STATIC",
      textStyle: { weight: styleConfig.textWeight, size: styleConfig.textSize, align: "CENTER" },
      safeZone: SAFE_ZONE_9_16,
    });
    cursor += duration;
  });

  return {
    version: "1",
    width: resolution.width,
    height: resolution.height,
    fps: 30,
    duration: input.durationSeconds,
    scenes,
    audio:
      styleConfig.audioTrack === "NONE" ? null : { track: styleConfig.audioTrack, volume: 0.35 },
    branding: {
      logoAssetId: logo?.id ?? null,
      ctaText: truncate(input.ctaText, 60) ?? "Shop Now",
      priceText: input.priceText,
      destinationUrl: input.destinationUrl,
    },
    metadata: {
      projectId: input.projectId,
      projectType: input.projectType,
      stylePreset: input.stylePreset,
      templateKey: blueprint.key,
      templateVersion: TEMPLATE_VERSION,
    },
  };
}
