import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AudioLines, ArrowRight, Plus, Loader2, Lock } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { listAudiobookProjects, createAudiobookProject } from "@/lib/audiobook-projects.functions";
import { isAudiobookStudioEnabledClient } from "@/lib/audiobook-feature-flags";
import { useAuth } from "@/hooks/use-auth";
import { safeErrorMessage } from "@/lib/audiobook-studio-ui";

export const Route = createFileRoute("/_authenticated/dashboard/audiobooks/")({
  component: AudiobookProjectsPage,
});

function Unavailable() {
  return (
    <PublisherShell accent={ACCENTS.help}>
      <h1 className="font-display text-3xl text-navy">Audiobook Studio</h1>
      <div className="mt-8 max-w-xl rounded-2xl border border-ink/10 bg-white p-8 text-center">
        <Lock className="mx-auto text-mute" size={30} />
        <p className="font-display mt-3 text-xl text-navy">Not available yet</p>
        <p className="mt-2 text-sm text-mute">
          Audiobook Studio isn't switched on for your account. Check back soon.
        </p>
      </div>
    </PublisherShell>
  );
}

function AudiobookProjectsPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const enabled = isAudiobookStudioEnabledClient(import.meta.env);
  if (authLoading) return null;
  if (!enabled || !isAdmin) return <Unavailable />;
  return <ProjectsInner />;
}

function ProjectsInner() {
  const navigate = useNavigate();
  const listFn = useServerFn(listAudiobookProjects);
  const createFn = useServerFn(createAudiobookProject);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["audiobooks", "projects"],
    queryFn: () => listFn(),
    retry: false,
  });

  async function handleCreate() {
    if (title.trim().length === 0) {
      toast.error("Give the audiobook a title first.");
      return;
    }
    setBusy(true);
    try {
      const res = await createFn({
        data: {
          title: title.trim(),
          authorName: authorName.trim() || null,
          language: "en",
        },
      });
      await refetch();
      navigate({
        to: "/dashboard/audiobooks/$audiobookId",
        params: { audiobookId: res.project.id },
      });
    } catch (e) {
      toast.error(safeErrorMessage(e, "Couldn't create this audiobook project."));
    } finally {
      setBusy(false);
    }
  }

  const projects = data?.projects ?? [];

  return (
    <PublisherShell accent={ACCENTS.help}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-navy">Audiobook Studio</h1>
          <p className="mt-1 max-w-xl text-sm text-mute">
            Turn a manuscript into a narrated audiobook: parse chapters, edit for narration, run
            quality control and export a package — with rights confirmed at every step.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy hover:brightness-105"
        >
          <Plus size={15} /> New audiobook
        </button>
      </div>

      {creating && (
        <div className="mt-6 max-w-xl rounded-2xl border border-ink/10 bg-white p-6">
          <p className="font-display text-lg text-navy">Create an audiobook project</p>
          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-mute">
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-navy" placeholder="Dethroning the Bully" />
          </label>
          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-mute">
            Author
            <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-navy" placeholder="Your name" />
          </label>
          <button type="button" disabled={busy} onClick={handleCreate} className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {busy ? <Loader2 className="animate-spin" size={15} /> : <ArrowRight size={15} />}
            Create project
          </button>
        </div>
      )}

      {isLoading && <p className="mt-8 text-sm text-mute">Loading your audiobooks…</p>}

      {error && (
        <div className="mt-8 max-w-xl rounded-2xl border border-ink/10 bg-white p-6">
          <p className="font-display text-lg text-navy">Temporarily unavailable</p>
          <p className="mt-2 text-sm text-mute">{safeErrorMessage(error)}</p>
        </div>
      )}

      {!isLoading && !error && projects.length === 0 && (
        <div className="mt-8 max-w-xl rounded-2xl border border-ink/10 bg-white p-8 text-center">
          <AudioLines className="mx-auto text-mute" size={30} />
          <p className="font-display mt-3 text-xl text-navy">No audiobooks yet</p>
          <p className="mt-2 text-sm text-mute">
            Start with a manuscript you already own the audio rights to. You'll be asked to confirm
            those rights before any narration is produced.
          </p>
          <button type="button" onClick={() => setCreating(true)} className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy hover:brightness-105">
            <Plus size={15} /> Create your first audiobook
          </button>
        </div>
      )}

      {projects.length > 0 && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p: any) => (
            <Link key={p.id} to="/dashboard/audiobooks/$audiobookId" params={{ audiobookId: p.id }} className="group rounded-2xl border border-ink/10 bg-white p-5 transition-colors hover:border-gold">
              <div className="flex items-center gap-2 text-mute">
                <AudioLines size={16} />
                <span className="text-[11px] font-semibold uppercase tracking-wide">{p.status ?? "DRAFT"}</span>
              </div>
              <p className="font-display mt-2 text-lg leading-snug text-navy">{p.title}</p>
              <p className="mt-1 text-sm text-mute">{p.author_name || "No author set"}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-navy group-hover:text-gold">
                Open studio <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </PublisherShell>
  );
}