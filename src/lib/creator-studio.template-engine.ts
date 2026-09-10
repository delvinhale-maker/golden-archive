import {
  creatorStudioPlannerInputSchema,
  creatorStudioRenderPlanSchema,
  type CreatorStudioRenderLayer,
  type CreatorStudioRenderPlan,
  type CreatorStudioRenderScene,
  type CreatorStudioTemplateFamily,
} from "@/lib/creator-studio.render-plan";
import type { CreatorStudioProjectType, CreatorStudioStyle } from "@/lib/creator-studio.schema";

export const CREATOR_STUDIO_TEMPLATE_VERSIONS: Record<CreatorStudioTemplateFamily, string> = {
  EBOOK: "1.0.0",
  COURSE: "1.0.0",
  PLANNER: "1.0.0",
  TIKTOK_PRODUCT_AD: "1.0.0",
  INSTAGRAM_REEL: "1.0.0",
  PRODUCT_TRAILER: "1.0.0",
  BOOK_TRAILER: "1.0.0",
};

const FAMILY_BY_PROJECT_TYPE: Record<CreatorStudioProjectType, CreatorStudioTemplateFamily> = {
  PROMOTE_EBOOK: "EBOOK",
  PROMOTE_COURSE: "COURSE",
  PROMOTE_PLANNER: "PLANNER",
  TIKTOK_AD: "TIKTOK_PRODUCT_AD",
  INSTAGRAM_REEL: "INSTAGRAM_REEL",
  PRODUCT_TRAILER: "PRODUCT_TRAILER",
  BOOK_TRAILER: "BOOK_TRAILER",
};

const BENEFIT_COPY: Record<CreatorStudioTemplateFamily, string> = {
  EBOOK: "A clear idea, packaged to read and use anywhere.",
  COURSE: "Learn the process in a focused, creator-led experience.",
  PLANNER: "Turn the goal into a plan you can actually follow.",
  TIKTOK_PRODUCT_AD: "Made to stop the scroll and show the value quickly.",
  INSTAGRAM_REEL: "A polished look at what makes this product worth saving.",
  PRODUCT_TRAILER: "See the product, the details, and the reason it matters.",
  BOOK_TRAILER: "Meet the idea behind the pages before you start reading.",
};

const BACKGROUND_BY_STYLE: Record<
  CreatorStudioStyle,
  { primary: CreatorStudioRenderScene["background_token"]; light: CreatorStudioRenderScene["background_token"] }
> = {
  LUXURY_EDITORIAL: { primary: "NAVY", light: "IVORY" },
  BOLD_SOCIAL: { primary: "INK", light: "WHITE" },
  CINEMATIC: { primary: "INK", light: "NAVY" },
  CLEAN_MINIMAL: { primary: "WHITE", light: "IVORY" },
  CREATOR_ENERGY: { primary: "NAVY", light: "GOLD_WASH" },
  BOOK_TRAILER: { primary: "INK", light: "IVORY" },
};

const DURATION_LAYOUTS: Record<15 | 30 | 45, readonly number[]> = {
  15: [2_000, 2_500, 2_500, 2_500, 2_500, 3_000],
  30: [3_500, 5_000, 6_000, 5_500, 5_000, 5_000],
  45: [5_000, 7_000, 10_000, 8_000, 7_000, 8_000],
};

function textLayer(
  id: string,
  text: string,
  role: Extract<CreatorStudioRenderLayer, { type: "TEXT" }>["role"],
  position: Extract<CreatorStudioRenderLayer, { type: "TEXT" }>["position"],
  styleToken: Extract<CreatorStudioRenderLayer, { type: "TEXT" }>["style_token"],
  durationMs: number,
  zIndex = 10,
): CreatorStudioRenderLayer {
  return {
    id,
    type: "TEXT",
    start_ms: 0,
    duration_ms: durationMs,
    z_index: zIndex,
    text,
    role,
    position,
    align: "CENTER",
    style_token: styleToken,
  };
}

function imageLayer(
  id: string,
  mediaRef: string,
  durationMs: number,
  options?: {
    startMs?: number;
    fit?: "COVER" | "CONTAIN";
    position?: "TOP" | "UPPER_CENTER" | "CENTER" | "LOWER_CENTER" | "BOTTOM";
    motion?: "NONE" | "PUSH_IN" | "PULL_OUT" | "PAN_UP" | "PAN_DOWN";
    zIndex?: number;
    cornerRadius?: number;
  },
): CreatorStudioRenderLayer {
  return {
    id,
    type: "IMAGE",
    start_ms: options?.startMs ?? 0,
    duration_ms: durationMs,
    z_index: options?.zIndex ?? 2,
    media_ref: mediaRef,
    fit: options?.fit ?? "CONTAIN",
    position: options?.position ?? "CENTER",
    motion: options?.motion ?? "PUSH_IN",
    corner_radius: options?.cornerRadius ?? 36,
  };
}

