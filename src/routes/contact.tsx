import { createFileRoute } from "@tanstack/react-router";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { Mail, LifeBuoy, Store, Loader2, CheckCircle2 } from "lucide-react";
import { useState } from "react";

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

type Status = "idle" | "submitting" | "success" | "error";

function ContactPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    topic: "support",
    message: "",
    company: "", // honeypot
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("submitting");
    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      setStatus("success");
      setForm({ name: "", email: "", topic: "support", message: "", company: "" });
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <MarketShell>
      <main className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-caps text-gold-ink">
          Contact
        </p>
        <h1 className="mt-2 font-display text-4xl text-navy md:text-5xl">
          We're here to help.
        </h1>
        <p className="mt-4 max-w-xl text-ink/70">
          Send us a message below or pick the right inbox. We respond within 24 hours, Monday through Friday.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-10 rounded-2xl border border-ink/10 bg-white p-6 md:p-8"
          noValidate
        >
          {status === "success" ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-gold-ink" />
              <h2 className="font-display text-2xl text-navy">Message sent.</h2>
              <p className="max-w-md text-sm text-ink/70">
                Thanks for reaching out — we received your message and will reply within 24 hours.
              </p>
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="mt-2 text-sm font-medium text-navy underline underline-offset-4 hover:text-gold-ink"
              >
                Send another message
              </button>
            </div>
          ) : (
            <>
              {/* Honeypot field — hidden from humans */}
              <div className="hidden" aria-hidden="true">
                <label>
                  Company
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-caps text-navy">Name</span>
                  <input
                    required
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    maxLength={120}
                    className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                    placeholder="Your name"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-caps text-navy">Email</span>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    maxLength={255}
                    className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                    placeholder="you@example.com"
                  />
                </label>
              </div>

              <label className="mt-4 block">
                <span className="text-xs font-semibold uppercase tracking-caps text-navy">Topic</span>
                <select
                  value={form.topic}
                  onChange={(e) => setForm({ ...form, topic: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                >
                  <option value="support">Customer support</option>
                  <option value="creator">Creator inquiry</option>
                  <option value="press">Press & partnerships</option>
                  <option value="other">Something else</option>
                </select>
              </label>

              <label className="mt-4 block">
                <span className="text-xs font-semibold uppercase tracking-caps text-navy">Message</span>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  maxLength={4000}
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                  placeholder="How can we help?"
                />
                <span className="mt-1 block text-[11px] text-mute">
                  {form.message.length}/4000
                </span>
              </label>

              {error && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition hover:bg-navy/90 disabled:opacity-60"
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  "Send message"
                )}
              </button>
            </>
          )}
        </form>

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
              <div className="mt-3 text-sm font-medium text-navy group-hover:text-gold-ink">
                {email}
              </div>
            </a>
          ))}
        </div>

        <div className="mt-10 rounded-2xl bg-navy p-6 text-white md:p-8">
          <p className="font-display text-xl">Mailing address</p>
          <p className="mt-2 text-sm text-white/70">
            AurumVault
            <br />
            All correspondence: support@aurumvault.store
          </p>
        </div>
      </main>
    </MarketShell>
  );
}

