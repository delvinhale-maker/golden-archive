import { useState } from "react";
import { toast } from "sonner";

export function EmailCaptureBanner() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/public/subscribers/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clean, source: "homepage_banner" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error || "Couldn't subscribe right now. Try again in a moment.");
        return;
      }
      if (body.status === "already_confirmed") {
        toast.success("You're already subscribed — thanks!");
      } else if (body.status === "suppressed") {
        toast.error("This address was previously unsubscribed and can't be re-added here.");
        return;
      } else {
        toast.success("Check your inbox to confirm your subscription.");
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }


  return (
    <section className="bg-gradient-to-br from-[#0a1f44] via-[#0f2756] to-[#0a1f44] py-14">
      <div className="mx-auto max-w-3xl px-6 text-center text-white">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Get Kingdom Resources Delivered Free
        </h2>
        <p className="mt-3 text-white/70">
          Join the Vault for early drops, free guides, and Kingdom-curated picks.
        </p>
        {done ? (
          <p
            className="mt-6 inline-block rounded-full px-5 py-3"
            style={{
              backgroundColor: "color-mix(in srgb, var(--accent-color) 15%, transparent)",
              color: "var(--accent-color)",
            }}
          >
            Almost there — check your inbox and click the confirm link to activate your subscription.
          </p>
        ) : (
          <form
            onSubmit={onSubmit}
            className="mx-auto mt-6 flex w-full max-w-md flex-col gap-3 sm:flex-row"
          >
            <label htmlFor="vault-email" className="sr-only">
              Email address
            </label>
            <input
              id="vault-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-white placeholder-white/50 outline-none"
              style={{ ["--tw-ring-color" as never]: "var(--accent-color)" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-color)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "")}
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-full px-6 py-3 font-semibold text-[#0a1f44] shadow-lg transition hover:brightness-105 disabled:opacity-60"
              style={{ backgroundColor: "var(--accent-color)" }}
            >
              {busy ? "Joining…" : "Join the Vault"}
            </button>
          </form>
        )}

      </div>
    </section>
  );
}
