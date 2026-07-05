import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Crown, ExternalLink } from "lucide-react";
import { getKingdomPicksRowFn, type AffiliatePick } from "@/lib/marketplace.functions";
import { supabase } from "@/integrations/supabase/client";

export const kingdomPicksRowQ = queryOptions({
  queryKey: ["mp", "row", "kingdom-picks"],
  queryFn: () => getKingdomPicksRowFn(),
});

/** Fire-and-forget outbound affiliate click tracking. Never blocks navigation. */
function trackAmazonClick(p: AffiliatePick, placement: string) {
  // 1) Persist to Lovable Cloud (affiliate_clicks — anon INSERT allowed)
  try {
    supabase
      .from("affiliate_clicks")
      .insert({
        product_id: p.id,
        affiliate_url: p.affiliateUrl,
        source: p.source ?? "amazon",
        user_id: null,
      })
      .then(({ error }) => {
        if (error) console.warn("[affiliate] click log failed", error.message);
      });
  } catch {
    /* ignore */
  }
  // 2) Emit analytics events (GA4 gtag + dataLayer + Plausible if present)
  try {
    const payload = {
      product_id: p.id,
      product_title: p.title,
      source: p.source ?? "amazon",
      placement,
      affiliate_url: p.affiliateUrl,
      value: p.price ?? undefined,
      currency: "USD",
    };
    const w = window as unknown as {
      gtag?: (...args: unknown[]) => void;
      dataLayer?: unknown[];
      plausible?: (event: string, opts?: { props?: Record<string, unknown> }) => void;
    };
    w.gtag?.("event", "affiliate_click", payload);
    w.dataLayer?.push({ event: "affiliate_click", ...payload });
    w.plausible?.("Affiliate Click", { props: payload });
  } catch {
    /* ignore */
  }
}

export function KingdomPicksRow() {
  const { data } = useSuspenseQuery(kingdomPicksRowQ);
  const picks = data as AffiliatePick[];
  if (picks.length === 0) return null;

  return (
    <section className="bg-bg-page py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-caps text-gold">
            <Crown size={14} /> CURATED PICKS
          </div>
          <h2
            className="mt-2 font-display text-3xl font-bold md:text-4xl"
            style={{ color: "#ffffff" }}
          >
            👑 Curated Picks
          </h2>
          <p className="mt-2 max-w-md text-sm text-white/70">
            Handpicked resources we recommend — from trusted partners.
          </p>
          <span className="mt-3 block h-[2px] w-10 bg-gold" />
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
          {picks.slice(0, 8).map((p) => (
            <article
              key={p.id}
              className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-card"
            >
              <div className="aspect-[4/5] w-full overflow-hidden bg-[#0F1E35]">
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="flex flex-1 flex-col p-4">
                {p.source && (
                  <span className="mb-2 inline-flex w-fit items-center rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-caps text-gold">
                    {p.source}
                  </span>
                )}
                <h3 className="line-clamp-2 font-display text-sm font-bold text-white">
                  {p.title}
                </h3>
                {p.price != null && (
                  <div className="mt-2 font-display text-lg font-bold text-gold">
                    ${p.price.toFixed(2)}
                  </div>
                )}
                <a
                  href={p.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  onClick={() => trackAmazonClick(p, "home_kingdom_picks_row")}
                  onAuxClick={() => trackAmazonClick(p, "home_kingdom_picks_row")}
                  data-analytics-event="affiliate_click"
                  data-analytics-source={p.source ?? "amazon"}
                  data-analytics-product-id={p.id}
                  className="mt-auto inline-flex h-10 items-center justify-center gap-1 rounded-full bg-gold px-4 text-xs font-bold text-navy transition hover:brightness-105"
                >
                  View on Amazon <ExternalLink size={12} />
                </a>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/kingdom-picks"
            className="inline-flex h-11 items-center rounded-full border border-gold px-6 text-sm font-bold text-gold hover:bg-gold hover:text-navy"
          >
            See all Kingdom Picks →
          </Link>
        </div>
      </div>
    </section>
  );
}
