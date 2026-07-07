import { createFileRoute } from "@tanstack/react-router";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { Mail, MessageSquare, BookOpen } from "lucide-react";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — AurumVault Help Center" },
      {
        name: "description",
        content:
          "Get help with orders, downloads, publishing, and seller questions on AurumVault.",
      },
      { property: "og:title", content: "AurumVault Support" },
      {
        property: "og:description",
        content:
          "Help center for buyers, sellers, and creators on AurumVault.",
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
    body: "After purchase, your digital files are available instantly in Account → My Downloads. If a download fails, try the link again or contact support.",
  },
  {
    icon: MessageSquare,
    title: "Publishing & Royalties",
    body: "Sellers keep 70% of every sale. Upload your ebook, cover, and manuscript in the publisher dashboard. Payouts are processed on the schedule shown in your dashboard.",
  },
  {
    icon: Mail,
    title: "Contact Support",
    body: "Reach us at support@aurumvault.store for order issues, creators@aurumvault.store for seller questions, or hello@aurumvault.store for partnerships.",
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
          Find answers to common questions about buying, downloading, and
          selling on AurumVault.
        </p>

        <div className="mt-10 space-y-4">
          {TOPICS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-ink/10 bg-white p-5 md:p-6"
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

        <div className="mt-10 rounded-2xl bg-navy p-6 text-white md:p-8">
          <p className="font-display text-xl">Still need help?</p>
          <p className="mt-2 text-sm text-white/70">
            Email{" "}
            <a
              href="mailto:support@aurumvault.store"
              className="text-gold-ink hover:underline"
            >
              support@aurumvault.store
            </a>{" "}
            and we’ll reply within 24 hours, Monday through Friday.
          </p>
        </div>
      </main>
    </MarketShell>
  );
}
