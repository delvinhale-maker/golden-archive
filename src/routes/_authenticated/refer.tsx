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

        <header
          className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-[#0F1E35] via-[#13294B] to-[#0F1E35] p-6 text-white shadow-xl sm:p-10"
          style={{ borderColor: "color-mix(in srgb, var(--accent-color) 30%, transparent)" }}
        >
          <div
            className="absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl"
            style={{ backgroundColor: "color-mix(in srgb, var(--accent-color) 20%, transparent)" }}
          />
          <div className="relative">
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest"
              style={{
                borderColor: "color-mix(in srgb, var(--accent-color) 40%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--accent-color) 10%, transparent)",
                color: "var(--accent-color)",
              }}
            >
              <Sparkles className="h-3.5 w-3.5" /> Refer &amp; Earn
            </div>
            <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
              Give 10% off. Earn 10% back.
            </h1>
            <p className="mt-3 max-w-xl text-sm text-white/80 sm:text-base">
              Share your link. Friends get <span className="font-semibold" style={{ color: "var(--accent-color)" }}>10% off</span> their first
              AurumVault purchase, and you earn <span className="font-semibold" style={{ color: "var(--accent-color)" }}>10% store credit</span> on
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
            <div
              className="min-w-0 rounded-2xl border px-4 py-3"
              style={{
                borderColor: "color-mix(in srgb, var(--accent-color) 40%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--accent-color) 10%, transparent)",
              }}
            >
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
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:brightness-110"
              style={{ backgroundColor: "var(--accent-color)" }}
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

        <ReferralStatusSection />


        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { step: "1", title: "Share your link", body: "Send it to friends, post it, or text it — it works anywhere." },
            { step: "2", title: "They save 10%", body: "Your code applies a 10% discount on their first purchase." },
            { step: "3", title: "You earn 10%", body: "Earn store credit on every order they complete. No cap." },
          ].map((s) => (
            <div key={s.step} className="rounded-2xl border border-[#0F1E35]/10 bg-white p-5 shadow-sm">
              <div
                className="grid h-8 w-8 place-items-center rounded-full bg-[#0F1E35] text-sm font-bold"
                style={{ color: "var(--accent-color)" }}
              >
                {s.step}
              </div>

              <h3 className="mt-3 text-base font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-[#0F1E35]/70">{s.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-3xl border border-[#0F1E35]/10 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl"
              style={{
                backgroundColor: "color-mix(in srgb, var(--accent-color) 10%, transparent)",
                color: "var(--accent-color)",
              }}
            >
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

function ReferralStatusSection() {
  const fetchStats = useServerFn(getReferralStats);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["referral-stats"],
    queryFn: () => fetchStats(),
    staleTime: 30_000,
  });

  const fmtMoney = (cents: number, currency = "usd") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <section className="mt-6 rounded-3xl border border-[#0F1E35]/10 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold sm:text-xl">Referral status</h2>
          <p className="mt-1 text-sm text-[#0F1E35]/70">Live attribution from your invite link.</p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-full border border-[#0F1E35]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#0F1E35] hover:bg-[#F5F0E8] disabled:opacity-60"
          disabled={isFetching}
        >
          {isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {isError ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Couldn't load your referral stats. <button className="underline" onClick={() => void refetch()}>Try again</button>.
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Your code"
          value={isLoading ? "—" : (data?.code ?? "—")}
          mono
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Successful referrals"
          value={isLoading ? "—" : String(data?.signups ?? 0)}
          hint="Friends who signed up with your link"
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Credited first orders"
          value={isLoading ? "—" : String(data?.creditedFirstOrders ?? 0)}
          hint={data ? `${fmtMoney(data.creditedRevenueCents)} attributed revenue` : undefined}
        />
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-bold text-[#0F1E35]">Recent attributed orders</h3>
        {isLoading ? (
          <div className="mt-2 h-12 animate-pulse rounded-xl bg-[#F5F0E8]" />
        ) : !data?.recent.length ? (
          <p className="mt-2 text-sm text-[#0F1E35]/60">No referred orders yet — share your link to get started.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[#0F1E35]/10 rounded-2xl border border-[#0F1E35]/10">
            {data.recent.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-[#0F1E35]/60 truncate">#{o.id.slice(0, 8)}</div>
                  <div className="text-[#0F1E35]/80">{fmtDate(o.created_at)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-[#F5F0E8] px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[#0F1E35]/70">
                    {o.status || "pending"}
                  </span>
                  <span className="font-bold text-[#0F1E35]">{fmtMoney(o.amount_cents, o.currency)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#0F1E35]/10 bg-[#F5F0E8]/60 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#0F1E35]/60">
        <span
          className="grid h-6 w-6 place-items-center rounded-full bg-[#0F1E35]"
          style={{ color: "var(--accent-color)" }}
        >
          {icon}
        </span>

        {label}
      </div>
      <div className={`mt-2 text-2xl font-black text-[#0F1E35] ${mono ? "font-mono tracking-widest" : ""}`}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-[#0F1E35]/60">{hint}</div> : null}
    </div>
  );
}

