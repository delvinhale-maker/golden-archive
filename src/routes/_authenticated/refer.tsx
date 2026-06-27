import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Share2, Gift, Mail, Twitter, MessageCircle, Sparkles, Users, CheckCircle2, DollarSign } from "lucide-react";
import { getReferralStats } from "@/lib/referrals.stats.functions";

export const Route = createFileRoute("/_authenticated/refer")({
  component: ReferPage,
  head: () => ({
    meta: [
      { title: "Refer & Earn | AurumVault" },
      { name: "description", content: "Invite friends to AurumVault. They get 10% off their first purchase, you earn 10% store credit when they buy." },
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: "Refer & Earn | AurumVault" },
      { property: "og:description", content: "Share AurumVault, earn store credit." },
      { property: "og:url", content: "https://www.aurumvault.store/refer" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Refer & Earn | AurumVault" },
      { name: "twitter:description", content: "Share AurumVault, earn store credit." },
    ],
    links: [{ rel: "canonical", href: "https://www.aurumvault.store/refer" }],
  }),
});

function ReferPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted || !data.user) return;
      setUid(data.user.id);
      setDisplayName(
        (data.user.user_metadata?.full_name as string | undefined) ??
          (data.user.user_metadata?.name as string | undefined) ??
          data.user.email?.split("@")[0] ??
          "",
      );
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const code = useMemo(() => (uid ? uid.replace(/-/g, "").slice(0, 8).toUpperCase() : "—"), [uid]);
  const link = useMemo(
    () => (uid ? `https://www.aurumvault.store/?ref=${code}` : "https://www.aurumvault.store/"),
    [uid, code],
  );

  const shareText = `Join me on AurumVault — the gold standard for purpose-driven digital products. Use my link for 10% off your first purchase: ${link}`;

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Couldn't copy — long-press to copy manually");
    }
  };

  const nativeShare = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
          title: "AurumVault",
          text: "Purpose-driven digital products. Get 10% off your first order:",
          url: link,
        });
      } catch {
        /* user dismissed */
      }
    } else {
      void copy(link, "Link");
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F0E8] text-[#0F1E35]">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Link to="/account" className="text-[#0F1E35]/70 hover:text-[#0F1E35]">Account</Link>
          <span className="text-[#0F1E35]/40">/</span>
          <span className="font-semibold">Refer &amp; Earn</span>
        </div>

        <header className="relative overflow-hidden rounded-3xl border border-[#B8860B]/30 bg-gradient-to-br from-[#0F1E35] via-[#13294B] to-[#0F1E35] p-6 text-white shadow-xl sm:p-10">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#B8860B]/20 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#B8860B]/40 bg-[#B8860B]/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#F5C76E]">
              <Sparkles className="h-3.5 w-3.5" /> Refer &amp; Earn
            </div>
            <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
              Give 10% off. Earn 10% back.
            </h1>
            <p className="mt-3 max-w-xl text-sm text-white/80 sm:text-base">
              Share your link. Friends get <span className="font-semibold text-[#F5C76E]">10% off</span> their first
              AurumVault purchase, and you earn <span className="font-semibold text-[#F5C76E]">10% store credit</span> on
              every order they complete.
            </p>
          </div>
        </header>

        <section className="mt-6 rounded-3xl border border-[#0F1E35]/10 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold sm:text-xl">Your invite link</h2>
          <p className="mt-1 text-sm text-[#0F1E35]/70">
            {displayName ? `Signed in as ${displayName}.` : null} Share it anywhere — every signup is attributed to you.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="min-w-0 rounded-2xl border border-[#0F1E35]/10 bg-[#F5F0E8] px-4 py-3 font-mono text-sm">
              <div className="truncate">{link}</div>
            </div>
            <button
              type="button"
              onClick={() => void copy(link, "Link")}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#0F1E35] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#13294B]"
            >
              <Copy className="h-4 w-4" /> Copy link
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="min-w-0 rounded-2xl border border-[#B8860B]/40 bg-[#B8860B]/10 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-widest text-[#0F1E35]/60">Referral code</div>
              <div className="mt-0.5 font-mono text-lg font-bold tracking-widest text-[#0F1E35]">{code}</div>
            </div>
            <button
              type="button"
              onClick={() => void copy(code, "Code")}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-[#0F1E35]/20 bg-white px-5 py-3 text-sm font-bold text-[#0F1E35] transition hover:bg-[#F5F0E8]"
            >
              <Copy className="h-4 w-4" /> Copy code
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void nativeShare()}
              className="inline-flex items-center gap-2 rounded-full bg-[#B8860B] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#9c7209]"
            >
              <Share2 className="h-4 w-4" /> Share
            </button>
            <a
              className="inline-flex items-center gap-2 rounded-full border border-[#0F1E35]/15 bg-white px-4 py-2 text-sm font-semibold text-[#0F1E35] hover:bg-[#F5F0E8]"
              href={`mailto:?subject=${encodeURIComponent("AurumVault — 10% off your first order")}&body=${encodeURIComponent(shareText)}`}
            >
              <Mail className="h-4 w-4" /> Email
            </a>
            <a
              className="inline-flex items-center gap-2 rounded-full border border-[#0F1E35]/15 bg-white px-4 py-2 text-sm font-semibold text-[#0F1E35] hover:bg-[#F5F0E8]"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
            >
              <Twitter className="h-4 w-4" /> Post on X
            </a>
            <a
              className="inline-flex items-center gap-2 rounded-full border border-[#0F1E35]/15 bg-white px-4 py-2 text-sm font-semibold text-[#0F1E35] hover:bg-[#F5F0E8]"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { step: "1", title: "Share your link", body: "Send it to friends, post it, or text it — it works anywhere." },
            { step: "2", title: "They save 10%", body: "Your code applies a 10% discount on their first purchase." },
            { step: "3", title: "You earn 10%", body: "Earn store credit on every order they complete. No cap." },
          ].map((s) => (
            <div key={s.step} className="rounded-2xl border border-[#0F1E35]/10 bg-white p-5 shadow-sm">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-[#0F1E35] text-sm font-bold text-[#F5C76E]">
                {s.step}
              </div>
              <h3 className="mt-3 text-base font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-[#0F1E35]/70">{s.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-3xl border border-[#0F1E35]/10 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#B8860B]/10 text-[#B8860B]">
              <Gift className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold sm:text-lg">Program rules</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#0F1E35]/75">
                <li>Discount applies to a friend's first eligible AurumVault order.</li>
                <li>Store credit posts to your account after the referred order clears Stripe.</li>
                <li>Self-referrals, refunded orders, and fraudulent activity are not eligible.</li>
                <li>AurumVault may adjust or end the program with notice.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
