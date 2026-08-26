import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  Lock,
  Download,
  RotateCcw,
  Mail,
  FileText,
  Scale,
  BadgeCheck,
} from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";

const SITE_URL = "https://www.aurumvault.store";
const CANONICAL = `${SITE_URL}/about/trust`;
const TITLE =
  "AurumVault Trust Center | Marketplace Policies & Customer Protection";
const DESCRIPTION =
  "How AurumVault protects buyers and creators: the official AurumVault.store domain, secure payments, instant digital delivery, refund and privacy policies, creator standards, and how to reach support.";

export const Route = createFileRoute("/about_/trust")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebPage",
              "@id": `${CANONICAL}#webpage`,
              url: CANONICAL,
              name: TITLE,
              description: DESCRIPTION,
              isPartOf: { "@id": `${SITE_URL}/#website` },
              about: { "@id": `${SITE_URL}/#organization` },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "AurumVault",
                  item: `${SITE_URL}/`,
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: "About AurumVault",
                  item: `${SITE_URL}/about`,
                },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: "Trust Center",
                  item: CANONICAL,
                },
              ],
            },
          ],
        }),
      },
    ],
  }),
  component: TrustCenterPage,
});

function TrustCenterPage() {
  return (
    <MarketShell>
      <main className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
        <nav aria-label="Breadcrumb" className="text-xs text-mute">
          <Link to="/" className="hover:text-navy">
            Home
          </Link>
          <span className="px-1.5">/</span>
          <Link to="/about" className="hover:text-navy">
            About AurumVault
          </Link>
          <span className="px-1.5">/</span>
          <span className="text-ink/70">Trust Center</span>
        </nav>

        <p className="mt-6 text-[11px] font-semibold uppercase tracking-caps text-gold-ink">
          Trust Center
        </p>
        <h1 className="mt-2 font-display text-4xl text-navy md:text-5xl">
          AurumVault Trust Center
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-ink/80">
          AurumVault is a premium digital-product marketplace operating at{" "}
          <strong className="font-semibold text-navy">AurumVault.store</strong>.
          This page explains, in plain language, how orders are paid for and
          delivered, what protections buyers have, the standards creators agree
          to, and how to reach a real person on our team.
        </p>

        <Section
          icon={<BadgeCheck size={18} />}
          title="How to verify you're on the official AurumVault website"
        >
          <ul className="mt-3 space-y-2">
            <li>
              Our only official storefront is{" "}
              <a
                href={SITE_URL}
                className="font-medium text-navy underline underline-offset-4"
              >
                https://www.aurumvault.store
              </a>
              . Any other domain claiming to be AurumVault is not operated by us.
            </li>
            <li>
              Official email from us comes from an{" "}
              <span className="font-medium text-navy">@aurumvault.store</span>{" "}
              address — support and order notifications included.
            </li>
            <li>
              We never ask for your password, card number, or one-time codes by
              email, DM, or phone.
            </li>
            <li>
              Payments are always completed on our checkout or on Stripe's hosted
              checkout — never by direct transfer, gift card, or crypto wallet.
            </li>
          </ul>
        </Section>

        <Section icon={<Lock size={18} />} title="Secure payments">
          <p className="mt-3">
            Card payments are processed by Stripe, a PCI-DSS Level 1 payment
            provider. AurumVault never sees or stores your full card number —
            payment details are submitted directly to Stripe. All pages are
            served over HTTPS.
          </p>
        </Section>

        <Section icon={<Download size={18} />} title="Digital delivery">
          <p className="mt-3">
            Every product on AurumVault is a digital download. After a successful
            payment we create your order, email a receipt, and issue a secure,
            time-limited download link for each item. Your purchases also stay
            available in your{" "}
            <Link
              to="/library"
              className="font-medium text-navy underline underline-offset-4"
            >
              library
            </Link>{" "}
            when you're signed in with the email used at checkout. If a download
            ever fails, contact support and we'll re-issue it.
          </p>
        </Section>

        <Section icon={<RotateCcw size={18} />} title="Refunds">
          <p className="mt-3">
            Because products are delivered instantly, refunds follow the terms set
            out in our published{" "}
            <Link
              to="/refunds"
              className="font-medium text-navy underline underline-offset-4"
            >
              refund policy
            </Link>{" "}
            — including our 14-day window for eligible purchases and the process
            for files that are broken, mis-described, or never delivered.
          </p>
        </Section>

        <Section icon={<ShieldCheck size={18} />} title="Creator standards">
          <p className="mt-3">
            Creators apply to sell on AurumVault and agree to our{" "}
            <Link
              to="/creator-agreement"
              className="font-medium text-navy underline underline-offset-4"
            >
              creator agreement
            </Link>{" "}
            and{" "}
            <Link
              to="/creator-terms"
              className="font-medium text-navy underline underline-offset-4"
            >
              creator terms
            </Link>
            . Listings are reviewed before release, must describe accurately what
            the buyer receives, and creators keep 85% of each sale. Products that
            misrepresent their contents, infringe someone else's work, or breach
            our standards are removed.
          </p>
        </Section>

        <Section icon={<Scale size={18} />} title="Intellectual property">
          <p className="mt-3">
            Creators must own or be licensed to sell everything they list. If you
            believe a listing infringes your copyright or trademark, email{" "}
            <a
              href="mailto:support@aurumvault.store"
              className="font-medium text-navy underline underline-offset-4"
            >
              support@aurumvault.store
            </a>{" "}
            with the product URL, a description of the protected work, and your
            contact details. We investigate and remove infringing listings.
          </p>
        </Section>

        <Section icon={<Mail size={18} />} title="Complaints and support">
          <p className="mt-3">
            Email{" "}
            <a
              href="mailto:support@aurumvault.store"
              className="font-medium text-navy underline underline-offset-4"
            >
              support@aurumvault.store
            </a>{" "}
            or use our{" "}
            <Link
              to="/contact"
              className="font-medium text-navy underline underline-offset-4"
            >
              contact page
            </Link>
            . We reply within 24 hours, Monday through Friday. If a first reply
            doesn't resolve things, ask for your case to be escalated and a
            member of the team will review it directly.
          </p>
        </Section>

        <Section icon={<FileText size={18} />} title="Policies in full">
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            <PolicyLink to="/terms" label="Terms of Service" />
            <PolicyLink to="/privacy" label="Privacy Policy" />
            <PolicyLink to="/refunds" label="Refund Policy" />
            <PolicyLink to="/creator-agreement" label="Creator Agreement" />
            <PolicyLink to="/creator-terms" label="Creator Terms" />
            <PolicyLink
              to="/affiliate-disclosure"
              label="Affiliate Disclosure"
            />
          </ul>
        </Section>

        <section className="mt-14 rounded-2xl bg-navy p-6 text-white md:p-8">
          <p className="font-display text-2xl">Explore AurumVault</p>
          <p className="mt-2 max-w-lg text-sm text-white/75">
            Browse the digital product marketplace, read the Academy, or apply to
            sell your own digital products.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/products"
              className="inline-flex items-center rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-navy hover:bg-gold/90"
            >
              Browse the marketplace
            </Link>
            <Link
              to="/academy"
              className="inline-flex items-center rounded-full border border-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              AurumVault Academy
            </Link>
            <Link
              to="/sell"
              className="inline-flex items-center rounded-full border border-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              Sell on AurumVault
            </Link>
          </div>
        </section>
      </main>
    </MarketShell>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-navy text-gold">
          {icon}
        </span>
        <h2 className="font-display text-2xl text-navy">{title}</h2>
      </div>
      <div className="mt-1 space-y-3 leading-relaxed text-ink/80">{children}</div>
    </section>
  );
}

function PolicyLink({ to, label }: { to: string; label: string }) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-center justify-between rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm font-medium text-navy hover:border-gold"
      >
        {label}
        <span aria-hidden className="text-mute">
          →
        </span>
      </Link>
    </li>
  );
}
