import type { CreatorStudioRenderLayer, CreatorStudioRenderPlan } from "@/lib/creator-studio.render-plan";
import {
  CreatorStudioProviderError,
  type CreatorStudioProviderStatus,
  type CreatorStudioRenderProvider,
  type CreatorStudioResolvedMedia,
} from "@/lib/creator-studio.provider";

const STAGE_BASE = "https://api.shotstack.io/edit/stage";
const PRODUCTION_BASE = "https://api.shotstack.io/edit/v1";
const REQUEST_TIMEOUT_MS = 30_000;

function providerConfig() {
  const environment = process.env.CREATOR_STUDIO_SHOTSTACK_ENV === "v1" ? "v1" : "stage";
  if (environment === "v1" && process.env.CREATOR_STUDIO_ALLOW_PRODUCTION_PROVIDER !== "true") {
    throw new CreatorStudioProviderError(
      "PROVIDER_PRODUCTION_DISABLED",
      "Production video rendering is disabled.",
    );
  }

  const apiKey =
    environment === "v1"
      ? process.env.SHOTSTACK_PRODUCTION_API_KEY
      : process.env.SHOTSTACK_STAGE_API_KEY;
  if (!apiKey) {
    throw new CreatorStudioProviderError(
      "PROVIDER_NOT_CONFIGURED",
      "Video rendering is not configured for this environment.",
    );
  }

  return { environment, apiKey, baseUrl: environment === "v1" ? PRODUCTION_BASE : STAGE_BASE };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function positionFor(layer: CreatorStudioRenderLayer) {
  if (!("position" in layer)) return "center";
  switch (layer.position) {
    case "TOP": return "top";
    case "UPPER_CENTER": return "top";
    case "LOWER_CENTER": return "bottom";
    case "BOTTOM": return "bottom";
    default: return "center";
  }
}

function transitionFor(kind: string) {
  if (kind === "FADE") return "fade";
  if (kind === "SLIDE") return "slideLeft";
  if (kind === "ZOOM") return "fade";
  return undefined;
}

function effectFor(layer: CreatorStudioRenderLayer) {
  if (layer.type !== "IMAGE") return undefined;
  if (layer.motion === "PUSH_IN") return "zoomIn";
  if (layer.motion === "PULL_OUT") return "zoomOut";
  return undefined;
}

function styleForText(layer: Extract<CreatorStudioRenderLayer, { type: "TEXT" }>) {
  const size =
    layer.style_token === "DISPLAY_PRIMARY" ? 70 :
    layer.style_token === "DISPLAY_SECONDARY" ? 54 :
    layer.style_token === "CTA_PRIMARY" ? 60 :
    layer.style_token === "PRICE_PRIMARY" ? 48 :
    layer.style_token === "WATERMARK_SUBTLE" ? 28 : 38;
  const opacity = layer.style_token === "WATERMARK_SUBTLE" ? 0.58 : 1;
  return { size, opacity };
}

function requireMedia(media: CreatorStudioResolvedMedia, ref: string) {
  const url = media[ref];
  if (!url) {
    throw new CreatorStudioProviderError(
      "MEDIA_RESOLUTION_FAILED",
      "One or more project assets could not be prepared for rendering.",
      { ref },
    );
  }
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new CreatorStudioProviderError(
      "MEDIA_URL_INVALID",
      "One or more project assets could not be prepared for rendering.",
      { ref, protocol: parsed.protocol },
    );
  }
  return url;
}

function clipFromLayer(
  layer: CreatorStudioRenderLayer,
  globalStartMs: number,
  media: CreatorStudioResolvedMedia,
  transitionKind: string,
) {
  const start = (globalStartMs + layer.start_ms) / 1000;
  const length = layer.duration_ms / 1000;
  const transition = transitionFor(transitionKind);

  if (layer.type === "TEXT") {
    const { size, opacity } = styleForText(layer);
    return {
      asset: {
        type: "html",
        html: `<p>${escapeHtml(layer.text)}</p>`,
        css: `p{font-family:Arial,sans-serif;font-size:${size}px;font-weight:700;line-height:1.15;color:#ffffff;text-align:${layer.align.toLowerCase()};margin:0;padding:20px;opacity:${opacity}}`,
        width: 900,
        height: 520,
        background: "transparent",
        position: "center",
      },
      start,
      length,
      position: positionFor(layer),
      ...(layer.position === "UPPER_CENTER" ? { offset: { y: -0.08 } } : {}),
      ...(layer.position === "LOWER_CENTER" ? { offset: { y: 0.08 } } : {}),
      ...(transition ? { transition: { in: transition } } : {}),
    };
  }

  if (layer.type === "IMAGE") {
    const effect = effectFor(layer);
    return {
      asset: { type: "image", src: requireMedia(media, layer.media_ref) },
      start,
      length,
      fit: layer.fit === "COVER" ? "crop" : "contain",
      position: positionFor(layer),
      ...(effect ? { effect } : {}),
      ...(transition ? { transition: { in: transition } } : {}),
    };
  }

  if (layer.type === "VIDEO") {
    return {
      asset: {
        type: "video",
        src: requireMedia(media, layer.media_ref),
        trim: layer.trim_start_ms / 1000,
        volume: layer.muted ? 0 : 1,
        transcode: true,
      },
      start,
      length,
      fit: layer.fit === "COVER" ? "crop" : "contain",
      position: positionFor(layer),
      ...(transition ? { transition: { in: transition } } : {}),
    };
  }

  return {
    asset: {
      type: "audio",
      src: requireMedia(media, layer.media_ref),
      trim: layer.trim_start_ms / 1000,
      volume: layer.volume,
    },
    start,
    length,
  };
}

