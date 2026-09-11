import { createFileRoute } from "@tanstack/react-router";
import {
  mapShotstackStatus,
  normalizeProviderError,
} from "@/lib/creator-studio/providers/shotstack.server";

/**
 * Public Shotstack render-complete callback. Authenticity is NOT based on a
 * provider-computed signature -- Shotstack does not sign its callbacks the
 * way Stripe does (see the header comment in providers/shotstack.server.ts)
 * -- so this route relies on two independent things instead:
 *   1. `token` must match the exact idempotency_key we generated for this
 *      render_job at submission time and embedded in the callback URL we
 *      gave Shotstack -- unguessable, per-job, never reused.
 *   2. Ownership/ids are resolved ONLY from our own stored render_jobs row
 *      (looked up by `job`), never trusted from the request body.
 * A request that fails either check is rejected before any DB write.
 */
async function readSafeBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const json = await request.json();
    return json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const Route = createFileRoute("/api/public/creator-studio/shotstack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const jobId = url.searchParams.get("job");
        const token = url.searchParams.get("token");
        if (!jobId || !token) {
          return Response.json({ received: true, ignored: "missing job/token" });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: job } = await supabaseAdmin
          .from("creator_studio_render_jobs")
          .select("id,project_id,owner_user_id,status,idempotency_key")
          .eq("id", jobId)
          .maybeSingle();
        if (!job || job.idempotency_key !== token) {
          // Deliberately generic response -- do not reveal which check failed.
          return new Response("Not found", { status: 404 });
        }

        const body = await readSafeBody(request);
        const rawStatus = typeof body.status === "string" ? body.status : "unknown";
        const outputUrl = typeof body.url === "string" ? body.url : null;
        const posterUrl = typeof body.poster === "string" ? body.poster : null;
        const providerError = typeof body.error === "string" ? body.error : null;

        const dedupeKey = `shotstack:${jobId}:${rawStatus}:${outputUrl ?? providerError ?? ""}`;
        const { error: dedupeError } = await supabaseAdmin
          .from("creator_studio_provider_events")
          .insert({
            render_job_id: jobId,
            provider: "shotstack",
            event_type: "render.status",
            raw_status: rawStatus,
            dedupe_key: dedupeKey,
            payload_summary: {
              status: rawStatus,
              hasOutput: !!outputUrl,
              hasError: !!providerError,
            },
          });
        if (dedupeError) {
          // Unique violation on dedupe_key means this exact event was already
          // processed (webhook retry) -- treat as success without redoing work.
          return Response.json({ received: true, duplicate: true });
        }

        // Already terminal -- ignore further events for this job (e.g. a
        // stray retry after we already finalized/released it).
        if (job.status === "SUCCEEDED" || job.status === "FAILED" || job.status === "CANCELLED") {
          return Response.json({ received: true, ignored: "job already terminal" });
        }

        const canonicalStatus = mapShotstackStatus(rawStatus);

        if (canonicalStatus === "SUCCEEDED" && outputUrl) {
          await handleRenderSucceeded(supabaseAdmin, job, outputUrl, posterUrl);
        } else if (canonicalStatus === "FAILED") {
          await handleRenderFailed(supabaseAdmin, job, providerError ?? "render_failed");
        } else {
          await supabaseAdmin
            .from("creator_studio_render_jobs")
            .update({ status: canonicalStatus })
            .eq("id", jobId);
        }

        await supabaseAdmin
          .from("creator_studio_provider_events")
          .update({ processed: true })
          .eq("dedupe_key", dedupeKey);

        return Response.json({ received: true });
      },
    },
  },
});

