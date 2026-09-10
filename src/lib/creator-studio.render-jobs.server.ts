import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildCreatorStudioRenderPlan } from "@/lib/creator-studio.template-engine";
import {
  CreatorStudioProviderError,
  type CreatorStudioResolvedMedia,
} from "@/lib/creator-studio.provider";
import { getCreatorStudioProvider } from "@/lib/creator-studio.shotstack.server";

const INPUT_BUCKET = "creator-studio-assets";
const OUTPUT_BUCKET = "creator-studio-output";
const INPUT_SIGNED_URL_SECONDS = 30 * 60;
const OUTPUT_SIGNED_URL_SECONDS = 10 * 60;

const renderRequestSchema = z.object({
  projectId: z.string().uuid(),
  idempotencyKey: z.string().min(16).max(128),
  quality: z.enum(["PREVIEW", "STANDARD"]).default("STANDARD"),
}).strict();
const renderJobIdSchema = z.object({ renderJobId: z.string().uuid() }).strict();

export type CreatorStudioRenderJob = {
  id: string;
  project_id: string;
  owner_user_id: string;
  provider: "SHOTSTACK";
  provider_job_id: string | null;
  template_version: string;
  quality: "PREVIEW" | "STANDARD";
  status: "QUEUED" | "SUBMITTED" | "RENDERING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  requested_duration_seconds: 15 | 30 | 45;
  estimated_cost_cents: number;
  actual_cost_cents: number | null;
  output_storage_path: string | null;
  error_code: string | null;
  safe_error_message: string | null;
  idempotency_key: string;
  attempt_count: number;
  started_at: string | null;
  completed_at: string | null;
  timeout_at: string | null;
  created_at: string;
  updated_at: string;
};

const JOB_COLS = "id,project_id,owner_user_id,provider,provider_job_id,template_version,quality,status,requested_duration_seconds,estimated_cost_cents,actual_cost_cents,output_storage_path,error_code,safe_error_message,idempotency_key,attempt_count,started_at,completed_at,timeout_at,created_at,updated_at";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return Array.from(data).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function trustedCallbackBase() {
  const raw = process.env.CREATOR_STUDIO_PUBLIC_BASE_URL;
  if (!raw) {
    throw new CreatorStudioProviderError(
      "CALLBACK_BASE_NOT_CONFIGURED",
      "Video callbacks are not configured for this environment.",
    );
  }
  const url = new URL(raw);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new CreatorStudioProviderError(
      "CALLBACK_BASE_INVALID",
      "Video callbacks are not configured for this environment.",
    );
  }
  return url.origin;
}

function trustedSourceMedia(urlString: unknown) {
  if (typeof urlString !== "string" || !urlString) return null;
  let parsed: URL;
  try { parsed = new URL(urlString); } catch { return null; }
  if (parsed.protocol !== "https:") return null;
  const allowed = new Set<string>();
  for (const value of [process.env.SUPABASE_URL, "https://www.aurumvault.store"]) {
    if (!value) continue;
    try { allowed.add(new URL(value).origin); } catch { /* ignore bad server config */ }
  }
  for (const value of (process.env.CREATOR_STUDIO_TRUSTED_MEDIA_ORIGINS ?? "").split(",")) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    try { allowed.add(new URL(trimmed).origin); } catch { /* ignore bad optional entry */ }
  }
  return allowed.has(parsed.origin) ? parsed.toString() : null;
}

