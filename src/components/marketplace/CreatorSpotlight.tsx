import { Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { getCurrentSpotlight, type Spotlight } from "@/lib/spotlights.functions";

export const creatorSpotlightQ = queryOptions({
  queryKey: ["home", "creator-spotlight"],
  queryFn: () => getCurrentSpotlight(),
  staleTime: 5 * 60 * 1000,
});

function formatMonth(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function excerpt(body: string, max = 320) {
  const text = body.replace(/[#*_>`~\-]+/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
}

function SpotlightInner() {
  const { data } = useSuspenseQuery(creatorSpotlightQ);
  if (!data) return null;
  const spot: Spotlight = data;
  const storeHref = spot.sellerSlug ? `/store/${spot.sellerSlug}` : null;

  return (
    <section className="bg-bg-page py-16 md:py-24" aria-labelledby="spotlight-heading">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 py-1 text-xs font-medium text-brand-gold">
              <Sparkles className="h-3.5 w-3.5" />
              Creator Spotlight · {formatMonth(spot.month)}
            </div>
            <h2 id="spotlight-heading" className="text-3xl font-bold text-fg-primary md:text-4xl">
              Meet {spot.sellerName}
            </h2>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-bg-surface shadow-xl md:grid md:grid-cols-5">
          {spot.heroImageUrl ? (
            <div className="relative md:col-span-2">
              <img
                src={spot.heroImageUrl}
                alt={`${spot.sellerName} — featured creator`}
                className="h-64 w-full object-cover md:h-full"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="hidden bg-gradient-to-br from-brand-gold/20 via-brand-gold/5 to-transparent md:col-span-2 md:block" />
          )}
          <div className="flex flex-col justify-between gap-6 p-6 md:col-span-3 md:p-10">
            <div>
              <h3 className="mb-4 text-2xl font-semibold text-fg-primary md:text-3xl">
                {spot.headline}
              </h3>
              <p className="whitespace-pre-line text-base leading-relaxed text-fg-secondary">
                {excerpt(spot.body)}
              </p>
            </div>
            {storeHref && (
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/store/$slug"
                  params={{ slug: spot.sellerSlug! }}
                  className="inline-flex items-center justify-center rounded-lg bg-brand-gold px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-brand-gold/90"
                >
                  Visit {spot.sellerName}'s store
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function CreatorSpotlight() {
  return (
    <Suspense fallback={null}>
      <SpotlightInner />
    </Suspense>
  );
}
