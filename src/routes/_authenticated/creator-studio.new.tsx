import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import {
  listOwnProductsForCreatorStudioFn,
  createProjectFn,
  updateProjectFn,
  markProjectReadyFn,
} from "@/lib/creator-studio.functions";
import {
  CREATION_TYPES,
  CREATION_TYPE_LABELS,
  STYLES,
  STYLE_LABELS,
  DURATIONS,
  type CreationType,
  type CreatorStudioStyle,
  type CreatorStudioDuration,
  type CreatorStudioProductPreview,
} from "@/lib/creator-studio.schema";

export const Route = createFileRoute("/_authenticated/creator-studio/new")({
  component: NewProjectWizard,
});

/**
 * Product → Video → Style → Review → Generate. A plain step wizard over
 * local state with fixed choices at each step — matching the spec's
 * explicit "do not imitate Premiere/CapCut/Canva" instruction.
 *
 * CS1 never calls a rendering provider: CREATOR_STUDIO_RENDERING_ENABLED
 * stays false and the "Generate" step always ends by saving the project as
 * READY with an honest "not turned on yet" message — it never claims
 * completion that hasn't happened.
 */
type WizardStep = "product" | "video" | "style" | "review" | "generate";
const STEP_ORDER: WizardStep[] = ["product", "video", "style", "review", "generate"];
const STEP_LABELS: Record<WizardStep, string> = {
  product: "Product",
  video: "Video",
  style: "Style",
  review: "Review",
  generate: "Generate",
};

function NewProjectWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>("product");
  const [selectedProduct, setSelectedProduct] = useState<CreatorStudioProductPreview | null>(null);
  const [skippedProduct, setSkippedProduct] = useState(false);
  const [creationType, setCreationType] = useState<CreationType | null>(null);
  const [style, setStyle] = useState<CreatorStudioStyle>("CLEAN_MINIMAL");
  const [duration, setDuration] = useState<CreatorStudioDuration>(30);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [headline, setHeadline] = useState("");
  const [ctaText, setCtaText] = useState("Shop Now");
  const [ctaUrl, setCtaUrl] = useState("");
  const [priceText, setPriceText] = useState("");
  const [saved, setSaved] = useState(false);

  const listProductsFn = useServerFn(listOwnProductsForCreatorStudioFn);
  const createFn = useServerFn(createProjectFn);
  const updateFn = useServerFn(updateProjectFn);
  const readyFn = useServerFn(markProjectReadyFn);

  const products = useQuery({
    queryKey: ["creator-studio", "own-products"],
    queryFn: () => listProductsFn({ data: undefined }),
    enabled: step === "product",
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createFn({
        data: { productId: selectedProduct?.productId, creationType: creationType! },
      }),
    onSuccess: (project) => {
      setProjectId(project.id);
      setHeadline(project.headline ?? "");
      setCtaText(project.ctaText ?? "Shop Now");
      setCtaUrl(project.ctaUrl ?? "");
      setPriceText(project.priceText ?? "");
      setStep("style");
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't start your project"),
  });

  const saveStyleMutation = useMutation({
    mutationFn: () =>
      updateFn({ data: { projectId: projectId!, style, durationSeconds: duration } }),
    onSuccess: () => setStep("review"),
    onError: (err: Error) => toast.error(err.message || "Couldn't save your choices"),
  });

  const saveReviewMutation = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          projectId: projectId!,
          headline: headline.trim() || null,
          ctaText: ctaText.trim() || null,
          ctaUrl: ctaUrl.trim() || null,
          priceText: priceText.trim() || null,
        },
      }),
    onSuccess: () => setStep("generate"),
    onError: (err: Error) => toast.error(err.message || "Couldn't save your project"),
  });

  const readyMutation = useMutation({
    mutationFn: () => readyFn({ data: { projectId: projectId! } }),
    onSuccess: () => setSaved(true),
    onError: (err: Error) => toast.error(err.message || "Couldn't save your project"),
  });

  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <PublisherShell accent={ACCENTS.creatorStudio}>
      <div className="mx-auto max-w-2xl">
        <nav aria-label="Progress" className="mb-8 flex items-center justify-center gap-2">
          {STEP_ORDER.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  i <= stepIndex ? "bg-[#7A2E52] text-white" : "bg-ink/10 text-mute"
                }`}
              >
                {i + 1}
              </span>
              <span className={`text-xs font-medium ${i <= stepIndex ? "text-navy" : "text-mute"}`}>
                {STEP_LABELS[s]}
              </span>
              {i < STEP_ORDER.length - 1 && (
                <span className="h-px w-6 bg-ink/10" aria-hidden="true" />
              )}
            </div>
          ))}
        </nav>

        {step === "product" && (
          <section>
            <h1 className="text-center font-display text-2xl text-navy">
              Pick what you're promoting
            </h1>
            <p className="mt-2 text-center text-sm text-mute">
              Use one of your AurumVault products, or skip this and add media later.
            </p>

            <div className="mt-6 space-y-3">
              {products.isLoading ? (
                <p className="py-8 text-center text-sm text-mute">Loading your products…</p>
              ) : products.isError ? (
                <p className="py-8 text-center text-sm text-destructive">
                  Creator Studio isn't available right now.
                </p>
              ) : products.data && products.data.length > 0 ? (
                products.data.map((p) => (
                  <button
                    key={p.productId}
                    type="button"
                    onClick={() => {
                      setSelectedProduct(p);
                      setSkippedProduct(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                      selectedProduct?.productId === p.productId
                        ? "border-[#7A2E52] bg-[#7A2E52]/5"
                        : "border-ink/10 hover:border-[#7A2E52]/40"
                    }`}
                  >
                    <span className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-paper">
                      {p.coverUrl && (
                        <img src={p.coverUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-navy">
                        {p.title}
                      </span>
                      <span className="block text-xs text-mute">
                        ${(p.priceCents / 100).toFixed(2)}
                      </span>
                    </span>
                    {selectedProduct?.productId === p.productId && (
                      <Check
                        size={18}
                        className="flex-shrink-0 text-[#7A2E52]"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-mute">
                  You don't have any published products yet.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setSkippedProduct(true);
                setSelectedProduct(null);
              }}
              className={`mt-3 w-full rounded-xl border p-3 text-center text-sm font-medium transition ${
                skippedProduct
                  ? "border-[#7A2E52] bg-[#7A2E52]/5 text-navy"
                  : "border-dashed border-ink/20 text-mute hover:border-[#7A2E52]/40"
              }`}
            >
              Skip — I'll add media later
            </button>

            <div className="mt-8 flex justify-end">
              <button
                type="button"
                disabled={!selectedProduct && !skippedProduct}
                onClick={() => setStep("video")}
                className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-navy disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </section>
        )}

        {step === "video" && (
          <section>
            <h1 className="text-center font-display text-2xl text-navy">What kind of video?</h1>
            <p className="mt-2 text-center text-sm text-mute">
              Choose the format that fits your goal.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CREATION_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setCreationType(type)}
                  className={`rounded-xl border p-4 text-left transition ${
                    creationType === type
                      ? "border-[#7A2E52] bg-[#7A2E52]/5"
                      : "border-ink/10 hover:border-[#7A2E52]/40"
                  }`}
                >
                  <span className="block text-sm font-semibold text-navy">
                    {CREATION_TYPE_LABELS[type].label}
                  </span>
                  <span className="mt-1 block text-xs text-mute">
                    {CREATION_TYPE_LABELS[type].blurb}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep("product")}
                className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-5 py-3 text-sm font-semibold text-navy"
              >
                <ArrowLeft size={16} aria-hidden="true" /> Back
              </button>
              <button
                type="button"
                disabled={!creationType || createMutation.isPending}
                onClick={() => createMutation.mutate()}
                className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-navy disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createMutation.isPending ? (
                  <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                ) : (
                  <>
                    Continue <ArrowRight size={16} aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </section>
        )}

        {step === "style" && (
          <section>
            <h1 className="text-center font-display text-2xl text-navy">Choose a style</h1>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {STYLES.map((s) => (
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
                    {STYLE_LABELS[s].label}
                  </span>
                  <span className="mt-1 block text-xs text-mute">{STYLE_LABELS[s].blurb}</span>
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
              <button
                type="button"
                onClick={() => setStep("video")}
                className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-5 py-3 text-sm font-semibold text-navy"
              >
                <ArrowLeft size={16} aria-hidden="true" /> Back
              </button>
              <button
                type="button"
                disabled={saveStyleMutation.isPending}
                onClick={() => saveStyleMutation.mutate()}
                className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-navy disabled:opacity-50"
              >
                {saveStyleMutation.isPending ? (
                  <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                ) : (
                  <>
                    Continue <ArrowRight size={16} aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </section>
        )}

        {step === "review" && (
          <section>
            <h1 className="text-center font-display text-2xl text-navy">Review your video</h1>
            <p className="mt-2 text-center text-sm text-mute">
              Edit the copy that appears in your video.
            </p>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-mute">
                  Headline
                </span>
                <input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  maxLength={200}
                  className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm text-navy"
                />
              </label>
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
                  Link
                </span>
                <input
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  maxLength={2000}
                  className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm text-navy"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-mute">
                  Price
                </span>
                <input
                  value={priceText}
                  onChange={(e) => setPriceText(e.target.value)}
                  maxLength={40}
                  className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm text-navy"
                />
              </label>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-3 rounded-xl border border-ink/10 bg-paper p-4 text-xs">
              <div>
                <dt className="font-semibold text-mute">Video type</dt>
                <dd className="text-navy">
                  {creationType ? CREATION_TYPE_LABELS[creationType].label : "—"}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-mute">Style</dt>
                <dd className="text-navy">{STYLE_LABELS[style].label}</dd>
              </div>
              <div>
                <dt className="font-semibold text-mute">Duration</dt>
                <dd className="text-navy">{duration} seconds</dd>
              </div>
              <div>
                <dt className="font-semibold text-mute">Format</dt>
                <dd className="text-navy">9:16 (1080 × 1920)</dd>
              </div>
            </dl>

            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep("style")}
                className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-5 py-3 text-sm font-semibold text-navy"
              >
                <ArrowLeft size={16} aria-hidden="true" /> Back
              </button>
              <button
                type="button"
                disabled={saveReviewMutation.isPending}
                onClick={() => saveReviewMutation.mutate()}
                className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-navy disabled:opacity-50"
              >
                {saveReviewMutation.isPending ? (
                  <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                ) : (
                  <>
                    Continue <ArrowRight size={16} aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </section>
        )}

        {step === "generate" && (
          <section className="text-center">
            {!saved ? (
              <>
                <Sparkles size={32} className="mx-auto text-[#7A2E52]" aria-hidden="true" />
                <h1 className="mt-4 font-display text-2xl text-navy">Almost there</h1>
                <p className="mt-2 text-sm text-mute">
                  Video creation isn't turned on for your account yet. Your project is saved — you
                  can come back and finish it once it's ready.
                </p>
                <button
                  type="button"
                  disabled={readyMutation.isPending}
                  onClick={() => readyMutation.mutate()}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-gold px-8 py-4 text-base font-semibold text-navy disabled:opacity-50"
                >
                  {readyMutation.isPending ? (
                    <Loader2 className="animate-spin" size={18} aria-hidden="true" />
                  ) : (
                    "Save My Project"
                  )}
                </button>
              </>
            ) : (
              <>
                <Check size={32} className="mx-auto text-[#7A2E52]" aria-hidden="true" />
                <h1 className="mt-4 font-display text-2xl text-navy">Project saved</h1>
                <p className="mt-2 text-sm text-mute">Find it anytime under My Videos.</p>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/creator-studio/videos" })}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-gold px-8 py-4 text-base font-semibold text-navy"
                >
                  Go to My Videos
                </button>
              </>
            )}
          </section>
        )}
      </div>
    </PublisherShell>
  );
}
