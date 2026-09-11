import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  requireCreatorStudioEnabled,
  requireCreatorStudioRenderingEnabled,
} from "./feature-flags.middleware";
import { planScenes, SceneValidationError, type PlannerAsset } from "./scene-planner";
import { validateComposition } from "./composition.schema";
import { RESOLUTION_BY_ASPECT_RATIO } from "./templates";
import {
  submitRender,
  normalizeProviderError,
  type ShotstackEnv,
} from "./providers/shotstack.server";
import { checkCreatorStudioAbuseGuardrails } from "./abuse-guardrails";
import { estimateRenderCostCents } from "./cost-tracking";

const SOURCE_URL_TTL_SECONDS = 60 * 15;
const SAFE_FAILURE_MESSAGE = "We couldn't finish this video. Your video credit was not consumed.";

function resolveShotstackEnv(): ShotstackEnv {
  // Fail toward the safer/cheaper choice: only ever targets production when
  // explicitly configured. Never inferred from CREATOR_STUDIO_RENDERING_ENABLED.
  return process.env.SHOTSTACK_ENV === "production" ? "production" : "sandbox";
}

const submitRenderInput = z.object({
  projectId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
});

/**
 * User-facing "Create Video" action. Reserves one video credit BEFORE
 * calling the provider (never after), then submits the render. On any
 * failure -- including a provider outage -- the reservation is released so
 * the customer's credit is never consumed for a video they didn't get. Both
 * the reservation and the release are idempotent on `idempotencyKey`, so a
 * double-click, a page refresh mid-submit, or a retried request cannot
 * double-charge a credit or start two renders for the same project (the
 * DB also enforces at most one in-flight render_jobs row per project as a
 * second, independent backstop).
 */
export const submitRenderFn = createServerFn({ method: "POST" })
  .middleware([
    requireCreatorStudioEnabled,
    requireCreatorStudioRenderingEnabled,
    requireSupabaseAuth,
  ])
  .inputValidator((data: unknown) => submitRenderInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const guard = await checkCreatorStudioAbuseGuardrails(supabaseAdmin, context.userId);
    if (!guard.allowed) throw new Error(guard.safeMessage);

    const { data: project, error: projectErr } = await context.supabase
      .from("creator_studio_projects" as any)
      .select(
        "id,owner_user_id,project_type,title,cta_text,price_text,destination_url,style_preset,duration_seconds,status",
      )
      .eq("id", data.projectId)
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (projectErr || !project) throw new Error("Project not found");
    if (!project.style_preset || !project.duration_seconds) {
      throw new Error("Finish choosing a style and duration before creating your video");
    }

    const { data: assetRows, error: assetsErr } = await context.supabase
      .from("creator_studio_project_assets" as any)
      .select("role,sort_order,asset:creator_studio_assets(id,storage_path)")
      .eq("project_id", data.projectId)
      .eq("owner_user_id", context.userId);
    if (assetsErr) throw new Error("Couldn't load this project's media");

    const assets: PlannerAsset[] = ((assetRows ?? []) as any[])
      .filter((row) => row.asset)
      .map((row) => ({
        id: row.asset.id,
        role: row.role,
        storagePath: row.asset.storage_path,
        sortOrder: row.sort_order,
      }));

    let composition;
    try {
      composition = planScenes({
        projectId: project.id,
        projectType: project.project_type,
        stylePreset: project.style_preset,
        durationSeconds: project.duration_seconds,
        headline: project.title,
        ctaText: project.cta_text,
        priceText: project.price_text,
        destinationUrl: project.destination_url,
        assets,
      });
      composition = validateComposition(composition);
    } catch (err) {
      if (err instanceof SceneValidationError) throw new Error(err.message);
      throw new Error("Couldn't prepare your video plan");
    }

    // Reserve BEFORE touching the provider. Idempotent -- a retry with the
    // same idempotencyKey returns the original reservation instead of
    // spending a second credit.
    const { data: reservation, error: reserveErr } = await context.supabase.rpc(
      "creator_studio_reserve_video_credit" as any,
      {
        p_user_id: context.userId,
        p_project_id: data.projectId,
        p_idempotency_key: data.idempotencyKey,
      },
    );
    if (reserveErr) throw new Error("Couldn't start your video");
    const reservationResult = reservation as { status: string };
    if (reservationResult.status === "DENIED_NO_CREDITS") {
      throw new Error(
        "You're out of video credits. Upgrade your plan or buy an extra video to continue.",
      );
    }

    const resolution = RESOLUTION_BY_ASPECT_RATIO["9:16"];
    const { data: jobRow, error: jobErr } = await context.supabase
      .from("creator_studio_render_jobs" as any)
      .insert({
        project_id: data.projectId,
        owner_user_id: context.userId,
        template_key: composition.metadata.templateKey,
        template_version: composition.metadata.templateVersion,
        status: "QUEUED",
        duration_seconds: project.duration_seconds,
        resolution: `${resolution.width}x${resolution.height}`,
        idempotency_key: data.idempotencyKey,
        estimated_provider_cost_cents: estimateRenderCostCents(project.duration_seconds),
      })
      .select("id")
      .single();

    if (jobErr || !jobRow) {
      // Another render is already in flight for this project (the DB's
      // partial unique index rejected the insert) -- release the credit we
      // just reserved so this failed attempt never costs the customer.
      await supabaseAdmin.rpc("creator_studio_release_reservation" as any, {
        p_user_id: context.userId,
        p_reserve_idempotency_key: data.idempotencyKey,
      });
      throw new Error("A video is already being created for this project");
    }

    await context.supabase
      .from("creator_studio_projects" as any)
      .update({ status: "GENERATING" })
      .eq("id", data.projectId)
      .eq("owner_user_id", context.userId);

    const env = resolveShotstackEnv();
    const callbackUrl = `https://www.aurumvault.store/api/public/creator-studio/shotstack-webhook?job=${jobRow.id}&token=${data.idempotencyKey}`;

    try {
      const sourceUrls: Record<string, string> = {};
      for (const scene of composition.scenes) {
        if (!scene.assetRef) continue;
        const { data: signed, error: signErr } = await context.supabase.storage
          .from("creator-studio-source-assets")
          .createSignedUrl(scene.assetRef.storagePath, SOURCE_URL_TTL_SECONDS);
        if (signErr || !signed?.signedUrl) throw new Error("Couldn't prepare your source files");
        sourceUrls[scene.id] = signed.signedUrl;
      }

      const result = await submitRender(composition, sourceUrls, callbackUrl, env);

      await supabaseAdmin
        .from("creator_studio_render_jobs")
        .update({
          status: "SUBMITTED",
          provider_job_id: result.providerJobId,
          started_at: new Date().toISOString(),
        })
        .eq("id", jobRow.id);

      return { renderJobId: jobRow.id, status: "SUBMITTED" as const };
    } catch (err) {
      const normalized = normalizeProviderError(err);
      await supabaseAdmin
        .from("creator_studio_render_jobs")
        .update({
          status: "FAILED",
          error_code: normalized.errorCode,
          safe_error_message: SAFE_FAILURE_MESSAGE,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobRow.id);
      await supabaseAdmin
        .from("creator_studio_projects")
        .update({ status: "FAILED" })
        .eq("id", data.projectId);
      await supabaseAdmin.rpc("creator_studio_release_reservation" as any, {
        p_user_id: context.userId,
        p_reserve_idempotency_key: data.idempotencyKey,
      });
      throw new Error(SAFE_FAILURE_MESSAGE);
    }
  });

