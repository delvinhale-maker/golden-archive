import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen, Clock, ArrowRight } from "lucide-react";
import { listLatestAcademyArticles } from "@/lib/academy.functions";

export const academyLatestQ = queryOptions({
  queryKey: ["academy", "latest-home"],
  queryFn: () => listLatestAcademyArticles(),
  staleTime: 60_000,
});

export function AcademyLatestRow() {
  const { data } = useSuspenseQuery(academyLatestQ);
  const articles = data.articles;
  if (!articles.length) return null;

  return (
    <section className="bg-white py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-caps text-gold-deep">
            <BookOpen size={14} /> AURUMVAULT ACADEMY
          </div>
          <h2 className="mt-2 font-display text-3xl font-bold text-navy md:text-4xl">
            From the Academy
          </h2>
          <p className="mt-2 max-w-md text-sm text-navy/70">
            Fresh insights, playbooks, and stories from our editors.
          </p>
          <span className="mt-3 block h-[2px] w-10 bg-gold" />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => {
            const categoryLabel =
              data.categoryNames[a.category] ?? a.category;
            return (
              <Link
                key={a.id}
                to="/academy/article/$slug"
                params={{ slug: a.slug }}
                aria-label={a.title}
                className="group flex flex-col overflow-hidden rounded-xl border border-navy/10 bg-white shadow-card transition hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-lg"
              >
                <div className="aspect-[16/10] w-full overflow-hidden bg-navy">
                  {a.featured_image ? (
                    <img
                      src={a.featured_image}
                      alt={a.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-navy text-gold">
                      <BookOpen size={36} />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-caps">
                    <span className="rounded-full border border-gold/50 bg-gold/15 px-2 py-0.5 text-gold-deep">
                      {categoryLabel}
                    </span>
                    <span className="inline-flex items-center gap-1 text-navy/60">
                      <Clock size={11} />
                      {a.reading_time_min} min read
                    </span>
                  </div>
                  <h3 className="mt-3 line-clamp-2 font-display text-base font-bold text-navy group-hover:text-gold-deep">
                    {a.title}
                  </h3>
                  {a.excerpt && (
                    <p className="mt-2 line-clamp-2 text-sm text-navy/70">
                      {a.excerpt}
                    </p>
                  )}
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-gold-deep">
                    Read article <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/academy"
            className="inline-flex h-11 items-center rounded-full border border-gold-deep px-6 text-sm font-bold text-gold-deep hover:bg-gold hover:text-navy"
          >
            Explore the Academy →
          </Link>
        </div>
      </div>
    </section>
  );
}
