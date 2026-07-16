import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import {
  listAcademyCategories,
  listArticlesByCategory,
} from "@/lib/academy.functions";
import { ArticleGrid } from "./academy.index";
import { ChevronRight } from "lucide-react";

const catsQuery = queryOptions({
  queryKey: ["academy", "categories"],
  queryFn: () => listAcademyCategories(),
});

function articlesQuery(category: string, sort: "newest" | "popular" | "featured") {
  return queryOptions({
    queryKey: ["academy", "articles", category, sort],
    queryFn: () => listArticlesByCategory({ data: { category, sort } }),
  });
}

export const Route = createFileRoute("/academy/$category")({
  loader: async ({ context, params }) => {
    const cats = await context.queryClient.ensureQueryData(catsQuery);
    const cat = cats.find((c) => c.slug === params.category);
    if (!cat) throw notFound();
    await context.queryClient.ensureQueryData(articlesQuery(params.category, "newest"));
    return { category: cat };
  },
  head: ({ loaderData, params }) => {
    const name = loaderData?.category.name ?? "Academy";
    const desc =
      loaderData?.category.description ??
      "Premium educational content from AurumVault Academy.";
    const url = `https://www.aurumvault.store/academy/${params.category}`;
    return {
      meta: [
        { title: `${name} — AurumVault Academy` },
        { name: "description", content: desc },
        { property: "og:title", content: `${name} — AurumVault Academy` },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => (
    <MarketShell>
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-3xl font-serif font-semibold">Category not found</h1>
        <Link to="/academy" className="mt-6 inline-block text-[#B8860B]">
          ← Back to Academy
        </Link>
      </div>
    </MarketShell>
  ),
  errorComponent: () => (
    <MarketShell>
      <div className="mx-auto max-w-3xl px-4 py-24 text-center text-ink/70">
        Something went wrong loading this category.
      </div>
    </MarketShell>
  ),
  component: CategoryPage,
});

function CategoryPage() {
  const { category } = Route.useLoaderData();
  const params = Route.useParams();
  const [sort, setSort] = useState<"newest" | "popular" | "featured">("newest");
  const { data: articles } = useSuspenseQuery(articlesQuery(params.category, sort));

  return (
    <MarketShell>
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mt-6 flex items-center gap-2 text-sm text-ink/60">
          <Link to="/academy" className="hover:text-[#B8860B]">
            Academy
          </Link>
          <ChevronRight size={14} />
          <span className="text-ink">{category.name}</span>
        </nav>

        <header className="mt-6 mb-8">
          <div className="text-4xl">{category.emoji}</div>
          <h1 className="mt-3 text-3xl font-serif font-semibold text-ink md:text-5xl">
            {category.name}
          </h1>
          {category.description && (
            <p className="mt-3 max-w-2xl text-base text-ink/70">{category.description}</p>
          )}
        </header>

        {/* Sort */}
        <div className="mb-8 flex flex-wrap gap-2">
          {(["newest", "popular", "featured"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                sort === s
                  ? "border-[#B8860B] bg-[#B8860B] text-[#0F1E35]"
                  : "border-ink/15 text-ink/70 hover:border-ink/30"
              }`}
            >
              {s === "newest" ? "Newest" : s === "popular" ? "Most Popular" : "Featured"}
            </button>
          ))}
        </div>

        <div className="pb-24">
          <ArticleGrid articles={articles} />
        </div>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "Academy",
                  item: "https://www.aurumvault.store/academy",
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: category.name,
                  item: `https://www.aurumvault.store/academy/${params.category}`,
                },
              ],
            }),
          }}
        />
      </div>
    </MarketShell>
  );
}
