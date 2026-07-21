import { createFileRoute, Link } from "@tanstack/react-router";
import { Gift, Sparkles } from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";

export const Route = createFileRoute("/gift-cards")({
  head: () => ({
    meta: [
      { title: "Gift Cards — AurumVault" },
      {
        name: "description",
        content:
          "Give the gift of premium digital resources. AurumVault gift cards — coming soon.",
      },
      { property: "og:title", content: "Gift Cards — AurumVault" },
      {
        property: "og:description",
        content: "Give the gift of premium digital resources. Coming soon.",
      },
    ],
  }),
  component: GiftCardsPage,
});

function GiftCardsPage() {
  return (
    <MarketShell>
      <section className="av-hero-bg border-b border-white/10">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center lg:px-8">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-caps text-gold">
            <Gift size={14} /> COMING SOON
          </div>
          <h1 className="mt-3 font-display text-4xl font-bold text-white md:text-5xl">
            AurumVault <span className="gold-gradient">Gift Cards</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-white/70">
            Give the gift of premium digital resources — eBooks, courses, templates, and audio from independent creators. Redeemable across the entire vault.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/products"
              className="inline-flex h-12 items-center rounded-full bg-gold px-7 text-sm font-bold text-navy"
            >
              Shop the vault
            </Link>
            <Link
              to="/contact"
              className="inline-flex h-12 items-center rounded-full border border-white/70 px-7 text-sm font-bold text-white"
            >
              Notify me when live
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-bg-page py-16">
        <div className="mx-auto grid max-w-5xl gap-6 px-6 md:grid-cols-3 lg:px-8">
          {[
            { title: "Any amount", body: "From $10 to $500 — choose what fits." },
            { title: "Instant delivery", body: "Digital delivery to any inbox, worldwide." },
            { title: "Never expires", body: "Redeem across every category, anytime." },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-white/10 bg-white/5 p-6"
            >
              <Sparkles size={18} className="text-gold" />
              <div className="mt-3 font-display text-lg font-bold text-white">
                {f.title}
              </div>
              <p className="mt-1 text-sm text-white/70">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketShell>
  );
}
