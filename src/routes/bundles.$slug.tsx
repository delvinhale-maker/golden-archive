import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Check, Layers, ShieldCheck, ShoppingCart, Zap } from "lucide-react";
import { toast } from "sonner";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { ProductCover } from "@/components/marketplace/ProductCover";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";
import { StripeEmbeddedBundleCheckout } from "@/components/StripeEmbeddedCheckout";
import { getBundleBySlug } from "@/lib/bundles.functions";
import { trackMerch } from "@/lib/merch-track";
import { useCart } from "@/hooks/use-av-store";

const ORIGIN = "https://www.aurumvault.store";

const bundleQuery = (slug: string) =>
  queryOptions({
    queryKey: ["bundles", "slug", slug],
    queryFn: () => getBundleBySlug({ data: { slug } }),
  });

export const Route = createFileRoute("/bundles/$slug")({
  loader: async ({ context, params }) => {
    const bundle = await context.queryClient.ensureQueryData(bundleQuery(params.slug));
    if (!bundle) throw notFound();
    return bundle;
  },
  head: ({ loaderData }) => {
    const b = loaderData;
    const title = b ? `${b.name} — Bundle | AurumVault` : "Bundle | AurumVault";
    const desc =
      b?.shortDescription ??
      (b
        ? `Get ${b.items.length} AurumVault products in one bundle for $${(b.priceCents / 100).toFixed(2)}.`
        : "AurumVault product bundle.");
    const url = b ? `${ORIGIN}/bundles/${b.slug}` : `${ORIGIN}/bundles`;
    const meta = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "product" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (b?.imageUrl && b.imageUrl.startsWith("https://")) {
      meta.push(
        { property: "og:image", content: b.imageUrl },
        { name: "twitter:image", content: b.imageUrl },
      );
    }
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: b
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Product",
                name: b.name,
                description: desc,
                url,
                offers: {
                  "@type": "Offer",
                  price: (b.priceCents / 100).toFixed(2),
                  priceCurrency: "USD",
                  availability: "https://schema.org/InStock",
                  url,
                },
              }),
            },
          ]
        : [],
    };
  },
  component: BundlePage,
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback error={error} reset={reset} title="Bundle isn't loading" />
  ),
  notFoundComponent: () => (
    <MarketShell>
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">Bundle not found</h1>
        <p className="mt-2 text-sm text-mute">
          This bundle may have ended or been renamed.
        </p>
        <Link to="/bundles" className="mt-6 inline-block text-navy underline">
          See all bundles
        </Link>
      </div>
    </MarketShell>
  ),
});

