/**
 * AurumVault Audiobook Studio — Phase 2 quality-control runs.
 *
 * Persists one run plus its check rows. Repeated check codes are expected
 * (one AUDIO_* row per asset), so rows are inserted as an append-only batch
 * keyed by run id — never upserted on check_code, which would collide.
 */
import { requireAudiobookBetaCohort } from "@/lib/audiobook-beta-cohort.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAudiobookStudioEnabled } from "@/lib/audiobook-feature-flags.middleware";
import { AUDIOBOOK_AUDIO_BUCKET, downloadAudiobookBytes } from "@/lib/audiobook-storage.server";

type Db = any;
const uuid = z.string().uuid();

export const runAudiobookQc = createServerFn({ method: "POST" })
  .middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort])
  .inputValidator((input: unknown) => z.object({ projectId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };

    const { data: project } = await supabase
      .from("audiobook_projects")
      .select("id")
      .eq("id", data.projectId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!project) throw new Error("Audiobook project not found");

    const [{ data: metadata }, { data: rights }, { data: chapters }, { data: assets }] =
      await Promise.all([
        supabase
          .from("audiobook_metadata")
          .select("*")
          .eq("project_id", data.projectId)
          .eq("owner_id", userId)
          .maybeSingle(),
        supabase
          .from("audiobook_rights_attestations")
          .select("status, version, statement_text, attested_at, revoked_at")
          .eq("project_id", data.projectId)
          .eq("owner_id", userId)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("audiobook_chapters")
          .select("id, chapter_index, title")
          .eq("project_id", data.projectId)
          .eq("owner_id", userId),
        supabase
          .from("audiobook_audio_assets")
          .select("id, chapter_id, storage_path, job_id")
          .eq("project_id", data.projectId)
          .eq("owner_id", userId)
          .eq("is_current", true),
      ]);

    const { data: run, error: runError } = await supabase
      .from("audiobook_qc_runs")
      .insert({
        owner_id: userId,
        project_id: data.projectId,
        status: "RUNNING",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (runError) throw new Error(runError.message);

    try {
      const { inspectWav } = await import("@/lib/audiobook-wav");
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

      const audio: Array<{ label: string; info: any; isMock: boolean }> = [];
      for (const asset of assets ?? []) {
        const chapter = (chapters ?? []).find((c: any) => c.id === asset.chapter_id);
        const label =
          chapter?.title ?? `Chapter ${((chapter?.chapter_index ?? 0) as number) + 1}`;
        const bytes = await downloadAudiobookBytes(
          supabase,
          AUDIOBOOK_AUDIO_BUCKET,
          asset.storage_path,
          userId,
        );
        audio.push({
          label,
          info: inspectWav(bytes),
          isMock: asset.job_id ? mockJobIds.has(asset.job_id) : false,
        });
      }

      const { evaluateAudiobookQc } = await import("@/lib/audiobook-qc");
      const evaluation = evaluateAudiobookQc({
        metadata: metadata
          ? {
              title: metadata.title,
              subtitle: metadata.subtitle,
              authorName: metadata.author_name,
              narratorName: metadata.narrator_name,
              publisher: metadata.publisher,
              description: metadata.description,
              language: metadata.language,
              isbn: metadata.isbn,
              genre: metadata.genre,
              keywords: metadata.keywords,
              coverPath: metadata.cover_path,
              copyrightYear: metadata.copyright_year,
            }
          : null,
        rights: rights
          ? {
              status: rights.status,
              version: rights.version,
              statementText: rights.statement_text,
              attestedAt: rights.attested_at,
              revokedAt: rights.revoked_at,
            }
          : null,
        audio,
        chapterCount: (chapters ?? []).length,
        chaptersWithAudio: new Set((assets ?? []).map((a: any) => a.chapter_id)).size,
      });

      const rows = evaluation.checks.map((check) => ({
        owner_id: userId,
        qc_run_id: run.id,
        check_code: check.check_code,
        severity: check.severity,
        passed: check.passed,
        detail: check.detail,
        metrics: check.metrics,
      }));
      if (rows.length > 0) {
        const { error } = await supabase.from("audiobook_qc_results").insert(rows);
        if (error) throw new Error(error.message);
      }

      await supabase
        .from("audiobook_qc_runs")
        .update({
          status: "COMPLETED",
          overall_result: evaluation.overallResult,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id)
        .eq("owner_id", userId);

      return {
        runId: run.id as string,
        overallResult: evaluation.overallResult,
        checks: evaluation.checks.map((check) => ({
          check_code: check.check_code,
          severity: check.severity,
          passed: check.passed,
          detail: check.detail,
          metrics: check.metrics as Record<string, string | number | boolean | null>,
        })),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Quality control failed.";
      await supabase
        .from("audiobook_qc_runs")
        .update({ status: "FAILED", completed_at: new Date().toISOString() })
        .eq("id", run.id)
        .eq("owner_id", userId);
      throw new Error(message);
    }
  });

export const getLatestQcRun = createServerFn({ method: "GET" })
  .middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort])
  .inputValidator((input: unknown) => z.object({ projectId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    const { data: run } = await supabase
      .from("audiobook_qc_runs")
      .select("id, status, overall_result, started_at, completed_at")
      .eq("project_id", data.projectId)
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!run) return { run: null, results: [] };

    const { data: results } = await supabase
      .from("audiobook_qc_results")
      .select("check_code, severity, passed, detail, metrics")
      .eq("qc_run_id", run.id)
      .eq("owner_id", userId)
      .order("created_at", { ascending: true });
    return { run, results: results ?? [] };
  });