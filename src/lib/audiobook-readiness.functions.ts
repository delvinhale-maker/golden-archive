/**
 * AurumVault Audiobook Studio — Phase 2 readiness reporting.
 *
 * Reads persisted state only. There is no distributor delivery mechanism in
 * this phase, so `deliveries` is always empty and DISTRIBUTED can never be
 * reported — by construction, not by convention.
 */
import { requireAudiobookBetaCohort } from "@/lib/audiobook-beta-cohort.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAudiobookStudioEnabled } from "@/lib/audiobook-feature-flags.middleware";
import { evaluateAudiobookReadiness } from "@/lib/audiobook-readiness";

type Db = any;

export type ProjectReadinessState = {
  metadata: any;
  rights: any;
  chapterCount: number;
  chaptersWithCurrentAudio: number;
  hasMockAudio: boolean;
  qcOverallResult: "PASSED" | "PASSED_WITH_WARNINGS" | "FAILED" | null;
};

/** Shared loader — also used by the package export path. */
export async function loadProjectReadinessState(
  supabase: Db,
  userId: string,
  projectId: string,
): Promise<ProjectReadinessState> {
  const [{ data: metadata }, { data: rights }, { data: chapters }, { data: assets }, { data: qc }] =
    await Promise.all([
      supabase
        .from("audiobook_metadata")
        .select("*")
        .eq("project_id", projectId)
        .eq("owner_id", userId)
        .maybeSingle(),
      supabase
        .from("audiobook_rights_attestations")
        .select("status, version, statement_text, attested_at, revoked_at")
        .eq("project_id", projectId)
        .eq("owner_id", userId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("audiobook_chapters")
        .select("id")
        .eq("project_id", projectId)
        .eq("owner_id", userId),
      supabase
        .from("audiobook_audio_assets")
        .select("id, chapter_id, job_id")
        .eq("project_id", projectId)
        .eq("owner_id", userId)
        .eq("is_current", true),
      supabase
        .from("audiobook_qc_runs")
        .select("overall_result")
        .eq("project_id", projectId)
        .eq("owner_id", userId)
        .eq("status", "COMPLETED")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const jobIds = Array.from(
    new Set((assets ?? []).map((a: any) => a.job_id).filter(Boolean)),
  ) as string[];
  let hasMockAudio = false;
  if (jobIds.length > 0) {
    const { data: jobs } = await supabase
      .from("audiobook_generation_jobs")
      .select("id, provider")
      .in("id", jobIds)
      .eq("owner_id", userId);
    hasMockAudio = (jobs ?? []).some((j: any) => j.provider === "mock");
  } else if ((assets ?? []).length > 0) {
    // Unattributed audio is treated as unverified, i.e. not distributable.
    hasMockAudio = true;
  }

  return {
    metadata: metadata ?? null,
    rights: rights ?? null,
    chapterCount: (chapters ?? []).length,
    chaptersWithCurrentAudio: new Set((assets ?? []).map((a: any) => a.chapter_id)).size,
    hasMockAudio,
    qcOverallResult: (qc?.overall_result as ProjectReadinessState["qcOverallResult"]) ?? null,
  };
}

export function readinessInputFrom(state: ProjectReadinessState) {
  const m = state.metadata;
  const r = state.rights;
  return {
    metadata: m
      ? {
          title: m.title,
          subtitle: m.subtitle,
          authorName: m.author_name,
          narratorName: m.narrator_name,
          publisher: m.publisher,
          description: m.description,
          language: m.language,
          isbn: m.isbn,
          genre: m.genre,
          keywords: m.keywords,
          coverPath: m.cover_path,
          copyrightYear: m.copyright_year,
        }
      : null,
    rights: r
      ? {
          status: r.status,
          version: r.version,
          statementText: r.statement_text,
          attestedAt: r.attested_at,
          revokedAt: r.revoked_at,
        }
      : null,
    chapterCount: state.chapterCount,
    chaptersWithCurrentAudio: state.chaptersWithCurrentAudio,
    hasMockAudio: state.hasMockAudio,
    qcOverallResult: state.qcOverallResult,
    deliveries: [] as never[],
  };
}

export const getAudiobookReadiness = createServerFn({ method: "GET" })
  .middleware([requireAudiobookStudioEnabled, requireSupabaseAuth, requireAudiobookBetaCohort])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    const { data: project } = await supabase
      .from("audiobook_projects")
      .select("id")
      .eq("id", data.projectId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!project) throw new Error("Audiobook project not found");

    const state = await loadProjectReadinessState(supabase, userId, data.projectId);
    const evaluation = evaluateAudiobookReadiness(readinessInputFrom(state));
    return { readiness: evaluation };
  });