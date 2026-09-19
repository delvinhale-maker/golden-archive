/**
 * AurumVault Audiobook Studio — Phase 2 narration job lifecycle.
 *
 * MOCK ONLY in this phase: the provider registry fails closed, so a non-mock
 * provider is rejected while AUDIOBOOK_TTS_LIVE_ENABLED is off. No network
 * call and no secret read happens anywhere in this module.
 *
 * Billing safety: the idempotency key is derived deterministically from the
 * narration request, and a COMPLETED job with the same key is REUSED rather
 * than regenerated — so an ACTUAL usage row is written at most once per job.
 */
import { requireAudiobookBetaCohort } from "@/lib/audiobook-beta-cohort.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAudiobookStudioEnabled } from "@/lib/audiobook-feature-flags.middleware";
import { segmentText, segmentationFingerprint, totalCharacters } from "@/lib/audiobook-segment";
import { narrationIdempotencyKey, sha256Hex } from "@/lib/audiobook-idempotency";
import { checkLiveJobCharacterCap } from "@/lib/audiobook-job-limits";
import { buildUsageRow, estimateDurationSeconds, estimateCostCents } from "@/lib/audiobook-usage";
import { MOCK_PROVIDER_ID } from "@/lib/audiobook-tts/mock";
import { resolveNarrationProviderAsync } from "@/lib/audiobook-tts/registry";
import {
  AUDIOBOOK_AUDIO_BUCKET,
  buildAudioPath,
  createAudiobookSignedUrl,
  uploadAudiobookBytes,
} from "@/lib/audiobook-storage.server";

type Db = any;
const uuid = z.string().uuid();

type NarrationTarget = {
  projectId: string;
  chapterId: string;
  chapterVersionId: string | null;
  voiceConfigId: string | null;
  provider: string;
  /** True only when the creator explicitly selected a saved voice config. */
  voiceExplicit: boolean;
  model: string | null;
  text: string;
};

async function resolveNarrationTarget(
  supabase: Db,
  userId: string,
  input: { chapterId: string; chapterVersionId?: string | null; voiceConfigId?: string | null },
): Promise<NarrationTarget> {
  const { data: chapter } = await supabase
    .from("audiobook_chapters")
    .select("id, project_id, owner_id, original_text")
    .eq("id", input.chapterId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!chapter) throw new Error("Chapter not found");

  let versionId: string | null = null;
  let text: string = chapter.original_text;

  if (input.chapterVersionId) {
    const { data: version } = await supabase
      .from("audiobook_chapter_versions")
      .select("id, chapter_id, owner_id, edited_text")
      .eq("id", input.chapterVersionId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!version || version.chapter_id !== chapter.id) throw new Error("Chapter version not found");
    versionId = version.id;
    text = version.edited_text;
  } else {
    const { data: current } = await supabase
      .from("audiobook_chapter_versions")
      .select("id, edited_text")
      .eq("chapter_id", chapter.id)
      .eq("owner_id", userId)
      .eq("is_current", true)
      .maybeSingle();
    if (current) {
      versionId = current.id;
      text = current.edited_text;
    }
  }

  let voiceConfigId: string | null = null;
  let provider = MOCK_PROVIDER_ID;
  let model: string | null = null;
  if (input.voiceConfigId) {
    const { data: voice } = await supabase
      .from("audiobook_voice_configs")
      .select("id, project_id, owner_id, provider, model")
      .eq("id", input.voiceConfigId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!voice || voice.project_id !== chapter.project_id) throw new Error("Voice config not found");
    voiceConfigId = voice.id;
    provider = voice.provider ?? MOCK_PROVIDER_ID;
    model = voice.model ?? null;
  }

  return {
    projectId: chapter.project_id,
    chapterId: chapter.id,
    chapterVersionId: versionId,
    voiceConfigId,
    provider,
    voiceExplicit: Boolean(input.voiceConfigId),
    model,
    text,
  };
}

