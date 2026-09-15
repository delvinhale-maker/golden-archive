import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  Lock,
  Play,
  Plus,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Wand2,
} from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { isAudiobookStudioEnabledClient } from "@/lib/audiobook-feature-flags";
import { useAuth } from "@/hooks/use-auth";
import {
  getAudiobookProject,
  updateAudiobookProject,
  beginAudiobookSourceUpload,
  registerAudiobookSource,
  parseAudiobookSource,
  listChapterVersions,
  getChapterVersionText,
  createChapterVersion,
  setCurrentChapterVersion,
  listPronunciations,
  upsertPronunciation,
  deletePronunciation,
  attestAudiobookRights,
  revokeAudiobookRights,
  upsertAudiobookMetadata,
  suggestMetadataFromProduct,
  listOwnedProductsForAudiobook,
} from "@/lib/audiobook-projects.functions";
import {
  estimateNarration,
  generateNarration,
  listNarrationJobs,
  getAudioPlaybackUrl,
  setCurrentAudioAsset,
  listAudiobookAudioAssets,
} from "@/lib/audiobook-jobs.functions";
import { runAudiobookQc, getLatestQcRun } from "@/lib/audiobook-qc.functions";
import { getAudiobookReadiness } from "@/lib/audiobook-readiness.functions";
import { exportAudiobookPackage } from "@/lib/audiobook-package.functions";
import {
  AUDIOBOOK_STEPS,
  IMMUTABLE_SOURCE_WARNING,
  MOCK_NARRATION_BADGE,
  MOCK_NARRATION_EXPLANATION,
  READINESS_LABELS,
  READINESS_TONES,
  RIGHTS_CONFIRMATION_LABEL,
  RIGHTS_REVOKE_WARNING,
  applyMetadataSuggestion,
  canGenerateNarration,
  deriveStepStatuses,
  evaluateExportAvailability,
  safeErrorMessage,
  type AudiobookStepId,
  type MetadataDraft,
  type SuggestibleField,
} from "@/lib/audiobook-studio-ui";

export const Route = createFileRoute("/_authenticated/dashboard/audiobooks/$audiobookId")({
  component: AudiobookDetailPage,
});

const CARD = "rounded-2xl border border-ink/10 bg-white p-6";
const INPUT = "mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm text-navy";
const LABEL = "block text-xs font-semibold uppercase tracking-wide text-mute";
const BTN_GOLD =
  "inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy hover:brightness-105 disabled:opacity-50";
const BTN_NAVY =
  "inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50";
const BTN_GHOST =
  "inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold text-navy hover:bg-ink/5 disabled:opacity-50";

function MockBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
      <AlertTriangle size={11} /> {MOCK_NARRATION_BADGE}
    </span>
  );
}

function AudiobookDetailPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  if (authLoading) return null;
  if (!isAudiobookStudioEnabledClient(import.meta.env) || !isAdmin) {
    return (
      <PublisherShell accent={ACCENTS.help}>
        <h1 className="font-display text-3xl text-navy">Audiobook Studio</h1>
        <div className={`mt-8 max-w-xl text-center ${CARD}`}>
          <Lock className="mx-auto text-mute" size={30} />
          <p className="font-display mt-3 text-xl text-navy">Not available yet</p>
          <p className="mt-2 text-sm text-mute">
            Audiobook Studio isn't switched on for your account.
          </p>
        </div>
      </PublisherShell>
    );
  }
  return <StudioInner />;
}

