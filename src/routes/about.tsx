import { createFileRoute } from "@tanstack/react-router";
import { MarketShell } from "@/components/marketplace/MarketShell";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About AurumVault — The Gold Standard Digital Marketplace" },
      {
        name: "description",
        content:
          "AurumVault is the curated marketplace for purpose-driven digital products from verified creators.",
      },
      { property: "og:title", content: "About AurumVault" },
      {
        property: "og:description",
        content:
          "Curated digital products from verified creators.",
      },
      { property: "og:type", content: "website" },
      { rel: "canonical", href: "https://www.aurumvault.store/about" } as never,
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <MarketShell>
      <main className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-caps text-gold">
          About
        </p>
        <h1 className="mt-2 font-display text-4xl text-navy md:text-5xl">
          The gold standard for digital products.
        </h1>
        <div className="mt-8 space-y-6 text-ink/80 leading-relaxed">
          <p>
            AurumVault is a curated marketplace built for creators who treat
            their craft as a calling. Every title is reviewed for quality,
            originality, and clarity before it reaches the storefront — so
            readers and buyers can trust what they find here.
          </p>
          <p>
            AurumVault is committed to purpose-driven publishing and sustainable
            creator economics. Sellers keep 70% of every sale; we keep the
            remaining 30% to maintain the platform, fight fraud, invest in
            AI-powered creator tools, and grow the Kingdom-minded audience
            that buys from you.
          </p>
        </div>

        <section className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Creator royalty" value="70%" />
          <Stat label="AI-reviewed titles" value="100%" />
          <Stat label="Verified creators" value="Curated" />
        </section>
      </main>
    </MarketShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <div className="font-display text-3xl text-navy">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-caps text-mute">
        {label}
      </div>
    </div>
  );
}
