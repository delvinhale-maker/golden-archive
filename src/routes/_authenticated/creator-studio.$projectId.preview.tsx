import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Film } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { ProjectStepNav } from "@/components/creator-studio/ProjectStepNav";
import { getProjectFn } from "@/lib/creator-studio/projects.functions";
import { previewCompositionFn } from "@/lib/creator-studio/render-jobs.functions";
import { getMyEntitlementsFn } from "@/lib/creator-studio/entitlements.functions";
import { PROJECT_TYPE_LABELS } from "@/lib/creator-studio/schema";

export const Route = createFileRoute("/_authenticated/creator-studio/$projectId/preview")({
  component: PreviewStepPage,
});

const SCENE_TYPE_LABELS: Record<string, string> = {
  HOOK: "Opening hook",
  COVER_REVEAL: "Cover reveal",
  FEATURE: "Feature highlight",
  BENEFITS: "Benefits",
  HERO: "Hero shot",
  CTA: "Call to action",
};

/** Step 6: shows the storyboard plan + entitlement impact before committing to Generate. A fixed, read-only summary list -- no scrubbing or reordering controls. */
function PreviewStepPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();

  const getFn = useServerFn(getProjectFn);
  const previewFn = useServerFn(previewCompositionFn);
  const entitlementsFn = useServerFn(getMyEntitlementsFn);

  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ["creator-studio", "project", projectId],
    queryFn: () => getFn({ data: { projectId } }),
    retry: false,
  });
  const { data: plan, isLoading: loadingPlan } = useQuery({
    queryKey: ["creator-studio", "preview", projectId],
    queryFn: () => previewFn({ data: { projectId } }),
    retry: false,
  });
  const { data: entitlements } = useQuery({
    queryKey: ["creator-studio", "entitlements"],
    queryFn: () => entitlementsFn(),
    retry: false,
  });

  const isLoading = loadingProject || loadingPlan;
  const hasCredit =
    !entitlements ||
    entitlements.freePreviewAvailable ||
    entitlements.videosRemainingIncluded > 0 ||
    entitlements.extraCreditsBalance > 0;

  return (
    <PublisherShell accent={ACCENTS.creatorStudio}>
      <div className="mx-auto max-w-2xl">
        <ProjectStepNav projectId={projectId} current="preview" />
        <h1 className="text-center font-display text-2xl text-navy">Review your video</h1>

        {isLoading ? (
          <p className="mt-8 text-center text-sm text-mute">Loading…</p>
        ) : !plan || !project ? (
          <p className="mt-8 text-center text-sm text-destructive">
            Finish choosing a style and duration before previewing your video.
          </p>
        ) : (
          <>
            <dl className="mt-6 grid grid-cols-2 gap-3 rounded-xl border border-ink/10 bg-white p-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-mute">
                  Video type
                </dt>
                <dd className="mt-1 text-navy">{PROJECT_TYPE_LABELS[project.projectType].label}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-mute">
                  Duration
                </dt>
                <dd className="mt-1 text-navy">{plan.totalDurationSeconds} seconds</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-mute">Format</dt>
                <dd className="mt-1 text-navy">9:16 (1080 × 1920 MP4)</dd>
              </div>
            </dl>

            <h2 className="mt-8 font-display text-lg text-navy">Storyboard</h2>
            <ol className="mt-3 space-y-2">
              {plan.scenes.map((scene: { type: string; durationSeconds: number }, i: number) => (
                <li
                  key={`${scene.type}-${i}`}
                  className="flex items-center justify-between rounded-lg border border-ink/10 bg-white px-4 py-2.5 text-sm"
                >
                  <span className="text-navy">{SCENE_TYPE_LABELS[scene.type] ?? scene.type}</span>
                  <span className="text-xs text-mute">{scene.durationSeconds.toFixed(1)}s</span>
                </li>
              ))}
            </ol>

            <div className="mt-8 rounded-xl border border-[#7A2E52]/20 bg-[#7A2E52]/5 p-4 text-center text-sm text-navy">
              {!entitlements ? (
                "Checking your video allowance…"
              ) : entitlements.freePreviewAvailable ? (
                "This will use your one free preview."
              ) : entitlements.videosRemainingIncluded > 0 ? (
                `This will use 1 of your ${entitlements.videosRemainingIncluded} remaining videos.`
              ) : entitlements.extraCreditsBalance > 0 ? (
                "This will use 1 extra video credit."
              ) : (
                <>
                  You're out of video credits.{" "}
                  <Link to="/creator-studio/upgrade" className="font-semibold underline">
                    Upgrade your plan or buy an extra video
                  </Link>{" "}
                  to continue.
                </>
              )}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <Link
                to="/creator-studio/$projectId/style"
                params={{ projectId }}
                className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-5 py-3 text-sm font-semibold text-navy"
              >
                Back
              </Link>
              <button
                type="button"
                disabled={!hasCredit}
                onClick={() =>
                  navigate({ to: "/creator-studio/$projectId/render", params: { projectId } })
                }
                className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-navy disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Film size={16} aria-hidden="true" /> Create Video{" "}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </div>
    </PublisherShell>
  );
}
