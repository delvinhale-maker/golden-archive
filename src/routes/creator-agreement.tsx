import { createFileRoute } from "@tanstack/react-router";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { Check } from "lucide-react";

export const Route = createFileRoute("/creator-agreement")({
  head: () => ({
    meta: [
      { title: "Creator Agreement — Sell on AurumVault" },
      {
        name: "description",
        content:
          "AurumVault creator agreement: royalty split, content standards, and payout terms for sellers.",
      },
      { property: "og:title", content: "Creator Agreement — AurumVault" },
      {
        property: "og:description",
        content:
          "Terms for creators selling digital products on AurumVault.",
      },
      { property: "og:type", content: "website" },
      {
        rel: "canonical",
        href: "https://www.aurumvault.store/creator-agreement",
      } as never,
    ],
  }),
  component: CreatorAgreementPage,
});

const POINTS = [
  "You must own or have licensed all rights to the content you upload.",
  "Covers and manuscripts must meet the minimum quality standards shown in the publish flow.",
  "All products are reviewed by AI and may be manually audited before going live.",
  "You keep 91% of every sale; AurumVault retains 9% to operate the platform.",
  "Payouts are issued on the schedule shown in your dashboard after payment holds clear.",
  "You may not sell illegal, hateful, fraudulent, or infringing content.",
  "AurumVault may remove listings that violate these standards or receive buyer complaints.",
];

function CreatorAgreementPage() {
  return (
    <MarketShell>
      <main className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-caps text-gold">
          For Sellers
        </p>
        <h1 className="mt-2 font-display text-4xl text-navy md:text-5xl">
          Creator Agreement
        </h1>
        <p className="mt-4 text-sm text-mute">
          Last updated: June 28, 2026. This page is maintained by AurumVault to
          describe the relationship between the marketplace and creators who sell
          here.
        </p>

        <div className="mt-10 space-y-8 text-ink/80 leading-relaxed">
          <section>
            <h2 className="font-display text-xl text-navy">1. Royalty Split</h2>
            <p className="mt-2 text-sm">
              AurumVault charges a 9% platform fee on each sale. The creator
              receives 91% of the gross transaction amount, less payment processing
              fees charged by Stripe. Net payout amounts are shown in your dashboard
              before you withdraw.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-navy">
              2. Content Standards
            </h2>
            <ul className="mt-3 space-y-2">
              {POINTS.slice(0, 3).map((text) => (
                <li key={text} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold">
                    <Check size={10} />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl text-navy">3. Payouts</h2>
            <p className="mt-2 text-sm">
              Payouts are made to the connected bank account or debit card in your
              Stripe Connect dashboard. Minimum payout thresholds and schedules are
              shown in your AurumVault dashboard. Fraud review, chargebacks, or tax
              verification may delay payouts.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-navy">
              4. Prohibited Conduct
            </h2>
            <p className="mt-2 text-sm">
              Creators may not manipulate reviews, abuse referral credits, infringe
              intellectual property, or upload misleading metadata. Violations may
              result in removal of listings, withholding of payouts, or permanent
              account suspension.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-navy">
              5. Platform & Creator Responsibilities
            </h2>
            <p className="mt-2 text-sm">
              AurumVault provides the marketplace, review tools, payment
              infrastructure, and customer support. Creators are responsible for
              the quality, accuracy, and legality of their own listings. This is a
              shared-responsibility arrangement: the platform handles technology
              and distribution, while the creator handles the work itself.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-navy">6. Agreement</h2>
            <p className="mt-2 text-sm">
              By publishing a product on AurumVault, you agree to these terms and
              our broader Terms of Service and Privacy Policy. If you do not agree,
              do not list products for sale.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-navy">7. Contact</h2>
            <p className="mt-2 text-sm">
              Seller questions:{" "}
              <a
                href="mailto:creators@aurumvault.store"
                className="text-navy hover:text-gold hover:underline"
              >
                creators@aurumvault.store
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </MarketShell>
  );
}
