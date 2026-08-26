import { useState } from "react";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(120),
  email: z.string().trim().email("Please enter a valid email.").max(255),
  topic: z.enum(["support", "creator", "press", "other"]),
  message: z
    .string()
    .trim()
    .min(10, "Please include a longer message (10+ characters).")
    .max(4000),
  consent: z.literal(true, {
    message: "Please agree to the privacy notice before sending your message.",
  }),
});


const TOPICS: { value: string; label: string }[] = [
  { value: "support", label: "Support" },
  { value: "creator", label: "Creators" },
  { value: "press", label: "Partnerships & Press" },
  { value: "other", label: "Something else" },
];

export function ContactForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    topic: "support",
    message: "",
    company: "",
  });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ ...form, consent });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed.data, company: form.company }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Could not send your message.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your message.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto text-gold-ink" size={28} />
        <h3 className="mt-3 font-display text-xl font-bold text-navy">Message sent</h3>
        <p className="mt-2 text-sm text-mute">
          Thanks — our team has your message and will reply to the address you provided.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto max-w-2xl rounded-2xl border border-line bg-white p-6 shadow-sm md:p-8"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold tracking-caps text-navy">YOUR NAME</span>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={120}
            autoComplete="name"
            className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm focus:border-gold focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold tracking-caps text-navy">YOUR EMAIL</span>
          <input
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            maxLength={255}
            inputMode="email"
            autoComplete="email"
            className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm focus:border-gold focus:outline-none"
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-semibold tracking-caps text-navy">TOPIC</span>
        <select
          value={form.topic}
          onChange={(e) => set("topic", e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm focus:border-gold focus:outline-none"
        >
          {TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 block">
        <span className="text-xs font-semibold tracking-caps text-navy">MESSAGE</span>
        <textarea
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
          rows={5}
          maxLength={4000}
          className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm focus:border-gold focus:outline-none"
        />
      </label>

      {/* honeypot */}
      <input
        value={form.company}
        onChange={(e) => set("company", e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <label className="mt-5 flex items-start gap-3">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink/30 accent-navy"
          aria-describedby="contact-privacy-notice"
        />
        <span id="contact-privacy-notice" className="text-xs leading-relaxed text-mute">
          I consent to AurumVault storing the name, email address, and message I submit
          here so the team can respond to my inquiry. We never sell your data, and you can
          ask us to delete it at any time. See our{" "}
          <Link to="/privacy" className="font-medium text-navy underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </span>
      </label>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={busy || !consent}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition hover:bg-navy/90 disabled:opacity-60"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        {busy ? "Sending…" : "Send message"}
      </button>

      <p className="mt-3 text-center text-xs text-mute">
        We typically reply within 1–2 business days.
      </p>
    </form>
  );
}