async function handleRenderSucceeded(
  supabaseAdmin: any,
  job: { id: string; project_id: string; owner_user_id: string; idempotency_key: string },
  outputUrl: string,
  posterUrl: string | null,
) {
  // Copy the finished video into AurumVault-controlled storage so the
  // customer's access never depends on Shotstack's own short-lived output
  // URL staying valid.
  const videoRes = await fetch(outputUrl, { signal: AbortSignal.timeout(60_000) });
  if (!videoRes.ok) {
    await handleRenderFailed(supabaseAdmin, job, "output_fetch_failed");
    return;
  }
  const videoBytes = await videoRes.arrayBuffer();
  const outputPath = `${job.owner_user_id}/${job.id}.mp4`;
  const { error: uploadErr } = await supabaseAdmin.storage
    .from("creator-studio-renders")
    .upload(outputPath, videoBytes, { contentType: "video/mp4", upsert: false });
  if (uploadErr) {
    await handleRenderFailed(supabaseAdmin, job, "output_store_failed");
    return;
  }

  const { data: outputAsset } = await supabaseAdmin
    .from("creator_studio_assets")
    .insert({
      owner_user_id: job.owner_user_id,
      asset_type: "VIDEO_OUTPUT",
      source_type: "PROVIDER_OUTPUT",
      storage_bucket: "creator-studio-renders",
      storage_path: outputPath,
      media_type: "video/mp4",
    })
    .select("id")
    .single();

  if (outputAsset) {
    await supabaseAdmin.from("creator_studio_project_assets").insert({
      project_id: job.project_id,
      asset_id: outputAsset.id,
      owner_user_id: job.owner_user_id,
      role: "OUTPUT",
      sort_order: 0,
    });

    if (posterUrl) {
      try {
        const posterRes = await fetch(posterUrl, { signal: AbortSignal.timeout(20_000) });
        if (posterRes.ok) {
          const posterPath = `${job.owner_user_id}/${job.id}-thumb.jpg`;
          await supabaseAdmin.storage
            .from("creator-studio-renders")
            .upload(posterPath, await posterRes.arrayBuffer(), {
              contentType: "image/jpeg",
              upsert: false,
            });
          const { data: thumbAsset } = await supabaseAdmin
            .from("creator_studio_assets")
            .insert({
              owner_user_id: job.owner_user_id,
              asset_type: "THUMBNAIL",
              source_type: "PROVIDER_OUTPUT",
              storage_bucket: "creator-studio-renders",
              storage_path: posterPath,
              media_type: "image/jpeg",
            })
            .select("id")
            .single();
          if (thumbAsset) {
            await supabaseAdmin.from("creator_studio_project_assets").insert({
              project_id: job.project_id,
              asset_id: thumbAsset.id,
              owner_user_id: job.owner_user_id,
              role: "THUMBNAIL",
              sort_order: 0,
            });
          }
        }
      } catch {
        // Thumbnail is best-effort -- the video itself already succeeded.
      }
    }
  }

  await supabaseAdmin
    .from("creator_studio_render_jobs")
    .update({
      status: "SUCCEEDED",
      output_asset_id: outputAsset?.id ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id);
  await supabaseAdmin
    .from("creator_studio_projects")
    .update({ status: "COMPLETE" })
    .eq("id", job.project_id);
  await supabaseAdmin.rpc("creator_studio_finalize_consumption", {
    p_user_id: job.owner_user_id,
    p_reserve_idempotency_key: job.idempotency_key,
  });
}

async function handleRenderFailed(
  supabaseAdmin: any,
  job: { id: string; project_id: string; owner_user_id: string; idempotency_key: string },
  rawError: string,
) {
  const normalized = normalizeProviderError(rawError);
  await supabaseAdmin
    .from("creator_studio_render_jobs")
    .update({
      status: "FAILED",
      error_code: normalized.errorCode,
      safe_error_message: normalized.safeErrorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id);
  await supabaseAdmin
    .from("creator_studio_projects")
    .update({ status: "FAILED" })
    .eq("id", job.project_id);
  await supabaseAdmin.rpc("creator_studio_release_reservation", {
    p_user_id: job.owner_user_id,
    p_reserve_idempotency_key: job.idempotency_key,
  });
}