function StudioInner() {
  const { audiobookId } = Route.useParams();
  const qc = useQueryClient();
  const [step, setStep] = useState<AudiobookStepId>("project");

  const projectFn = useServerFn(getAudiobookProject);
  const assetsFn = useServerFn(listAudiobookAudioAssets);
  const jobsFn = useServerFn(listNarrationJobs);
  const pronFn = useServerFn(listPronunciations);
  const qcFn = useServerFn(getLatestQcRun);
  const readinessFn = useServerFn(getAudiobookReadiness);

  const projectQ = useQuery({
    queryKey: ["audiobooks", audiobookId, "project"],
    queryFn: () => projectFn({ data: { projectId: audiobookId } }),
    retry: false,
  });
  const assetsQ = useQuery({
    queryKey: ["audiobooks", audiobookId, "assets"],
    queryFn: () => assetsFn({ data: { projectId: audiobookId } }),
    retry: false,
  });
  const jobsQ = useQuery({
    queryKey: ["audiobooks", audiobookId, "jobs"],
    queryFn: () => jobsFn({ data: { projectId: audiobookId } }),
    retry: false,
  });
  const pronQ = useQuery({
    queryKey: ["audiobooks", audiobookId, "pronunciations"],
    queryFn: () => pronFn({ data: { projectId: audiobookId } }),
    retry: false,
  });
  const qcQ = useQuery({
    queryKey: ["audiobooks", audiobookId, "qc"],
    queryFn: () => qcFn({ data: { projectId: audiobookId } }),
    retry: false,
  });
  const readinessQ = useQuery({
    queryKey: ["audiobooks", audiobookId, "readiness"],
    queryFn: () => readinessFn({ data: { projectId: audiobookId } }),
    retry: false,
  });

  function invalidateAll() {
    void qc.invalidateQueries({ queryKey: ["audiobooks", audiobookId] });
  }

  if (projectQ.isLoading) {
    return (
      <PublisherShell accent={ACCENTS.help}>
        <p className="text-sm text-mute">Loading audiobook…</p>
      </PublisherShell>
    );
  }

  if (projectQ.error || !projectQ.data) {
    return (
      <PublisherShell accent={ACCENTS.help}>
        <div className={`max-w-xl ${CARD}`}>
          <p className="font-display text-lg text-navy">Couldn't open this audiobook</p>
          <p className="mt-2 text-sm text-mute">{safeErrorMessage(projectQ.error)}</p>
          <Link to="/dashboard/audiobooks" className={`mt-4 ${BTN_GHOST}`}>
            <ArrowLeft size={14} /> Back to Audiobook Studio
          </Link>
        </div>
      </PublisherShell>
    );
  }

  const { project, chapters, sources, metadata, rights } = projectQ.data as any;
  const assets = assetsQ.data?.assets ?? [];
  const currentAssets = assets.filter((a: any) => a.isCurrent);
  const hasMockAudio = currentAssets.some((a: any) => a.isMock);
  const rightsAttested = rights?.status === "ATTESTED";
  const readiness = readinessQ.data?.readiness ?? null;

  const statuses = deriveStepStatuses({
    hasProject: true,
    sourceCount: sources.length,
    parsedSourceCount: chapters.length > 0 ? sources.length : 0,
    chapterCount: chapters.length,
    chaptersWithAudio: new Set(currentAssets.map((a: any) => a.chapterId)).size,
    pronunciationCount: pronQ.data?.pronunciations?.length ?? 0,
    rightsAttested,
    qcResult: (qcQ.data?.run?.overall_result as any) ?? null,
    metadataComplete: Boolean(metadata?.is_complete),
    readinessState: readiness?.state ?? null,
  });

  return (
    <PublisherShell accent={ACCENTS.help}>
      <Link to="/dashboard/audiobooks" className="text-sm font-semibold text-mute hover:text-navy">
        ← Audiobook Studio
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-navy">{project.title}</h1>
          <p className="mt-1 text-sm text-mute">
            {project.author_name || "No author set"} · {project.status}
            {readiness && (
              <>
                {" · "}
                <span
                  className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold ${READINESS_TONES[readiness.state as keyof typeof READINESS_TONES]}`}
                >
                  {READINESS_LABELS[readiness.state as keyof typeof READINESS_LABELS]}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {hasMockAudio && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <MockBadge />
          <p className="text-sm text-amber-800">{MOCK_NARRATION_EXPLANATION}</p>
        </div>
      )}

      <nav className="mt-6 flex flex-wrap gap-2">
        {AUDIOBOOK_STEPS.map((s, i) => {
          const active = step === s.id;
          const status = statuses[s.id];
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                active
                  ? "border-navy bg-navy text-white"
                  : "border-ink/15 bg-white text-navy hover:border-gold"
              }`}
            >
              <span className="mr-1 opacity-60">{i + 1}.</span>
              {s.label}
              {status === "DONE" && <span className="ml-1 text-emerald-500">•</span>}
              {status === "BLOCKED" && <span className="ml-1 text-amber-500">•</span>}
            </button>
          );
        })}
      </nav>

      <div className="mt-6 space-y-6">
        {step === "project" && (
          <ProjectStep project={project} onSaved={invalidateAll} />
        )}
        {step === "manuscript" && (
          <ManuscriptStep
            projectId={audiobookId}
            sources={sources}
            chapterCount={chapters.length}
            onChanged={invalidateAll}
          />
        )}
        {step === "chapters" && <ChaptersStep chapters={chapters} onChanged={invalidateAll} />}
        {step === "narration" && (
          <NarrationStep
            projectId={audiobookId}
            chapters={chapters}
            pronunciations={pronQ.data?.pronunciations ?? []}
            rightsAttested={rightsAttested}
            onChanged={invalidateAll}
          />
        )}
        {step === "review" && (
          <ReviewStep
            chapters={chapters}
            assets={assets}
            jobs={jobsQ.data?.jobs ?? []}
            onChanged={invalidateAll}
          />
        )}
        {step === "qc" && (
          <QcStep projectId={audiobookId} latest={qcQ.data ?? null} onChanged={invalidateAll} />
        )}
        {step === "metadata" && (
          <MetadataRightsStep
            projectId={audiobookId}
            metadata={metadata}
            rights={rights}
            onChanged={invalidateAll}
          />
        )}
        {step === "readiness" && (
          <ReadinessStep
            projectId={audiobookId}
            readiness={readiness}
            audioAssetCount={currentAssets.length}
            hasMockAudio={hasMockAudio}
          />
        )}
      </div>
    </PublisherShell>
  );
}

