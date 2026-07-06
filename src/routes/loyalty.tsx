import { createFileRoute, Link } from "@tanstack/react-router";
import { Coins, ShieldCheck, Star } from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";

export const Route = createFileRoute("/loyalty")({
  head: () => ({
    meta: [
      { title: "Vault Points — AurumVault Loyalty" },
      {
        name: "description",
        content:
          "Earn Vault Points on every purchase and redeem for premium digital resources on AurumVault.",
      },
      { property: "og:title", content: "Vault Points — AurumVault Loyalty" },
      {
        property: "og:description",
        content:
          "Earn Vault Points on every purchase and redeem for premium resources.",
      },
    ],
  }),
  component: LoyaltyPage,
});

function LoyaltyPage() {
  return (
    <MarketShell>
      <section className="av-hero-bg border-b border-white/10">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center lg:px-8">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-caps text-gold">
            <Coins size={14} /> LOYALTY PROGRAM · COMING SOON
          </div>
          <h1 className="mt-3 font-display text-4xl font-bold text-white md:text-5xl">
            <span className="gold-gradient">Vault Points</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-white/70">
            Earn points on every purchase, review, and referral. Redeem for eBooks, courses, and templates across the AurumVault marketplace.
          </p>
        </div>
      </section>

      <section className="bg-bg-page py-16">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Coins,
                title: "Earn 1 point per $1",
                body: "Every dollar you spend at the vault stacks — automatically.",
              },
              {
                icon: Star,
                title: "Bonus for reviews",
                body: "Leave a verified review, earn bonus points on top of your purchase.",
              },
              {
                icon: ShieldCheck,
                title: "Redeem site-wide",
                body: "Apply points to any product from any creator. No expiry.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-white/10 bg-white/5 p-6"
              >
                <f.icon size={20} className="text-gold" />
                <div className="mt-3 font-display text-lg font-bold text-white">
                  {f.title}
                </div>
                <p className="mt-1 text-sm text-white/70">{f.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              to="/products"
              className="inline-flex h-12 items-center rounded-full bg-gold px-7 text-sm font-bold text-navy"
            >
              Start earning →
            </Link>
          </div>
        </div>
      </section>
    </MarketShell>
  );
}
