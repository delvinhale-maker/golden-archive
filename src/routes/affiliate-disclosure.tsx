import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { Info } from "lucide-react";

export const Route = createFileRoute("/affiliate-disclosure")({
  head: () => ({
    meta: [
      { title: "Affiliate Disclosure — AurumVault" },
      {
        name: "description",
        content:
          "AurumVault participates in affiliate programs including Amazon Associates and the Walmart Affiliate Program.",
      },
      { property: "og:title", content: "Affiliate Disclosure — AurumVault" },
    ],
  }),
  component: AffiliateDisclosurePage,
});

function AffiliateDisclosurePage() {
  return (
    <MarketShell>
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-16">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-gold/15 px-3 py-1 text-[11px] font-bold uppercase tracking-caps text-gold-ink">
          <Info size={12} /> FTC Disclosure
        </div>
        <h1 className="font-display text-3xl font-bold text-navy md:text-4xl">
          Affiliate Disclosure
        </h1>
        <div className="prose mt-6 max-w-none text-ink/85">
          <p className="text-lg leading-relaxed">
            AurumVault participates in affiliate programs including{" "}
            <strong>Amazon Associates</strong> and the{" "}
            <strong>Walmart Affiliate Program</strong>. We earn commissions on
            qualifying purchases made through links on this site. This does not
            affect the price you pay and helps us continue building
            Kingdom-centered resources.
          </p>

          <h2 className="mt-8 font-display text-xl text-navy">
            How Kingdom Picks works
          </h2>
          <p>
            Products in our <Link to="/kingdom-picks" className="text-gold-ink underline">Kingdom Picks</Link>{" "}
            section are curated by our team. When you click a partner link and
            complete a purchase on Amazon, Walmart, or another partner site, we
            may receive a small referral commission from that retailer — at no
            additional cost to you.
          </p>

          <h2 className="mt-8 font-display text-xl text-navy">
            Editorial independence
          </h2>
          <p>
            We only recommend resources that align with our mission. Commission
            potential never determines whether a product is featured. AurumVault's
            own digital products always rank first in search and category pages.
          </p>

          <h2 className="mt-8 font-display text-xl text-navy">Questions?</h2>
          <p>
            Reach out via our <Link to="/contact" className="text-gold-ink underline">contact page</Link>{" "}
            if you have any questions about our partnerships or disclosures.
          </p>
        </div>
      </div>
    </MarketShell>
  );
}
