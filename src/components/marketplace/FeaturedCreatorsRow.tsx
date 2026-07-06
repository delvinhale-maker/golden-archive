import { Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { BadgeCheck, MapPin } from "lucide-react";
import { getApprovedCreators, type CreatorSummary } from "@/lib/creators.functions";

export const featuredCreatorsQ = queryOptions({
  queryKey: ["mp", "featured-creators"],
  queryFn: () => getApprovedCreators(),
  staleTime: 60_000,
});

export function FeaturedCreatorsRow() {
  const { data } = useSuspenseQuery(featuredCreatorsQ);
  const list = (data as CreatorSummary[]).slice(0, 12);
  if (list.length === 0) return null;
  return (
    <section className="bg-bg-page py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold tracking-caps text-gold">
              FEATURED CREATORS
            </div>
            <h2 className="mt-1 font-display text-2xl font-bold text-white md:text-3xl">
              Verified voices shipping premium resources
            </h2>
          </div>
          <Link
            to="/creators"
            className="hidden shrink-0 text-sm font-bold text-gold hover:underline md:inline"
          >
            Browse all creators →
          </Link>
        </div>
        <div className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 lg:-mx-8 lg:px-8">
          {list.map((c) => (
            <Link
              key={c.userId}
              to="/store/$slug"
              params={{ slug: c.brandSlug }}
              className="group relative flex w-[260px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 transition hover:-translate-y-1 hover:border-gold"
            >
              <div
                className="h-24 w-full bg-cover bg-center"
                style={{
                  background: c.coverUrl
                    ? `url(${c.coverUrl}) center/cover`
                    : "linear-gradient(135deg,#0f1629 0%,#1a2744 55%,#c9a227 130%)",
                }}
              />
              <div className="px-5 pb-5">
                <div className="-mt-8 grid h-14 w-14 place-items-center overflow-hidden rounded-full border-[3px] border-navy bg-navy">
                  {c.avatarUrl ? (
                    <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-display text-lg text-gold">
                      {c.brandName.slice(0, 1)}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <div className="truncate font-display text-base font-bold text-white">
                    {c.brandName}
                  </div>
                  <BadgeCheck size={14} className="shrink-0 text-emerald" />
                </div>
                {c.pitch && (
                  <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-white/70">
                    {c.pitch}
                  </p>
                )}
                {c.country && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-white/50">
                    <MapPin size={11} />
                    {c.country}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-4 text-center md:hidden">
          <Link to="/creators" className="text-sm font-bold text-gold hover:underline">
            Browse all creators →
          </Link>
        </div>
      </div>
    </section>
  );
}