const projectIdInput = z.object({ projectId: z.string().uuid() });

/** Bounded-backoff status polling fallback for when the webhook hasn't landed yet. Never exposes backend/provider details to the client. */
export const getLatestRenderJobForProjectFn = createServerFn({ method: "GET" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((data: unknown) => projectIdInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("creator_studio_render_jobs" as any)
      .select(
        "id,status,duration_seconds,resolution,safe_error_message,output_asset_id,created_at,completed_at",
      )
      .eq("project_id", data.projectId)
      .eq("owner_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error("Couldn't check your video's status");
    if (!row) return null;
    return {
      renderJobId: row.id,
      status: row.status as
        | "QUEUED"
        | "SUBMITTED"
        | "RENDERING"
        | "SUCCEEDED"
        | "FAILED"
        | "CANCELLED",
      safeErrorMessage: row.safe_error_message,
      outputAssetId: row.output_asset_id as string | null,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };
  });

const assetIdInput = z.object({ assetId: z.string().uuid() });

/** Mints a short-lived signed URL for a finished video/thumbnail so the browser can play or download it -- the renders bucket is never public. */
export const getSignedOutputUrlFn = createServerFn({ method: "GET" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((data: unknown) => assetIdInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: asset, error: assetErr } = await context.supabase
      .from("creator_studio_assets" as any)
      .select("storage_path,owner_user_id")
      .eq("id", data.assetId)
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (assetErr || !asset) throw new Error("Video not found");

    const { data: signed, error: signErr } = await context.supabase.storage
      .from("creator-studio-renders")
      .createSignedUrl(asset.storage_path, 60 * 10, { download: false });
    if (signErr || !signed?.signedUrl) throw new Error("Couldn't prepare your video");
    return { signedUrl: signed.signedUrl };
  });

/**
 * Step 6 "Preview plan" -- runs the same deterministic scene planner used at
 * submission time, but purely to describe the storyboard back to the
 * customer (scene count/timing only, never Shotstack JSON). Reserves
 * nothing and calls no provider.
 */
export const previewCompositionFn = createServerFn({ method: "GET" })
  .middleware([requireCreatorStudioEnabled, requireSupabaseAuth])
  .inputValidator((data: unknown) => projectIdInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: project, error: projectErr } = await context.supabase
      .from("creator_studio_projects" as any)
      .select(
        "id,project_type,title,cta_text,price_text,destination_url,style_preset,duration_seconds",
      )
      .eq("id", data.projectId)
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (projectErr || !project) throw new Error("Project not found");
    if (!project.style_preset || !project.duration_seconds) {
      return null;
    }

    const { data: assetRows } = await context.supabase
      .from("creator_studio_project_assets" as any)
      .select("role,sort_order,asset:creator_studio_assets(id,storage_path)")
      .eq("project_id", data.projectId)
      .eq("owner_user_id", context.userId);

    const assets: PlannerAsset[] = ((assetRows ?? []) as any[])
      .filter((row) => row.asset)
      .map((row) => ({
        id: row.asset.id,
        role: row.role,
        storagePath: row.asset.storage_path,
        sortOrder: row.sort_order,
      }));

    try {
      const composition = planScenes({
        projectId: project.id,
        projectType: project.project_type,
        stylePreset: project.style_preset,
        durationSeconds: project.duration_seconds,
        headline: project.title,
        ctaText: project.cta_text,
        priceText: project.price_text,
        destinationUrl: project.destination_url,
        assets,
      });
      return {
        templateKey: composition.metadata.templateKey,
        templateVersion: composition.metadata.templateVersion,
        totalDurationSeconds: composition.duration,
        scenes: composition.scenes.map((s: { type: string; duration: number }) => ({
          type: s.type,
          durationSeconds: s.duration,
        })),
      };
    } catch (err) {
      if (err instanceof SceneValidationError) throw new Error(err.message);
      throw new Error("Couldn't prepare your video plan");
    }
  });
