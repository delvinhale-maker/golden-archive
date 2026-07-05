import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { DollarSign, ShoppingBag, Clock, CheckCircle2, TrendingUp, CalendarDays, Timer } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useServerFn } from "@tanstack/react-start";
import { getPayoutScheduleStatus } from "@/lib/payout-schedule.functions";

export const Route = createFileRoute("/_authenticated/dashboard/earn")({
  component: EarnPage,
});

const HOLDING_MS = 24 * 60 * 60 * 1000;
const SUPPORT_EMAIL = "illcapitalllc@mail.com";

type OrderItemRow = {
  id: string;
  seller_amount_cents: number;
  unit_amount_cents: number;
  product_title: string | null;
  created_at: string;
  orders: { status: string; updated_at: string } | null;
};
type BalanceRow = { pending_cents: number; paid_cents: number; currency: string };
type PayoutRow = {
  id: string;
  amount_cents: number;
  currency: string;
  method: string | null;
  note: string | null;
  paid_at: string;
};
type ScheduleStatus = Awaited<ReturnType<typeof getPayoutScheduleStatus>>;

type ItemStatus = "pending" | "ready" | "paid";

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
function fmtDate(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

type TzMode = "local" | "eastern" | "utc";
const TZ_STORAGE_KEY = "aurumvault.payoutTzDisplay";
const TZ_OPTIONS: { value: TzMode; label: string; zone: string | undefined }[] = [
  { value: "local", label: "Local time", zone: undefined },
  { value: "eastern", label: "US Eastern", zone: "America/New_York" },
  { value: "utc", label: "UTC", zone: "UTC" },
];

function fmtDateTimeTz(d: Date, mode: TzMode) {
  const opt = TZ_OPTIONS.find((o) => o.value === mode) ?? TZ_OPTIONS[0];
  const parts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: opt.zone,
    timeZoneName: "short",
  };
  return d.toLocaleString(undefined, parts);
}