/* ------------------------------- 1. Project ------------------------------ */

function ProjectStep({ project, onSaved }: { project: any; onSaved: () => void }) {
  const save = useServerFn(updateAudiobookProject);
  const [title, setTitle] = useState(project.title ?? "");
  const [authorName, setAuthorName] = useState(project.author_name ?? "");
  const [description, setDescription] = useState(project.description ?? "");
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    try {
      await save({
        data: {
          projectId: project.id,
          title: title.trim(),
          authorName: authorName.trim() || null,
          description: description.trim() || null,
        },
      });
      toast.success("Project details saved.");
      onSaved();
    } catch (e) {
      toast.error(safeErrorMessage(e, "Couldn't save these details."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`max-w-2xl ${CARD}`}>
      <h2 className="font-display text-xl text-navy">Project</h2>
      <label className={`mt-4 ${LABEL}`}>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT} />
      </label>
      <label className={`mt-3 ${LABEL}`}>
        Author
        <input
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          className={INPUT}
        />
      </label>
      <label className={`mt-3 ${LABEL}`}>
        Description
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={INPUT}
        />
      </label>
      <button type="button" onClick={handleSave} disabled={busy} className={`mt-5 ${BTN_NAVY}`}>
        {busy && <Loader2 className="animate-spin" size={14} />} Save details
      </button>
    </section>
  );
}

/* ------------------------------ 2. Manuscript ---------------------------- */

