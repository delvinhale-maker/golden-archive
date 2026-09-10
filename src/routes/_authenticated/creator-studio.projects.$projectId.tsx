import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban } from "lucide-react";
import { toast } from "sonner";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { getProjectFn, cancelProjectFn } from "@/lib/creator-studio.functions";
import {
  CREATION_TYPE_LABELS,
  STYLE_LABELS,
  type ProjectStatus,
} from "@/lib/creator-studio.schema";

export const Route = createFileRoute("/_authenticated/creator-studio/projects/$projectId")({
  component: ProjectDetailPage,
});

const STATUS_LABELS: Record<ProjectStatus, string> = {
  DRAFT: "Draft",
  READY: "Saved — ready when video creation is turned on",
  QUEUED: "Preparing your promo…",
  RENDERING: "Creating your video…",
  COMPLETED: "Your video is ready.",
  FAILED: "We couldn't finish this video. Your video allowance was not used. Try again.",
  CANCELLED: "Cancelled",
};

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();
  const getFn = useServerFn(getProjectFn);
  const cancelFn = useServerFn(cancelProjectFn);

  const {
    data: project,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["creator-studio", "project", projectId],
    queryFn: () => getFn({ data: { projectId } }),
    retry: false,
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelFn({ data: { projectId } }),
    onSuccess: () => {
      toast.success("Project cancelled");
      void queryClient.invalidateQueries({ queryKey: ["creator-studio", "project", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["creator-studio", "my-projects"] });
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't cancel this project"),
  });

  return (
    <PublisherShell accent={ACCENTS.creatorStudio}>
      <Link
        to="/creator-studio/videos"
        className="inline-flex items-center gap-1.5 text-sm text-mute hover:text-navy"
      >
        <ArrowLeft size={14} aria-hidden="true" /> My Videos
      </Link>

      {isLoading ? (
        <p className="mt-6 text-sm text-mute">Loading…</p>
      ) : isError || !project ? (
        <p className="mt-6 text-sm text-destructive">
          This project isn't available — it may not exist, or Creator Studio isn't turned on right
          now.
        </p>
      ) : (
        <div className="mt-4 max-w-xl">
          <h1 className="font-display text-3xl text-navy">{project.projectName}</h1>
          <p className="mt-2 text-sm font-medium text-[#7A2E52]">{STATUS_LABELS[project.status]}</p>

          <dl className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-ink/10 bg-white p-5 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-mute">
                Video type
              </dt>
              <dd className="mt-1 text-navy">{CREATION_TYPE_LABELS[project.creationType].label}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-mute">Style</dt>
              <dd className="mt-1 text-navy">{STYLE_LABELS[project.style].label}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-mute">Duration</dt>
              <dd className="mt-1 text-navy">{project.durationSeconds} seconds</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-mute">Format</dt>
              <dd className="mt-1 text-navy">9:16 (1080 × 1920)</dd>
            </div>
            {project.headline && (
              <div className="col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-mute">
                  Headline
                </dt>
                <dd className="mt-1 text-navy">{project.headline}</dd>
              </div>
            )}
          </dl>

          {project.status !== "CANCELLED" &&
            project.status !== "COMPLETED" &&
            project.status !== "FAILED" && (
              <button
                type="button"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-ink/15 px-5 py-2.5 text-sm font-semibold text-navy disabled:opacity-50"
              >
                <Ban size={15} aria-hidden="true" /> Cancel project
              </button>
            )}
        </div>
      )}
    </PublisherShell>
  );
}
