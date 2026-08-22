import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { ShieldCheck, Sparkles, HeartHandshake, Crown } from "lucide-react";

const SITE_URL = "https://www.aurumvault.store";
const ABOUT_URL = `${SITE_URL}/about`;
const ABOUT_TITLE = "About AurumVault | Digital Marketplace for Creators";
const ABOUT_DESC =
  "AurumVault is a premium digital-product marketplace at AurumVault.store where creators, entrepreneurs and businesses buy and sell eBooks, planners, journals, templates, AI prompt packs and business systems. Creators keep 85%.";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: ABOUT_TITLE },
      { name: "description", content: ABOUT_DESC },
      { property: "og:title", content: ABOUT_TITLE },
      { property: "og:description", content: ABOUT_DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: ABOUT_URL },
      { name: "twitter:title", content: ABOUT_TITLE },
      { name: "twitter:description", content: ABOUT_DESC },
    ],
    links: [{ rel: "canonical", href: ABOUT_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          "@id": `${ABOUT_URL}#webpage`,
          url: ABOUT_URL,
          name: ABOUT_TITLE,
          description: ABOUT_DESC,
          isPartOf: { "@id": `${SITE_URL}/#website` },
          about: { "@id": `${SITE_URL}/#organization` },
        }),
      },
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
          About AurumVault — the gold standard for digital products.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-ink/80">
          AurumVault is a digital-product marketplace at{" "}
          <strong className="font-semibold text-navy">AurumVault.store</strong>{" "}
          that connects creators, entrepreneurs and businesses with premium
          digital resources — and gives eligible creators a platform for selling
          their own digital products. Some people search for us as “Aurum Vault”;
          it's the same marketplace.
        </p>
        <p className="mt-4 leading-relaxed text-ink/80">
          You'll find eBooks, interactive planners, journals, templates, AI
          prompt packs, media kits, marketing resources and complete{" "}
          <Link
            to="/business-systems"
            className="font-medium text-navy underline underline-offset-4 hover:text-gold-ink"
          >
            business operating systems
          </Link>{" "}
          across the{" "}
          <Link
            to="/products"
            className="font-medium text-navy underline underline-offset-4 hover:text-gold-ink"
          >
            digital product marketplace
          </Link>
          , plus{" "}
          <Link
            to="/creator-business-tools"
            className="font-medium text-navy underline underline-offset-4 hover:text-gold-ink"
          >
            creator business resources
          </Link>{" "}
          and free education in the{" "}
          <Link
            to="/academy"
            className="font-medium text-navy underline underline-offset-4 hover:text-gold-ink"
          >
            AurumVault Academy
          </Link>
          . Everything is delivered instantly as a download.
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
            <a href="mailto:support@aurumvault.tech" className="font-medium text-navy underline underline-offset-4 hover:text-gold-ink">
              support@aurumvault.tech
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
