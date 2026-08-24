import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Calculator, ArrowRight } from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { estimateDigitalProductRevenue, formatEstimateDollars } from "@/lib/revenue-calculator";
import { CREATOR_SHARE } from "@/lib/storefront";

const SITE_URL = "https://www.aurumvault.store";
const CANONICAL = `${SITE_URL}/tools/revenue-calculator`;
const TITLE = "Digital Product Revenue Calculator | AurumVault";
const DESC =
  "Estimate how much a digital product could earn from your audience. Enter your audience size, price, and expected conversion rate to see estimated buyers and revenue.";

export const Route = createFileRoute("/tools/revenue-calculator")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "AurumVault", item: `${SITE_URL}/` },
            { "@type": "ListItem", position: 2, name: "Revenue Calculator", item: CANONICAL },
          ],
        }),
      },
    ],
  }),
  component: RevenueCalculatorPage,
});

function RevenueCalculatorPage() {
  const [audienceSize, setAudienceSize] = useState(5000);
  const [conversionRatePct, setConversionRatePct] = useState(2);
  const [priceDollars, setPriceDollars] = useState(29);

  const result = useMemo(
    () =>
      estimateDigitalProductRevenue({
        audienceSize,
        conversionRatePct,
        priceCents: Math.round(priceDollars * 100),
      }),
    [audienceSize, conversionRatePct, priceDollars],
  );

  return (
    <MarketShell>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-caps text-gold">
          <Calculator size={12} aria-hidden /> Free Tool
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold text-navy md:text-4xl">
          Digital Product Revenue Calculator
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-mute">
          Get a rough sense of what a digital product could earn from your existing audience. Enter
          your numbers below — these are estimates to help you think through pricing and reach, not
          a forecast or a guarantee.
        </p>

        <section className="mt-8 rounded-2xl border border-line bg-white p-6">
          <div className="grid gap-5 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium text-navy">Audience size</span>
              <input
                type="number"
                min={0}
                value={audienceSize}
                onChange={(e) => setAudienceSize(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-xs text-mute">
                Followers, subscribers, or email list size
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-navy">Expected conversion rate (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={conversionRatePct}
                onChange={(e) => setConversionRatePct(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-xs text-mute">
                Most creators see well under 5% on a cold audience
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-navy">Price ($)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={priceDollars}
                onChange={(e) => setPriceDollars(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-6 grid gap-4 rounded-xl bg-paper p-5 sm:grid-cols-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-caps text-mute">Est. Buyers</p>
              <p className="mt-1 font-display text-2xl font-bold text-navy">
                {result.estimatedBuyers.toLocaleString("en-US")}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-caps text-mute">
                Est. Gross Revenue
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-navy">
                {formatEstimateDollars(result.grossRevenueCents)}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-caps text-mute">
                Est. Your Earnings ({Math.round(CREATOR_SHARE * 100)}% creator share)
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-gold-ink">
                {formatEstimateDollars(result.creatorEarningsCents)}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-mute">
            These are rough estimates based on the numbers you entered, not a guarantee of sales.
            Actual results depend on your audience's trust, how well the product fits their problem,
            your pricing, and your marketing. AurumVault creators keep{" "}
            {Math.round(CREATOR_SHARE * 100)}% of every sale.
          </p>
        </section>

        <section className="mt-10 space-y-3 text-[15px] leading-relaxed text-ink">
          <h2 className="font-display text-xl font-bold text-navy">How this estimate works</h2>
          <p>
            The math is simple on purpose: audience size × conversion rate = estimated buyers.
            Estimated buyers × price = estimated gross revenue. Gross revenue × your creator share =
            what you'd actually keep. There's no hidden model predicting demand for your specific
            product — that depends on factors this calculator can't see, like how well-known you are
            to your audience and how directly your product solves their problem.
          </p>
          <p>
            A useful way to use this: run the numbers at a conservative conversion rate (0.5–2% for
            most creators selling to a cold or lightly-engaged audience) before you commit to a
            price or a big production effort.
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/become-a-creator"
            className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy hover:brightness-105"
          >
            Sell your first digital product <ArrowRight size={14} aria-hidden />
          </Link>
          <Link
            to="/products"
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-navy hover:bg-paper"
          >
            Browse the marketplace
          </Link>
        </div>
      </main>
    </MarketShell>
  );
}
