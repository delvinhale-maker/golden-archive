import { createFileRoute } from "@tanstack/react-router";
import { MarketShell } from "@/components/marketplace/MarketShell";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — AurumVault" },
      {
        name: "description",
        content:
          "AurumVault terms of service for buyers, sellers, and creators. Last updated 2026.",
      },
      { property: "og:title", content: "Terms of Service — AurumVault" },
      {
        property: "og:description",
        content:
          "Terms and conditions for using the AurumVault marketplace.",
      },
      { property: "og:type", content: "website" },
      { rel: "canonical", href: "https://www.aurumvault.store/terms" } as never,
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <MarketShell>
      <main className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-caps text-gold-ink">
          Legal
        </p>
        <h1 className="mt-2 font-display text-4xl text-navy md:text-5xl">
          Terms of Service
        </h1>
        <p className="mt-4 text-sm text-mute">
          Last updated: June 28, 2026. This page is maintained by AurumVault to
          describe the rules and expectations for using this marketplace.
        </p>

        <div className="mt-10 space-y-8 text-ink/80 leading-relaxed">
          <Section title="1. Acceptance of Terms">
            By accessing or using AurumVault (the “Platform”), you agree to these
            Terms of Service and our Privacy Policy. If you do not agree, please do
            not use the Platform.
          </Section>

          <Section title="2. Marketplace Overview">
            AurumVault is a digital marketplace operated by AurumVault.
            The Platform connects creators who sell digital products with buyers who
            purchase them. We charge a 15% platform fee on each sale; creators keep
            the remaining 85%.
          </Section>

          <Section title="3. Buyer Obligations">
            Buyers receive a license to use purchased digital products for personal
            use unless the product listing or creator agreement specifies otherwise.
            Reselling, redistributing, or sharing files without authorization is
            prohibited. All sales are final unless a product is materially defective
            or unavailable.
          </Section>

          <Section title="4. Creator Obligations">
            Creators must own or have rights to all content they upload. Covers,
            manuscripts, descriptions, and metadata must be accurate and not
            infringe third-party rights. We reserve the right to remove listings
            that violate these rules or fail review.
          </Section>

          <Section title="5. Prohibited Content">
            The Platform may not be used to sell illegal, harmful, hateful,
            fraudulent, or sexually explicit content. We use automated and manual
            review tools to enforce these standards. Listings that violate this
            policy may be removed and accounts may be suspended.
          </Section>

          <Section title="6. Payments & Payouts">
            Payments are processed by Stripe. Creators receive payouts according
            to the schedule shown in their dashboard. Payouts may be delayed for
            fraud review, chargebacks, or tax verification.
          </Section>

          <Section title="7. Account Termination">
            We may suspend or terminate accounts for violations of these terms,
            repeated failed reviews, fraud, chargebacks, or inactivity. You may
            delete your account by contacting support.
          </Section>

          <Section title="8. Disclaimers">
            The Platform is provided “as is.” We do not guarantee uninterrupted
            service, specific sales volumes, or the accuracy of every listing. Our
            liability is limited to the amount paid by the buyer for the specific
            transaction at issue.
          </Section>

          <Section title="9. Educational Content Disclaimer (Credit Repair, Consumer Law & Financial Titles)">
            Certain products sold on AurumVault — including but not limited to
            titles covering credit repair, disputing credit bureaus, Method of
            Verification (M.O.V.) letters, "Suing the Credit Bureaus," debt
            validation, FCRA/FDCPA strategies, and related consumer-law or
            financial topics — are provided strictly for{" "}
            <strong>educational and informational purposes only</strong>. These
            products <strong>do not constitute legal, financial, tax, or
            professional advice</strong>, and no attorney–client, fiduciary, or
            advisory relationship is created by purchasing, downloading, or
            reading them. Creators of these products are not necessarily
            attorneys, and AurumVault is not a law firm. Laws vary by
            jurisdiction and change over time; results are not guaranteed and
            individual outcomes will vary. Before acting on anything contained
            in these materials — including sending dispute letters, filing
            lawsuits, or taking any legal or financial action — you should
            consult a licensed attorney or qualified professional in your
            jurisdiction. By purchasing these titles you acknowledge that you
            use the information at your own risk and that AurumVault and the
            creator disclaim all liability for any outcomes arising from your
            use of the materials.
          </Section>

          <Section title="10. Changes to These Terms">
            We may update these terms at any time. Continued use of the Platform
            after changes means you accept the revised terms. Material changes will
            be announced by email or dashboard notice.
          </Section>

          <Section title="10. Contact">
            For questions about these terms, email{" "}
            <a
              href="mailto:support@aurumvault.store"
              className="text-navy hover:text-gold-ink hover:underline"
            >
              support@aurumvault.store
            </a>
            .
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
