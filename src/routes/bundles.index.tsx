import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { BundleCard } from "@/components/marketplace/BundleCard";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";
import { listActiveBundles } from "@/lib/bundles.functions";

const CANONICAL = "https://www.aurumvault.store/bundles";
const SEO_TITLE = "Digital Product Bundles — Build More, Save More | AurumVault";
const SEO_DESC =
  "Curated AurumVault bundles: pair the planners, playbooks and templates that work together and pay less than buying them one at a time.";

export const bundlesQuery = queryOptions({
  queryKey: ["bundles", "active"],
  queryFn: () => listActiveBundles(),
});

export const Route = createFileRoute("/bundles/")({
  head: () => ({
    meta: [
      { title: SEO_TITLE },
      { name: "description", content: SEO_DESC },
      { property: "og:title", content: SEO_TITLE },
      { property: "og:description", content: SEO_DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bundlesQuery),
  component: BundlesIndex,
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback error={error} reset={reset} title="Bundles aren't loading" />
  ),
  notFoundComponent: () => (
    <MarketShell>
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">Bundles not found</h1>
        <Link to="/products" className="mt-6 inline-block text-navy underline">
          Browse the Vault
        </Link>
      </div>
    </MarketShell>
  ),
});

function BundlesIndex() {
  const { data: bundles } = useSuspenseQuery(bundlesQuery);

  return (
    <MarketShell>
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8 md:py-16">
          <div className="inline-flex items-center gap-2 rounded-full bg-navy px-3 py-1 text-[11px] font-bold uppercase tracking-caps text-white">
            <Layers size={12} /> Curated bundles
          </div>
          <h1 className="mt-4 font-display text-4xl font-bold text-navy md:text-5xl">
            Build More. Save More.
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-mute md:text-base">
            Hand-picked sets of AurumVault products that belong together — one price, instant
            delivery, and every included title still downloadable on its own.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        {bundles.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white py-16 text-center">
            <p className="font-display text-xl font-bold text-ink">No bundles are live yet</p>
            <p className="mt-1 text-sm text-mute">
              New curated sets are added regularly — browse the Vault in the meantime.
            </p>
            <Link
              to="/products"
              className="mt-6 inline-block rounded-full bg-gold px-6 py-2.5 text-sm font-bold text-navy"
            >
              Browse the Vault
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {bundles.map((b) => (
              <BundleCard key={b.id} bundle={b} surface="bundles_index" />
            ))}
          </div>
        )}
      </div>
    </MarketShell>
  );
}
