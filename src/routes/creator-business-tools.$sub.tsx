import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BadgeCheck } from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { getProducts } from "@/lib/marketplace.functions";
import {
  CREATOR_TOOLS_LABEL,
  CREATOR_TOOLS_SLUG,
  CREATOR_TOOL_SUBS,
  getCreatorToolSubBySlug,
} from "@/lib/creator-business-tools";

const ORIGIN = "https://www.aurumvault.store";

export const Route = createFileRoute("/creator-business-tools/$sub")({
  loader: ({ params }) => {
    const sub = getCreatorToolSubBySlug(params.sub);
    if (!sub) throw notFound();
    return { sub };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Not found | AurumVault" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { sub } = loaderData;
    const title = `${sub.name} for Creators | AurumVault`;
    const desc = sub.blurb;
    const url = `${ORIGIN}/creator-business-tools/${sub.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: sub.name,
            description: desc,
            url,
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${ORIGIN}/` },
              {
                "@type": "ListItem",
                position: 2,
                name: CREATOR_TOOLS_LABEL,
                item: `${ORIGIN}/creator-business-tools`,
              },
              { "@type": "ListItem", position: 3, name: sub.name, item: url },
            ],
          }),
        },
      ],
    };
  },
  component: CreatorToolSubPage,
});

function CreatorToolSubPage() {
  const { sub } = Route.useLoaderData();

  const { data: listing } = useQuery({
    queryKey: ["creator-business-tools-products"],
    queryFn: () =>
      getProducts({
        data: { category: CREATOR_TOOLS_SLUG, pageSize: 48, page: 1 },
      }),
    staleTime: 60_000,
  });
  const products = (listing?.items ?? []).filter(
    (p) => (p.subcategory ?? "") === sub.name,
  );
  const others = CREATOR_TOOL_SUBS.filter((s) => s.slug !== sub.slug);

  return (
    <MarketShell>
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-white/10">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, #05070C 0%, #0B1424 58%, #241E10 100%)",
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
            <Link
              to="/creator-business-tools"
              className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-caps text-white/60 transition hover:text-gold"
            >
              <ArrowLeft size={13} aria-hidden /> {CREATOR_TOOLS_LABEL}
            </Link>
            <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-caps text-gold">
              <BadgeCheck size={12} aria-hidden /> {sub.filter}
            </span>
            <h1 className="mt-4 font-display text-3xl font-bold leading-[1.1] text-white sm:text-4xl md:text-5xl">
              {sub.name}
            </h1>
            <span
              aria-hidden
              className="mt-5 block h-px w-24 bg-gradient-to-r from-transparent via-gold/70 to-transparent"
            />
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/80">
              {sub.intro}
            </p>
          </div>
        </section>

        {/* What's inside */}
        <section className="border-b border-white/10 bg-[#080A11]">
          <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
            <h2 className="font-display text-2xl font-bold text-white md:text-3xl">
              What you get
            </h2>
            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {sub.points.map((p) => (
                <li
                  key={p}
                  className="flex items-start gap-2 text-[14px] leading-relaxed text-white/75"
                >
                  <span
                    aria-hidden
                    className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold"
                  />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Products */}
        <section className="border-b border-white/10 bg-[#0A0D17]">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
            <h2 className="font-display text-2xl font-bold text-white md:text-3xl">
              {sub.name} products
            </h2>
            {products.length > 0 ? (
              <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {products.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            ) : (
              <p className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-6 text-[14px] text-white/65">
                No {sub.name.toLowerCase()} products are live yet. New tools are
                added as they’re released — browse{" "}
                <Link
                  to="/creator-business-tools"
                  className="font-bold text-gold hover:underline"
                >
                  the full department
                </Link>{" "}
                in the meantime.
              </p>
            )}
          </div>
        </section>

        {/* Related subcategories */}
        <section className="bg-[#080A11]">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
            <h2 className="font-display text-2xl font-bold text-white md:text-3xl">
              Explore more Creator Business Tools
            </h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((s) => (
                <Link
                  key={s.slug}
                  to="/creator-business-tools/$sub"
                  params={{ sub: s.slug }}
                  className="group flex min-w-0 flex-col rounded-xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-gold/55 hover:bg-white/[0.06]"
                >
                  <h3 className="font-display text-[17px] font-bold leading-snug text-white">
                    {s.name}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/65">
                    {s.blurb}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-caps text-gold">
                    Browse{" "}
                    <ArrowRight
                      size={13}
                      aria-hidden
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </MarketShell>
  );
}
