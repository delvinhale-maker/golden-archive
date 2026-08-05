import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { Mail, MessageSquare, BookOpen, Download, RotateCcw, Store, ChevronDown } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — AurumVault Help Center" },
      {
        name: "description",
        content:
          "Answers to the most common questions about AurumVault purchases, downloads, refunds, and creator payouts. Reach support at support@supportaurumvault.tech.",
      },
      { property: "og:title", content: "AurumVault Support" },
      {
        property: "og:description",
        content:
          "Help center covering purchases, downloads, refunds, and creator questions.",
      },
      { property: "og:type", content: "website" },
      { rel: "canonical", href: "https://www.aurumvault.store/support" } as never,
    ],
  }),
  component: SupportPage,
});

const TOPICS = [
  {
    icon: BookOpen,
    title: "Buying & Downloads",
    body: "Instant delivery after checkout. Your files live in Account → My Downloads and re-download links never expire.",
  },
  {
    icon: RotateCcw,
    title: "Refunds",
    body: "14-day money-back guarantee on digital purchases you haven't fully downloaded or consumed. Just email support.",
  },
  {
    icon: Store,
    title: "Creators & Payouts",
    body: "Sellers keep 85% of every sale. Track earnings in your dashboard; payouts run on the schedule shown there.",
  },
  {
    icon: Mail,
    title: "Contact a Human",
    body: "Email support@supportaurumvault.tech for orders, creators@supportaurumvault.tech for seller questions. Reply within 24h.",
  },
];

type FAQ = { q: string; a: string };

const FAQ_SECTIONS: { title: string; items: FAQ[] }[] = [
  {
    title: "Purchases & Payment",
    items: [
      {
        q: "What payment methods do you accept?",
        a: "We accept all major credit and debit cards (Visa, Mastercard, American Express, Discover), Apple Pay, Google Pay, and Link. Checkout is powered by Stripe — we never see or store your card details.",
      },
      {
        q: "Is checkout secure?",
        a: "Yes. All payments run through Stripe's PCI-compliant infrastructure over TLS. AurumVault never stores card numbers, CVV codes, or bank details on our servers.",
      },
      {
        q: "Will I receive a receipt?",
        a: "Yes. A receipt is emailed to you immediately after checkout, and every order is saved in Account → Orders where you can re-download it any time.",
      },
      {
        q: "Do you charge tax?",
        a: "Applicable sales tax and VAT are calculated automatically at checkout based on your billing address. The final total is shown before you confirm the purchase.",
      },
    ],
  },
  {
    title: "Downloads & Access",
    items: [
      {
        q: "How do I download my files after purchase?",
        a: "Downloads are instant. Right after checkout you'll see a download button on the confirmation screen, and the same files are permanently available under Account → My Downloads. A copy of every download link is also emailed to you.",
      },
      {
        q: "Can I download my files more than once?",
        a: "Yes. Your purchases stay in your library forever. You can re-download them on any device, any time, as often as you need.",
      },
      {
        q: "What file formats do you deliver?",
        a: "Ebooks are delivered as PDF and/or EPUB. Journals and planners are PDF (usually print-ready). AI Prompt Packs are PDF plus a plain-text file for easy copy-paste. Every product page lists the exact formats included.",
      },
      {
        q: "A download link isn't working. What do I do?",
        a: "First, sign in and try the link in Account → My Downloads (that link is always current). If it still fails, email support@supportaurumvault.tech with your order number and we'll re-issue it within 24 hours.",
      },
      {
        q: "Can I read a preview before buying?",
        a: "Most titles have a free sample preview on the product page — look for the 'Read sample' button. Every preview is watermarked and shows real content from the actual product.",
      },
    ],
  },
  {
    title: "Refunds & Returns",
    items: [
      {
        q: "What is your refund policy?",
        a: "We offer a 14-day money-back guarantee on digital purchases you haven't fully downloaded or consumed. If a product isn't what was described, or you're not satisfied, email support@supportaurumvault.tech within 14 days of purchase and we'll issue a refund to your original payment method.",
      },
      {
        q: "How long does a refund take?",
        a: "Once approved, refunds are issued instantly on our side and typically appear on your card within 5–10 business days depending on your bank.",
      },
      {
        q: "Can I get a refund after downloading?",
        a: "Because digital products can't be 'returned,' refunds after significant download or use are handled case-by-case. If the product is defective, mislabeled, or genuinely not as described, we'll always make it right.",
      },
    ],
  },
  {
    title: "For Creators",
    items: [
      {
        q: "How much does AurumVault take?",
        a: "Creators keep 85% of every sale. AurumVault keeps 15% to run the platform, fight fraud, invest in AI-powered creator tools, and grow the audience that buys from you.",
      },
      {
        q: "How do I become a creator?",
        a: "Apply at /become-a-creator. Applications are reviewed within a few business days. Once approved, you can publish ebooks, journals, prompt packs, planners, and interactive editions directly from your dashboard.",
      },
      {
        q: "When and how do I get paid?",
        a: "Royalties accrue in real time and are tracked in your dashboard under Earn. Payouts run on the schedule shown in your dashboard once Stripe Connect payouts are enabled on your account.",
      },
      {
        q: "Who owns the rights to my work?",
        a: "You do. AurumVault takes a non-exclusive license only for as long as your title is live on the store, purely to sell and deliver it. You can unpublish any title at any time from your Bookshelf.",
      },
      {
        q: "How do you review submissions?",
        a: "Every submission is reviewed for craft, clarity, originality, and whether the product delivers what its listing promises. We're not looking for perfection — we're looking for work that respects the buyer's time.",
      },
    ],
  },
  {
    title: "Account & Privacy",
    items: [
      {
        q: "Do I need an account to buy?",
        a: "Yes — an account lets us deliver files instantly, keep them in your library forever, and route support faster. Signing in with Google takes about 3 seconds.",
      },
      {
        q: "How do I reset my password?",
        a: "Go to the sign-in page and click 'Forgot password.' We'll email a reset link within a minute or two. If you don't see it, check your spam folder.",
      },
      {
        q: "How do I delete my account?",
        a: "Email support@supportaurumvault.tech from the address on your account and we'll delete your data within 7 days. See our Privacy Policy for details on what's retained for legal/tax reasons.",
      },
    ],
  },
];

