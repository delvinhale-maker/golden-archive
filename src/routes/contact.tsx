import { createFileRoute } from "@tanstack/react-router";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { Mail, LifeBuoy, Store } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact AurumVault — Support & Creator Inquiries" },
      {
        name: "description",
        content:
          "Get in touch with AurumVault for support, creator inquiries, or partnership opportunities. We typically reply within 24 hours.",
      },
      { property: "og:title", content: "Contact AurumVault" },
      {
        property: "og:description",
        content:
          "Support, creator inquiries, and partnerships. Replies within 24 hours.",
      },
      { property: "og:type", content: "website" },
      { rel: "canonical", href: "https://www.aurumvault.store/contact" } as never,
    ],
  }),
  component: ContactPage,
});

const CHANNELS = [
  {
    icon: LifeBuoy,
    title: "Customer support",
    body: "Order issues, downloads, refunds.",
    email: "support@aurumvault.store",
  },
  {
    icon: Store,
    title: "Creator inquiries",
    body: "Apply to sell, royalties, payouts.",
    email: "creators@aurumvault.store",
  },
  {
    icon: Mail,
    title: "Press & partnerships",
    body: "Media, collaborations, brand deals.",
    email: "hello@aurumvault.store",
  },
];

function ContactPage() {
  return (
    <MarketShell>
      <main className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-caps text-gold">
          Contact
        </p>
        <h1 className="mt-2 font-display text-4xl text-navy md:text-5xl">
          We're here to help.
        </h1>
        <p className="mt-4 max-w-xl text-ink/70">
          Pick the right inbox below and we'll respond within 24 hours, Monday
          through Friday.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {CHANNELS.map(({ icon: Icon, title, body, email }) => (
            <a
              key={email}
              href={`mailto:${email}`}
              className="group rounded-2xl border border-ink/10 bg-white p-5 transition hover:border-gold/40 hover:shadow-sm"
            >
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-navy text-gold">
                <Icon size={16} />
              </div>
              <div className="mt-3 font-display text-lg text-navy">{title}</div>
              <p className="mt-1 text-sm text-mute">{body}</p>
              <div className="mt-3 text-sm font-medium text-navy group-hover:text-gold">
                {email}
              </div>
            </a>
          ))}
        </div>

        <div className="mt-10 rounded-2xl bg-navy p-6 text-white md:p-8">
          <p className="font-display text-xl">Mailing address</p>
          <p className="mt-2 text-sm text-white/70">
            AurumVault, c/o Illustrious Capital™
            <br />
            All correspondence: support@aurumvault.store
          </p>
        </div>
      </main>
    </MarketShell>
  );
}
