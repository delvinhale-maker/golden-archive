import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
    const { error } = await supabase
      .from("subscribers")
      .insert({ email: clean, source: "homepage_banner" });
    setBusy(false);
    if (error && !/duplicate|unique/i.test(error.message)) {
      toast.error("Couldn't subscribe right now. Try again in a moment.");
      return;
    }
    setDone(true);
    toast.success("You're in! Check your inbox for a welcome gift.");
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
          <p className="mt-6 inline-block rounded-full bg-[#d4af37]/15 px-5 py-3 text-[#f4d56b]">
            You're in! Check your inbox for a welcome gift.
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
              className="flex-1 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-white placeholder-white/50 outline-none focus:border-[#d4af37]"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-gradient-to-b from-[#f4d56b] to-[#d4af37] px-6 py-3 font-semibold text-[#0a1f44] shadow-lg transition hover:brightness-105 disabled:opacity-60"
            >
              {busy ? "Joining…" : "Join the Vault"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