function videoLayer(
  id: string,
  mediaRef: string,
  durationMs: number,
  options?: { startMs?: number; zIndex?: number },
): CreatorStudioRenderLayer {
  return {
    id,
    type: "VIDEO",
    start_ms: options?.startMs ?? 0,
    duration_ms: durationMs,
    z_index: options?.zIndex ?? 2,
    media_ref: mediaRef,
    fit: "COVER",
    position: "CENTER",
    muted: true,
    trim_start_ms: 0,
  };
}

function previewWatermark(durationMs: number): CreatorStudioRenderLayer {
  return textLayer(
    "preview-watermark",
    "AurumVault Preview",
    "WATERMARK",
    "BOTTOM",
    "WATERMARK_SUBTLE",
    durationMs,
    90,
  );
}

function buildMediaCatalog(
  assets: Array<{
    id: string;
    category: "PRODUCT_COVER" | "SCREENSHOT" | "LOGO" | "ADDITIONAL_MEDIA";
    mime_type: "image/jpeg" | "image/png" | "image/webp" | "video/mp4";
    sort_order: number;
  }>,
  source: { has_cover: boolean; preview_count: number },
) {
  const ordered = [...assets].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  const uploadedCover = ordered.find((asset) => asset.category === "PRODUCT_COVER");
  const logo = ordered.find((asset) => asset.category === "LOGO");
  const proof = ordered
    .filter((asset) => asset.category === "SCREENSHOT" || asset.category === "ADDITIONAL_MEDIA")
    .map((asset) => ({
      ref: `asset:${asset.id}`,
      kind: asset.mime_type === "video/mp4" ? ("VIDEO" as const) : ("IMAGE" as const),
    }));

  for (let index = 0; index < source.preview_count; index += 1) {
    proof.push({ ref: `source:preview:${index}`, kind: "IMAGE" as const });
  }

  return {
    coverRef: uploadedCover ? `asset:${uploadedCover.id}` : source.has_cover ? "source:cover" : null,
    logoRef: logo ? `asset:${logo.id}` : null,
    proof: proof.slice(0, 8),
  };
}

function makeProofLayers(
  media: Array<{ ref: string; kind: "IMAGE" | "VIDEO" }>,
  sceneDurationMs: number,
): CreatorStudioRenderLayer[] {
  if (media.length === 0) {
    return [
      textLayer(
        "proof-fallback",
        "A closer look at what’s inside",
        "SUPPORTING",
        "CENTER",
        "DISPLAY_SECONDARY",
        sceneDurationMs,
      ),
    ];
  }

  const visible = media.slice(0, sceneDurationMs >= 8_000 ? 5 : sceneDurationMs >= 5_000 ? 4 : 3);
  const segment = Math.floor(sceneDurationMs / visible.length);
  return visible.map((item, index) => {
    const startMs = index * segment;
    const durationMs = index === visible.length - 1 ? sceneDurationMs - startMs : segment;
    return item.kind === "VIDEO"
      ? videoLayer(`proof-${index + 1}`, item.ref, durationMs, { startMs })
      : imageLayer(`proof-${index + 1}`, item.ref, durationMs, {
          startMs,
          fit: "CONTAIN",
          motion: index % 2 === 0 ? "PUSH_IN" : "PULL_OUT",
        });
  });
}

function addWatermarkIfPreview(
  layers: CreatorStudioRenderLayer[],
  durationMs: number,
  quality: "PREVIEW" | "STANDARD",
) {
  return quality === "PREVIEW" ? [...layers, previewWatermark(durationMs)] : layers;
}

function formatPrice(priceCents: number | null, currency: string) {
  if (priceCents == null) return "";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(priceCents / 100);
  } catch {
    return `${currency} ${(priceCents / 100).toFixed(2)}`;
  }
}

