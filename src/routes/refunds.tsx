import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketShell } from "@/components/marketplace/MarketShell";

export const Route = createFileRoute("/refunds")({
  head: () => ({
    meta: [
      { title: "Refund Policy — AurumVault" },
      {
        name: "description",
        content:
          "AurumVault's refund and return policy for digital products. 14-day money-back guarantee on eligible purchases.",
      },
      { property: "og:title", content: "Refund Policy — AurumVault" },
      {
        property: "og:description",
        content:
          "Refund and return policy for digital products purchased on AurumVault.",
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
          Refund &amp; Return Policy
        </h1>
        <p className="mt-4 text-sm text-mute">
          Last updated: July 27, 2026. This policy applies to all digital
          products sold on AurumVault (aurumvault.store).
        </p>

        <div className="mt-10 space-y-8 text-ink/80 leading-relaxed">
          <Section title="1. Digital Goods — Summary">
            AurumVault sells digital products (ebooks, journals, planners, AI
            prompt packs, interactive editions, and similar files). Because
            these are delivered instantly and cannot be physically returned, we
            handle refunds under the terms below rather than a traditional
            return process.
          </Section>

          <Section title="2. 14-Day Money-Back Guarantee">
            You may request a full refund within <strong>14 days</strong> of
            purchase if you have not fully downloaded or substantially consumed
            the product, or if the product is materially defective, mislabeled,
            or not as described on its listing. Refunds are issued to the
            original payment method.
          </Section>

          <Section title="3. When Refunds Are Not Available">
            To keep the marketplace fair to creators, refunds are generally not
            issued when:
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                The product has been downloaded in full and no defect or
                misrepresentation is claimed.
              </li>
              <li>
                The request is made more than 14 days after the purchase date.
              </li>
              <li>
                The refund is requested because the buyer changed their mind
                about a product that was accurately described.
              </li>
              <li>
                There is evidence of abuse (e.g. repeated buy-and-refund
                patterns or redistribution of files).
              </li>
            </ul>
          </Section>

          <Section title="4. Defective or Misrepresented Products">
            If a file won't open, is corrupted, is missing pages, or the
            listing materially misrepresents what you received, contact us
            within 14 days and we'll either fix the file, replace it, or issue
            a full refund — whichever you prefer. Nothing in this policy limits
            rights you may have under applicable consumer protection law.
          </Section>

          <Section title="5. How to Request a Refund">
            Email{" "}
            <a
              href="mailto:support@aurumvault.tech"
              className="text-navy hover:text-gold-ink hover:underline"
            >
              support@aurumvault.tech
            </a>{" "}
            from the address on your order with your order number and a short
            note about the reason. Most requests are reviewed within one
            business day. Approved refunds are issued instantly on our side and
            typically appear on your card within 5–10 business days depending
            on your bank.
          </Section>

          <Section title="6. Chargebacks">
            Please contact support before filing a chargeback — most issues can
            be resolved faster by email. Accounts with unresolved chargebacks
            may be suspended pending review.
          </Section>

          <Section title="7. Creator Payouts &amp; Refunds">
            When a buyer refund is approved, the corresponding creator earnings
            for that order are reversed. Creators can see refunded orders in
            their dashboard under Earn.
          </Section>

          <Section title="8. Contact">
            Questions about this policy? Email{" "}
            <a
              href="mailto:support@aurumvault.tech"
              className="text-navy hover:text-gold-ink hover:underline"
            >
              support@aurumvault.tech
            </a>{" "}
            or visit the{" "}
            <Link to="/support" className="text-navy hover:text-gold-ink hover:underline">
              Help Center
            </Link>
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
