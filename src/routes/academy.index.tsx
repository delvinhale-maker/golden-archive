import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { getAcademyHub, type AcademyArticle, type AcademyCategory } from "@/lib/academy.functions";
import { BookOpen, Clock, ArrowRight, Sparkles } from "lucide-react";

const hubQuery = queryOptions({
  queryKey: ["academy", "hub"],
  queryFn: () => getAcademyHub(),
});

export const Route = createFileRoute("/academy/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(hubQuery),
  head: () => ({
    meta: [
      { title: "AurumVault Academy — Learn. Build. Grow." },
      {
        name: "description",
        content:
          "Master personal finance, AI, business, productivity, digital entrepreneurship, and Kingdom-minded personal growth through premium educational content.",
      },
      { property: "og:title", content: "AurumVault Academy — Learn. Build. Grow." },
      {
        property: "og:description",
        content:
          "The educational hub of AurumVault. Premium articles on finance, AI, publishing, entrepreneurship, and Kingdom living.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.aurumvault.store/academy" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AurumVault Academy" },
      {
        name: "twitter:description",
        content: "Learn. Build. Grow. The educational hub of AurumVault.",
      },
    ],
    links: [{ rel: "canonical", href: "https://www.aurumvault.store/academy" }],
  }),
  component: AcademyHome,
});

function AcademyHome() {
  const { data } = useSuspenseQuery(hubQuery);
  return (
    <MarketShell>
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <AcademyHero />
        <CategoriesGrid categories={data.categories} />
        {data.featured.length > 0 && (
          <section className="mt-16">
            <SectionHeader
              eyebrow="Featured"
              title="Editor's picks"
              subtitle="Hand-selected essays from the vault"
            />
            <ArticleGrid articles={data.featured} />
          </section>
        )}
        <section className="mt-16 pb-24">
          <SectionHeader
            eyebrow="Latest"
            title="New from the Academy"
            subtitle="Fresh writing on wealth, work, and wisdom"
          />
          <ArticleGrid articles={data.latest} />
        </section>
      </div>
    </MarketShell>
  );
}

function AcademyHero() {
  return (
    <section
      className="mt-6 overflow-hidden rounded-3xl px-6 py-14 md:px-14 md:py-20"
      style={{
        background:
          "linear-gradient(135deg, #0F1E35 0%, #172A48 55%, #0F1E35 100%)",
      }}
    >
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#B8860B]/40 bg-[#B8860B]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-[#E9C46A]">
          <Sparkles size={12} /> AurumVault Academy
        </div>
        <h1 className="mt-5 text-4xl font-serif font-semibold leading-tight text-white md:text-6xl">
          Learn. Build. <span className="text-[#B8860B]">Grow.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">
          Master personal finance, AI, business, productivity, digital entrepreneurship,
          and Kingdom-minded personal growth through premium educational content.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href="#categories"
            className="inline-flex items-center gap-2 rounded-full bg-[#B8860B] px-6 py-3 text-sm font-semibold text-[#0F1E35] transition hover:brightness-110"
          >
            <BookOpen size={16} /> Start Learning
          </a>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Browse Marketplace <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function CategoriesGrid({ categories }: { categories: AcademyCategory[] }) {
  return (
    <section id="categories" className="mt-16 scroll-mt-24">
      <SectionHeader
        eyebrow="Curriculum"
        title="Featured categories"
        subtitle="Five disciplines. One mission: quiet, compounding growth."
      />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <Link
            key={c.slug}
            to="/academy/$category"
            params={{ category: c.slug }}
            className="group relative overflow-hidden rounded-2xl border border-[#B8860B]/25 bg-[#FDF9F0] p-6 transition hover:-translate-y-0.5 hover:border-[#B8860B] hover:shadow-lg"
          >
            <div className="text-3xl">{c.emoji ?? "📖"}</div>
            <h3 className="mt-4 text-lg font-semibold text-[#0F1E35]">{c.name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#0F1E35]/70">
              {c.description}
            </p>
            <div className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-[#B8860B]">
              Explore <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-[#B8860B]">
        {eyebrow}
      </div>
      <h2 className="mt-2 text-2xl font-serif font-semibold text-ink md:text-3xl">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-ink/60">{subtitle}</p>}
    </div>
  );
}

export function ArticleGrid({ articles }: { articles: AcademyArticle[] }) {
  if (articles.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-ink/15 p-10 text-center text-sm text-ink/60">
        No articles yet — check back soon.
      </div>
    );
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((a) => (
        <ArticleCard key={a.id} article={a} />
      ))}
    </div>
  );
}

export function difficultyFor(readingMin: number): "Beginner" | "Intermediate" | "Advanced" {
  if (readingMin <= 5) return "Beginner";
  if (readingMin <= 12) return "Intermediate";
  return "Advanced";
}

export function ArticleCard({ article }: { article: AcademyArticle }) {
  const date = article.published_at ? new Date(article.published_at) : null;
  const difficulty = difficultyFor(article.reading_time_min);
  return (
    <Link
      to="/academy/article/$slug"
      params={{ slug: article.slug }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white transition duration-300 hover:-translate-y-1 hover:border-[#B8860B]/60 hover:shadow-[0_20px_50px_-20px_rgba(15,30,53,0.35)]"
    >
      <div
        className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-[#0F1E35] via-[#152743] to-[#0F1E35]"
        style={
          article.featured_image
            ? { backgroundImage: `url(${article.featured_image})`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
      >
        {!article.featured_image && (
          <>
            <div
              aria-hidden
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 30% 30%, rgba(184,134,11,0.35), transparent 55%), radial-gradient(circle at 75% 70%, rgba(184,134,11,0.18), transparent 60%)",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-serif text-5xl italic tracking-tight text-[#B8860B]/80">AV</span>
            </div>
          </>
        )}
        <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#0F1E35]/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#E9C46A] backdrop-blur">
          {difficulty}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#B8860B]">
          <span>{article.category.replace(/-/g, " ")}</span>
          <span className="text-ink/30">•</span>
          <span className="inline-flex items-center gap-1 text-ink/60">
            <Clock size={11} /> {article.reading_time_min} min
          </span>
        </div>
        <h3 className="mt-3 line-clamp-2 text-lg font-semibold text-ink transition group-hover:text-[#B8860B]">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink/70">
            {article.excerpt}
          </p>
        )}
        <div className="mt-4 flex items-center justify-between text-[12px] text-ink/60">
          <span>{article.author_name ?? "AurumVault"}</span>
          {date && <span>{date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>}
        </div>
        <div className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-[#B8860B]">
          Continue Reading <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}