export function buildCreatorStudioRenderPlan(rawInput: unknown): CreatorStudioRenderPlan {
  const input = creatorStudioPlannerInputSchema.parse(rawInput);
  const { project, quality } = input;
  const family = FAMILY_BY_PROJECT_TYPE[project.project_type];
  const media = buildMediaCatalog(input.assets, input.source_product_media);
  if (!media.coverRef) {
    throw new Error("Creator Studio render plan requires a ready product cover.");
  }

  const [hookMs, coverMs, proofMs, benefitMs, heroMs, ctaMs] =
    DURATION_LAYOUTS[project.duration_seconds];
  const background = BACKGROUND_BY_STYLE[project.style_key];
  const price = formatPrice(project.price_cents, project.currency);
  const scenes: CreatorStudioRenderScene[] = [];
  let startMs = 0;

  function pushScene(
    id: string,
    purpose: CreatorStudioRenderScene["purpose"],
    durationMs: number,
    backgroundToken: CreatorStudioRenderScene["background_token"],
    layers: CreatorStudioRenderLayer[],
    transition: CreatorStudioRenderScene["transition_in"]["kind"] = "FADE",
  ) {
    scenes.push({
      id,
      purpose,
      start_ms: startMs,
      duration_ms: durationMs,
      background_token: backgroundToken,
      transition_in: {
        kind: scenes.length === 0 ? "NONE" : transition,
        duration_ms: scenes.length === 0 ? 0 : Math.min(500, Math.floor(durationMs / 4)),
      },
      layers: addWatermarkIfPreview(layers, durationMs, quality),
    });
    startMs += durationMs;
  }

  pushScene(
    "scene-hook",
    "HOOK",
    hookMs,
    background.primary,
    [textLayer("hook", project.hook, "HOOK", "CENTER", "DISPLAY_PRIMARY", hookMs)],
    "NONE",
  );

  pushScene(
    "scene-cover",
    "COVER_REVEAL",
    coverMs,
    background.light,
    [
      imageLayer("cover", media.coverRef, coverMs, {
        fit: "CONTAIN",
        motion: "PUSH_IN",
        cornerRadius: 24,
      }),
      textLayer(
        "cover-title",
        project.product_title,
        "TITLE",
        "BOTTOM",
        "DISPLAY_SECONDARY",
        coverMs,
        20,
      ),
    ],
    "ZOOM",
  );

  pushScene(
    "scene-proof",
    "PRODUCT_PROOF",
    proofMs,
    "MEDIA",
    makeProofLayers(media.proof, proofMs),
    "SLIDE",
  );

  pushScene(
    "scene-benefit",
    "BENEFIT",
    benefitMs,
    background.primary,
    [
      textLayer(
        "benefit",
        BENEFIT_COPY[family],
        "SUPPORTING",
        "CENTER",
        "DISPLAY_SECONDARY",
        benefitMs,
      ),
    ],
  );

  const heroLayers: CreatorStudioRenderLayer[] = [
    imageLayer("hero-cover", media.coverRef, heroMs, {
      fit: "CONTAIN",
      motion: "PULL_OUT",
      position: "UPPER_CENTER",
      cornerRadius: 24,
    }),
    textLayer("hero-title", project.product_title, "TITLE", "LOWER_CENTER", "DISPLAY_SECONDARY", heroMs, 20),
  ];
  if (price) {
    heroLayers.push(textLayer("hero-price", price, "PRICE", "BOTTOM", "PRICE_PRIMARY", heroMs, 25));
  }
  pushScene("scene-hero", "HERO", heroMs, background.light, heroLayers, "ZOOM");

  const ctaLayers: CreatorStudioRenderLayer[] = [
    textLayer("cta", project.cta, "CTA", "CENTER", "CTA_PRIMARY", ctaMs, 30),
  ];
  if (project.destination_url) {
    ctaLayers.push(
      textLayer(
        "cta-url",
        project.destination_url,
        "SUPPORTING",
        "LOWER_CENTER",
        "BODY_PRIMARY",
        ctaMs,
        25,
      ),
    );
  }
  if (media.logoRef) {
    ctaLayers.push(
      imageLayer("cta-logo", media.logoRef, ctaMs, {
        fit: "CONTAIN",
        position: "BOTTOM",
        motion: "NONE",
        zIndex: 15,
        cornerRadius: 0,
      }),
    );
  }
  pushScene("scene-cta", "CTA", ctaMs, background.primary, ctaLayers);

  return creatorStudioRenderPlanSchema.parse({
    schema_version: "1.0",
    project_id: project.id,
    project_type: project.project_type,
    style_key: project.style_key,
    template: {
      family,
      version: CREATOR_STUDIO_TEMPLATE_VERSIONS[family],
    },
    output: {
      format: "MP4",
      width: 1080,
      height: 1920,
      fps: 30,
      aspect_ratio: "9:16",
      duration_ms: project.duration_seconds * 1000,
      quality,
    },
    merge_fields: [
      { key: "PRODUCT_TITLE", value: project.product_title },
      { key: "HOOK", value: project.hook },
      { key: "CTA", value: project.cta },
      { key: "PRICE", value: price },
      { key: "DESTINATION_URL", value: project.destination_url ?? "" },
    ],
    scenes,
  });
}
