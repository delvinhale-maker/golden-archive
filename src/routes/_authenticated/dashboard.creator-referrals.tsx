import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Check,
  Users,
  DollarSign,
  Sparkles,
  Twitter,
  Facebook,
  Linkedin,
  Mail,
} from "lucide-react";
import { getCreatorReferralStats, type CreatorReferralStats } from "@/lib/creator-referrals.functions";

export const Route = createFileRoute("/_authenticated/dashboard/creator-referrals")({
  component: CreatorReferralsPage,
  head: () => ({
    meta: [
      { title: "Refer Creators · Earn 5% for 12 Months | AurumVault" },
      {
        name: "description",
        content:
          "Invite other creators to AurumVault. Earn a 5% bonus on every sale they make for 12 months.",
      },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [
      { rel: "canonical", href: "https://www.aurumvault.store/dashboard/creator-referrals" },
    ],
  }),
});

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function CreatorReferralsPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const code = useMemo(
    () => (uid ? uid.replace(/-/g, "").slice(0, 8).toUpperCase() : "—"),
    [uid],
  );
  const link = useMemo(() => {
    if (!uid) return "";
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://www.aurumvault.store";
    return `${origin}/become-a-creator?cref=${code}`;
  }, [uid, code]);

  const stats = useServerFn(getCreatorReferralStats);
  const { data } = useQuery({
    queryKey: ["creator-referral-stats", uid],
    queryFn: () => stats(),
    enabled: !!uid,
  });
  const s: CreatorReferralStats = data ?? {
    referred_count: 0,
    active_count: 0,
    gmv_cents: 0,
    bonus_cents: 0,
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Referral link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const shareText = encodeURIComponent(
    "Join me on AurumVault — the gold standard marketplace for purpose-driven creators.",
  );
  const u = encodeURIComponent(link);

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy text-white">
        <div className="mx-auto max-w-5xl px-4 md:px-8 py-4 flex items-center gap-3">
          <Link to="/dashboard" className="text-white/70 hover:text-white inline-flex items-center gap-1 text-sm">
            <ArrowLeft size={14} /> Dashboard
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 md:px-8 py-10">
        <div className="rounded-2xl bg-gradient-to-br from-navy to-[#22335A] text-white p-6 md:p-8">
          <p className="text-gold text-xs uppercase tracking-[0.3em] font-semibold inline-flex items-center gap-2">
            <Sparkles size={14} /> Creator Referral Program
          </p>
          <h1 className="mt-3 font-display text-3xl md:text-4xl leading-tight">
            Earn 5% on every sale for 12 months
          </h1>
          <p className="mt-3 text-white/80 max-w-2xl">
            Share your unique link with fellow creators. When they get approved and start
            selling on AurumVault, you earn a <b>5% bonus</b> on their sales for a full year.
          </p>
        </div>

        <div className="mt-6 bg-white rounded-2xl border border-ink/10 p-5">
          <p className="text-xs uppercase tracking-wider text-mute">Your referral link</p>
          <div className="mt-2 flex flex-col md:flex-row items-stretch md:items-center gap-2">
            <input
              readOnly
              value={link || "Sign in to generate your link"}
              className="flex-1 px-3 py-2.5 rounded-lg bg-paper border border-ink/10 text-navy font-mono text-sm"
            />
            <button
              onClick={copy}
              disabled={!link}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-navy text-white text-sm font-medium hover:bg-navy/90 disabled:opacity-50"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`https://twitter.com/intent/tweet?text=${shareText}&url=${u}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:border-gold"
            >
              <Twitter size={12} /> X / Twitter
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${u}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:border-gold"
            >
              <Facebook size={12} /> Facebook
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${u}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:border-gold"
            >
              <Linkedin size={12} /> LinkedIn
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent("Join me on AurumVault")}&body=${shareText}%20${u}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:border-gold"
            >
              <Mail size={12} /> Email
            </a>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={<Users size={16} />} label="Referred creators" value={s.referred_count} />
          <StatCard icon={<Sparkles size={16} />} label="Active (in 12mo window)" value={s.active_count} />
          <StatCard icon={<DollarSign size={16} />} label="Attributed sales" value={fmt(s.gmv_cents)} />
          <StatCard icon={<DollarSign size={16} />} label="Your 5% bonus" value={fmt(s.bonus_cents)} highlight />
        </div>

        <div className="mt-8 bg-white rounded-2xl border border-ink/10 p-5">
          <h2 className="font-display text-lg text-navy">How it works</h2>
          <ol className="mt-3 space-y-2 text-sm text-navy/80 list-decimal pl-5">
            <li>Share your unique link with creators in your circle.</li>
            <li>They apply through your link and get approved to sell on AurumVault.</li>
            <li>You earn <b>5%</b> of every sale they make for <b>12 months</b> from attribution.</li>
            <li>Bonuses appear in your earnings once the referred creator's orders complete.</li>
          </ol>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight ? "bg-gold/10 border-gold/40" : "bg-white border-ink/10"
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-mute">
        {icon} {label}
      </div>
      <p className="font-display text-2xl text-navy mt-1">{value}</p>
    </div>
  );
}
