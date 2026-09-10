import type { CreatorStudioRenderPlan } from "@/lib/creator-studio-render.schema";

export type ShotstackEnvironment = "stage" | "v1";
export type ShotstackStatus = "queued" | "fetching" | "preprocessing" | "rendering" | "saving" | "done" | "failed";

type AssetUrls = { cover?: string; screenshots?: string[]; logo?: string };

function config() {
  const apiKey = process.env.SHOTSTACK_API_KEY;
  const environment: ShotstackEnvironment = process.env.SHOTSTACK_ENV === "v1" ? "v1" : "stage";
  if (!apiKey) throw new Error("Creator Studio render provider is not configured");
  return { apiKey, environment, baseUrl: `https://api.shotstack.io/edit/${environment}` };
}

function textClip(text: string, start: number, length: number) {
  return {
    asset: {
      type: "rich-text",
      text,
      font: { size: 64, color: "#F8F3E8" },
      align: { horizontal: "center", vertical: "middle" },
    },
    start,
    length,
  };
}

function imageClip(src: string, start: number, length: number) {
  return { asset: { type: "image", src }, start, length, fit: "contain", effect: "zoomIn", transition: { in: "fade", out: "fade" } };
}

export function buildShotstackEdit(plan: CreatorStudioRenderPlan, assets: AssetUrls, callback?: string) {
  const clips = plan.scenes.map((scene) => {
    if (scene.kind === "PRODUCT_HERO" && assets.cover) return imageClip(assets.cover, scene.startSeconds, scene.durationSeconds);
    if (scene.kind === "SCREENSHOTS" && assets.screenshots?.length) return imageClip(assets.screenshots[0], scene.startSeconds, scene.durationSeconds);
    if (scene.kind === "CTA" && assets.logo) return imageClip(assets.logo, scene.startSeconds, scene.durationSeconds);
    return textClip(scene.headline ?? scene.body ?? "AurumVault Creator Studio", scene.startSeconds, scene.durationSeconds);
  });

  return {
    timeline: { background: "#0F1E35", tracks: [{ clips }] },
    output: { format: "mp4", size: { width: 1080, height: 1920 } },
    ...(callback ? { callback } : {}),
  };
}

async function providerFetch(path: string, init?: RequestInit) {
  const { apiKey, baseUrl } = config();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", "x-api-key": apiKey, ...(init?.headers ?? {}) },
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`SHOTSTACK_HTTP_${response.status}`);
  return json;
}

export async function submitShotstackRender(edit: unknown): Promise<{ id: string; environment: ShotstackEnvironment }> {
  const { environment } = config();
  const json = await providerFetch("/render", { method: "POST", body: JSON.stringify(edit) });
  const id = json?.response?.id;
  if (typeof id !== "string" || !id) throw new Error("SHOTSTACK_MALFORMED_RESPONSE");
  return { id, environment };
}

export async function getShotstackRender(renderId: string): Promise<{ id: string; status: ShotstackStatus; url?: string; error?: string }> {
  const json = await providerFetch(`/render/${encodeURIComponent(renderId)}`);
  const response = json?.response;
  if (!response || typeof response.status !== "string") throw new Error("SHOTSTACK_MALFORMED_RESPONSE");
  return { id: response.id ?? renderId, status: response.status, url: typeof response.url === "string" ? response.url : undefined, error: typeof response.error === "string" ? response.error : undefined };
}

export function getShotstackEnvironment(): ShotstackEnvironment {
  return config().environment;
}
