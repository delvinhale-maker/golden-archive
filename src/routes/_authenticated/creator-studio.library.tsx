import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Film, Plus } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { listMyProjectsFn } from "@/lib/creator-studio/projects.functions";
import { PROJECT_TYPE_LABELS, type ProjectStatus } from "@/lib/creator-studio/schema";

export const Route = createFileRoute("/_authenticated/creator-studio/library")({
  component: LibraryPage,
});

const STATUS_LABELS: Record<ProjectStatus, string> = {
  DRAFT: "Draft",
  READY: "Saved",
  GENERATING: "Creating your video…",
  COMPLETE: "Your video is ready.",
  FAILED: "We couldn't finish this video. Your video credit was not consumed.",
  ARCHIVED: "Archived",
};

const STATUS_TONE: Record<ProjectStatus, string> = {
  DRAFT: "bg-ink/5 text-mute",
  READY: "bg-sky-50 text-sky-700",
  GENERATING: "bg-amber-50 text-amber-700",
  COMPLETE: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-red-50 text-red-700",
  ARCHIVED: "bg-ink/5 text-mute",
};

function LibraryPage() {
  const listFn = useServerFn(listMyProjectsFn);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["creator-studio", "my-projects"],
    queryFn: () => listFn(),
    retry: false,
  });

  return (
    <PublisherShell accent={ACCENTS.creatorStudio}>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-navy md:text-4xl">My Videos</h1>
        <Link
          to="/creator-studio/new"
          className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-navy"
        >
          <Plus size={16} aria-hidden="true" /> Create My Video
        </Link>
      </div>

      {isLoading ? (
        <p className="mt-8 text-sm text-mute">Loading your videos…</p>
      ) : isError ? (
        <p className="mt-8 text-sm text-destructive">Creator Studio isn't available right now.</p>
      ) : !data || data.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-ink/15 p-10 text-center">
          <Film size={28} className="mx-auto text-mute" aria-hidden="true" />
          <p className="mt-3 text-sm text-mute">You haven't created any videos yet.</p>
          <Link
            to="/creator-studio/new"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-navy"
          >
            Create My Video
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((project) => (
            <Link
              key={project.id}
              to="/creator-studio/$projectId"
              params={{ projectId: project.id }}
              className="rounded-2xl border border-ink/10 bg-white p-5 transition hover:border-[#7A2E52]/40"
            >
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_TONE[project.status]}`}
              >
                {STATUS_LABELS[project.status]}
              </span>
              <h3 className="mt-3 font-display text-base text-navy">{project.title}</h3>
              <p className="mt-1 text-xs text-mute">
                {PROJECT_TYPE_LABELS[project.projectType].label}
                {project.durationSeconds ? ` · ${project.durationSeconds}s` : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </PublisherShell>
  );
}