export function translateRenderPlanToShotstack(
  plan: CreatorStudioRenderPlan,
  media: CreatorStudioResolvedMedia,
  callbackUrl: string,
) {
  const tracks: Array<{ clips: unknown[] }> = [];
  for (const scene of plan.scenes) {
    for (const layer of [...scene.layers].sort((a, b) => a.z_index - b.z_index)) {
      tracks.push({
        clips: [clipFromLayer(layer, scene.start_ms, media, scene.transition_in.kind)],
      });
    }
  }

  return {
    timeline: { background: "#0F1E35", tracks },
    output: {
      format: "mp4",
      size: { width: plan.output.width, height: plan.output.height },
      fps: plan.output.fps,
      quality: plan.output.quality === "PREVIEW" ? "low" : "high",
    },
    callback: callbackUrl,
  };
}

async function request(path: string, init: RequestInit) {
  const { apiKey, baseUrl } = providerConfig();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new CreatorStudioProviderError(
      "PROVIDER_UNREACHABLE",
      "The video service is temporarily unavailable. Your project is safe.",
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }

  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!response.ok) {
    throw new CreatorStudioProviderError(
      "PROVIDER_REQUEST_FAILED",
      "The video service could not accept this request. Your project is safe.",
      { status: response.status, providerBody: body ?? text.slice(0, 1000) },
    );
  }
  return body;
}

export class ShotstackCreatorStudioProvider implements CreatorStudioRenderProvider {
  readonly name = "SHOTSTACK" as const;

  async createRender(input: {
    plan: CreatorStudioRenderPlan;
    media: CreatorStudioResolvedMedia;
    callbackUrl: string;
  }) {
    const payload = translateRenderPlanToShotstack(input.plan, input.media, input.callbackUrl);
    const body = await request("/render", { method: "POST", body: JSON.stringify(payload) });
    const providerJobId = body?.response?.id;
    if (typeof providerJobId !== "string" || providerJobId.length < 8) {
      throw new CreatorStudioProviderError(
        "PROVIDER_RESPONSE_INVALID",
        "The video service returned an invalid response. Your project is safe.",
        { body },
      );
    }
    return { providerJobId, metadata: { success: body?.success === true } };
  }

  async getRenderStatus(providerJobId: string): Promise<CreatorStudioProviderStatus> {
    const body = await request(`/render/${encodeURIComponent(providerJobId)}?data=false`, { method: "GET" });
    const response = body?.response ?? {};
    const status = String(response.status ?? "").toLowerCase();
    const metadata: Record<string, unknown> = {
      providerStatus: status,
      billableSeconds: typeof response.billable === "number" ? response.billable : null,
      renderTimeSeconds: typeof response.renderTime === "number" ? response.renderTime : null,
    };

    if (["queued", "fetching", "preprocessing", "generating"].includes(status)) {
      return { state: "QUEUED", providerStatus: status, metadata };
    }
    if (["rendering", "saving"].includes(status)) {
      return { state: "RENDERING", providerStatus: status, metadata };
    }
    if (status === "done" && typeof response.url === "string") {
      return { state: "SUCCEEDED", providerStatus: status, outputUrl: response.url, metadata };
    }
    if (status === "failed") {
      return {
        state: "FAILED",
        providerStatus: status,
        safeErrorCode: "PROVIDER_RENDER_FAILED",
        safeErrorMessage: "The video could not be generated. Your project has been preserved.",
        metadata: { ...metadata, providerErrorPresent: !!response.error },
      };
    }
    throw new CreatorStudioProviderError(
      "PROVIDER_RESPONSE_INVALID",
      "The video service returned an unknown status. Your project is safe.",
      { providerStatus: status },
    );
  }
}

export function getCreatorStudioProvider() {
  return new ShotstackCreatorStudioProvider();
}
