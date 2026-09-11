import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { ProjectStepNav } from "@/components/creator-studio/ProjectStepNav";
import {
  submitRenderFn,
  getLatestRenderJobForProjectFn,
  getSignedOutputUrlFn,
} from "@/lib/creator-studio/render-jobs.functions";

export const Route = createFileRoute("/_authenticated/creator-studio/$projectId/render")({
  component: RenderStepPage,
});

/**
 * Step 7: Generate. Plain infrastructure terms never surface here -- the UI
 * only ever says "Preparing your promo…" / "Creating your video…" / "Your
 * video is ready." No progress percentage is shown (none is honestly known
 * from the provider), and the copy tells the customer they can leave the
 * page safely since the render continues server-side either way.
 */
function RenderStepPage() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  const submitFn = useServerFn(submitRenderFn);
  const statusFn = useServerFn(getLatestRenderJobForProjectFn);
  const signedUrlFn = useServerFn(getSignedOutputUrlFn);

  const [pollStartedAt] = useState(() => Date.now());

  const statusQuery = useQuery({
    queryKey: ["creator-studio", "render-status", projectId],
    queryFn: () => statusFn({ data: { projectId } }),
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "SUCCEEDED" || status === "FAILED" || status === "CANCELLED" || !status)
        return false;
      // Bounded backoff: check every 4s for the first 30s, then every 10s,
      // matching the "do not poll aggressively" requirement.
      const elapsed = Date.now() - pollStartedAt;
      return elapsed < 30_000 ? 4_000 : 10_000;
    },
  });

  const job = statusQuery.data;

  const outputUrlQuery = useQuery({
    queryKey: ["creator-studio", "output-url", job?.outputAssetId],
    queryFn: () => signedUrlFn({ data: { assetId: job!.outputAssetId! } }),
    enabled: job?.status === "SUCCEEDED" && !!job.outputAssetId,
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: () => submitFn({ data: { projectId, idempotencyKey: idempotencyKeyRef.current } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["creator-studio", "render-status", projectId],
      });
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't create your video"),
  });

  function retry() {
    idempotencyKeyRef.current = crypto.randomUUID();
    submitMutation.mutate();
  }

  const statusMessage = useMemo(() => {
    switch (job?.status) {
      case "QUEUED":
      case "SUBMITTED":
        return "Preparing your promo…";
      case "RENDERING":
        return "Creating your video…";
      case "SUCCEEDED":
        return "Your video is ready.";
      case "FAILED":
        return (
          job.safeErrorMessage ||
          "We couldn't finish this video. Your video credit was not consumed."
        );
      default:
        return null;
    }
  }, [job]);

  return (
    <PublisherShell accent={ACCENTS.creatorStudio}>
      <div className="mx-auto max-w-2xl text-center">
        <ProjectStepNav projectId={projectId} current="render" />

        {!job || job.status === "FAILED" ? (
          <section>
            <Sparkles size={32} className="mx-auto text-[#7A2E52]" aria-hidden="true" />
            <h1 className="mt-4 font-display text-2xl text-navy">
              {job?.status === "FAILED" ? "Let's try again" : "Ready when you are"}
            </h1>
            {job?.status === "FAILED" && (
              <p className="mt-2 text-sm text-destructive">{statusMessage}</p>
            )}
            <p className="mt-2 text-sm text-mute">
              We'll take it from here. You can leave this page any time — your video keeps going.
            </p>
            <button
              type="button"
              disabled={submitMutation.isPending}
              onClick={() => (job?.status === "FAILED" ? retry() : submitMutation.mutate())}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gold px-8 py-4 text-base font-semibold text-navy disabled:opacity-50"
            >
              {submitMutation.isPending ? (
                <Loader2 className="animate-spin" size={18} aria-hidden="true" />
              ) : job?.status === "FAILED" ? (
                "Try Again"
              ) : (
                "Create Video"
              )}
            </button>
          </section>
        ) : job.status === "SUCCEEDED" ? (
          <section>
            <h1 className="font-display text-2xl text-navy">Your video is ready.</h1>
            {outputUrlQuery.data?.signedUrl && (
              <video
                controls
                playsInline
                className="mx-auto mt-6 aspect-[9/16] w-full max-w-xs rounded-2xl bg-black"
                src={outputUrlQuery.data.signedUrl}
              />
            )}
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              {outputUrlQuery.data?.signedUrl && (
                <a
                  href={outputUrlQuery.data.signedUrl}
                  download
                  className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-navy"
                >
                  <Download size={16} aria-hidden="true" /> Download
                </a>
              )}
              <Link
                to="/creator-studio/library"
                className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-6 py-3 text-sm font-semibold text-navy"
              >
                My Videos
              </Link>
            </div>
          </section>
        ) : (
          <section>
            <Loader2 size={32} className="mx-auto animate-spin text-[#7A2E52]" aria-hidden="true" />
            <h1 className="mt-4 font-display text-2xl text-navy">{statusMessage}</h1>
            <p className="mt-2 text-sm text-mute">
              You can leave this page — your video will be waiting for you in My Videos.
            </p>
          </section>
        )}
      </div>
    </PublisherShell>
  );
}
