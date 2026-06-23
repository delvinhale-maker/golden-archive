import { createFileRoute } from "@tanstack/react-router";
import heroImg from "@/assets/vault-hero.jpg";
import barImg from "@/assets/vault-bar.jpg";

export const Route = createFileRoute("/vault")({
  head: () => ({
    meta: [
      { title: "Aurum Vault — Allocated Gold Custody for Private Wealth" },
      {
        name: "description",
        content:
          "Aurum Vault is a private custodian of allocated physical gold. Sovereign-grade storage, fully insured, redeemable on demand.",
      },
      { property: "og:title", content: "Aurum Vault" },
      {
        property: "og:description",
        content:
          "Allocated physical gold, vaulted in jurisdictionally-secure facilities. By invitation.",
      },
    ],
  }),
  component: Index,
});

const stats = [
  { label: "Assets under custody", value: "$4.2B" },
  { label: "Allocated, never lent", value: "100%" },
  { label: "Insurance coverage", value: "Lloyd's" },
  { label: "Vault jurisdictions", value: "6" },
];

const pillars = [
  {
    n: "01",
    title: "Allocated, in your name",
    body: "Every bar is serialised, assayed, and registered to you alone. We do not lease, hypothecate, or pool client metal.",
  },
  {
    n: "02",
    title: "Sovereign-grade vaults",
    body: "Class-III facilities in Zürich, Singapore, and Toronto. Continuous attestation by Bureau Veritas and Inspectorate.",
  },
  {
    n: "03",
    title: "Redeem in 72 hours",
    body: "Withdraw as bullion, settle in fiat, or transfer between vaults. No queues, no gates, no surprises.",
  },
];

