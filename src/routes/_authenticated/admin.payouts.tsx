import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AVLogo } from "@/components/marketplace/AVLogo";
import { ShieldCheck, ArrowLeft, CheckCircle2, Clock, DollarSign, Loader2, History } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/payouts")({
  component: AdminPayoutsPage,
});

// Mirrors the auto-release review window (24h). Balances become eligible for
// payout once at least one paid order backing them has been settled for >= 24h.
const READY_WINDOW_MS = 24 * 60 * 60 * 1000;

type BalanceRow = { seller_id: string; pending_cents: number; paid_cents: number; currency: string };
type Profile = { id: string; display_name: string | null };
type PayoutRow = {
  id: string;
  seller_id: string;
  amount_cents: number;
  currency: string;
  method: string | null;
  note: string | null;
  paid_by: string | null;
  paid_at: string;
};
type OrderAgg = { seller_id: string; oldest_paid_at: string };

type SellerSummary = BalanceRow & {
  display_name: string | null;
  oldest_paid_at: string | null;
  ready: boolean;
};

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function AdminPayoutsPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  const [rows, setRows] = useState<SellerSummary[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  // form state per-seller
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [methods, setMethods] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (loading || !user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        const ok = data?.role === "admin";
        setIsAdmin(ok);
        setChecking(false);
        if (!ok) navigate({ to: "/dashboard" });
      });
  }, [loading, user, navigate]);

  async function refresh() {
    setRefreshing(true);
    const [{ data: bals }, { data: ords }, { data: hist }] = await Promise.all([
      supabase
        .from("seller_balances")
        .select("seller_id,pending_cents,paid_cents,currency")
        .order("pending_cents", { ascending: false }),
      // Fetch paid orders + items to compute per-seller oldest settled order.
      supabase
        .from("order_items")
        .select("seller_id,orders!inner(status,updated_at)")
        .eq("orders.status", "paid"),
      supabase
        .from("seller_payouts")
        .select("id,seller_id,amount_cents,currency,method,note,paid_by,paid_at")
        .order("paid_at", { ascending: false })
        .limit(100),
    ]);
    setRefreshing(false);

    const balances = (bals ?? []) as BalanceRow[];
    const items = ((ords ?? []) as unknown) as Array<{
      seller_id: string;
      orders: { updated_at: string } | null;
    }>;

    const oldestBySeller = new Map<string, string>();
    for (const it of items) {
      const t = it.orders?.updated_at;
      if (!t) continue;
      const cur = oldestBySeller.get(it.seller_id);
      if (!cur || new Date(t).getTime() < new Date(cur).getTime()) {
        oldestBySeller.set(it.seller_id, t);
      }
    }

    // Load display names
    const sellerIds = Array.from(new Set(balances.map((b) => b.seller_id)));
    let profMap: Record<string, Profile> = {};
    if (sellerIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,display_name")
        .in("id", sellerIds);
      for (const p of (profs ?? []) as Profile[]) profMap[p.id] = p;
    }
    setProfiles(profMap);

    const now = Date.now();
    const summaries: SellerSummary[] = balances.map((b) => {
      const oldest = oldestBySeller.get(b.seller_id) ?? null;
      const ready =
        b.pending_cents > 0 &&
        !!oldest &&
        now - new Date(oldest).getTime() >= READY_WINDOW_MS;
      return {
        ...b,
        display_name: profMap[b.seller_id]?.display_name ?? null,
        oldest_paid_at: oldest,
        ready,
      };
    });
    setRows(summaries);
    setPayouts((hist ?? []) as PayoutRow[]);
  }

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin]);

  async function markPaid(row: SellerSummary) {
    const raw = amounts[row.seller_id]?.trim();
    const amountDollars = Number(raw);
    if (!raw || Number.isNaN(amountDollars) || amountDollars <= 0) {
      toast.error("Enter a payout amount in dollars");
      return;
    }
    const cents = Math.round(amountDollars * 100);
    if (cents > row.pending_cents) {
      toast.error(`Amount exceeds pending balance (${fmt(row.pending_cents)})`);
      return;
    }
    setMarkingId(row.seller_id);
    const { error } = await supabase.rpc("admin_record_seller_payout", {
      _seller_id: row.seller_id,
      _amount_cents: cents,
      _method: methods[row.seller_id]?.trim() || undefined,
      _note: notes[row.seller_id]?.trim() || undefined,
    });
    setMarkingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Recorded payout of ${fmt(cents)}`);
    setAmounts((a) => ({ ...a, [row.seller_id]: "" }));
    setNotes((n) => ({ ...n, [row.seller_id]: "" }));
    refresh();
  }

  const readyRows = useMemo(() => rows.filter((r) => r.ready), [rows]);
  const otherRows = useMemo(() => rows.filter((r) => !r.ready && r.pending_cents > 0), [rows]);

  if (loading || checking) return null;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-4 flex items-center gap-4">
          <Link to="/">
            <AVLogo />
          </Link>
          <span className="inline-flex items-center gap-1.5 text-sm rounded-full bg-gold/15 text-gold px-3 py-1">
            <ShieldCheck size={14} /> Admin · Payouts
          </span>
          <Link
            to="/admin"
            className="ml-auto text-sm text-white/70 hover:text-white inline-flex items-center gap-1"
          >
            <ArrowLeft size={14} /> Back to admin
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 md:px-8 py-8 space-y-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-navy">Seller payouts</h1>
          <p className="mt-1 text-mute">
            Record manual bank / PayPal payouts. This moves funds from pending → paid on the seller's balance
            and creates an audit record.
          </p>
        </div>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={16} className="text-navy" />
            <h2 className="font-display text-xl text-navy">Ready for release ({readyRows.length})</h2>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="ml-auto text-xs text-mute hover:text-navy"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          {readyRows.length === 0 ? (
            <p className="text-sm text-mute rounded-2xl bg-white border border-ink/10 p-6">
              No sellers with releasable balance right now.
            </p>
          ) : (
            <div className="grid gap-4">
              {readyRows.map((r) => (
                <SellerCard
                  key={r.seller_id}
                  row={r}
                  amount={amounts[r.seller_id] ?? ""}
                  method={methods[r.seller_id] ?? ""}
                  note={notes[r.seller_id] ?? ""}
                  onAmount={(v) => setAmounts((a) => ({ ...a, [r.seller_id]: v }))}
                  onMethod={(v) => setMethods((m) => ({ ...m, [r.seller_id]: v }))}
                  onNote={(v) => setNotes((n) => ({ ...n, [r.seller_id]: v }))}
                  onMarkPaid={() => markPaid(r)}
                  submitting={markingId === r.seller_id}
                  onPayFull={() =>
                    setAmounts((a) => ({ ...a, [r.seller_id]: (r.pending_cents / 100).toFixed(2) }))
                  }
                />
              ))}
            </div>
          )}
        </section>

        {otherRows.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} className="text-navy" />
              <h2 className="font-display text-xl text-navy">Pending — not yet releasable ({otherRows.length})</h2>
            </div>
            <div className="grid gap-2">
              {otherRows.map((r) => (
                <div
                  key={r.seller_id}
                  className="bg-white border border-ink/10 rounded-xl px-4 py-3 flex items-center gap-3 text-sm"
                >
                  <span className="text-navy font-medium truncate flex-1">
                    {r.display_name ?? r.seller_id.slice(0, 8)}
                  </span>
                  <span className="text-mute">Pending {fmt(r.pending_cents)}</span>
                  <span className="text-xs text-mute">Waiting for 24h clearance</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center gap-2 mb-3">
            <History size={16} className="text-navy" />
            <h2 className="font-display text-xl text-navy">Recent payouts</h2>
          </div>
          {payouts.length === 0 ? (
            <p className="text-sm text-mute rounded-2xl bg-white border border-ink/10 p-6">
              No payouts recorded yet.
            </p>
          ) : (
            <div className="rounded-2xl bg-white border border-ink/10 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-mute border-b border-ink/10">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Seller</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Note</th>
                    <th className="py-3 px-4">By admin</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id} className="border-b border-ink/5 last:border-0">
                      <td className="py-3 px-4 text-navy">
                        {new Date(p.paid_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-navy">
                        {profiles[p.seller_id]?.display_name ?? p.seller_id.slice(0, 8)}
                      </td>
                      <td className="py-3 px-4 font-medium text-navy">{fmt(p.amount_cents)}</td>
                      <td className="py-3 px-4 text-mute">{p.method ?? "—"}</td>
                      <td className="py-3 px-4 text-mute max-w-xs truncate">{p.note ?? "—"}</td>
                      <td className="py-3 px-4 text-mute">{p.paid_by?.slice(0, 8) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function SellerCard(props: {
  row: SellerSummary;
  amount: string;
  method: string;
  note: string;
  onAmount: (v: string) => void;
  onMethod: (v: string) => void;
  onNote: (v: string) => void;
  onMarkPaid: () => void;
  onPayFull: () => void;
  submitting: boolean;
}) {
  const { row, amount, method, note, onAmount, onMethod, onNote, onMarkPaid, onPayFull, submitting } = props;
  return (
    <div className="bg-white border border-ink/10 rounded-2xl p-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <p className="font-display text-lg text-navy">{row.display_name ?? "Seller"}</p>
        <span className="text-xs text-mute font-mono">{row.seller_id.slice(0, 8)}</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2.5 py-0.5 text-xs font-semibold">
          Ready for release
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-xs text-mute uppercase tracking-wider">Pending</div>
          <div className="text-lg font-display text-navy">{fmt(row.pending_cents)}</div>
        </div>
        <div>
          <div className="text-xs text-mute uppercase tracking-wider">Lifetime paid</div>
          <div className="text-lg font-display text-navy">{fmt(row.paid_cents)}</div>
        </div>
        <div>
          <div className="text-xs text-mute uppercase tracking-wider">Oldest paid order</div>
          <div className="text-sm text-navy">
            {row.oldest_paid_at ? new Date(row.oldest_paid_at).toLocaleDateString() : "—"}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_2fr_auto] items-end">
        <label className="block">
          <span className="text-xs text-mute uppercase tracking-wider">Amount ($)</span>
          <div className="mt-1 flex gap-1">
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => onAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={onPayFull}
              className="text-xs px-2 rounded-lg border border-ink/15 text-mute hover:text-navy"
            >
              All
            </button>
          </div>
        </label>
        <label className="block">
          <span className="text-xs text-mute uppercase tracking-wider">Method</span>
          <input
            value={method}
            onChange={(e) => onMethod(e.target.value)}
            placeholder="Bank / PayPal"
            className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs text-mute uppercase tracking-wider">Note (optional)</span>
          <input
            value={note}
            onChange={(e) => onNote(e.target.value)}
            placeholder="Reference / transfer id"
            className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
          />
        </label>
        <button
          onClick={onMarkPaid}
          disabled={submitting}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          Mark as paid
        </button>
      </div>
    </div>
  );
}