async function loadPlannerInput(userSupabase: any, userId: string, projectId: string, quality: "PREVIEW" | "STANDARD") {
  const { data: project, error: projectError } = await userSupabase
    .from("creator_studio_projects" as never)
    .select("id,owner_user_id,source_product_id,project_type,status,duration_seconds,aspect_ratio,style_key,product_title,hook,cta,destination_url,price_cents,currency")
    .eq("id", projectId)
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (projectError || !project) throw new Error("Creator Studio project not found.");
  if ((project as any).status !== "READY") throw new Error("This project is not ready to generate a video.");

  const { data: links, error: linkError } = await userSupabase
    .from("creator_studio_project_assets" as never)
    .select("asset_id,sort_order")
    .eq("project_id", projectId)
    .eq("owner_user_id", userId)
    .order("sort_order", { ascending: true });
  if (linkError) throw new Error("Creator Studio assets are temporarily unavailable.");

  const ids = (links ?? []).map((row: any) => String(row.asset_id));
  const { data: assetRows, error: assetError } = ids.length
    ? await userSupabase
        .from("creator_studio_assets" as never)
        .select("id,category,state,mime_type,storage_path")
        .eq("owner_user_id", userId)
        .eq("state", "READY")
        .in("id", ids)
    : { data: [], error: null };
  if (assetError) throw new Error("Creator Studio assets are temporarily unavailable.");

  const order = new Map((links ?? []).map((row: any) => [String(row.asset_id), Number(row.sort_order)]));
  const assets = (assetRows ?? []).map((row: any) => ({
    id: String(row.id),
    category: row.category,
    state: "READY" as const,
    mime_type: row.mime_type,
    sort_order: order.get(String(row.id)) ?? 0,
    storage_path: String(row.storage_path),
  }));

  let sourceCover: string | null = null;
  let sourcePreviews: string[] = [];
  if ((project as any).source_product_id) {
    const { data: source } = await userSupabase
      .from("marketplace_products")
      .select("id,cover_url")
      .eq("id", (project as any).source_product_id)
      .eq("seller_id", userId)
      .maybeSingle();
    sourceCover = trustedSourceMedia(source?.cover_url);
    const { data: previews } = await userSupabase
      .from("product_previews")
      .select("image_url,page_order")
      .eq("product_id", (project as any).source_product_id)
      .order("page_order", { ascending: true })
      .limit(8);
    sourcePreviews = (previews ?? []).map((row: any) => trustedSourceMedia(row.image_url)).filter(Boolean) as string[];
  }

  return { project: project as any, assets, sourceCover, sourcePreviews, quality };
}

async function buildPlanAndMedia(userSupabase: any, userId: string, projectId: string, quality: "PREVIEW" | "STANDARD") {
  const loaded = await loadPlannerInput(userSupabase, userId, projectId, quality);
  const plan = buildCreatorStudioRenderPlan({
    project: loaded.project,
    assets: loaded.assets.map(({ storage_path: _storagePath, ...asset }) => asset),
    source_product_media: {
      has_cover: !!loaded.sourceCover,
      preview_count: loaded.sourcePreviews.length,
    },
    quality,
  });

  const admin = await adminClient();
  const media: CreatorStudioResolvedMedia = {};
  for (const asset of loaded.assets) {
    const signed = await admin.storage.from(INPUT_BUCKET).createSignedUrl(asset.storage_path, INPUT_SIGNED_URL_SECONDS);
    if (signed.error || !signed.data?.signedUrl) throw new Error("A private project asset could not be prepared.");
    media[`asset:${asset.id}`] = signed.data.signedUrl;
  }
  if (loaded.sourceCover) media["source:cover"] = loaded.sourceCover;
  loaded.sourcePreviews.forEach((url, index) => { media[`source:preview:${index}`] = url; });
  return { plan, media };
}

function safeReserveError(message: string | undefined) {
  if (message?.includes("creator_studio_rendering_disabled")) return "Video generation is temporarily disabled.";
  if (message?.includes("creator_studio_provider_circuit_open")) return "Video generation is temporarily paused while the provider recovers.";
  if (message?.includes("creator_studio_render_concurrency_limit")) return "Finish the current video before starting another one.";
  if (message?.includes("creator_studio_project_not_ready")) return "This project is not ready to generate a video.";
  return "Creator Studio could not reserve this video request.";
}

async function getAdminJob(jobId: string): Promise<CreatorStudioRenderJob | null> {
  const admin = await adminClient();
  const { data } = await admin.from("creator_studio_render_jobs").select(JOB_COLS).eq("id", jobId).maybeSingle();
  return (data ?? null) as CreatorStudioRenderJob | null;
}

function safeProviderOutputUrl(urlString: string) {
  const url = new URL(urlString);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !(host === "cdn.shotstack.io" || host.endsWith(".shotstack.io") || host.endsWith(".amazonaws.com"))) {
    throw new CreatorStudioProviderError(
      "PROVIDER_OUTPUT_URL_INVALID",
      "The generated video could not be secured for download.",
      { host },
    );
  }
  return url.toString();
}

async function readWithLimit(response: Response, maxBytes: number) {
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) throw new Error("output_too_large");
  if (!response.body) throw new Error("output_body_missing");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("output_too_large");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return merged;
}