async function requireRightsAttested(supabase: Db, userId: string, projectId: string) {
  const { data } = await supabase
    .from("audiobook_rights_attestations")
    .select("status, version, statement_text, attested_at, revoked_at")
    .eq("project_id", projectId)
    .eq("owner_id", userId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { evaluateRightsAttestation } = await import("@/lib/audiobook-rights");
  const evaluation = evaluateRightsAttestation(
    data
      ? {
          status: data.status,
          version: data.version,
          statementText: data.statement_text,
          attestedAt: data.attested_at,
          revokedAt: data.revoked_at,
        }
      : null,
  );
  if (evaluation.blocked) {
    throw new Error(evaluation.blockers[0]?.message ?? "Rights attestation required.");
  }
}

const narrationInputSchema = z.object({
  chapterId: uuid,
  chapterVersionId: uuid.nullable().optional(),
  voiceConfigId: uuid.nullable().optional(),
});

export const estimateNarration = createServerFn({ method: "POST" })
  .middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort])
  .inputValidator((input: unknown) => narrationInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    const target = await resolveNarrationTarget(supabase, userId, data);
    // Without an explicit saved voice, the estimate must reflect the provider
    // this environment would actually use. Fails closed to mock on any error.
    let providerId = target.provider;
    if (!target.voiceExplicit) {
      try {
        providerId = (await resolveNarrationProviderAsync(process.env)).id;
      } catch {
        providerId = MOCK_PROVIDER_ID;
      }
    }
    const segments = segmentText(target.text);
    const characters = totalCharacters(segments);
    const cost = estimateCostCents(characters, providerId, target.model);

    return {
      provider: providerId,
      model: target.model,
      segments: segments.length,
      characters,
      estimatedDurationSeconds: estimateDurationSeconds(characters),
      estimatedCostCents: providerId === MOCK_PROVIDER_ID ? 0 : cost.costCents,
      currency: cost.currency,
      rateKnown: cost.rateKnown,
      isMock: providerId === MOCK_PROVIDER_ID,
    };
  });

/**
 * Generates narration with the MOCK provider, synchronously but with a durable
 * QUEUED -> GENERATING -> COMPLETED/FAILED status trail so the same rows work
 * unchanged when a live provider is enabled in a later phase.
 */
