import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { ShieldCheck, Sparkles, HeartHandshake, Crown } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About AurumVault — The Gold Standard Digital Marketplace" },
      {
        name: "description",
        content:
          "AurumVault is a curated marketplace for purpose-driven digital products — ebooks, journals, AI prompt packs, and planners — from independent, Kingdom-minded creators. Learn our mission, story, and how we pay creators 85%.",
      },
      { property: "og:title", content: "About AurumVault" },
      {
        property: "og:description",
        content:
          "A curated marketplace for purpose-driven digital products. Creators keep 85%. Every title reviewed for quality before it goes live.",
      },
      { property: "og:type", content: "website" },
      { rel: "canonical", href: "https://www.aurumvault.store/about" } as never,
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <MarketShell>
      <main className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-caps text-gold-ink">
          About
        </p>
        <h1 className="mt-2 font-display text-4xl text-navy md:text-5xl">
          The gold standard for digital products.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-ink/80">
          AurumVault is a curated digital marketplace for ebooks, journals, AI
          prompt packs, and planners built by independent creators who treat
          their craft as a calling. We exist to make it easy to find work
          that's actually worth your time — and to make it possible for the
          people who make that work to earn a real living from it.
        </p>

        <section className="mt-12">
          <h2 className="font-display text-2xl text-navy">Our mission</h2>
          <p className="mt-3 leading-relaxed text-ink/80">
            To be the most trusted home on the internet for purpose-driven
            digital products — where every title is reviewed for quality,
            every creator is paid fairly, and every buyer knows exactly what
            they're getting before they click purchase.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl text-navy">Our story</h2>
          <div className="mt-3 space-y-4 leading-relaxed text-ink/80">
            <p>
              AurumVault was founded by creators who were tired of watching
              great work get buried on marketplaces that took huge cuts,
              buried independent voices under paid promotions, and treated
              digital products like disposable inventory. We wanted a place
              where a well-made journal or a thoughtful ebook could stand on
              its own merit.
            </p>
            <p>
              So we built one. Every product on AurumVault is reviewed before
              it hits the storefront. Creators keep 85% of every sale — no
              hidden fees, no pay-to-play placement. And buyers get instant
              downloads, clear previews, and real support from a small team
              that actually reads the emails.
            </p>
          </div>
        </section>

        <section className="mt-12 grid gap-4 md:grid-cols-2">
          <Value
            icon={<ShieldCheck size={18} />}
            title="Quality first"
            body="Every title is reviewed for craft, clarity, and originality before it goes live. No AI-slop, no rehashed content."
          />
          <Value
            icon={<Sparkles size={18} />}
            title="Purpose-driven"
            body="We favor work that helps people build something — a business, a spiritual practice, a healthier mind, a better plan."
          />
          <Value
            icon={<HeartHandshake size={18} />}
            title="Creators keep 85%"
            body="You make it, you keep the lion's share. We take 15% to run the platform, fight fraud, and grow the audience."
          />
          <Value
            icon={<Crown size={18} />}
            title="Kingdom-minded"
            body="We're rooted in faith-driven excellence, but everyone is welcome here — as a creator and as a buyer."
          />
        </section>

        <section className="mt-12 grid grid-cols-2 md:grid-cols-3 gap-4">
          <Stat label="Creator royalty" value="85%" />
          <Stat label="Reviewed titles" value="100%" />
          <Stat label="Support reply" value="< 24h" />
        </section>

        <section className="mt-12 rounded-2xl bg-navy p-6 text-white md:p-8">
          <p className="font-display text-2xl">Sell on AurumVault</p>
          <p className="mt-2 max-w-lg text-sm text-white/75">
            If you make ebooks, journals, prompt packs, or planners worth
            recommending, we'd love to see them. Apply to become a creator
            and keep 85% of every sale.
          </p>
          <Link
            to="/become-a-creator"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-navy hover:bg-gold/90"
          >
            Become a creator
          </Link>
        </section>

        <section className="mt-10 rounded-2xl border border-ink/10 bg-white p-6 md:p-8">
          <p className="font-display text-xl text-navy">Get in touch</p>
          <p className="mt-2 text-sm text-ink/70">
            Questions, feedback, or press inquiries? Visit our{" "}
            <Link to="/contact" className="font-medium text-navy underline underline-offset-4 hover:text-gold-ink">
              contact page
            </Link>{" "}
            or email{" "}
            <a href="mailto:support@aurumvault.store" className="font-medium text-navy underline underline-offset-4 hover:text-gold-ink">
              support@aurumvault.store
            </a>
            . We reply within 24 hours, Monday through Friday.
          </p>
        </section>
      </main>
    </MarketShell>
  );
}

function Value({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-navy text-gold">
        {icon}
      </div>
      <div className="mt-3 font-display text-lg text-navy">{title}</div>
      <p className="mt-1 text-sm leading-relaxed text-ink/70">{body}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <div className="font-display text-3xl text-navy">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-caps text-mute">
        {label}
      </div>
    </div>
  );
}
