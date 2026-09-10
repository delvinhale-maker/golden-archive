import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getSignedCreatorStudioAssets } from "@/lib/creator-studio-assets.server";
import { planCreatorStudioScenes } from "@/lib/creator-studio-scene-planner";
import { buildShotstackEdit, getShotstackEnvironment, getShotstackRender, submitShotstackRender, type ShotstackStatus } from "@/lib/creator-studio-shotstack.server";
import type { CreatorStudioGoal, CreatorStudioStyle } from "@/lib/creator-studio.schema";

export type CreatorStudioRenderJob = {
  id: string;
  owner_user_id: string;
  project_id: string;
  idempotency_key: string;
  provider: "SHOTSTACK";
  provider_environment: "stage" | "v1";
  provider_render_id: string | null;
  status: "DRAFT" | "QUEUED" | "FETCHING" | "PREPROCESSING" | "RENDERING" | "SAVING" | "COMPLETED" | "FAILED" | "CANCELLED";
  output_url: string | null;
  failure_code: string | null;
  estimated_cost_cents: number;
  actual_cost_cents: number | null;
  created_at: string;
  updated_at: string;
};

const JOB_COLS = "id,owner_user_id,project_id,idempotency_key,provider,provider_environment,provider_render_id,status,output_url,failure_code,estimated_cost_cents,actual_cost_cents,created_at,updated_at";

function estimateCostCents(durationSeconds: number) {
  const perMinute = Number(process.env.CREATOR_STUDIO_ESTIMATED_RENDER_COST_CENTS_PER_MINUTE ?? "30");
  const safePerMinute = Number.isFinite(perMinute) && perMinute >= 0 ? perMinute : 30;
  return Math.max(1, Math.ceil((durationSeconds / 60) * safePerMinute));
}

function mapStatus(status: ShotstackStatus): CreatorStudioRenderJob["status"] {
  const map: Record<ShotstackStatus, CreatorStudioRenderJob["status"]> = {
    queued: "QUEUED",
    fetching: "FETCHING",
    preprocessing: "PREPROCESSING",
    rendering: "RENDERING",
    saving: "SAVING",
    done: "COMPLETED",
    failed: "FAILED",
  };
  return map[status];
}

function safeFailureCode(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message.startsWith("SHOTSTACK_HTTP_")) return message;
  if (message === "SHOTSTACK_MALFORMED_RESPONSE") return message;
  if (message.includes("not configured")) return "SHOTSTACK_NOT_CONFIGURED";
  return "RENDER_PROVIDER_FAILURE";
}

