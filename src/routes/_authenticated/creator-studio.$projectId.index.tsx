import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Ban, Download } from "lucide-react";
import { toast } from "sonner";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { getProjectFn, archiveProjectFn } from "@/lib/creator-studio/projects.functions";
import {
  getLatestRenderJobForProjectFn,
  getSignedOutputUrlFn,
} from "@/lib/creator-studio/render-jobs.functions";
import {
  PROJECT_TYPE_LABELS,
  STYLE_PRESET_LABELS,
  type ProjectStatus,
} from "@/lib/creator-studio/schema";

export const Route = createFileRoute("/_authenticated/creator-studio/$projectId/")({
  component: ProjectOverviewPage,
});

const STATUS_LABELS: Record<ProjectStatus, string> = {
  DRAFT: "Draft — continue where you left off",
  READY: "Saved — ready to generate",
  GENERATING: "Creating your video…",
  COMPLETE: "Your video is ready.",
  FAILED: "We couldn't finish this video. Your video credit was not consumed.",
  ARCHIVED: "Archived",
};

/** Overview/status hub for one project. Not a wizard step -- what you land on from the library, or after a render finishes. */
function ProjectOverviewPage() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();

  const getFn = useServerFn(getProjectFn);
  const jobFn = useServerFn(getLatestRenderJobForProjectFn);
  const signedUrlFn = useServerFn(getSignedOutputUrlFn);
  const archiveFn = useServerFn(archiveProjectFn);

  const {
    data: project,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["creator-studio", "project", projectId],
    queryFn: () => getFn({ data: { projectId } }),
    retry: false,
  });
  const { data: job } = useQuery({
    queryKey: ["creator-studio", "render-status", projectId],
    queryFn: () => jobFn({ data: { projectId } }),
    retry: false,
    enabled:
      project?.status === "COMPLETE" ||
      project?.status === "GENERATING" ||
      project?.status === "FAILED",
  });
  const { data: outputUrl } = useQuery({
    queryKey: ["creator-studio", "output-url", job?.outputAssetId],
    queryFn: () => signedUrlFn({ data: { assetId: job!.outputAssetId! } }),
    enabled: project?.status === "COMPLETE" && !!job?.outputAssetId,
    retry: false,
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveFn({ data: { projectId } }),
    onSuccess: () => {
      toast.success("Project archived");
      void queryClient.invalidateQueries({ queryKey: ["creator-studio", "project", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["creator-studio", "my-projects"] });
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't archive this project"),
  });

  const continueStep =
    project?.status === "DRAFT" || project?.status === "READY" || project?.status === "FAILED"
      ? ("/creator-studio/$projectId/style" as const)
      : null;

  return (
    <PublisherShell accent={ACCENTS.creatorStudio}>
      <Link
        to="/creator-studio/library"
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
          <h1 className="font-display text-3xl text-navy">{project.title}</h1>
          <p className="mt-2 text-sm font-medium text-[#7A2E52]">{STATUS_LABELS[project.status]}</p>

          <dl className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-ink/10 bg-white p-5 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-mute">
                Video type
              </dt>
              <dd className="mt-1 text-navy">{PROJECT_TYPE_LABELS[project.projectType].label}</dd>
            </div>
            {project.stylePreset && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-mute">Style</dt>
                <dd className="mt-1 text-navy">{STYLE_PRESET_LABELS[project.stylePreset].label}</dd>
              </div>
            )}
            {project.durationSeconds && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-mute">
                  Duration
                </dt>
                <dd className="mt-1 text-navy">{project.durationSeconds} seconds</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-mute">Format</dt>
              <dd className="mt-1 text-navy">9:16 (1080 × 1920)</dd>
            </div>
          </dl>

          {project.status === "COMPLETE" && outputUrl?.signedUrl && (
            <video
              controls
              playsInline
              className="mt-6 aspect-[9/16] w-full max-w-xs rounded-2xl bg-black"
              src={outputUrl.signedUrl}
            />
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {continueStep && (
              <Link
                to={continueStep}
                params={{ projectId }}
                className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-navy"
              >
                Continue <ArrowRight size={14} aria-hidden="true" />
              </Link>
            )}
            {project.status === "COMPLETE" && outputUrl?.signedUrl && (
              <a
                href={outputUrl.signedUrl}
                download
                className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-5 py-2.5 text-sm font-semibold text-navy"
              >
                <Download size={14} aria-hidden="true" /> Download
              </a>
            )}
            {project.status !== "ARCHIVED" && (
              <button
                type="button"
                onClick={() => archiveMutation.mutate()}
                disabled={archiveMutation.isPending}
                className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-5 py-2.5 text-sm font-semibold text-navy disabled:opacity-50"
              >
                <Ban size={14} aria-hidden="true" /> Archive
              </button>
            )}
          </div>
        </div>
      )}
    </PublisherShell>
  );
}
