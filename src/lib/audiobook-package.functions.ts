/**
 * AurumVault Audiobook Studio — Phase 2 package export.
 *
 * The ZIP is assembled in the Worker from the creator's own private audio
 * bytes, guarded by a conservative size ceiling; oversized exports return a
 * truthful "too large" error instead of crashing the request.
 *
 * A package containing mock narration always carries MOCK_NARRATION and
 * NOT_DISTRIBUTION_READY markers.
 */
import { requireAudiobookBetaCohort } from "@/lib/audiobook-beta-cohort.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAudiobookStudioEnabled } from "@/lib/audiobook-feature-flags.middleware";
import { evaluateAudiobookReadiness } from "@/lib/audiobook-readiness";
import { evaluateRightsAttestation } from "@/lib/audiobook-rights";
import { AUDIOBOOK_AUDIO_BUCKET, downloadAudiobookBytes } from "@/lib/audiobook-storage.server";
import { loadProjectReadinessState, readinessInputFrom } from "@/lib/audiobook-readiness.functions";
import { sha256Hex } from "@/lib/audiobook-idempotency";

type Db = any;

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export const exportAudiobookPackage = createServerFn({ method: "POST" })
  .middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort])
  .inputValidator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };

    const { data: project } = await supabase
      .from("audiobook_projects")
      .select("id, title")
      .eq("id", data.projectId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!project) throw new Error("Audiobook project not found");

    const [{ data: assets }, { data: chapters }] = await Promise.all([
      supabase
        .from("audiobook_audio_assets")
        .select("id, chapter_id, storage_path, job_id, duration_seconds, checksum_sha256")
        .eq("project_id", data.projectId)
        .eq("owner_id", userId)
        .eq("is_current", true),
      supabase
        .from("audiobook_chapters")
        .select("id, chapter_index, title")
        .eq("project_id", data.projectId)
        .eq("owner_id", userId),
    ]);

    if ((assets ?? []).length === 0) {
      throw new Error("This project has no accepted audio to export yet.");
    }

    const jobIds = Array.from(
      new Set((assets ?? []).map((a: any) => a.job_id).filter(Boolean)),
    ) as string[];
    let mockJobIds = new Set<string>();
    if (jobIds.length > 0) {
      const { data: jobs } = await supabase
        .from("audiobook_generation_jobs")
        .select("id, provider")
        .in("id", jobIds)
        .eq("owner_id", userId);
      mockJobIds = new Set(
        (jobs ?? []).filter((j: any) => j.provider === "mock").map((j: any) => j.id as string),
      );
    }

    const audio = [] as Array<{
      order: number;
      label: string;
      bytes: Uint8Array;
      checksumSha256: string;
      isMock: boolean;
      durationSeconds: number | null;
    }>;
    for (const asset of assets ?? []) {
      const chapter = (chapters ?? []).find((c: any) => c.id === asset.chapter_id);
      const order = (chapter?.chapter_index as number | undefined) ?? 0;
      const bytes = await downloadAudiobookBytes(
        supabase,
        AUDIOBOOK_AUDIO_BUCKET,
        asset.storage_path,
        userId,
      );
      audio.push({
        order,
        label: chapter?.title ?? `Chapter ${order + 1}`,
        bytes,
        checksumSha256: asset.checksum_sha256 ?? (await sha256Hex(bytes)),
        isMock: asset.job_id ? mockJobIds.has(asset.job_id) : true,
        durationSeconds: asset.duration_seconds ?? null,
      });
    }

    const state = await loadProjectReadinessState(supabase, userId, data.projectId);
    const readinessInput = readinessInputFrom(state);
    const readiness = evaluateAudiobookReadiness(readinessInput);
    const rights = evaluateRightsAttestation(readinessInput.rights);

    const { buildAudiobookPackageZip } = await import("@/lib/audiobook-package.server");
    const built = await buildAudiobookPackageZip({
      projectId: data.projectId,
      projectTitle: project.title,
      metadata: readinessInput.metadata,
      rights,
      readinessState: readiness.state,
      audio,
      generatedAt: new Date().toISOString(),
    });

    await supabase.from("audiobook_activity_events").insert({
      owner_id: userId,
      actor_id: userId,
      project_id: data.projectId,
      event_type: "PACKAGE_EXPORTED",
      payload: {
        markers: built.manifest.markers,
        files: built.manifest.files.length,
        distribution_ready: built.manifest.distribution_ready,
      },
    });

    return {
      filename: built.filename,
      manifest: built.manifest,
      /** base64 ZIP — the client turns this into a Blob download. */
      zipBase64: toBase64(built.zip),
    };
  });