export const generateNarration = createServerFn({ method: "POST" })
  .middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort])
  .inputValidator((input: unknown) => narrationInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    const target = await resolveNarrationTarget(supabase, userId, data);
    await requireRightsAttested(supabase, userId, target.projectId);

    // Fails closed: mock unless BOTH audiobook flags are on in this process,
    // the provider is explicitly "openai", and the server secret is present.
    const provider = await resolveNarrationProviderAsync(process.env);
    // A saved voice config pins its provider; without one the environment's
    // fail-closed resolution is authoritative.
    if (target.voiceExplicit && target.provider !== provider.id) {
      throw new Error(
        `Narration provider "${target.provider}" is not available in this environment.`,
      );
    }

    const segments = segmentText(target.text);
    const characters = totalCharacters(segments);
    // Beta cost guard: a paid provider is billed per character across every
    // segment, so a single job may not exceed the conservative ceiling.
    const cap = checkLiveJobCharacterCap(characters, provider.isMock);
    if (!cap.allowed) throw new Error(cap.message ?? "This chapter is too long to narrate.");
    const idempotencyKey = await narrationIdempotencyKey({
      projectId: target.projectId,
      chapterId: target.chapterId,
      chapterVersionId: target.chapterVersionId,
      voiceConfigId: target.voiceConfigId,
      provider: provider.id,
      model: target.model,
      segmentationFingerprint: segmentationFingerprint(segments),
      characters,
    });

    // Reuse: identical logical request must never regenerate or re-bill.
    const { data: existingJob } = await supabase
      .from("audiobook_generation_jobs")
      .select("id, status, project_id, provider")
      .eq("owner_id", userId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingJob && existingJob.status === "COMPLETED") {
      const { data: asset } = await supabase
        .from("audiobook_audio_assets")
        .select("id, version, is_current, duration_seconds, file_size_bytes")
        .eq("job_id", existingJob.id)
        .eq("owner_id", userId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      return {
        jobId: existingJob.id,
        status: "COMPLETED" as const,
        reused: true,
        isMock: (existingJob.provider ?? MOCK_PROVIDER_ID) === MOCK_PROVIDER_ID,
        asset: asset ?? null,
      };
    }

    let jobId: string;
    if (existingJob) {
      jobId = existingJob.id;
      await supabase
        .from("audiobook_generation_jobs")
        .update({ status: "GENERATING", started_at: new Date().toISOString() })
        .eq("id", jobId)
        .eq("owner_id", userId);
    } else {
      const { data: created, error } = await supabase
        .from("audiobook_generation_jobs")
        .insert({
          owner_id: userId,
          project_id: target.projectId,
          chapter_id: target.chapterId,
          chapter_version_id: target.chapterVersionId,
          voice_config_id: target.voiceConfigId,
          provider: provider.id,
          model: target.model,
          idempotency_key: idempotencyKey,
          requested_characters: characters,
          status: "QUEUED",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      jobId = created.id;

      // ESTIMATE usage is recorded once, at enqueue time.
      await supabase.from("audiobook_usage").insert(
        buildUsageRow({
          ownerId: userId,
          projectId: target.projectId,
          chapterId: target.chapterId,
          jobId,
          kind: "ESTIMATE",
          provider: provider.id,
          model: target.model,
          characters,
        }),
      );

      await supabase
        .from("audiobook_generation_jobs")
        .update({ status: "GENERATING", started_at: new Date().toISOString() })
        .eq("id", jobId)
        .eq("owner_id", userId);
    }

    try {
      // Segment-by-segment so the pipeline matches a real provider's shape.
      const chunks: Uint8Array[] = [];
      let durationSeconds = 0;
      let sampleRate = 24000;
      for (const segment of segments) {
        const result = await provider.synthesize({
          text: segment.text,
          model: target.model,
        });
        chunks.push(result.wav);
        durationSeconds += result.durationSeconds;
        sampleRate = result.sampleRate;
      }

      // Concatenate PCM payloads under a single valid header.
      const { inspectWav, pcmToWav, DEFAULT_WAV_FORMAT } = await import("@/lib/audiobook-wav");
      const pcmParts: Int16Array[] = chunks.map((wav) => {
        const info = inspectWav(wav);
        const start = wav.byteLength - info.dataBytes;
        const copy = wav.slice(start, start + info.dataBytes);
        return new Int16Array(copy.buffer, copy.byteOffset, Math.floor(copy.byteLength / 2));
      });
      const totalSamples = pcmParts.reduce((n, p) => n + p.length, 0);
      const merged = new Int16Array(totalSamples);
      let cursor = 0;
      for (const part of pcmParts) {
        merged.set(part, cursor);
        cursor += part.length;
      }
      const wav = pcmToWav(merged, { ...DEFAULT_WAV_FORMAT, sampleRate });
      const info = inspectWav(wav);

      const { data: latestAsset } = await supabase
        .from("audiobook_audio_assets")
        .select("version")
        .eq("chapter_id", target.chapterId)
        .eq("owner_id", userId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      const version = ((latestAsset?.version as number | undefined) ?? 0) + 1;
      const storagePath = buildAudioPath(userId, target.projectId, jobId, version);

      await uploadAudiobookBytes(
        supabase,
        AUDIOBOOK_AUDIO_BUCKET,
        storagePath,
        userId,
        wav,
        "audio/wav",
      );

      await supabase
        .from("audiobook_audio_assets")
        .update({ is_current: false })
        .eq("chapter_id", target.chapterId)
        .eq("owner_id", userId);

      const { data: asset, error: assetError } = await supabase
        .from("audiobook_audio_assets")
        .insert({
          owner_id: userId,
          project_id: target.projectId,
          chapter_id: target.chapterId,
          job_id: jobId,
          version,
          is_current: true,
          storage_bucket: AUDIOBOOK_AUDIO_BUCKET,
          storage_path: storagePath,
          mime_type: "audio/wav",
          file_size_bytes: wav.byteLength,
          duration_seconds: Math.round(info.durationSeconds * 100) / 100,
          sample_rate: info.sampleRate,
          checksum_sha256: await sha256Hex(wav),
        })
        .select("id, version, is_current, duration_seconds, file_size_bytes")
        .single();
      if (assetError) throw new Error(assetError.message);

      // ACTUAL usage exactly once per job.
      const { data: existingActual } = await supabase
        .from("audiobook_usage")
        .select("id")
        .eq("job_id", jobId)
        .eq("owner_id", userId)
        .eq("kind", "ACTUAL")
        .limit(1)
        .maybeSingle();
      if (!existingActual) {
        await supabase.from("audiobook_usage").insert(
          buildUsageRow({
            ownerId: userId,
            projectId: target.projectId,
            chapterId: target.chapterId,
            jobId,
            kind: "ACTUAL",
            provider: provider.id,
            model: target.model,
            characters,
            durationSeconds: info.durationSeconds,
          }),
        );
      }

      await supabase
        .from("audiobook_generation_jobs")
        .update({ status: "COMPLETED", completed_at: new Date().toISOString(), error_message: null })
        .eq("id", jobId)
        .eq("owner_id", userId);

      await supabase.from("audiobook_activity_events").insert({
        owner_id: userId,
        actor_id: userId,
        project_id: target.projectId,
        job_id: jobId,
        event_type: "NARRATION_COMPLETED",
        payload: { provider: provider.id, mock: provider.isMock, characters },
      });

      return { jobId, status: "COMPLETED" as const, reused: false, isMock: provider.isMock, asset };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Narration failed.";
      await supabase
        .from("audiobook_generation_jobs")
        .update({ status: "FAILED", error_message: message.slice(0, 500) })
        .eq("id", jobId)
        .eq("owner_id", userId);
      throw new Error(message);
    }
  });

export const listNarrationJobs = createServerFn({ method: "GET" })
  .middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort])
  .inputValidator((input: unknown) => z.object({ projectId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    const { data: jobs, error } = await supabase
      .from("audiobook_generation_jobs")
      .select(
        "id, chapter_id, status, provider, model, requested_characters, attempt, queued_at, started_at, completed_at, error_message",
      )
      .eq("project_id", data.projectId)
      .eq("owner_id", userId)
      .order("queued_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { jobs: jobs ?? [] };
  });

export const getAudioPlaybackUrl = createServerFn({ method: "POST" })
  .middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort])
  .inputValidator((input: unknown) => z.object({ assetId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    const { data: asset } = await supabase
      .from("audiobook_audio_assets")
      .select("id, storage_bucket, storage_path, owner_id")
      .eq("id", data.assetId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!asset) throw new Error("Audio asset not found");
    const url = await createAudiobookSignedUrl(
      supabase,
      AUDIOBOOK_AUDIO_BUCKET,
      asset.storage_path,
      userId,
    );
    return { url };
  });

export const setCurrentAudioAsset = createServerFn({ method: "POST" })
  .middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort])
  .inputValidator((input: unknown) => z.object({ assetId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    const { data: asset } = await supabase
      .from("audiobook_audio_assets")
      .select("id, chapter_id")
      .eq("id", data.assetId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!asset) throw new Error("Audio asset not found");

    await supabase
      .from("audiobook_audio_assets")
      .update({ is_current: false })
      .eq("chapter_id", asset.chapter_id)
      .eq("owner_id", userId);
    const { error } = await supabase
      .from("audiobook_audio_assets")
      .update({ is_current: true })
      .eq("id", data.assetId)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { updated: true };
  });

/**
 * Phase 3 read-only listing used by the creator Review step. Returns every
 * audio asset for the project (all versions) plus whether its originating job
 * used the mock provider, so the UI can label placeholder audio truthfully.
 */
export const listAudiobookAudioAssets = createServerFn({ method: "GET" })
  .middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort])
  .inputValidator((input: unknown) => z.object({ projectId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    const { data: assets, error } = await supabase
      .from("audiobook_audio_assets")
      .select(
        "id, chapter_id, job_id, version, is_current, duration_seconds, file_size_bytes, created_at",
      )
      .eq("project_id", data.projectId)
      .eq("owner_id", userId)
      .order("version", { ascending: false });
    if (error) throw new Error(error.message);

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

    return {
      assets: (assets ?? []).map((a: any) => ({
        id: a.id as string,
        chapterId: a.chapter_id as string,
        version: a.version as number,
        isCurrent: a.is_current as boolean,
        durationSeconds: (a.duration_seconds as number | null) ?? null,
        fileSizeBytes: (a.file_size_bytes as number | null) ?? null,
        createdAt: a.created_at as string,
        isMock: a.job_id ? mockJobIds.has(a.job_id) : true,
      })),
    };
  });