function ManuscriptStep({
  projectId,
  sources,
  chapterCount,
  onChanged,
}: {
  projectId: string;
  sources: any[];
  chapterCount: number;
  onChanged: () => void;
}) {
  const begin = useServerFn(beginAudiobookSourceUpload);
  const register = useServerFn(registerAudiobookSource);
  const parse = useServerFn(parseAudiobookSource);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [stage, setStage] = useState<string | null>(null);

  async function handleFile(file: File) {
    try {
      setStage("Preparing secure upload…");
      const started = await begin({
        data: {
          projectId,
          fileName: file.name,
          fileSizeBytes: file.size,
          mimeType: file.type || null,
        },
      });
      setStage("Uploading manuscript…");
      const res = await fetch(started.upload.signedUrl, {
        method: "PUT",
        body: file,
        headers: file.type ? { "content-type": file.type } : undefined,
      });
      if (!res.ok) throw new Error("The upload didn't complete. Please try again.");
      setStage("Registering manuscript…");
      await register({
        data: {
          projectId,
          fileName: file.name,
          fileSizeBytes: file.size,
          mimeType: file.type || null,
          sourceId: started.sourceId,
          storagePath: started.storagePath,
        },
      });
      setStage("Parsing chapters…");
      const parsed = await parse({ data: { sourceId: started.sourceId } });
      toast.success(`Parsed ${parsed.chapters.length} chapter(s).`);
      onChanged();
    } catch (e) {
      toast.error(safeErrorMessage(e, "Couldn't process this manuscript."));
    } finally {
      setStage(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className={`max-w-2xl ${CARD}`}>
      <h2 className="font-display text-xl text-navy">Manuscript</h2>
      <p className="mt-2 text-sm text-mute">
        Upload a TXT, DOCX, EPUB or clean (text-based) PDF. Scanned image PDFs can't be read.
      </p>
      <p className="mt-3 rounded-xl border border-ink/10 bg-ink/[0.03] p-3 text-xs text-mute">
        {IMMUTABLE_SOURCE_WARNING}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".txt,.docx,.epub,.pdf,text/plain,application/pdf,application/epub+zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <button
        type="button"
        disabled={stage !== null || chapterCount > 0}
        onClick={() => inputRef.current?.click()}
        className={`mt-5 ${BTN_GOLD}`}
      >
        {stage ? <Loader2 className="animate-spin" size={15} /> : <UploadCloud size={15} />}
        {chapterCount > 0 ? "Already parsed" : "Upload manuscript"}
      </button>
      {stage && <p className="mt-2 text-sm text-mute">{stage}</p>}

      <div className="mt-6 space-y-2">
        {sources.length === 0 && (
          <p className="text-sm text-mute">No manuscript uploaded yet.</p>
        )}
        {sources.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 px-3 py-2 text-sm"
          >
            <span className="font-semibold text-navy">{s.file_name}</span>
            <span className="text-xs text-mute">
              {s.validation_status ?? "PENDING"}
              {s.word_count ? ` · ${s.word_count} words` : ""}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------- 3. Chapters ----------------------------- */

function ChaptersStep({ chapters, onChanged }: { chapters: any[]; onChanged: () => void }) {
  const [selected, setSelected] = useState<string | null>(chapters[0]?.id ?? null);
  const versionsFn = useServerFn(listChapterVersions);
  const textFn = useServerFn(getChapterVersionText);
  const createFn = useServerFn(createChapterVersion);
  const setCurrentFn = useServerFn(setCurrentChapterVersion);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const versionsQ = useQuery({
    queryKey: ["audiobooks", "chapter", selected, "versions"],
    queryFn: () => versionsFn({ data: { chapterId: selected as string } }),
    enabled: Boolean(selected),
    retry: false,
  });
  const current = versionsQ.data?.versions?.find((v: any) => v.is_current);
  const textQ = useQuery({
    queryKey: ["audiobooks", "version", current?.id, "text"],
    queryFn: () => textFn({ data: { versionId: current.id } }),
    enabled: Boolean(current?.id),
    retry: false,
  });

  if (chapters.length === 0) {
    return (
      <section className={`max-w-2xl ${CARD}`}>
        <h2 className="font-display text-xl text-navy">Chapters</h2>
        <p className="mt-2 text-sm text-mute">
          No chapters yet — upload and parse a manuscript first.
        </p>
      </section>
    );
  }

  async function handleCreateVersion() {
    if (!selected || draft.trim().length === 0) {
      toast.error("Add the narration-edited text first.");
      return;
    }
    setBusy(true);
    try {
      await createFn({
        data: {
          chapterId: selected,
          editedText: draft,
          changeNote: "Narration edit",
          makeCurrent: true,
        },
      });
      toast.success("New narration version saved. The original text is unchanged.");
      setDraft("");
      await versionsQ.refetch();
      onChanged();
    } catch (e) {
      toast.error(safeErrorMessage(e, "Couldn't save this version."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className={CARD}>
        <h2 className="font-display text-xl text-navy">Chapters</h2>
        <div className="mt-3 space-y-1">
          {chapters.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setSelected(c.id);
                setDraft("");
              }}
              className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${
                selected === c.id ? "bg-navy text-white" : "text-navy hover:bg-ink/5"
              }`}
            >
              {c.chapter_index + 1}. {c.title || "Untitled"}
              <span className="ml-1 text-xs opacity-60">{c.char_count} ch.</span>
            </button>
          ))}
        </div>
      </div>

      <div className={CARD}>
        <p className="rounded-xl border border-ink/10 bg-ink/[0.03] p-3 text-xs text-mute">
          {IMMUTABLE_SOURCE_WARNING}
        </p>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-mute">
          Current narration text {current ? `(v${current.version})` : ""}
        </p>
        <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-xl border border-ink/10 p-3 text-sm text-navy">
          {textQ.isLoading ? "Loading…" : (textQ.data?.version?.edited_text ?? "—")}
        </pre>

        <label className={`mt-5 ${LABEL}`}>
          New narration-edit version
          <textarea
            rows={6}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste the narration-adjusted text for this chapter…"
            className={INPUT}
          />
        </label>
        <button
          type="button"
          onClick={handleCreateVersion}
          disabled={busy}
          className={`mt-3 ${BTN_NAVY}`}
        >
          {busy && <Loader2 className="animate-spin" size={14} />} Save as new version
        </button>

        <div className="mt-6 space-y-1">
          {(versionsQ.data?.versions ?? []).map((v: any) => (
            <div
              key={v.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-ink/10 px-3 py-2 text-sm"
            >
              <span className="text-navy">
                v{v.version} {v.is_current && <span className="text-emerald-600">· current</span>}
              </span>
              {!v.is_current && (
                <button
                  type="button"
                  className={BTN_GHOST}
                  onClick={async () => {
                    try {
                      await setCurrentFn({ data: { versionId: v.id } });
                      await versionsQ.refetch();
                      onChanged();
                    } catch (e) {
                      toast.error(safeErrorMessage(e));
                    }
                  }}
                >
                  Use this version
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ 4. Narration ----------------------------- */

function NarrationStep({
  projectId,
  chapters,
  pronunciations,
  rightsAttested,
  onChanged,
}: {
  projectId: string;
  chapters: any[];
  pronunciations: any[];
  rightsAttested: boolean;
  onChanged: () => void;
}) {
  const estimateFn = useServerFn(estimateNarration);
  const generateFn = useServerFn(generateNarration);
  const upsertPron = useServerFn(upsertPronunciation);
  const deletePron = useServerFn(deletePronunciation);
  const [chapterId, setChapterId] = useState<string | null>(chapters[0]?.id ?? null);
  const [estimate, setEstimate] = useState<any>(null);
  const [busy, setBusy] = useState<null | "estimate" | "generate">(null);
  const [term, setTerm] = useState("");
  const [replacement, setReplacement] = useState("");

  const gate = canGenerateNarration({ rightsAttested, chapterCount: chapters.length });

  return (
    <section className="space-y-4">
      <div className={`max-w-2xl ${CARD}`}>
        <h2 className="font-display text-xl text-navy">Voice / Narration</h2>
        <p className="mt-2 text-sm text-mute">
          Narration uses the voice provider configured for your account. Run Estimate to see which
          provider will be used — placeholder audio is always labelled as such.
        </p>
        {!gate.allowed && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {gate.reason}
          </p>
        )}
        <label className={`mt-4 ${LABEL}`}>
          Chapter
          <select
            className={INPUT}
            value={chapterId ?? ""}
            onChange={(e) => {
              setChapterId(e.target.value);
              setEstimate(null);
            }}
          >
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.chapter_index + 1}. {c.title || "Untitled"}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!chapterId || busy !== null}
            className={BTN_GHOST}
            onClick={async () => {
              setBusy("estimate");
              try {
                setEstimate(await estimateFn({ data: { chapterId: chapterId as string } }));
              } catch (e) {
                toast.error(safeErrorMessage(e, "Couldn't estimate this chapter."));
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === "estimate" ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Wand2 size={14} />
            )}
            Estimate
          </button>
          <button
            type="button"
            disabled={!chapterId || !gate.allowed || busy !== null}
            className={BTN_GOLD}
            onClick={async () => {
              setBusy("generate");
              try {
                const res = await generateFn({ data: { chapterId: chapterId as string } });
                toast.success(
                  res.reused
                    ? "Reused the existing placeholder take — nothing was re-billed."
                    : "Placeholder narration generated.",
                );
                onChanged();
              } catch (e) {
                toast.error(safeErrorMessage(e, "Couldn't generate narration."));
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === "generate" ? (
              <Loader2 className="animate-spin" size={15} />
            ) : (
              <Play size={15} />
            )}
            Generate placeholder narration
          </button>
        </div>
        {estimate && (
          <div className="mt-4 rounded-xl border border-ink/10 p-3 text-sm text-navy">
            {estimate.segments} segment(s) · {estimate.characters} characters · about{" "}
            {Math.round(estimate.estimatedDurationSeconds / 60)} min · provider{" "}
            <span className="font-semibold">{estimate.provider}</span>
            {estimate.isMock && (
              <>
                {" "}
                <MockBadge />
              </>
            )}
          </div>
        )}
      </div>

      <div className={`max-w-2xl ${CARD}`}>
        <h3 className="font-display text-lg text-navy">Pronunciations</h3>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className={`flex-1 ${LABEL}`}>
            Term
            <input value={term} onChange={(e) => setTerm(e.target.value)} className={INPUT} />
          </label>
          <label className={`flex-1 ${LABEL}`}>
            Say it as
            <input
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              className={INPUT}
            />
          </label>
          <button
            type="button"
            className={BTN_NAVY}
            onClick={async () => {
              if (term.trim().length === 0) return;
              try {
                await upsertPron({
                  data: {
                    projectId,
                    term: term.trim(),
                    replacement: replacement.trim() || null,
                  },
                });
                setTerm("");
                setReplacement("");
                onChanged();
              } catch (e) {
                toast.error(safeErrorMessage(e, "Couldn't save this pronunciation."));
              }
            }}
          >
            <Plus size={14} /> Add
          </button>
        </div>
        <div className="mt-4 space-y-1">
          {pronunciations.length === 0 && (
            <p className="text-sm text-mute">No pronunciation rules yet.</p>
          )}
          {pronunciations.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-ink/10 px-3 py-2 text-sm"
            >
              <span className="text-navy">
                {p.term} → {p.replacement || p.ipa || "—"}
              </span>
              <button
                type="button"
                aria-label={`Remove ${p.term}`}
                className="text-mute hover:text-red-600"
                onClick={async () => {
                  try {
                    await deletePron({ data: { id: p.id } });
                    onChanged();
                  } catch (e) {
                    toast.error(safeErrorMessage(e));
                  }
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- 5. Review ------------------------------ */

function ReviewStep({
  chapters,
  assets,
  jobs,
  onChanged,
}: {
  chapters: any[];
  assets: any[];
  jobs: any[];
  onChanged: () => void;
}) {
  const playFn = useServerFn(getAudioPlaybackUrl);
  const setCurrentFn = useServerFn(setCurrentAudioAsset);
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);

  const byChapter = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const a of assets) {
      const list = map.get(a.chapterId) ?? [];
      list.push(a);
      map.set(a.chapterId, list);
    }
    return map;
  }, [assets]);

  if (assets.length === 0) {
    return (
      <section className={`max-w-2xl ${CARD}`}>
        <h2 className="font-display text-xl text-navy">Review</h2>
        <p className="mt-2 text-sm text-mute">
          No audio yet. Generate narration for a chapter to review it here.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {chapters.map((c) => {
        const takes = byChapter.get(c.id) ?? [];
        if (takes.length === 0) return null;
        return (
          <div key={c.id} className={CARD}>
            <p className="font-display text-lg text-navy">
              {c.chapter_index + 1}. {c.title || "Untitled"}
            </p>
            <div className="mt-3 space-y-2">
              {takes.map((a: any) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 px-3 py-2 text-sm"
                >
                  <span className="flex flex-wrap items-center gap-2 text-navy">
                    Take v{a.version}
                    {a.isCurrent && <span className="text-emerald-600">· accepted</span>}
                    {a.isMock && <MockBadge />}
                  </span>
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      className={BTN_GHOST}
                      onClick={async () => {
                        try {
                          const { url } = await playFn({ data: { assetId: a.id } });
                          setPlaying({ id: a.id, url });
                        } catch (e) {
                          toast.error(safeErrorMessage(e, "Couldn't open this audio."));
                        }
                      }}
                    >
                      <Play size={14} /> Play
                    </button>
                    {!a.isCurrent && (
                      <button
                        type="button"
                        className={BTN_GHOST}
                        onClick={async () => {
                          try {
                            await setCurrentFn({ data: { assetId: a.id } });
                            toast.success("Accepted take updated.");
                            onChanged();
                          } catch (e) {
                            toast.error(safeErrorMessage(e));
                          }
                        }}
                      >
                        Accept this take
                      </button>
                    )}
                  </span>
                </div>
              ))}
              {playing && takes.some((a: any) => a.id === playing.id) && (
                <audio className="w-full" controls autoPlay src={playing.url} />
              )}
            </div>
          </div>
        );
      })}

      <div className={CARD}>
        <h3 className="font-display text-lg text-navy">Generation jobs</h3>
        <div className="mt-3 space-y-1">
          {jobs.map((j) => (
            <div
              key={j.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 px-3 py-2 text-sm"
            >
              <span className="text-navy">
                {j.status} · {j.provider}
                {j.provider === "mock" && (
                  <>
                    {" "}
                    <MockBadge />
                  </>
                )}
              </span>
              <span className="text-xs text-mute">{j.requested_characters ?? 0} characters</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------- 6. QC -------------------------------- */

function QcStep({
  projectId,
  latest,
  onChanged,
}: {
  projectId: string;
  latest: any;
  onChanged: () => void;
}) {
  const runFn = useServerFn(runAudiobookQc);
  const [busy, setBusy] = useState(false);

  const results = latest?.results ?? [];

  return (
    <section className={`max-w-3xl ${CARD}`}>
      <h2 className="font-display text-xl text-navy">Quality control</h2>
      <p className="mt-2 text-sm text-mute">
        QC checks metadata, rights and the accepted audio for each chapter.
      </p>
      <button
        type="button"
        disabled={busy}
        className={`mt-4 ${BTN_GOLD}`}
        onClick={async () => {
          setBusy(true);
          try {
            const res = await runFn({ data: { projectId } });
            toast.success(`QC finished: ${res.overallResult}`);
            onChanged();
          } catch (e) {
            toast.error(safeErrorMessage(e, "Couldn't run quality control."));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="animate-spin" size={15} /> : <ShieldCheck size={15} />} Run QC
      </button>

      {latest?.run && (
        <p className="mt-4 text-sm font-semibold text-navy">
          Last run: {latest.run.overall_result ?? latest.run.status}
        </p>
      )}

      <div className="mt-4 space-y-1">
        {results.length === 0 && <p className="text-sm text-mute">No QC results yet.</p>}
        {results.map((r: any, i: number) => (
          <div
            key={`${r.check_code}-${i}`}
            className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-ink/10 px-3 py-2 text-sm"
          >
            <span className="text-navy">
              {r.passed ? (
                <CheckCircle2 className="mr-1 inline text-emerald-600" size={14} />
              ) : (
                <AlertTriangle
                  className={`mr-1 inline ${r.severity === "BLOCKER" ? "text-red-600" : "text-amber-600"}`}
                  size={14}
                />
              )}
              {r.check_code}
            </span>
            <span className="max-w-md text-right text-xs text-mute">{r.detail}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------- 7. Metadata & Rights ------------------------- */

function MetadataRightsStep({
  projectId,
  metadata,
  rights,
  onChanged,
}: {
  projectId: string;
  metadata: any;
  rights: any;
  onChanged: () => void;
}) {
  const saveFn = useServerFn(upsertAudiobookMetadata);
  const suggestFn = useServerFn(suggestMetadataFromProduct);
  const productsFn = useServerFn(listOwnedProductsForAudiobook);
  const attestFn = useServerFn(attestAudiobookRights);
  const revokeFn = useServerFn(revokeAudiobookRights);

  const [draft, setDraft] = useState<MetadataDraft>({
    title: metadata?.title ?? "",
    subtitle: metadata?.subtitle ?? "",
    authorName: metadata?.author_name ?? "",
    narratorName: metadata?.narrator_name ?? "",
    publisher: metadata?.publisher ?? "",
    description: metadata?.description ?? "",
    language: metadata?.language ?? "en",
    isbn: metadata?.isbn ?? "",
    genre: metadata?.genre ?? "",
    copyrightYear: metadata?.copyright_year ? String(metadata.copyright_year) : "",
  });
  const [evaluation, setEvaluation] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<any>(null);
  const [picked, setPicked] = useState<SuggestibleField[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [statement, setStatement] = useState("");

  const productsQ = useQuery({
    queryKey: ["audiobooks", "owned-products"],
    queryFn: () => productsFn(),
    retry: false,
  });

  const attested = rights?.status === "ATTESTED";

  return (
    <section className="space-y-4">
      <div className={`max-w-2xl ${CARD}`}>
        <h2 className="font-display text-xl text-navy">Metadata</h2>

        <div className="mt-4 rounded-xl border border-ink/10 bg-ink/[0.03] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-mute">
            Suggest from an existing product
          </p>
          <select
            className={INPUT}
            defaultValue=""
            onChange={async (e) => {
              const productId = e.target.value;
              if (!productId) return;
              try {
                const res = await suggestFn({ data: { projectId, productId } });
                setSuggestion(res.suggestion);
                setPicked([]);
                toast.message(res.note);
              } catch (err) {
                toast.error(safeErrorMessage(err, "Couldn't read that product."));
              }
            }}
          >
            <option value="">Choose a product…</option>
            {(productsQ.data?.products ?? []).map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          {suggestion && (
            <div className="mt-3 space-y-2 text-sm">
              <p className="text-xs text-mute">
                Nothing has been saved. Tick the fields you want, then apply them.
              </p>
              {(["title", "subtitle", "description", "language"] as SuggestibleField[]).map(
                (field) =>
                  suggestion[field] ? (
                    <label key={field} className="flex items-start gap-2 text-navy">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={picked.includes(field)}
                        onChange={(e) =>
                          setPicked((prev) =>
                            e.target.checked
                              ? [...prev, field]
                              : prev.filter((f) => f !== field),
                          )
                        }
                      />
                      <span>
                        <span className="font-semibold">{field}:</span>{" "}
                        <span className="text-mute">{String(suggestion[field]).slice(0, 160)}</span>
                      </span>
                    </label>
                  ) : null,
              )}
              <button
                type="button"
                disabled={picked.length === 0}
                className={BTN_GHOST}
                onClick={() => {
                  setDraft((d) => applyMetadataSuggestion(d, suggestion, picked));
                  toast.success("Applied the selected fields to the form — remember to save.");
                }}
              >
                Apply selected fields
              </button>
            </div>
          )}
        </div>

        {(
          [
            ["title", "Title"],
            ["subtitle", "Subtitle"],
            ["authorName", "Author"],
            ["narratorName", "Narrator (synthetic narration must be disclosed)"],
            ["publisher", "Publisher"],
            ["language", "Language"],
            ["isbn", "ISBN"],
            ["genre", "Genre"],
            ["copyrightYear", "Copyright year"],
          ] as [keyof MetadataDraft, string][]
        ).map(([key, label]) => (
          <label key={key} className={`mt-3 ${LABEL}`}>
            {label}
            <input
              value={draft[key]}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              className={INPUT}
            />
          </label>
        ))}
        <label className={`mt-3 ${LABEL}`}>
          Description
          <textarea
            rows={5}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className={INPUT}
          />
        </label>

        <button
          type="button"
          disabled={busy}
          className={`mt-5 ${BTN_NAVY}`}
          onClick={async () => {
            setBusy(true);
            try {
              const year = Number.parseInt(draft.copyrightYear, 10);
              const res = await saveFn({
                data: {
                  projectId,
                  title: draft.title.trim() || null,
                  subtitle: draft.subtitle.trim() || null,
                  authorName: draft.authorName.trim() || null,
                  narratorName: draft.narratorName.trim() || null,
                  publisher: draft.publisher.trim() || null,
                  description: draft.description.trim() || null,
                  language: draft.language.trim() || "en",
                  isbn: draft.isbn.trim() || null,
                  genre: draft.genre.trim() || null,
                  copyrightYear: Number.isFinite(year) ? year : null,
                },
              });
              setEvaluation(res.evaluation);
              toast.success("Metadata saved.");
              onChanged();
            } catch (e) {
              toast.error(safeErrorMessage(e, "Couldn't save this metadata."));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy && <Loader2 className="animate-spin" size={14} />} Save metadata
        </button>

        {evaluation && (
          <div className="mt-4 space-y-1 text-sm">
            <p className="font-semibold text-navy">
              Completeness: {evaluation.score}% {evaluation.isComplete ? "· complete" : ""}
            </p>
            {evaluation.blockers.map((b: any) => (
              <p key={b.code} className="text-red-700">
                Blocker — {b.message}
              </p>
            ))}
            {evaluation.warnings.map((w: any) => (
              <p key={w.code} className="text-amber-700">
                Warning — {w.message}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className={`max-w-2xl ${CARD}`}>
        <h2 className="font-display text-xl text-navy">Narration rights</h2>
        {attested ? (
          <>
            <p className="mt-2 text-sm text-emerald-700">
              <CheckCircle2 className="mr-1 inline" size={14} /> Rights attested (v{rights.version}).
            </p>
            <p className="mt-3 rounded-xl border border-ink/10 bg-ink/[0.03] p-3 text-xs text-mute">
              {rights.statement_text}
            </p>
            <p className="mt-3 text-xs text-amber-700">{RIGHTS_REVOKE_WARNING}</p>
            <button
              type="button"
              className={`mt-3 ${BTN_GHOST}`}
              onClick={async () => {
                try {
                  await revokeFn({ data: { attestationId: rights.id } });
                  toast.success("Attestation revoked.");
                  onChanged();
                } catch (e) {
                  toast.error(safeErrorMessage(e));
                }
              }}
            >
              Revoke attestation
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-mute">
              Audio generation stays disabled until you confirm your rights.
            </p>
            <label className={`mt-4 ${LABEL}`}>
              Rights statement
              <textarea
                rows={3}
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                placeholder="Describe the rights you hold in this work."
                className={INPUT}
              />
            </label>
            <label className="mt-3 flex items-start gap-2 text-sm text-navy">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>{RIGHTS_CONFIRMATION_LABEL}</span>
            </label>
            <button
              type="button"
              disabled={!confirmed || statement.trim().length === 0}
              className={`mt-4 ${BTN_GOLD}`}
              onClick={async () => {
                try {
                  await attestAudiobookRightsSafe();
                } catch (e) {
                  toast.error(safeErrorMessage(e, "Couldn't record this attestation."));
                }
              }}
            >
              <ShieldCheck size={15} /> Attest narration rights
            </button>
          </>
        )}
      </div>
    </section>
  );

  async function attestAudiobookRightsSafe() {
    await attestFn({ data: { projectId, statementText: statement.trim() } });
    toast.success("Rights attested. Narration is now unlocked.");
    setConfirmed(false);
    setStatement("");
    onChanged();
  }
}

/* --------------------------- 8. Readiness / Export ----------------------- */

function ReadinessStep({
  projectId,
  readiness,
  audioAssetCount,
  hasMockAudio,
}: {
  projectId: string;
  readiness: any;
  audioAssetCount: number;
  hasMockAudio: boolean;
}) {
  const exportFn = useServerFn(exportAudiobookPackage);
  const [busy, setBusy] = useState(false);
  const decision = evaluateExportAvailability({ audioAssetCount, hasMockAudio });

  async function handleExport() {
    setBusy(true);
    try {
      const res = await exportFn({ data: { projectId } });
      const bytes = Uint8Array.from(atob(res.zipBase64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Package exported.");
    } catch (e) {
      toast.error(safeErrorMessage(e, "Couldn't export this package."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`max-w-2xl ${CARD}`}>
      <h2 className="font-display text-xl text-navy">Readiness & export</h2>
      {readiness ? (
        <>
          <p className="mt-3">
            <span
              className={`inline-block rounded-full border px-3 py-1 text-sm font-bold ${READINESS_TONES[readiness.state as keyof typeof READINESS_TONES]}`}
            >
              {READINESS_LABELS[readiness.state as keyof typeof READINESS_LABELS]}
            </span>
          </p>
          <div className="mt-4 space-y-1 text-sm">
            {(readiness.blockers ?? []).map((b: any) => (
              <p key={b.code} className="text-red-700">
                Blocker — {b.message}
              </p>
            ))}
            {(readiness.warnings ?? []).map((w: any) => (
              <p key={w.code} className="text-amber-700">
                Warning — {w.message}
              </p>
            ))}
            {(readiness.blockers ?? []).length === 0 &&
              (readiness.warnings ?? []).length === 0 && (
                <p className="text-mute">No blockers or warnings recorded.</p>
              )}
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-mute">Readiness will appear once the project has data.</p>
      )}

      {decision.reason && (
        <p
          className={`mt-5 rounded-xl border p-3 text-sm ${
            decision.allowed
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-ink/10 bg-ink/[0.03] text-mute"
          }`}
        >
          {decision.reason}
        </p>
      )}

      <button
        type="button"
        disabled={!decision.allowed || busy}
        onClick={handleExport}
        className={`mt-4 ${BTN_GOLD}`}
      >
        {busy ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />}
        {decision.testOnly ? "Export workflow-test package" : "Export package"}
      </button>
    </section>
  );
}