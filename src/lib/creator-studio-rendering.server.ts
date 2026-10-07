import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { planCreatorStudioVideo } from "./creator-studio-template-engine";
import {
  getShotstackRender,
  shotstackEnvironmentForDiagnostics,
  submitShotstackRender,
} from "./creator-studio-shotstack.server";
import type { CreatorStudioRenderPlan } from "./creator-studio.schema";

const ProviderStatusSchema = z.enum([
  "queued",
  "fetching",
  "preprocessing",
  "rendering",
  "saving",
  "done",
  "failed",
]);

export type CreatorStudioJobStatus =
  | "RESERVED"
  | "QUEUED"
  | "FETCHING"
  | "PREPROCESSING"
  | "RENDERING"
  | "SAVING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Creator Studio service database is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function callbackUrl() {
  const app = process.env.CREATOR_STUDIO_APP_URL;
  const secret = process.env.CREATOR_STUDIO_SHOTSTACK_CALLBACK_SECRET;
  if (!app || !secret) throw new Error("Creator Studio provider callback is not configured");
  const url = new URL("/api/creator-studio-shotstack-callback", z.string().url().parse(app));
  url.searchParams.set("token", secret);
  return url.toString();
}

export function callbackTokenMatches(token: string | null) {
  const expected = process.env.CREATOR_STUDIO_SHOTSTACK_CALLBACK_SECRET;
  if (!expected || !token || token.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) mismatch |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return mismatch === 0;
}

export function mapShotstackStatus(status: string): CreatorStudioJobStatus {
  const parsed = ProviderStatusSchema.parse(status);
  if (parsed === "done") return "COMPLETED";
  if (parsed === "failed") return "FAILED";
  return parsed.toUpperCase() as CreatorStudioJobStatus;
}

export function estimateCreatorStudioRenderCost(durationSeconds: 15 | 30 | 45) {
  const perMinute = Number(process.env.CREATOR_STUDIO_ESTIMATED_RENDER_COST_PER_MINUTE_USD ?? "0.30");
  if (!Number.isFinite(perMinute) || perMinute < 0) return 0;
  return Number(((durationSeconds / 60) * perMinute).toFixed(4));
}

