import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Award, Coins, Crown, Rocket, Star, Trophy } from "lucide-react";
import type { ComponentType } from "react";
import { getCreatorBadges, type BadgeKey } from "@/lib/leaderboard.functions";

const ICONS: Record<BadgeKey, ComponentType<{ size?: number; className?: string }>> = {
  first_sale: Rocket,
  ten_sales: Star,
  hundred_sales: Award,
  one_k_earned: Coins,
  ten_k_earned: Trophy,
  top_creator: Crown,
};

type Props = {
  sellerId: string;
  /** Hide the whole row when the creator has zero earned badges. Default true. */
  hideIfEmpty?: boolean;
  className?: string;
};

export function StorefrontBadgeRow({ sellerId, hideIfEmpty = true, className }: Props) {
  const fetch = useServerFn(getCreatorBadges);
  const { data } = useQuery({
    queryKey: ["creator-badges", sellerId],
    queryFn: () => fetch({ data: { sellerId } }),
    staleTime: 5 * 60 * 1000,
  });

  if (!data) return null;
  const earned = data.filter((b) => b.earned);
  if (earned.length === 0 && hideIfEmpty) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${className ?? ""}`}
      aria-label="Creator badges earned"
    >
      {data.map((b) => {
        const Icon = ICONS[b.key];
        return (
          <span
            key={b.key}
            title={b.earned ? b.label : `${b.label} — ${b.hint}`}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium tracking-wide transition ${
              b.earned
                ? "border-gold/40 bg-gold/15 text-gold-ink"
                : "border-muted/30 bg-muted/10 text-mute opacity-60"
            }`}
          >
            <Icon size={12} />
            {b.label}
          </span>
        );
      })}
    </div>
  );
}