const vaults = [
  { city: "Zürich", country: "Switzerland", code: "CH-01" },
  { city: "Singapore", country: "Singapore", code: "SG-04" },
  { city: "Toronto", country: "Canada", code: "CA-02" },
  { city: "Dubai", country: "UAE", code: "AE-03" },
];

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground vault-grain">
      {/* Nav */}
      <header className="absolute top-0 left-0 right-0 z-30">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-12">
          <a href="/" className="flex items-center gap-2">
            <span className="font-serif text-2xl text-gold-soft">A</span>
            <span className="tracking-luxe text-[11px] text-gold-soft">
              AURUM VAULT
            </span>
          </a>
          <div className="hidden items-center gap-10 text-xs tracking-luxe text-muted-foreground md:flex">
            <a href="#custody" className="hover:text-gold-soft transition">CUSTODY</a>
            <a href="#vaults" className="hover:text-gold-soft transition">VAULTS</a>
            <a href="#assurance" className="hover:text-gold-soft transition">ASSURANCE</a>
            <a href="#contact" className="hover:text-gold-soft transition">CONTACT</a>
          </div>
          <a
            href="#contact"
            className="gold-border rounded-sm px-4 py-2 text-[11px] tracking-luxe text-gold-soft hover:bg-gold/10 transition"
          >
            CLIENT LOGIN
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative isolate min-h-screen overflow-hidden">
        <img
          src={heroImg}
          alt=""
          width={1536}
          height={1024}
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/30 to-transparent" />

        <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-6 pt-32 pb-24 lg:px-12">
          <div className="max-w-2xl">
            <div className="mb-8 flex items-center gap-4">
              <span className="h-px w-12 bg-gold" />
              <span className="font-mono text-[10px] tracking-luxe text-gold">
                EST. MMVII · BY INVITATION
              </span>
            </div>

            <h1 className="font-serif text-5xl leading-[1.05] text-foreground sm:text-6xl md:text-7xl lg:text-8xl">
              The quiet weight of <span className="gold-gradient italic">certainty</span>.
            </h1>

            <p className="mt-8 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
              Aurum Vault is a private custodian of allocated physical gold for
              families, foundations, and institutions who measure wealth in
              generations — not quarters.
            </p>

            <div className="mt-12 flex flex-wrap items-center gap-4">
              <a
                href="#contact"
                className="group relative overflow-hidden rounded-sm bg-gold px-7 py-3.5 text-[11px] tracking-luxe text-primary-foreground"
              >
                <span className="relative z-10">REQUEST INTRODUCTION</span>
                <span className="shine absolute inset-0" />
              </a>
              <a
                href="#custody"
                className="px-2 py-3.5 text-[11px] tracking-luxe text-gold-soft hover:text-gold transition"
              >
                READ THE CUSTODY MODEL →
              </a>
            </div>
          </div>

          {/* Spot price ticker */}
          <div className="mt-24 grid max-w-3xl grid-cols-2 gap-px gold-border bg-gold/10 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-background/80 px-5 py-5 backdrop-blur">
                <div className="font-serif text-2xl text-gold-soft">{s.value}</div>
                <div className="mt-1 text-[10px] tracking-luxe text-muted-foreground">
                  {s.label.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-luxe text-muted-foreground">
          XAU/USD · 2,418.40 ▲ 0.62%
        </div>
      </section>

      {/* Custody */}
      <section id="custody" className="relative py-32 lg:py-40">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="mb-20 max-w-3xl">
            <span className="font-mono text-[10px] tracking-luxe text-gold">
              — THE CUSTODY MODEL
            </span>
            <h2 className="mt-6 font-serif text-4xl leading-tight md:text-5xl lg:text-6xl">
              Title is yours. Always.
              <span className="block text-muted-foreground italic">
                The bar is yours. Always.
              </span>
            </h2>
          </div>

          <div className="grid gap-px gold-border bg-gold/10 md:grid-cols-3">
            {pillars.map((p) => (
              <div
                key={p.n}
                className="group relative bg-background p-10 transition hover:bg-card"
              >
                <div className="font-mono text-[10px] tracking-luxe text-gold">
                  {p.n}
                </div>
                <h3 className="mt-6 font-serif text-2xl text-foreground">
                  {p.title}
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {p.body}
                </p>
                <div className="mt-10 h-px w-8 bg-gold transition-all group-hover:w-20" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bar showcase */}
      <section id="assurance" className="relative overflow-hidden bg-onyx py-32 lg:py-40">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-2 lg:gap-24 lg:px-12">
          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-tr from-gold/20 via-transparent to-transparent blur-3xl" />
            <div className="relative overflow-hidden rounded-sm gold-border float-slow">
              <img
                src={barImg}
                alt="Aurum Vault 1kg fine gold bar"
                width={1024}
                height={1536}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <div>
            <span className="font-mono text-[10px] tracking-luxe text-gold">
              — ASSURANCE & PROVENANCE
            </span>
            <h2 className="mt-6 font-serif text-4xl leading-tight md:text-5xl">
              Every bar tells you exactly where it has been.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-muted-foreground">
              LBMA Good Delivery refiners. Chain-of-custody recorded on a
              tamper-evident ledger. Quarterly third-party attestation by
              Bureau Veritas. You can audit your holdings — bar by bar,
              serial by serial — in any browser, at any hour.
            </p>

            <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6">
              {[
                ["Purity", "999.9 fine"],
                ["Standard", "LBMA Good Delivery"],
                ["Audit cadence", "Quarterly"],
                ["Settlement", "T+0"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] tracking-luxe text-muted-foreground">
                    {k.toUpperCase()}
                  </dt>
                  <dd className="mt-2 font-serif text-xl text-gold-soft">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Vaults */}
      <section id="vaults" className="py-32 lg:py-40">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="mb-16 flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-2xl">
              <span className="font-mono text-[10px] tracking-luxe text-gold">
                — THE NETWORK
              </span>
              <h2 className="mt-6 font-serif text-4xl leading-tight md:text-5xl">
                Six jurisdictions. One standard.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Diversify by geography, not just by asset. Move metal between
              vaults at cost, on the same business day.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-px gold-border bg-gold/10 md:grid-cols-4">
            {vaults.map((v) => (
              <div
                key={v.code}
                className="group flex flex-col justify-between bg-background p-8 transition hover:bg-card min-h-[220px]"
              >
                <div className="font-mono text-[10px] tracking-luxe text-gold">
                  VAULT {v.code}
                </div>
                <div>
                  <div className="font-serif text-3xl text-foreground">
                    {v.city}
                  </div>
                  <div className="mt-1 text-xs tracking-luxe text-muted-foreground">
                    {v.country.toUpperCase()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="relative py-32 lg:py-40">
        <div className="mx-auto max-w-4xl px-6 text-center lg:px-12">
          <div className="mx-auto mb-10 h-px w-32 gold-rule" />
          <span className="font-mono text-[10px] tracking-luxe text-gold">
            — BY INVITATION
          </span>
          <h2 className="mt-6 font-serif text-4xl leading-tight md:text-6xl">
            A custodian for the
            <span className="gold-gradient italic"> next hundred years</span>.
          </h2>
          <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-muted-foreground">
            New relationships begin with a private conversation. Our principal
            office responds within one business day.
          </p>

          <form
            onSubmit={(e) => e.preventDefault()}
            className="mx-auto mt-12 flex max-w-md flex-col gap-3 sm:flex-row"
          >
            <input
              type="email"
              placeholder="your@private.email"
              className="flex-1 rounded-sm gold-border bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold"
            />
            <button
              type="submit"
              className="relative overflow-hidden rounded-sm bg-gold px-6 py-3 text-[11px] tracking-luxe text-primary-foreground"
            >
              <span className="relative z-10">REQUEST INTRODUCTION</span>
              <span className="shine absolute inset-0" />
            </button>
          </form>

          <p className="mt-6 font-mono text-[10px] tracking-luxe text-muted-foreground">
            ENCRYPTED · NEVER SHARED · DELETED ON REQUEST
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-[10px] tracking-luxe text-muted-foreground md:flex-row lg:px-12">
          <div>© {new Date().getFullYear()} AURUM VAULT SA · ZÜRICH</div>
          <div className="flex gap-8">
            <a href="#" className="hover:text-gold-soft">TERMS</a>
            <a href="#" className="hover:text-gold-soft">PRIVACY</a>
            <a href="#" className="hover:text-gold-soft">DISCLOSURES</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