function SupportPage() {
  return (
    <MarketShell>
      <main className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-caps text-gold-ink">
          Help Center
        </p>
        <h1 className="mt-2 font-display text-4xl text-navy md:text-5xl">
          How can we help?
        </h1>
        <p className="mt-4 max-w-xl text-ink/70">
          Answers to the most common questions about buying, downloading,
          refunds, and selling on AurumVault. Can't find it here?{" "}
          <Link to="/contact" className="font-medium text-navy underline underline-offset-4 hover:text-gold-ink">
            Send us a message
          </Link>
          .
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {TOPICS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-ink/10 bg-white p-5"
            >
              <div className="flex items-start gap-4">
                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-gold">
                  <Icon size={18} />
                </div>
                <div>
                  <div className="font-display text-lg text-navy">{title}</div>
                  <p className="mt-1 text-sm leading-relaxed text-ink/70">
                    {body}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <section className="mt-14">
          <h2 className="font-display text-2xl text-navy md:text-3xl">
            Frequently asked questions
          </h2>

          {FAQ_SECTIONS.map((section) => (
            <div key={section.title} className="mt-8">
              <h3 className="text-xs font-semibold uppercase tracking-caps text-gold-ink">
                {section.title}
              </h3>
              <div className="mt-3 divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-white">
                {section.items.map((item) => (
                  <FaqItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            </div>
          ))}
        </section>

        <div className="mt-12 rounded-2xl bg-navy p-6 text-white md:p-8">
          <div className="flex items-start gap-3">
            <MessageSquare className="mt-1 h-5 w-5 text-gold" />
            <div>
              <p className="font-display text-xl">Still need help?</p>
              <p className="mt-2 text-sm text-white/75">
                Email{" "}
                <a
                  href="mailto:support@supportaurumvault.tech"
                  className="text-gold-ink hover:underline"
                >
                  support@supportaurumvault.tech
                </a>{" "}
                or use the{" "}
                <Link to="/contact" className="text-gold-ink hover:underline">
                  contact form
                </Link>
                . We reply within 24 hours, Monday through Friday.
              </p>
            </div>
          </div>
        </div>
      </main>
    </MarketShell>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="group px-5 py-4"
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer items-center justify-between gap-4 list-none">
        <span className="font-medium text-navy">{q}</span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-mute transition-transform ${open ? "rotate-180" : ""}`}
        />
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-ink/75">{a}</p>
    </details>
  );
}
