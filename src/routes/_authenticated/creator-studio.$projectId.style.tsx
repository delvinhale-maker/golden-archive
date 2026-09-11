import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { ProjectStepNav } from "@/components/creator-studio/ProjectStepNav";
import { getProjectFn, updateProjectFn } from "@/lib/creator-studio/projects.functions";
import {
  STYLE_PRESETS,
  STYLE_PRESET_LABELS,
  DURATIONS,
  type StylePreset,
  type Duration,
} from "@/lib/creator-studio/schema";

export const Route = createFileRoute("/_authenticated/creator-studio/$projectId/style")({
  component: StyleStepPage,
});

/** Steps 4-5: message + CTA, then style + duration -- combined onto one route since both are simple field pickers, no separate deep link needed between them. */
function StyleStepPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const getFn = useServerFn(getProjectFn);
  const updateFn = useServerFn(updateProjectFn);

  const { data: project, isLoading } = useQuery({
    queryKey: ["creator-studio", "project", projectId],
    queryFn: () => getFn({ data: { projectId } }),
    retry: false,
  });

  const [ctaText, setCtaText] = useState("Shop Now");
  const [priceText, setPriceText] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [style, setStyle] = useState<StylePreset>("CLEAN_MINIMAL");
  const [duration, setDuration] = useState<Duration>(30);

  useEffect(() => {
    if (!project) return;
    setCtaText(project.ctaText || "Shop Now");
    setPriceText(project.priceText ?? "");
    setDestinationUrl(project.destinationUrl ?? "");
    setStyle(project.stylePreset ?? "CLEAN_MINIMAL");
    setDuration(project.durationSeconds ?? 30);
    // Deliberately keyed on project?.id only -- this seeds the form once
    // when the project loads, and must not re-run (and clobber in-progress
    // edits) on every background refetch of `project`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          projectId,
          ctaText: ctaText.trim() || "Shop Now",
          priceText: priceText.trim() || null,
          destinationUrl: destinationUrl.trim() || null,
          stylePreset: style,
          durationSeconds: duration,
        },
      }),
    onSuccess: () => navigate({ to: "/creator-studio/$projectId/preview", params: { projectId } }),
    onError: (err: Error) => toast.error(err.message || "Couldn't save your choices"),
  });

  if (isLoading) {
    return (
      <PublisherShell accent={ACCENTS.creatorStudio}>
        <p className="text-center text-sm text-mute">Loading…</p>
      </PublisherShell>
    );
  }

  return (
    <PublisherShell accent={ACCENTS.creatorStudio}>
      <div className="mx-auto max-w-2xl">
        <ProjectStepNav projectId={projectId} current="style" />
        <h1 className="text-center font-display text-2xl text-navy">Message, style &amp; length</h1>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-mute">
              Call to action
            </span>
            <input
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              maxLength={60}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm text-navy"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-mute">
              Price (optional)
            </span>
            <input
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              maxLength={40}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm text-navy"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-mute">
              Link (optional)
            </span>
            <input
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              maxLength={2000}
              placeholder="https://"
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm text-navy"
            />
          </label>
        </div>

        <h2 className="mt-8 text-center font-display text-lg text-navy">Style</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {STYLE_PRESETS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStyle(s)}
              className={`rounded-xl border p-4 text-left transition ${
                style === s
                  ? "border-[#7A2E52] bg-[#7A2E52]/5"
                  : "border-ink/10 hover:border-[#7A2E52]/40"
              }`}
            >
              <span className="block text-sm font-semibold text-navy">
                {STYLE_PRESET_LABELS[s].label}
              </span>
              <span className="mt-1 block text-xs text-mute">{STYLE_PRESET_LABELS[s].blurb}</span>
            </button>
          ))}
        </div>

        <h2 className="mt-8 text-center font-display text-lg text-navy">Duration</h2>
        <div className="mt-3 flex justify-center gap-3">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              className={`rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
                duration === d
                  ? "border-[#7A2E52] bg-[#7A2E52]/5 text-navy"
                  : "border-ink/10 text-mute hover:border-[#7A2E52]/40"
              }`}
            >
              {d} seconds
            </button>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Link
            to="/creator-studio/$projectId/assets"
            params={{ projectId }}
            className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-5 py-3 text-sm font-semibold text-navy"
          >
            Back
          </Link>
          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-navy disabled:opacity-50"
          >
            {saveMutation.isPending ? (
              <Loader2 className="animate-spin" size={16} aria-hidden="true" />
            ) : (
              <>
                Continue <ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
    </PublisherShell>
  );
}
