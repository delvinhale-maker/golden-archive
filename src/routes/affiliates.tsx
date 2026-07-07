import { createFileRoute, Link } from "@tanstack/react-router";
import { DollarSign, Link2, TrendingUp } from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";

export const Route = createFileRoute("/affiliates")({
  head: () => ({
    meta: [
      { title: "AurumVault Affiliate Program" },
      {
        name: "description",
        content:
          "Refer buyers to AurumVault and earn commission on every sale — platform-wide affiliate program.",
      },
      { property: "og:title", content: "AurumVault Affiliate Program" },
      {
        property: "og:description",
        content:
          "Refer buyers to AurumVault and earn commission on every sale.",
      },
    ],
  }),
  component: AffiliatesPage,
});

function AffiliatesPage() {
  return (
    <MarketShell>
      <section className="av-hero-bg border-b border-white/10">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center lg:px-8">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-caps text-gold-ink">
            <DollarSign size={14} /> PLATFORM AFFILIATE PROGRAM
          </div>
          <h1 className="mt-3 font-display text-4xl font-bold text-white md:text-5xl">
            Refer. Earn. <span className="gold-gradient">Repeat.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-white/70">
            Share AurumVault with your audience. Every buyer you send earns you commission on their first purchase — and beyond.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/dashboard/affiliate"
              className="inline-flex h-12 items-center rounded-full bg-gold px-7 text-sm font-bold text-navy"
            >
              Join the program →
            </Link>
            <Link
              to="/affiliate-disclosure"
              className="inline-flex h-12 items-center rounded-full border border-white/70 px-7 text-sm font-bold text-white"
            >
              Read the disclosure
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-bg-page py-16">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Link2,
                title: "Get your link",
                body: "Grab a personal referral link from your dashboard in seconds.",
              },
              {
                icon: TrendingUp,
                title: "Share the vault",
                body: "Post it anywhere — social, newsletter, YouTube, blog.",
              },
              {
                icon: DollarSign,
                title: "Earn every sale",
                body: "Commission tracks automatically — paid out monthly.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-white/10 bg-white/5 p-6"
              >
                <f.icon size={20} className="text-gold-ink" />
                <div className="mt-3 font-display text-lg font-bold text-white">
                  {f.title}
                </div>
                <p className="mt-1 text-sm text-white/70">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketShell>
  );
}
