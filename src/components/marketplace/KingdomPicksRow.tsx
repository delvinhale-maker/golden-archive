import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Crown } from "lucide-react";
import { fetchAffiliateProducts } from "@/lib/affiliate";
import { AffiliateCard } from "./AffiliateCard";

export function KingdomPicksRow() {
  const { data, isLoading } = useQuery({
    queryKey: ["affiliate", "home-row"],
    queryFn: () =>
      fetchAffiliateProducts({ activeOnly: true, featuredFirst: true, limit: 8 }),
    staleTime: 60_000,
  });

  if (!isLoading && (!data || data.length === 0)) return null;

  return (
    <section className="bg-[#FDFAF1] py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-caps text-gold">
              <Crown size={14} /> KINGDOM PICKS
            </div>
            <h2 className="mt-1 font-display text-3xl font-bold text-ink md:text-4xl">
              👑 Kingdom Picks
            </h2>
            <p className="mt-1 text-sm text-mute">
              Curated resources we recommend — from trusted partners.
            </p>
          </div>
          <Link
            to="/kingdom-picks"
            className="hidden text-sm font-bold text-navy underline-offset-4 hover:underline md:inline"
          >
            See all Kingdom Picks →
          </Link>
        </div>

        <div className="-mx-6 flex gap-4 overflow-x-auto px-6 pb-3 md:mx-0 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:px-0">
          {(data ?? []).map((p) => (
            <div key={p.id} className="min-w-[200px] md:min-w-0">
              <AffiliateCard product={p} />
            </div>
          ))}
        </div>

        <div className="mt-4 md:hidden">
          <Link
            to="/kingdom-picks"
            className="text-sm font-bold text-navy underline-offset-4 hover:underline"
          >
            See all Kingdom Picks →
          </Link>
        </div>
      </div>
    </section>
  );
}