function BundlePage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(bundleQuery(slug));
  const bundle = data!;
  const cart = useCart();
  const [showCheckout, setShowCheckout] = useState(false);
  const logged = useRef(false);

  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    trackMerch("impression", "bundle_page", { bundleId: bundle.id });
  }, [bundle.id]);

  const addItemsToCart = () => {
    for (const it of bundle.items) {
      cart.add({
        id: it.productId,
        title: it.title,
        price: it.priceCents / 100,
        category: it.category,
        image: it.coverUrl ?? undefined,
      });
    }
    trackMerch("add_to_cart", "bundle_page", {
      bundleId: bundle.id,
      amountCents: bundle.individualValueCents,
    });
    toast.success("Added every bundle item to your cart at list price");
  };

  return (
    <MarketShell>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <nav className="mb-5 text-xs text-mute">
          <Link to="/" className="hover:text-navy">
            Home
          </Link>{" "}
          /{" "}
          <Link to="/bundles" className="hover:text-navy">
            Bundles
          </Link>{" "}
          / <span className="text-ink">{bundle.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3 py-1 text-[10px] font-bold uppercase tracking-caps text-white">
              <Layers size={11} /> {bundle.items.length}-product bundle
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">
              {bundle.name}
            </h1>
            {bundle.shortDescription && (
              <p className="mt-3 max-w-2xl text-sm text-mute md:text-base">
                {bundle.shortDescription}
              </p>
            )}

            {bundle.imageUrl && (
              <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white p-3">
                <img
                  src={bundle.imageUrl}
                  alt={bundle.name}
                  className="w-full rounded-xl object-cover"
                />
              </div>
            )}

            <h2 className="mt-8 font-display text-xl font-bold text-ink">What's inside</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {bundle.items.map((it) => (
                <li
                  key={it.productId}
                  className="flex gap-3 rounded-xl border border-line bg-white p-3"
                >
                  <Link
                    to="/products/$id"
                    params={{ id: it.productId }}
                    className="block h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-[#f5f4ef]"
                  >
                    {it.coverUrl && /^https?:\/\//.test(it.coverUrl) ? (
                      <img
                        src={it.coverUrl}
                        alt={it.title}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ProductCover
                        title={it.title}
                        category={it.category}
                        productId={it.productId}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </Link>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-caps text-gold-ink">
                      {it.category}
                    </div>
                    <Link
                      to="/products/$id"
                      params={{ id: it.productId }}
                      className="line-clamp-2 font-display text-sm font-bold text-ink hover:text-navy"
                    >
                      {it.title}
                    </Link>
                    <div className="mt-1 text-xs text-mute">
                      Sold separately{" "}
                      <span className="font-semibold text-ink">
                        ${(it.priceCents / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {bundle.fullDescription && (
              <div className="mt-8 whitespace-pre-line rounded-2xl border border-line bg-white p-5 text-sm leading-relaxed text-ink/90">
                {bundle.fullDescription}
              </div>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start">
            <div className="rounded-2xl border border-line bg-white p-5">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-3xl font-bold text-gold-ink">
                  ${(bundle.priceCents / 100).toFixed(2)}
                </span>
                {bundle.savingsCents > 0 && (
                  <span className="text-sm text-mute line-through">
                    ${(bundle.individualValueCents / 100).toFixed(2)}
                  </span>
                )}
              </div>
              {bundle.savingsCents > 0 && (
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-[11px] font-bold text-navy">
                  You save ${(bundle.savingsCents / 100).toFixed(2)} ({bundle.savingsPct}%)
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  trackMerch("click", "bundle_page", {
                    bundleId: bundle.id,
                    amountCents: bundle.priceCents,
                  });
                  setShowCheckout(true);
                }}
                className="mt-5 w-full rounded-full bg-gold py-3 text-sm font-bold text-navy shadow-gold-glow"
              >
                Buy the bundle
              </button>
              <button
                type="button"
                onClick={addItemsToCart}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-line py-2.5 text-sm font-bold text-ink hover:border-gold"
              >
                <ShoppingCart size={14} /> Add items individually
              </button>

              <ul className="mt-5 space-y-2 text-xs text-mute">
                <li className="flex items-center gap-2">
                  <Zap size={13} className="text-gold-ink" /> Instant download for every title
                </li>
                <li className="flex items-center gap-2">
                  <Check size={13} className="text-gold-ink" /> Each product delivered separately
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck size={13} className="text-gold-ink" /> SSL-encrypted checkout
                </li>
              </ul>
              <p className="mt-3 text-[11px] text-mute">
                Digital goods —{" "}
                <Link to="/refunds" className="font-medium text-navy underline">
                  see refund policy
                </Link>
                .
              </p>
            </div>
          </aside>
        </div>

        {showCheckout && (
          <div className="mt-10 rounded-2xl border border-line bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-ink">Secure Checkout</h2>
              <button
                type="button"
                onClick={() => setShowCheckout(false)}
                className="text-xs font-semibold text-mute hover:text-ink"
              >
                ← Back to bundle
              </button>
            </div>
            <StripeEmbeddedBundleCheckout bundleId={bundle.id} />
          </div>
        )}
      </div>
    </MarketShell>
  );
}
