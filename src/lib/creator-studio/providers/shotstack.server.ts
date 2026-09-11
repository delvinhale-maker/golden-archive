import type {
  CreatorVideoComposition,
  CompositionScene,
  MotionPreset,
  Transition,
} from "../composition.schema";

/**
 * Server-only Shotstack adapter. This is the ONLY file in the codebase that
 * knows Shotstack's JSON shape or talks to its API -- the composition model
 * (composition.schema.ts), the scene planner, and every route/server
 * function upstream of this file are entirely provider-neutral. Swapping
 * providers later means rewriting this one file, not the render pipeline.
 *
 * SHOTSTACK_API_KEY, SHOTSTACK_WEBHOOK_SECRET are read here and nowhere
 * else server-side; they are never sent to the client and are never
 * VITE_-prefixed. No Shotstack SDK is used -- direct typed fetch calls
 * against their REST API are simpler to audit and keep this adapter's
 * surface area small (per the CS3 instruction not to add an SDK unless it
 * materially improves reliability).
 *
 * On webhook authenticity: Shotstack's render-complete callback is a plain
 * HTTPS POST with no built-in request signing (unlike Stripe's HMAC
 * webhooks) as of this adapter's implementation. The strongest available
 * mechanism is therefore：
 *   1. A per-render, unguessable callback token embedded in the callback
 *      URL we hand Shotstack at submission time (see buildCallbackUrl) --
 *      an attacker who cannot read our render_jobs table cannot forge it.
 *   2. Ownership is NEVER read from the webhook payload -- the render job
 *      row is looked up strictly by our own stored provider_job_id (see
 *      the webhook route), so a payload claiming a different owner/job is
 *      structurally impossible to act on.
 *   3. SHOTSTACK_WEBHOOK_SECRET is an additional static, app-wide shared
 *      value compared against a header we ask the operator to configure in
 *      Shotstack's dashboard (if/when their workflow supports a custom
 *      header) -- defense-in-depth on top of (1)/(2), not a replacement.
 */

export type ShotstackEnv = "sandbox" | "production";

/** Every provider call is bounded -- a hung Shotstack request must never hang the submitting server function indefinitely. */
const PROVIDER_TIMEOUT_MS = 30_000;

const BASE_URL_BY_ENV: Record<ShotstackEnv, string> = {
  sandbox: "https://api.shotstack.io/edit/stage",
  production: "https://api.shotstack.io/edit/v1",
};

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
}

export function getShotstackApiKey(env: ShotstackEnv): string {
  return env === "sandbox"
    ? getEnv("SHOTSTACK_SANDBOX_API_KEY")
    : getEnv("SHOTSTACK_PRODUCTION_API_KEY");
}

export function getShotstackWebhookSecret(): string {
  return getEnv("SHOTSTACK_WEBHOOK_SECRET");
}

// ---------------------------------------------------------------------------
// Pure JSON builder -- unit-testable with no network access. Takes a map of
// scene id -> already-resolved, short-lived signed source URL (minted by the
// caller via Supabase Storage) rather than resolving storage paths itself.
// ---------------------------------------------------------------------------

const MOTION_TO_SHOTSTACK_EFFECT: Record<MotionPreset, string | undefined> = {
  STATIC: undefined,
  KEN_BURNS_IN: "zoomIn",
  KEN_BURNS_OUT: "zoomOut",
  PAN_LEFT: "slideLeft",
  PAN_RIGHT: "slideRight",
};

const TRANSITION_TO_SHOTSTACK: Record<Transition, { in?: string; out?: string } | undefined> = {
  CUT: undefined,
  FADE: { in: "fade", out: "fade" },
  SLIDE: { in: "slideRight", out: "slideLeft" },
};

export type ShotstackEditRequest = Record<string, unknown>;

export function buildShotstackEditRequest(
  composition: CreatorVideoComposition,
  sourceUrlsBySceneId: Record<string, string>,
  callbackUrl: string,
): ShotstackEditRequest {
  const imageClips = composition.scenes.map((scene: CompositionScene) => {
    const src = scene.assetRef ? sourceUrlsBySceneId[scene.id] : undefined;
    const clip: Record<string, unknown> = {
      asset: src
        ? { type: "image", src }
        : {
            type: "html",
            html: "<div></div>",
            width: composition.width,
            height: composition.height,
          },
      start: scene.start,
      length: scene.duration,
      fit: "cover",
    };
    const effect = MOTION_TO_SHOTSTACK_EFFECT[scene.motionPreset as MotionPreset];
    if (effect) clip.effect = effect;
    const transition = TRANSITION_TO_SHOTSTACK[scene.transition as Transition];
    if (transition) clip.transition = transition;
    return clip;
  });

  const titleClips = composition.scenes
    .filter((scene: CompositionScene) => scene.text.headline)
    .map((scene: CompositionScene) => ({
      asset: {
        type: "title",
        text: scene.text.headline,
        style: scene.textStyle.weight === "BOLD" ? "blockbuster" : "minimal",
        size: scene.textStyle.size.toLowerCase(),
        position: "center",
      },
      start: scene.start,
      length: scene.duration,
    }));

  const tracks: Record<string, unknown>[] = [{ clips: imageClips }];
  if (titleClips.length > 0) tracks.unshift({ clips: titleClips });

  return {
    timeline: {
      background: "#0F1E35",
      ...(composition.audio
        ? {
            soundtrack: {
              src: `shotstack-library://${composition.audio.track.toLowerCase()}`,
              effect: "fadeInFadeOut",
              volume: composition.audio.volume,
            },
          }
        : {}),
      tracks,
    },
    output: {
      format: "mp4",
      size: { width: composition.width, height: composition.height },
      fps: composition.fps,
    },
    callback: callbackUrl,
  };
}

