import { Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import {
  getCreatorLeaderboard,
  type LeaderboardRow,
} from "@/lib/leaderboard.functions";

export const topCreatorsQ = queryOptions({
  queryKey: ["mp", "top-creators"],
  queryFn: () => getCreatorLeaderboard(),
  staleTime: 5 * 60_000,
});

export function TopCreatorsLeaderboard() {
  const { data } = useSuspenseQuery(topCreatorsQ);
  const rows = (data as LeaderboardRow[]).slice(0, 10);
  if (rows.length === 0) return null;
  return (
    <section className="bg-bg-page py-16 md:py-24">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-caps text-gold-ink">
            <Trophy size={14} /> TOP CREATORS THIS MONTH
          </div>
          <h2 className="mt-2 font-display text-3xl font-bold text-white md:text-4xl">
            The leaderboard
          </h2>
          <span className="mx-auto mt-3 block h-[2px] w-10 bg-gold" />
        </div>
        <ol className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
          {rows.map((r) => {
            const inner = (
              <div className="flex items-center gap-4 p-4">
                <div
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-sm font-bold ${
                    r.rank === 1
                      ? "bg-gold text-navy"
                      : r.rank <= 3
                        ? "bg-white/20 text-white"
                        : "bg-white/10 text-white/80"
                  }`}
                >
                  {r.rank}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-base font-bold text-white">
                    {r.name}
                  </div>
                  <div className="text-[11px] text-white/60">Creator</div>
                </div>
              </div>
            );
            return (
              <li key={r.sellerId}>
                {r.slug ? (
                  <Link
                    to="/store/$slug"
                    params={{ slug: r.slug }}
                    className="block transition hover:bg-white/5"
                  >
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ol>
        <div className="mt-6 text-center">
          <Link
            to="/creators"
            className="inline-flex h-11 items-center rounded-full border border-gold px-6 text-sm font-bold text-gold-ink hover:bg-gold hover:text-navy"
          >
            See all creators →
          </Link>
        </div>
      </div>
    </section>
  );
}