export async function submitCreatorStudioRenderJob(params: { ownerUserId: string; projectId: string; idempotencyKey: string; callbackUrl?: string }) {
  const { ownerUserId, projectId, idempotencyKey, callbackUrl } = params;

  const { data: existing } = await (supabaseAdmin.from("creator_studio_render_jobs" as never) as any)
    .select(JOB_COLS)
    .eq("owner_user_id", ownerUserId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing) return existing as CreatorStudioRenderJob;

  const { data: project, error: projectError } = await (supabaseAdmin.from("creator_studio_projects" as never) as any)
    .select("id,owner_user_id,goal,style_key,duration_seconds,product_title,call_to_action")
    .eq("id", projectId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (projectError || !project) throw new Error("CREATOR_STUDIO_PROJECT_NOT_FOUND");

  const plan = planCreatorStudioScenes({
    goal: project.goal as CreatorStudioGoal,
    style: project.style_key as CreatorStudioStyle,
    durationSeconds: project.duration_seconds as 15 | 30 | 45,
    productTitle: project.product_title,
    callToAction: project.call_to_action,
  });
  const environment = getShotstackEnvironment();
  const estimatedCostCents = estimateCostCents(plan.output.durationSeconds);

  const { data: created, error: insertError } = await (supabaseAdmin.from("creator_studio_render_jobs" as never) as any)
    .insert({
      owner_user_id: ownerUserId,
      project_id: projectId,
      idempotency_key: idempotencyKey,
      provider: "SHOTSTACK",
      provider_environment: environment,
      status: "DRAFT",
      render_plan: plan,
      estimated_cost_cents: estimatedCostCents,
    })
    .select(JOB_COLS)
    .single();
  if (insertError || !created) {
    const { data: raced } = await (supabaseAdmin.from("creator_studio_render_jobs" as never) as any)
      .select(JOB_COLS).eq("owner_user_id", ownerUserId).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (raced) return raced as CreatorStudioRenderJob;
    throw new Error("CREATOR_STUDIO_RENDER_JOB_CREATE_FAILED");
  }

  try {
    const assets = await getSignedCreatorStudioAssets(projectId, ownerUserId);
    const edit = buildShotstackEdit(plan, assets, callbackUrl);
    const provider = await submitShotstackRender(edit);
    const now = new Date().toISOString();
    const { data: queued, error: updateError } = await (supabaseAdmin.from("creator_studio_render_jobs" as never) as any)
      .update({ provider_render_id: provider.id, status: "QUEUED", submitted_at: now, updated_at: now, failure_code: null })
      .eq("id", created.id)
      .eq("owner_user_id", ownerUserId)
      .select(JOB_COLS)
      .single();
    if (updateError || !queued) throw new Error("CREATOR_STUDIO_RENDER_JOB_UPDATE_FAILED");
    return queued as CreatorStudioRenderJob;
  } catch (error) {
    const now = new Date().toISOString();
    await (supabaseAdmin.from("creator_studio_render_jobs" as never) as any)
      .update({ status: "FAILED", failure_code: safeFailureCode(error), completed_at: now, updated_at: now })
      .eq("id", created.id)
      .eq("owner_user_id", ownerUserId);
    throw new Error("CREATOR_STUDIO_RENDER_SUBMISSION_FAILED");
  }
}

export async function refreshCreatorStudioRenderJob(params: { ownerUserId: string; jobId: string }) {
  const { data: job, error } = await (supabaseAdmin.from("creator_studio_render_jobs" as never) as any)
    .select(`${JOB_COLS},provider_render_id`)
    .eq("id", params.jobId)
    .eq("owner_user_id", params.ownerUserId)
    .maybeSingle();
  if (error || !job) throw new Error("CREATOR_STUDIO_RENDER_JOB_NOT_FOUND");
  if (!job.provider_render_id || ["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)) return job as CreatorStudioRenderJob;

  try {
    const provider = await getShotstackRender(job.provider_render_id);
    const status = mapStatus(provider.status);
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status, updated_at: now };
    if (status === "COMPLETED") { patch.output_url = provider.url ?? null; patch.completed_at = now; patch.failure_code = null; }
    if (status === "FAILED") { patch.completed_at = now; patch.failure_code = "SHOTSTACK_RENDER_FAILED"; }
    const { data: updated, error: updateError } = await (supabaseAdmin.from("creator_studio_render_jobs" as never) as any)
      .update(patch).eq("id", job.id).eq("owner_user_id", params.ownerUserId).select(JOB_COLS).single();
    if (updateError || !updated) throw new Error("CREATOR_STUDIO_RENDER_JOB_UPDATE_FAILED");
    return updated as CreatorStudioRenderJob;
  } catch (error) {
    if (error instanceof Error && error.message === "CREATOR_STUDIO_RENDER_JOB_UPDATE_FAILED") throw error;
    throw new Error("CREATOR_STUDIO_RENDER_STATUS_UNAVAILABLE");
  }
}

export async function refreshCreatorStudioRenderByProviderId(providerRenderId: string) {
  const { data: job, error } = await (supabaseAdmin.from("creator_studio_render_jobs" as never) as any)
    .select("id,owner_user_id,provider_render_id")
    .eq("provider", "SHOTSTACK")
    .eq("provider_environment", getShotstackEnvironment())
    .eq("provider_render_id", providerRenderId)
    .maybeSingle();
  if (error || !job) return null;
  return refreshCreatorStudioRenderJob({ ownerUserId: job.owner_user_id, jobId: job.id });
}

export const creatorStudioRenderInternals = { estimateCostCents, mapStatus, safeFailureCode };
