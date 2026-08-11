import { createFileRoute } from "@tanstack/react-router";
import { MarketShell } from "@/components/marketplace/MarketShell";

export const Route = createFileRoute("/refunds")({
  head: () => ({
    meta: [
      { title: "Refund Policy — AurumVault" },
      {
        name: "description",
        content:
          "AurumVault refund policy: the 14-day money-back guarantee for eligible purchases.",
      },
      { property: "og:title", content: "Refund Policy — AurumVault" },
      {
        property: "og:description",
        content: "How refunds work for purchases made on AurumVault.",
      },
      { property: "og:type", content: "website" },
      { rel: "canonical", href: "https://www.aurumvault.store/refunds" } as never,
    ],
  }),
  component: RefundsPage,
});

function RefundsPage() {
  return (
    <MarketShell>
      <main className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-caps text-gold-ink">
          Legal
        </p>
        <h1 className="mt-2 font-display text-4xl text-navy md:text-5xl">
          Refund Policy
        </h1>
        <p className="mt-4 text-sm text-mute">
          Last updated: June 28, 2026. This page is maintained by AurumVault to
          describe how refunds work for purchases made on this marketplace.
        </p>

        <div className="mt-10 space-y-8 text-ink/80 leading-relaxed">
          <Section title="1. 14-Day Money-Back Guarantee">
            Eligible purchases are covered by a 14-day money-back guarantee,
            starting from the date of purchase. To request a refund, contact
            support within that window.
          </Section>

          <Section title="2. Eligibility">
            A purchase is eligible for a refund under this guarantee unless the
            product listing or creator agreement states otherwise, or unless the
            purchase is otherwise excluded by our Terms of Service.
          </Section>

          <Section title="3. How to Request a Refund">
            Email{" "}
            <a
              href="mailto:support@aurumvault.store"
              className="text-navy hover:text-gold-ink hover:underline"
            >
              support@aurumvault.store
            </a>{" "}
            with your order details. Approved refunds are returned to the
            original payment method.
          </Section>
        </div>
      </main>
    </MarketShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl text-navy">{title}</h2>
      <div className="mt-2 text-sm">{children}</div>
    </section>
  );
}