async function ingestProviderOutput(job: CreatorStudioRenderJob, providerUrl: string) {
  const admin = await adminClient();
  const { data: control } = await admin.from("creator_studio_runtime_control")
    .select("max_output_bytes").eq("singleton", true).single();
  const maxBytes = Number(control?.max_output_bytes ?? 262_144_000);
  const source = safeProviderOutputUrl(providerUrl);
  const response = await fetch(source, { signal: AbortSignal.timeout(120_000), redirect: "follow" });
  if (!response.ok) throw new Error(`output_download_${response.status}`);
  safeProviderOutputUrl(response.url);
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (contentType && !contentType.includes("video/mp4") && !contentType.includes("application/octet-stream")) {
    throw new Error("output_content_type_invalid");
  }
  const bytes = await readWithLimit(response, maxBytes);
  const path = `${job.owner_user_id}/${job.id}.mp4`;
  const uploaded = await admin.storage.from(OUTPUT_BUCKET).upload(path, bytes, {
    contentType: "video/mp4",
    cacheControl: "3600",
    upsert: false,
  });
  if (uploaded.error && !String(uploaded.error.message).toLowerCase().includes("already exists")) {
    throw uploaded.error;
  }
  return path;
}

export async function reconcileCreatorStudioRenderJobInternal(renderJobId: string, ownerUserId?: string) {
  const job = await getAdminJob(renderJobId);
  if (!job || (ownerUserId && job.owner_user_id !== ownerUserId)) throw new Error("Creator Studio video not found.");
  if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(job.status)) return job;
  if (!job.provider_job_id) return job;

  const provider = getCreatorStudioProvider();
  let status;
  try {
    status = await provider.getRenderStatus(job.provider_job_id);
  } catch (error) {
    if (job.timeout_at && Date.parse(job.timeout_at) <= Date.now()) {
      const admin = await adminClient();
      await admin.rpc("creator_studio_server_apply_provider_status", {
        _render_job_id: job.id,
        _job_status: "FAILED",
        _provider_status: "timeout",
        _error_code: "PROVIDER_TIMEOUT",
        _safe_error_message: "The video service did not finish in time. Your project has been preserved.",
        _provider_metadata: {},
      });
      return (await getAdminJob(job.id))!;
    }
    throw error;
  }

  const admin = await adminClient();
  if (status.state === "QUEUED") {
    await admin.from("creator_studio_provider_state").update({
      provider_status: status.providerStatus,
      provider_metadata: status.metadata,
      last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("render_job_id", job.id);
    return (await getAdminJob(job.id))!;
  }

  if (status.state === "RENDERING") {
    await admin.rpc("creator_studio_server_apply_provider_status", {
      _render_job_id: job.id,
      _job_status: "RENDERING",
      _provider_status: status.providerStatus,
      _provider_metadata: status.metadata,
    });
    return (await getAdminJob(job.id))!;
  }

  if (status.state === "FAILED") {
    await admin.rpc("creator_studio_server_apply_provider_status", {
      _render_job_id: job.id,
      _job_status: "FAILED",
      _provider_status: status.providerStatus,
      _error_code: status.safeErrorCode,
      _safe_error_message: status.safeErrorMessage,
      _provider_metadata: status.metadata,
    });
    return (await getAdminJob(job.id))!;
  }

  try {
    const outputPath = await ingestProviderOutput(job, status.outputUrl);
    await admin.rpc("creator_studio_server_apply_provider_status", {
      _render_job_id: job.id,
      _job_status: "SUCCEEDED",
      _provider_status: status.providerStatus,
      _provider_output_url: status.outputUrl,
      _output_storage_path: outputPath,
      _provider_metadata: status.metadata,
    });
  } catch (error) {
    await admin.rpc("creator_studio_server_apply_provider_status", {
      _render_job_id: job.id,
      _job_status: "FAILED",
      _provider_status: status.providerStatus,
      _provider_output_url: status.outputUrl,
      _error_code: "OUTPUT_INGEST_FAILED",
      _safe_error_message: "The generated video could not be secured for download. Your project has been preserved.",
      _provider_metadata: { ...status.metadata, ingestError: error instanceof Error ? error.message : String(error) },
    });
  }
  return (await getAdminJob(job.id))!;
}

export async function reconcileCreatorStudioRenderFromCallback(renderJobId: string, callbackToken: string) {
  const admin = await adminClient();
  const { data: state } = await admin.from("creator_studio_provider_state")
    .select("callback_secret_hash").eq("render_job_id", renderJobId).maybeSingle();
  if (!state?.callback_secret_hash) return { accepted: false as const, status: 404 };
  const presented = await sha256Hex(callbackToken);
  if (!constantTimeEqual(presented, String(state.callback_secret_hash))) {
    return { accepted: false as const, status: 401 };
  }
  await reconcileCreatorStudioRenderJobInternal(renderJobId);
  return { accepted: true as const, status: 200 };
}

export const requestCreatorStudioRender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => renderRequestSchema.parse(input))
  .handler(async ({ data, context }): Promise<CreatorStudioRenderJob> => {
    const { plan, media } = await buildPlanAndMedia(context.supabase, context.userId, data.projectId, data.quality);
    const admin = await adminClient();
    const reserved = await admin.rpc("creator_studio_server_reserve_render_job", {
      _actor_user_id: context.userId,
      _project_id: data.projectId,
      _idempotency_key: data.idempotencyKey,
      _quality: data.quality,
      _template_version: plan.template.version,
    });
    if (reserved.error || !reserved.data) throw new Error(safeReserveError(reserved.error?.message));
    const jobId = String(reserved.data);
    const existing = await getAdminJob(jobId);
    if (!existing) throw new Error("Creator Studio could not load the reserved video request.");
    if (existing.status !== "QUEUED") return existing;

    const callbackToken = randomHex(32);
    const callbackHash = await sha256Hex(callbackToken);
    const claim = await admin.rpc("creator_studio_server_claim_render_submission", {
      _render_job_id: jobId,
      _callback_secret_hash: callbackHash,
    });
    if (claim.error) throw new Error("Creator Studio could not safely claim this video request.");
    if (claim.data !== true) return (await getAdminJob(jobId))!;

    const callbackUrl = `${trustedCallbackBase()}/api/public/creator-studio/shotstack-callback/${jobId}/${callbackToken}`;
    try {
      const provider = getCreatorStudioProvider();
      const created = await provider.createRender({ plan, media, callbackUrl });
      const submitted = await admin.rpc("creator_studio_server_mark_render_submitted", {
        _render_job_id: jobId,
        _provider_job_id: created.providerJobId,
        _callback_secret_hash: callbackHash,
      });
      if (submitted.error || submitted.data !== true) {
        console.error("[creator-studio] provider accepted render but persistence failed", {
          renderJobId: jobId,
          providerJobId: created.providerJobId,
        });
        throw new Error("Video request persistence failed after provider submission.");
      }
    } catch (error) {
      const providerError = error instanceof CreatorStudioProviderError ? error : null;
      await admin.rpc("creator_studio_server_mark_submission_failed", {
        _render_job_id: jobId,
        _error_code: providerError?.safeCode ?? "PROVIDER_SUBMISSION_FAILED",
        _safe_error_message: providerError?.safeMessage ?? "The video service could not start this video. Your project is safe.",
      });
    }
    return (await getAdminJob(jobId))!;
  });

