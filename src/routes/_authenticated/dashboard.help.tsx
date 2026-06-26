import { createFileRoute, Link } from "@tanstack/react-router";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { LifeBuoy, Mail, BookOpen, DollarSign } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/help")({
  component: HelpPage,
});

const FAQ = [
  {
    q: "How do I publish a title?",
    a: "Click Publish in the top nav, then walk through the 4 steps: Book Details → Content & Rights → Pricing & Royalties → Review & Publish.",
  },
  {
    q: "What file formats are accepted?",
    a: "Manuscript: PDF, EPUB, or DOCX. Cover: JPG or PNG at minimum 1600×2560px (1:1.6 portrait).",
  },
  {
    q: "How much does AurumVault take?",
    a: "AurumVault keeps a 9% platform fee. You keep 91% of every sale.",
  },
  {
    q: "When do I get paid?",
    a: "Royalty tracking is live. Stripe Connect payouts arrive in Stage 2 — your unpaid balance accrues until then.",
  },
  {
    q: "Can I unpublish a title?",
    a: "Yes. From your Bookshelf, click Unpublish next to any live title. It comes off the storefront immediately and reverts to Draft.",
  },
];

function HelpPage() {
  return (
    <PublisherShell accent={ACCENTS.help}>
      <h1 className="font-display text-3xl md:text-4xl text-navy">Help</h1>
      <p className="mt-1 text-mute">Answers, guidance, and direct support.</p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <HelpCard
          icon={<BookOpen size={18} />}
          title="Publishing guide"
          body="Learn the 4-step KDP-style flow: details, rights, pricing, review."
        />
        <HelpCard
          icon={<DollarSign size={18} />}
          title="Royalties"
          body="You earn 70–91% per sale depending on tier. Track it in Earn."
        />
        <HelpCard
          icon={<Mail size={18} />}
          title="Contact support"
          body="Email support@aurumvault.store — we typically reply within 24 hours."
        />
      </div>

      <section className="mt-10 rounded-2xl bg-white border border-ink/10 p-6 md:p-8">
        <div className="flex items-center gap-2">
          <LifeBuoy size={18} style={{ color: "var(--page-accent)" }} />
          <h2 className="font-display text-xl text-navy">Frequently asked questions</h2>
        </div>
        <dl className="mt-6 divide-y divide-ink/10">
          {FAQ.map((item) => (
            <div key={item.q} className="py-4 first:pt-0 last:pb-0">
              <dt className="font-semibold text-navy">{item.q}</dt>
              <dd className="mt-1 text-sm text-mute">{item.a}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 rounded-xl p-5 text-white" style={{ background: "var(--page-accent)" }}>
          <p className="font-display text-lg">Still stuck?</p>
          <p className="text-sm text-white/80 mt-1">Email us and we'll route it to the right person.</p>
          <Link
            to="."
            onClick={(e) => {
              e.preventDefault();
              window.location.href = "mailto:support@aurumvault.store";
            }}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-white text-navy font-semibold px-4 py-2 text-sm"
          >
            <Mail size={14} /> support@aurumvault.store
          </Link>
        </div>
      </section>
    </PublisherShell>
  );
}

function HelpCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-white border border-ink/10 p-5">
      <div
        className="inline-flex items-center justify-center h-9 w-9 rounded-full text-white"
        style={{ background: "var(--page-accent)" }}
      >
        {icon}
      </div>
      <div className="mt-3 font-display text-lg text-navy">{title}</div>
      <p className="mt-1 text-sm text-mute">{body}</p>
    </div>
  );
}