export function buildShotstackEdit(
  plan: CreatorStudioRenderPlan,
  assetUrls: Record<string, string>,
  callback?: string,
) {
  const clips = plan.scenes.map((scene) => {
    const src = scene.assetId ? assetUrls[scene.assetId] : undefined;
    const base = {
      start: Number(scene.startSeconds.toFixed(3)),
      length: Number(scene.durationSeconds.toFixed(3)),
      transition: { in: "fade", out: "fade" },
    };
    if (src) {
      return {
        asset: { type: "image", src },
        fit: "crop",
        ...base,
      };
    }
    return {
      asset: {
        type: "html",
        html: `<div style="font-family:Arial,sans-serif;font-size:56px;color:#fff;text-align:center;padding:80px">${escapeHtml(scene.headline ?? "AurumVault")}</div>`,
        width: 1080,
        height: 1920,
        background: "transparent",
      },
      ...base,
    };
  });

  return {
    timeline: {
      background: "#0F1E35",
      tracks: [{ clips }],
    },
    output: {
      format: "mp4",
      resolution: "1080",
      aspectRatio: "9:16",
      fps: 30,
    },
    ...(callback ? { callback } : {}),
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function signedAssetUrls(ownerUserId: string, projectId: string) {
  const db = serviceClient();
  const { data: assets, error } = await db
    .from("creator_studio_assets")
    .select("id,storage_path")
    .eq("owner_user_id", ownerUserId)
    .eq("project_id", projectId);
  if (error) throw new Error("Couldn't load Creator Studio assets");

  const urls: Record<string, string> = {};
  for (const asset of assets ?? []) {
    const { data, error: signError } = await db.storage
      .from("creator-studio-assets")
      .createSignedUrl(asset.storage_path, 3600);
    if (signError || !data?.signedUrl) throw new Error("Couldn't prepare secure render asset");
    urls[asset.id] = data.signedUrl;
  }
  return urls;
}

export async function submitCreatorStudioRender(params: {
  ownerUserId: string;
  projectId: string;
  idempotencyKey: string;
}) {
  const db = serviceClient();
  const { data: project, error: projectError } = await db
    .from("creator_studio_projects")
    .select("id,goal,duration_seconds,style_key,product_title,call_to_action,destination_url,price_label,archived_at")
    .eq("id", params.projectId)
    .eq("owner_user_id", params.ownerUserId)
    .maybeSingle();
  if (projectError || !project || project.archived_at) throw new Error("Creator Studio project not found");

  const urls = await signedAssetUrls(params.ownerUserId, params.projectId);
  const { data: assets } = await db
    .from("creator_studio_assets")
    .select("id,kind,mime_type")
    .eq("owner_user_id", params.ownerUserId)
    .eq("project_id", params.projectId)
    .order("sort_order");
  if (!assets?.length) throw new Error("Add at least one product image before rendering");

  const brief = {
    goal: project.goal,
    style: project.style_key,
    durationSeconds: project.duration_seconds,
    productTitle: project.product_title || "AurumVault Product",
    callToAction: project.call_to_action || "Learn more",
    destinationUrl: project.destination_url || undefined,
    priceLabel: project.price_label || undefined,
    assets: assets.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      mimeType: asset.mime_type,
      signedUrl: urls[asset.id],
    })),
  };
  const plan = planCreatorStudioVideo(brief);

  const { data: reservation, error: reservationError } = await db.rpc("creator_studio_reserve_render", {
    p_owner_user_id: params.ownerUserId,
    p_project_id: params.projectId,
    p_idempotency_key: params.idempotencyKey,
    p_template_key: plan.templateKey,
    p_template_revision: plan.templateRevision,
    p_duration_seconds: plan.durationSeconds,
    p_provider_environment: shotstackEnvironmentForDiagnostics(),
    p_estimated_cost_usd: estimateCreatorStudioRenderCost(plan.durationSeconds),
  });
  if (reservationError || !reservation) throw new Error("Creator Studio allowance is unavailable");

  const reservationRow = Array.isArray(reservation) ? reservation[0] : reservation;
  if (!reservationRow?.allowed) throw new Error(reservationRow?.reason || "Monthly video allowance exhausted");
  const jobId = reservationRow.render_job_id as string;
  if (reservationRow.existing_provider_render_id) {
    return { jobId, providerRenderId: reservationRow.existing_provider_render_id as string, reused: true };
  }

  try {
    const provider = await submitShotstackRender(buildShotstackEdit(plan, urls, callbackUrl()));
    const { error: updateError } = await db
      .from("creator_studio_render_jobs")
      .update({
        provider_render_id: provider.id,
        status: "QUEUED",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("owner_user_id", params.ownerUserId);
    if (updateError) throw new Error("Couldn't persist Creator Studio render submission");
    await db.from("creator_studio_projects").update({ status: "RENDERING", updated_at: new Date().toISOString() }).eq("id", params.projectId).eq("owner_user_id", params.ownerUserId);
    return { jobId, providerRenderId: provider.id, reused: false };
  } catch (error) {
    await db.rpc("creator_studio_release_render", { p_render_job_id: jobId, p_owner_user_id: params.ownerUserId });
    throw error;
  }
}

export async function refreshCreatorStudioRender(params: {
  ownerUserId: string;
  jobId?: string;
  providerRenderId?: string;
}) {
  const db = serviceClient();
  let query = db
    .from("creator_studio_render_jobs")
    .select("id,owner_user_id,project_id,provider_render_id,status")
    .eq("owner_user_id", params.ownerUserId);
  query = params.jobId ? query.eq("id", params.jobId) : query.eq("provider_render_id", params.providerRenderId!);
  const { data: job, error } = await query.maybeSingle();
  if (error || !job?.provider_render_id) throw new Error("Creator Studio render job not found");

  const provider = await getShotstackRender(job.provider_render_id);
  const status = mapShotstackStatus(provider.status);
  const patch: Record<string, unknown> = { status };
  if (status === "COMPLETED") {
    patch.output_url = provider.url ?? null;
    patch.completed_at = new Date().toISOString();
  }
  if (status === "FAILED") {
    patch.provider_error_code = provider.error ? "PROVIDER_FAILED" : "PROVIDER_FAILED_UNSPECIFIED";
    patch.failed_at = new Date().toISOString();
  }
  const { error: updateError } = await db.from("creator_studio_render_jobs").update(patch).eq("id", job.id);
  if (updateError) throw new Error("Couldn't update Creator Studio render status");

  if (status === "COMPLETED") {
    await db.rpc("creator_studio_settle_render", { p_render_job_id: job.id, p_owner_user_id: params.ownerUserId });
    await db.from("creator_studio_projects").update({ status: "COMPLETED", updated_at: new Date().toISOString() }).eq("id", job.project_id);
  } else if (status === "FAILED") {
    await db.rpc("creator_studio_release_render", { p_render_job_id: job.id, p_owner_user_id: params.ownerUserId });
    await db.from("creator_studio_projects").update({ status: "FAILED", updated_at: new Date().toISOString() }).eq("id", job.project_id);
  }

  return { jobId: job.id, status, outputUrl: provider.url ?? null };
}