function useCountdown(target: Date | null) {
  const [remaining, setRemaining] = useState(() => (target ? target.getTime() - Date.now() : null));

  useEffect(() => {
    if (!target) {
      setRemaining(null);
      return;
    }
    const tick = () => {
      const ms = target.getTime() - Date.now();
      setRemaining(Math.max(0, ms));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (remaining === null || remaining <= 0) return null;
  const seconds = Math.floor((remaining / 1000) % 60);
  const minutes = Math.floor((remaining / (1000 * 60)) % 60);
  const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  return { days, hours, minutes, seconds };
}

function fmtCountdown({ days, hours, minutes, seconds }: NonNullable<ReturnType<typeof useCountdown>>) {
  const parts = [
    days > 0 ? `${days}d` : "",
    `${hours.toString().padStart(2, "0")}h`,
    `${minutes.toString().padStart(2, "0")}m`,
    `${seconds.toString().padStart(2, "0")}s`,
  ].filter(Boolean);
  return parts.join(" ");
}

const STATUS_COPY: Record<ItemStatus, string> = {
  pending:
    "This sale was just made and is still within our standard holding period. This helps protect against refunds or order issues before your earnings are finalized.",
  ready:
    "Your earnings have cleared and are ready to be paid out in the next payout cycle. Payouts are processed every Friday.",
  paid: `This amount was sent to you. If you haven't received it within 3–5 business days, reach out to us at ${SUPPORT_EMAIL} and we'll look into it.`,
};

function EarnPage() {
  const { user } = useAuth();
  const fetchSchedule = useServerFn(getPayoutScheduleStatus);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [balance, setBalance] = useState<BalanceRow | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [schedule, setSchedule] = useState<ScheduleStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: oi }, { data: bal }, { data: po }, sched] = await Promise.all([
        supabase
          .from("order_items")
          .select("id,seller_amount_cents,unit_amount_cents,product_title,created_at,orders!inner(status,updated_at)")
          .eq("seller_id", user.id)
          .eq("orders.status", "paid")
          .order("created_at", { ascending: false }),
        supabase
          .from("seller_balances")
          .select("pending_cents,paid_cents,currency")
          .eq("seller_id", user.id)
          .maybeSingle(),
        supabase
          .from("seller_payouts")
          .select("id,amount_cents,currency,method,note,paid_at")
          .eq("seller_id", user.id)
          .order("paid_at", { ascending: false })
          .limit(50),
        fetchSchedule().catch(() => null),
      ]);
      setItems((oi ?? []) as unknown as OrderItemRow[]);
      setBalance((bal as BalanceRow | null) ?? { pending_cents: 0, paid_cents: 0, currency: "usd" });
      setPayouts((po ?? []) as PayoutRow[]);
      setSchedule(sched as ScheduleStatus | null);
      setLoading(false);
    })();
  }, [user, fetchSchedule]);

  const lifetimeGross = items.reduce((s, i) => s + (i.unit_amount_cents || 0), 0);
  const lifetimeEarned = items.reduce((s, i) => s + (i.seller_amount_cents || 0), 0);
  const unitsSold = items.length;
  const pending = balance?.pending_cents ?? 0;
  const paidOut = balance?.paid_cents ?? 0;
  const scheduleActive = !!schedule?.scheduled;

  // Per-item status. "Ready for Release" requires BOTH a cleared holding
  // period AND a confirmed active Friday schedule.
  const now = Date.now();
  const perItem = useMemo(() => {
    const totalPending = pending;
    let remainingPending = totalPending;
    // Oldest first so oldest earnings are matched to remaining pending
    const sorted = [...items].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    return sorted
      .map((it) => {
        const paidAt = it.orders?.updated_at ? new Date(it.orders.updated_at).getTime() : 0;
        const cleared = paidAt > 0 && now - paidAt >= HOLDING_MS;
        const cents = it.seller_amount_cents || 0;
        // If we still have pending remaining, this item is (pending or ready).
        // Otherwise it's already been paid out.
        let status: ItemStatus;
        if (remainingPending >= cents && remainingPending > 0) {
          remainingPending -= cents;
          status = cleared && scheduleActive ? "ready" : "pending";
        } else if (remainingPending > 0) {
          remainingPending = 0;
          status = cleared && scheduleActive ? "ready" : "pending";
        } else {
          status = "paid";
        }
        return { ...it, status, paidAt };
      })
      .sort((a, b) => b.paidAt - a.paidAt);
  }, [items, pending, now, scheduleActive]);

  const readyCents = perItem
    .filter((i) => i.status === "ready")
    .reduce((s, i) => s + (i.seller_amount_cents || 0), 0);
  const pendingCents = perItem
    .filter((i) => i.status === "pending")
    .reduce((s, i) => s + (i.seller_amount_cents || 0), 0);

  // Fallback: balance ledger is the source of truth for pending totals.
  // If per-item accounting doesn't cover the full pending amount (e.g. legacy
  // sales), show the remainder as pending too so the badge always reflects
  // the real ledger.
  const accountedPending = readyCents + pendingCents;
  const orphanedPending = Math.max(0, pending - accountedPending);
  const effectivePending = pendingCents + orphanedPending;

  const overallStatus: ItemStatus | "none" =
    readyCents > 0 ? "ready" : effectivePending > 0 ? "pending" : paidOut > 0 ? "paid" : "none";

  const nextRelease = schedule?.next_release_at ? new Date(schedule.next_release_at) : null;
  const countdown = useCountdown(nextRelease);
  const [tzMode, setTzMode] = useState<TzMode>(() => {
    if (typeof window === "undefined") return "local";
    const stored = window.localStorage.getItem(TZ_STORAGE_KEY) as TzMode | null;
    return stored && TZ_OPTIONS.some((o) => o.value === stored) ? stored : "local";
  });
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(TZ_STORAGE_KEY, tzMode);
  }, [tzMode]);

  // Monthly chart
  const nowDate = new Date();
  const months: { key: string; label: string; earnings: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString(undefined, { month: "short" }),
      earnings: 0,
    });
  }
  let thisMonthEarned = 0;
  const monthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);
  for (const it of items) {
    const d = new Date(it.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const m = months.find((x) => x.key === key);
    if (m) m.earnings += (it.seller_amount_cents || 0) / 100;
    if (d >= monthStart) thisMonthEarned += it.seller_amount_cents || 0;
  }

  return (
    <PublisherShell accent={ACCENTS.earn}>
      <h1 className="font-display text-3xl md:text-4xl text-navy">Your Earnings</h1>
      <p className="mt-1 text-mute">
        Track your sales and payout status below. Payouts are processed every Friday.
      </p>

      {/* Summary cards */}
      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<ShoppingBag size={18} />} label="Lifetime Sales" value={fmt(lifetimeGross)} sub={`${unitsSold} unit${unitsSold === 1 ? "" : "s"}`} />
        <StatCard icon={<DollarSign size={18} />} label="Total Earned" value={fmt(lifetimeEarned)} sub="After 30% fee" />
        <StatCard icon={<Clock size={18} />} label="Pending Balance" value={fmt(pending)} sub={readyCents > 0 ? `${fmt(readyCents)} ready` : undefined} />
        <StatCard icon={<CheckCircle2 size={18} />} label="Paid Out" value={fmt(paidOut)} />
      </div>

      {/* Payout status */}
      <section className="mt-6 rounded-2xl bg-white border border-ink/10 p-6">
        <div className="flex items-start gap-4">
          <PayoutStatusBadge status={overallStatus} />
          <div className="flex-1">
            <h2 className="font-display text-lg text-navy">Payout status</h2>
            <p className="mt-1 text-sm text-mute">
              {overallStatus === "ready" && STATUS_COPY.ready}
              {overallStatus === "pending" && STATUS_COPY.pending}
              {overallStatus === "paid" && STATUS_COPY.paid}
              {overallStatus === "none" && "You'll see your payout status here once you start earning."}
            </p>
            {nextRelease && (readyCents > 0 || pendingCents > 0) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-navy/80">
                  <CalendarDays size={12} /> Next payout: <strong>{fmtDateTimeTz(nextRelease, tzMode)}</strong>
                </span>
                {countdown && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2 py-1 text-xs font-semibold text-navy">
                    <Timer size={12} /> {fmtCountdown(countdown)}
                  </span>
                )}
                {!scheduleActive && (
                  <span className="text-xs text-amber-700">(schedule confirming…)</span>
                )}
                <label className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-mute">
                  Show in
                  <select
                    value={tzMode}
                    onChange={(e) => setTzMode(e.target.value as TzMode)}
                    className="rounded border border-ink/10 bg-white px-1.5 py-0.5 text-[11px] text-navy focus:outline-none focus:ring-1 focus:ring-navy/30"
                  >
                    {TZ_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <span className="w-full text-[11px] text-mute">
                  Released Fridays at 14:00 UTC (9:00 AM ET winter / 10:00 AM ET summer). Countdown reflects the exact UTC instant.
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Monthly chart */}
      <section className="mt-6 rounded-2xl bg-white border border-ink/10 p-6">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-navy" />
          <h2 className="font-display text-xl text-navy">Monthly earnings</h2>
        </div>
        <p className="text-xs text-mute mt-1">
          Last 6 months. This month: <strong className="text-navy">{fmt(thisMonthEarned)}</strong>
        </p>
        <div className="mt-5 h-72">
          {loading ? (
            <div className="text-mute text-sm">Loading…</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months}>
                <CartesianGrid stroke="#eee" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  cursor={{ fill: "rgba(45,106,79,0.06)" }}
                  contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, "Earned"]}
                />
                <Bar dataKey="earnings" fill="var(--page-accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Sales breakdown by status */}
      <section className="mt-6 rounded-2xl bg-white border border-ink/10 p-6">
        <h3 className="font-display text-lg text-navy">Sales breakdown</h3>
        <p className="mt-1 text-xs text-mute">Per-sale payout status. Hover a status for what it means.</p>
        {perItem.length === 0 ? (
          <p className="mt-3 text-sm text-mute">No sales yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-mute border-b border-ink/10">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Product</th>
                  <th className="py-2 pr-4">You earned</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {perItem.slice(0, 25).map((it) => (
                  <tr key={it.id} className="border-b border-ink/5 last:border-0 align-top">
                    <td className="py-3 pr-4 text-navy whitespace-nowrap">{fmtDate(it.created_at)}</td>
                    <td className="py-3 pr-4 text-navy">{it.product_title ?? "—"}</td>
                    <td className="py-3 pr-4 font-medium text-navy">{fmt(it.seller_amount_cents || 0)}</td>
                    <td className="py-3">
                      <PayoutStatusBadge status={it.status} title={STATUS_COPY[it.status]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {perItem.length > 25 && (
              <p className="mt-3 text-xs text-mute">Showing 25 of {perItem.length} sales.</p>
            )}
          </div>
        )}
      </section>

      {/* Payout history */}
      <section className="mt-6 rounded-2xl bg-white border border-ink/10 p-6">
        <h3 className="font-display text-lg text-navy">Payout history</h3>
        {payouts.length === 0 ? (
          <p className="mt-2 text-sm text-mute">No payouts yet. Once an admin releases funds, they'll appear here.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-mute border-b border-ink/10">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Method</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id} className="border-b border-ink/5 last:border-0">
                    <td className="py-3 pr-4 text-navy">{fmtDate(p.paid_at)}</td>
                    <td className="py-3 pr-4 font-medium text-navy">{fmt(p.amount_cents)}</td>
                    <td className="py-3 pr-4 text-mute">{p.method ?? "—"}</td>
                    <td className="py-3">
                      <PayoutStatusBadge status="paid" title={STATUS_COPY.paid} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl bg-white border border-ink/10 p-6">
        <h3 className="font-display text-lg text-navy">How payouts work</h3>
        <p className="mt-2 text-sm text-mute">
          AurumVault takes <strong className="text-navy">30%</strong> per sale. You keep <strong className="text-navy">70%</strong>.
          Payouts are processed every Friday after each sale clears our standard holding period.
        </p>
        <p className="mt-3 text-xs text-mute">
          Have a question about your balance or a payout? Contact us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-navy underline">
            {SUPPORT_EMAIL}
          </a>{" "}
          — we're happy to help.
        </p>
      </section>
    </PublisherShell>
  );
}

function PayoutStatusBadge({
  status,
  title,
}: {
  status: "paid" | "ready" | "pending" | "none";
  title?: string;
}) {
  const map = {
    ready: { bg: "bg-amber-50", fg: "text-amber-700", label: "Ready for Release" },
    pending: { bg: "bg-slate-50", fg: "text-slate-600", label: "Pending" },
    paid: { bg: "bg-emerald-50", fg: "text-emerald-700", label: "Paid" },
    none: { bg: "bg-slate-50", fg: "text-slate-500", label: "No balance" },
  }[status];
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${map.bg} ${map.fg}`}
    >
      {map.label}
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-ink/10 p-5">
      <div
        className="inline-flex items-center justify-center h-9 w-9 rounded-full text-white"
        style={{ background: "var(--page-accent)" }}
      >
        {icon}
      </div>
      <div className="mt-3 text-2xl font-display text-navy">{value}</div>
      <div className="text-xs text-mute uppercase tracking-wider mt-0.5">{label}</div>
      {sub && <div className="text-xs text-mute mt-1">{sub}</div>}
    </div>
  );
}
