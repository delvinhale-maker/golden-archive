import { createFileRoute } from "@tanstack/react-router";
import { MarketShell } from "@/components/marketplace/MarketShell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — AurumVault" },
      {
        name: "description",
        content:
          "AurumVault privacy policy: how we collect, use, store, and protect your personal information.",
      },
      { property: "og:title", content: "Privacy Policy — AurumVault" },
      {
        property: "og:description",
        content:
          "How AurumVault handles your personal data and privacy choices.",
      },
      { property: "og:type", content: "website" },
      { rel: "canonical", href: "https://www.aurumvault.store/privacy" } as never,
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <MarketShell>
      <main className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-caps text-gold-ink">
          Legal
        </p>
        <h1 className="mt-2 font-display text-4xl text-navy md:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-mute">
          Last updated: June 28, 2026. This page is maintained by AurumVault to
          answer common questions about how we handle personal information.
        </p>

        <div className="mt-10 space-y-8 text-ink/80 leading-relaxed">
          <Section title="1. What We Collect">
            We collect information you provide directly, such as your name, email
            address, payment details, and product listings. We also collect
            technical data like IP address, browser type, and device information to
            keep the Platform secure and performant.
          </Section>

          <Section title="2. How We Use Information">
            We use your information to provide the marketplace, process payments,
            deliver purchased files, send service-related notifications, improve
            the Platform, and prevent fraud or abuse. Marketing emails are sent
            only with your consent.
          </Section>

          <Section title="3. Sharing & Subprocessors">
            We share data only with service providers needed to operate the
            Platform, such as payment processors (Stripe), cloud hosting and
            database services (Lovable Cloud), and email delivery providers. We do
            not sell personal information.
          </Section>

          <Section title="4. Cookies & Analytics">
            We use cookies and similar technologies to maintain sessions, remember
            preferences, and understand how visitors use the Platform. You can
            manage cookies through your browser settings.
          </Section>

          <Section title="5. Data Retention">
            We keep your account and transaction data for as long as your account
            is active or as needed for legal, tax, and fraud-prevention purposes.
            When you delete your account, we remove or anonymize personal data
            except where retention is required by law.
          </Section>

          <Section title="6. Your Choices">
            You can update your profile, change email preferences, and request
            deletion of your account by contacting support. You may also
            unsubscribe from marketing emails using the link at the bottom of each
            email.
          </Section>

          <Section title="7. Security">
            We use industry-standard measures to protect your data, including
            encryption in transit and access controls. No online service can
            guarantee perfect security, and we encourage you to use strong,
            unique passwords.
          </Section>

          <Section title="8. Children's Privacy">
            AurumVault is not intended for users under 13. We do not knowingly
            collect personal information from children under 13. If you believe we
            have collected such data, contact us to have it removed.
          </Section>

          <Section title="9. Changes to This Policy">
            We may update this Privacy Policy from time to time. Changes will be
            posted on this page with an updated date, and material changes will be
            communicated by email or dashboard notice.
          </Section>

          <Section title="10. Contact">
            For privacy questions or data requests, email{" "}
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
