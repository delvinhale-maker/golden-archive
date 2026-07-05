import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { DollarSign, ShoppingBag, Clock, CheckCircle2, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard/earn")({
  component: EarnPage,
});

type OrderItemRow = {
  seller_amount_cents: number;
  unit_amount_cents: number;
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

// Mirrors the auto-release review window (24h) — surface-only.
const READY_WINDOW_MS = 24 * 60 * 60 * 1000;

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function EarnPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [balance, setBalance] = useState<BalanceRow | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: oi }, { data: bal }, { data: po }] = await Promise.all([
        supabase
          .from("order_items")
          .select("seller_amount_cents,unit_amount_cents,created_at,orders!inner(status,updated_at)")
          .eq("seller_id", user.id)
          .eq("orders.status", "paid"),
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
      ]);
      setItems((oi ?? []) as unknown as OrderItemRow[]);
      setBalance((bal as BalanceRow | null) ?? { pending_cents: 0, paid_cents: 0, currency: "usd" });
      setPayouts((po ?? []) as PayoutRow[]);
      setLoading(false);
    })();
  }, [user]);

  const lifetimeGross = items.reduce((s, i) => s + (i.unit_amount_cents || 0), 0);
  const lifetimeEarned = items.reduce((s, i) => s + (i.seller_amount_cents || 0), 0);
  const unitsSold = items.length;
  const pending = balance?.pending_cents ?? 0;
  const paidOut = balance?.paid_cents ?? 0;

  // "Ready for Release" = pending > 0 AND at least one paid order older than 24h
  const now = Date.now();
  const hasMatureOrder = items.some((i) => {
    const t = i.orders?.updated_at ? new Date(i.orders.updated_at).getTime() : 0;
    return t > 0 && now - t >= READY_WINDOW_MS;
  });
  const payoutStatus: "paid" | "ready" | "pending" | "none" =
    pending === 0 && paidOut > 0
      ? "paid"
      : pending > 0 && hasMatureOrder
        ? "ready"
        : pending > 0
          ? "pending"
          : "none";

  // Monthly earnings chart
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
      <h1 className="font-display text-3xl md:text-4xl text-navy">Earn</h1>
      <p className="mt-1 text-mute">Your AurumVault sales, earnings, and payouts.</p>

      {/* Summary cards */}
      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<ShoppingBag size={18} />}
          label="Lifetime Sales"
          value={fmt(lifetimeGross)}
          sub={`${unitsSold} unit${unitsSold === 1 ? "" : "s"}`}
        />
        <StatCard
          icon={<DollarSign size={18} />}
          label="Total Earned"
          value={fmt(lifetimeEarned)}
          sub="After 9% fee"
        />
        <StatCard
          icon={<Clock size={18} />}
          label="Pending Balance"
          value={fmt(pending)}
        />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="Paid Out"
          value={fmt(paidOut)}
        />
      </div>

      {/* Payout status */}
      <section className="mt-6 rounded-2xl bg-white border border-ink/10 p-6 flex items-start gap-4">
        <PayoutStatusBadge status={payoutStatus} />
        <div className="flex-1">
          <h2 className="font-display text-lg text-navy">Payout status</h2>
          <p className="mt-1 text-sm text-mute">
            {payoutStatus === "ready" && (
              <>Your pending balance of <strong className="text-navy">{fmt(pending)}</strong> is ready for release. Payouts are sent manually by an admin.</>
            )}
            {payoutStatus === "pending" && (
              <>You have <strong className="text-navy">{fmt(pending)}</strong> pending. It becomes releasable 24 hours after the sale clears.</>
            )}
            {payoutStatus === "paid" && (
              <>All caught up — you've been paid <strong className="text-navy">{fmt(paidOut)}</strong> lifetime.</>
            )}
            {payoutStatus === "none" && <>You'll see your payout status here once you start earning.</>}
          </p>
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
                    <td className="py-3 pr-4 text-navy">{new Date(p.paid_at).toLocaleDateString()}</td>
                    <td className="py-3 pr-4 font-medium text-navy">{fmt(p.amount_cents)}</td>
                    <td className="py-3 pr-4 text-mute">{p.method ?? "—"}</td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-xs font-medium">
                        <CheckCircle2 size={12} /> Paid
                      </span>
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
          AurumVault takes <strong className="text-navy">9%</strong> per sale. You keep <strong className="text-navy">91%</strong>.
          Payouts are sent manually by our team after the 24-hour clearance window.
        </p>
      </section>
    </PublisherShell>
  );
}

function PayoutStatusBadge({ status }: { status: "paid" | "ready" | "pending" | "none" }) {
  const map = {
    ready: { bg: "bg-amber-50", fg: "text-amber-700", label: "Ready for Release" },
    pending: { bg: "bg-slate-50", fg: "text-slate-600", label: "Pending" },
    paid: { bg: "bg-emerald-50", fg: "text-emerald-700", label: "Paid" },
    none: { bg: "bg-slate-50", fg: "text-slate-500", label: "No balance" },
  }[status];
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${map.bg} ${map.fg}`}>
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