// ---------------------------------------------------------------------------
// Network calls -- never invoked without live sandbox credentials configured.
// ---------------------------------------------------------------------------

export type SubmitRenderResult = { providerJobId: string };

export async function submitRender(
  composition: CreatorVideoComposition,
  sourceUrlsBySceneId: Record<string, string>,
  callbackUrl: string,
  env: ShotstackEnv,
): Promise<SubmitRenderResult> {
  const body = buildShotstackEditRequest(composition, sourceUrlsBySceneId, callbackUrl);
  const res = await fetch(`${BASE_URL_BY_ENV[env]}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": getShotstackApiKey(env) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ShotstackApiError(res.status, text);
  }
  const json = (await res.json()) as { response?: { id?: string } };
  const providerJobId = json.response?.id;
  if (!providerJobId) throw new ShotstackApiError(502, "Missing render id in Shotstack response");
  return { providerJobId };
}

export type ProviderRenderStatus =
  | "QUEUED"
  | "SUBMITTED"
  | "RENDERING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

const SHOTSTACK_STATUS_MAP: Record<string, ProviderRenderStatus> = {
  queued: "QUEUED",
  fetching: "SUBMITTED",
  rendering: "RENDERING",
  saving: "RENDERING",
  done: "SUCCEEDED",
  failed: "FAILED",
};

export function mapShotstackStatus(rawStatus: string): ProviderRenderStatus {
  return SHOTSTACK_STATUS_MAP[rawStatus.toLowerCase()] ?? "RENDERING";
}

export type GetRenderStatusResult = {
  status: ProviderRenderStatus;
  outputUrl: string | null;
  thumbnailUrl: string | null;
  rawStatus: string;
  errorCode: string | null;
  safeErrorMessage: string | null;
};

export async function getRenderStatus(
  providerJobId: string,
  env: ShotstackEnv,
): Promise<GetRenderStatusResult> {
  const res = await fetch(`${BASE_URL_BY_ENV[env]}/render/${providerJobId}`, {
    headers: { "x-api-key": getShotstackApiKey(env) },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ShotstackApiError(res.status, text);
  }
  const json = (await res.json()) as {
    response?: { status?: string; url?: string; poster?: string; error?: string };
  };
  const rawStatus = json.response?.status ?? "unknown";
  const status = mapShotstackStatus(rawStatus);
  const failure =
    status === "FAILED" ? normalizeProviderError(json.response?.error ?? "render_failed") : null;
  return {
    status,
    outputUrl: json.response?.url ?? null,
    thumbnailUrl: json.response?.poster ?? null,
    rawStatus,
    errorCode: failure?.errorCode ?? null,
    safeErrorMessage: failure?.safeErrorMessage ?? null,
  };
}

export class ShotstackApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly rawBody: string,
  ) {
    super(`Shotstack API error (${statusCode})`);
    this.name = "ShotstackApiError";
  }
}

/**
 * Maps ANY adapter failure (HTTP error, timeout, malformed response, or a
 * raw provider error string) to a stable internal error_code plus a
 * customer-safe message. Never returns provider JSON, stack traces, API
 * keys, or internal URLs -- this is what every caller stores in
 * render_jobs.error_code / safe_error_message.
 */
export function normalizeProviderError(err: unknown): {
  errorCode: string;
  safeErrorMessage: string;
} {
  const SAFE_MESSAGE = "We couldn't finish this video. Your video credit was not consumed.";

  if (err instanceof ShotstackApiError) {
    if (err.statusCode === 401 || err.statusCode === 403) {
      return { errorCode: "provider_auth_failed", safeErrorMessage: SAFE_MESSAGE };
    }
    if (err.statusCode === 400 || err.statusCode === 422) {
      return { errorCode: "provider_rejected_composition", safeErrorMessage: SAFE_MESSAGE };
    }
    if (err.statusCode === 429) {
      return { errorCode: "provider_rate_limited", safeErrorMessage: SAFE_MESSAGE };
    }
    if (err.statusCode >= 500) {
      return { errorCode: "provider_unavailable", safeErrorMessage: SAFE_MESSAGE };
    }
    return { errorCode: "provider_error", safeErrorMessage: SAFE_MESSAGE };
  }
  if (err instanceof Error && err.name === "AbortError") {
    return { errorCode: "provider_timeout", safeErrorMessage: SAFE_MESSAGE };
  }
  if (typeof err === "string") {
    return { errorCode: "provider_reported_failure", safeErrorMessage: SAFE_MESSAGE };
  }
  return { errorCode: "provider_unknown_error", safeErrorMessage: SAFE_MESSAGE };
}