export const getCreatorStudioRenderJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => renderJobIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<CreatorStudioRenderJob> => {
    return reconcileCreatorStudioRenderJobInternal(data.renderJobId, context.userId);
  });

export const listCreatorStudioRenderJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorStudioRenderJob[]> => {
    const { data, error } = await (context.supabase as any).from("creator_studio_render_jobs")
      .select(JOB_COLS).eq("owner_user_id", context.userId).order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error("Creator Studio videos are temporarily unavailable.");
    return (data ?? []) as CreatorStudioRenderJob[];
  });

export const getCreatorStudioRenderDownloadUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => renderJobIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const job = await getAdminJob(data.renderJobId);
    if (!job || job.owner_user_id !== context.userId || job.status !== "SUCCEEDED" || !job.output_storage_path) {
      throw new Error("That finished video is not available.");
    }
    const admin = await adminClient();
    const signed = await admin.storage.from(OUTPUT_BUCKET).createSignedUrl(job.output_storage_path, OUTPUT_SIGNED_URL_SECONDS, {
      download: `${job.id}.mp4`,
    });
    if (signed.error || !signed.data?.signedUrl) throw new Error("Creator Studio could not prepare this download.");
    return { url: signed.data.signedUrl };
  });

export const cancelCreatorStudioRender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => renderJobIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<CreatorStudioRenderJob> => {
    const admin = await adminClient();
    const cancelled = await admin.rpc("creator_studio_server_cancel_render", {
      _actor_user_id: context.userId,
      _render_job_id: data.renderJobId,
    });
    if (cancelled.error || cancelled.data !== true) throw new Error("That video could not be cancelled.");
    return (await getAdminJob(data.renderJobId))!;
  });
