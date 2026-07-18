import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getAdminEarningsSummary,
  adminListPayoutRequests,
  adminDecidePayoutRequest,
  adminListTaxForms,
  adminSignTaxFormUrl,
  adminReviewTaxForm,
  type AdminEarningsSummary,
  type AdminPayoutRequest,
  type AdminTaxForm,
} from "@/lib/admin-earnings.functions";
import { toast } from "sonner";
import { AVLogo } from "@/components/marketplace/AVLogo";
import { ArrowLeft, Loader2, DollarSign, TrendingUp, Users, Wallet, FileText, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/earnings")({
  component: AdminEarningsPage,
});

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function AdminEarningsPage() {
  const [summary, setSummary] = useState<AdminEarningsSummary | null>(null);
  const [requests, setRequests] = useState<AdminPayoutRequest[]>([]);
  const [taxForms, setTaxForms] = useState<AdminTaxForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchSummary = useServerFn(getAdminEarningsSummary);
  const fetchRequests = useServerFn(adminListPayoutRequests);
  const fetchTax = useServerFn(adminListTaxForms);
  const decideFn = useServerFn(adminDecidePayoutRequest);
  const signFn = useServerFn(adminSignTaxFormUrl);
  const reviewFn = useServerFn(adminReviewTaxForm);

  async function refresh() {
    try {
      const [s, r, t] = await Promise.all([fetchSummary(), fetchRequests(), fetchTax()]);
      setSummary(s);
      setRequests(r);
      setTaxForms(t);
    } catch (e: any) {
      toast.error(e?.message ?? "Load failed");
    }
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function decide(id: string, approve: boolean, markPaid: boolean) {
    const note = approve ? "" : (window.prompt("Reason for decline (optional):") ?? "");
    const method = approve && markPaid ? (window.prompt("Payout method used (e.g. ACH, PayPal):") ?? "") : "";
    setBusyId(id);
    try {
      await decideFn({
        data: {
          request_id: id,
          approve,
          method: method || null,
          admin_note: note || null,
          mark_paid: markPaid,
        },
      });
      toast.success(approve ? (markPaid ? "Marked as paid" : "Approved") : "Declined");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  async function viewTaxForm(path: string) {
    try {
      const { url } = await signFn({ data: { file_path: path } });
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e?.message ?? "Cannot open");
    }
  }

  async function reviewTax(id: string, status: "approved" | "rejected") {
    const note = window.prompt(status === "rejected" ? "Reason (optional):" : "Note (optional):") ?? "";
    try {
      await reviewFn({ data: { form_id: id, status, admin_note: note || null } });
      toast.success(`Tax form ${status}`);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  return (
    <div className="min-h-screen bg-parchment">
      <header className="bg-navy text-white shadow-sm">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-4 flex items-center gap-4">
          <AVLogo />
          <span className="text-white/60 text-sm ml-2">Admin · Earnings</span>
          <Link to="/admin" className="ml-auto text-white/80 hover:text-white text-sm inline-flex items-center gap-1">
            <ArrowLeft size={14} /> Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 md:px-8 py-8">
        <h1 className="font-display text-3xl text-navy">Platform Earnings</h1>
        <p className="mt-1 text-mute">Revenue, creator payouts, and pending requests.</p>

        {loading || !summary ? (
          <div className="mt-8 flex items-center gap-2 text-mute">
            <Loader2 className="animate-spin" size={16} /> Loading…
          </div>
        ) : (
          <>
            <section className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={<TrendingUp size={16} />} label="Gross revenue" value={fmt(summary.gross_revenue_cents)} />
              <StatCard icon={<DollarSign size={16} />} label="Platform fees (15%)" value={fmt(summary.platform_fees_cents)} accent="text-emerald-700" />
              <StatCard icon={<Wallet size={16} />} label="Creator earnings" value={fmt(summary.creator_earnings_cents)} />
              <StatCard icon={<CheckCircle2 size={16} />} label="Paid out" value={fmt(summary.paid_out_cents)} />
            </section>
            <section className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={<Wallet size={16} />} label="Pending balances" value={fmt(summary.pending_balance_cents)} />
              <StatCard icon={<Users size={16} />} label="Creators w/ balance" value={String(summary.seller_count)} />
              <StatCard icon={<TrendingUp size={16} />} label="Paid orders" value={String(summary.order_count)} />
              <StatCard icon={<FileText size={16} />} label="Pending requests" value={String(summary.pending_request_count)} accent="text-amber-700" />
            </section>

            <section className="mt-10 rounded-2xl border border-navy/10 bg-white p-6">
              <h2 className="font-display text-xl text-navy">Payout requests</h2>
              {requests.length === 0 ? (
                <p className="mt-2 text-mute text-sm">No requests yet.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-navy/60">
                      <tr>
                        <th className="text-left font-medium py-2 pr-4">Date</th>
                        <th className="text-left font-medium py-2 pr-4">Creator</th>
                        <th className="text-right font-medium py-2 pr-4">Amount</th>
                        <th className="text-left font-medium py-2 pr-4">Method</th>
                        <th className="text-left font-medium py-2 pr-4">Status</th>
                        <th className="text-left font-medium py-2 pr-4">Note</th>
                        <th className="text-right font-medium py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((r) => (
                        <tr key={r.id} className="border-t border-navy/5 align-top">
                          <td className="py-2 pr-4 whitespace-nowrap">
                            {new Date(r.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-2 pr-4">
                            {r.seller_name ?? r.seller_id.slice(0, 8)}
                          </td>
                          <td className="py-2 pr-4 text-right font-medium">{fmt(r.amount_cents)}</td>
                          <td className="py-2 pr-4 text-xs">
                            {r.method_snapshot ? (
                              <details>
                                <summary className="cursor-pointer capitalize">
                                  {String((r.method_snapshot as any).method ?? "—")}
                                </summary>
                                <pre className="mt-1 text-[11px] whitespace-pre-wrap break-all bg-navy/5 rounded p-2 max-w-xs">
                                  {JSON.stringify((r.method_snapshot as any).details ?? {}, null, 2)}
                                </pre>
                              </details>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs ${
                              r.status === "pending" ? "bg-amber-100 text-amber-900" :
                              r.status === "paid" ? "bg-emerald-100 text-emerald-900" :
                              r.status === "approved" ? "bg-blue-100 text-blue-900" :
                              "bg-rose-100 text-rose-900"
                            }`}>{r.status}</span>
                          </td>
                          <td className="py-2 pr-4 text-xs max-w-[180px] break-words">
                            {r.seller_note ?? ""}
                            {r.admin_note ? <div className="italic text-mute mt-1">Admin: {r.admin_note}</div> : null}
                          </td>
                          <td className="py-2 text-right whitespace-nowrap">
                            {r.status === "pending" ? (
                              <div className="inline-flex gap-1">
                                <button
                                  onClick={() => decide(r.id, true, true)}
                                  disabled={busyId === r.id}
                                  className="px-2 py-1 rounded bg-emerald-700 text-white text-xs disabled:opacity-60"
                                >
                                  Mark paid
                                </button>
                                <button
                                  onClick={() => decide(r.id, false, false)}
                                  disabled={busyId === r.id}
                                  className="px-2 py-1 rounded border border-rose-300 text-rose-700 text-xs disabled:opacity-60"
                                >
                                  Decline
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="mt-6 rounded-2xl border border-navy/10 bg-white p-6">
              <h2 className="font-display text-xl text-navy">Tax forms</h2>
              {taxForms.length === 0 ? (
                <p className="mt-2 text-mute text-sm">None submitted.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-navy/60">
                      <tr>
                        <th className="text-left font-medium py-2 pr-4">Date</th>
                        <th className="text-left font-medium py-2 pr-4">Creator</th>
                        <th className="text-left font-medium py-2 pr-4">Type</th>
                        <th className="text-left font-medium py-2 pr-4">Status</th>
                        <th className="text-right font-medium py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taxForms.map((t) => (
                        <tr key={t.id} className="border-t border-navy/5">
                          <td className="py-2 pr-4">{new Date(t.submitted_at).toLocaleDateString()}</td>
                          <td className="py-2 pr-4">{t.seller_name ?? t.seller_id.slice(0, 8)}</td>
                          <td className="py-2 pr-4">{t.form_type}</td>
                          <td className="py-2 pr-4">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs ${
                              t.status === "submitted" ? "bg-amber-100 text-amber-900" :
                              t.status === "approved" ? "bg-emerald-100 text-emerald-900" :
                              "bg-rose-100 text-rose-900"
                            }`}>{t.status}</span>
                          </td>
                          <td className="py-2 text-right whitespace-nowrap">
                            <button
                              onClick={() => viewTaxForm(t.file_path)}
                              className="px-2 py-1 rounded border border-navy/20 text-navy text-xs"
                            >
                              View
                            </button>
                            {t.status === "submitted" ? (
                              <>
                                <button
                                  onClick={() => reviewTax(t.id, "approved")}
                                  className="ml-1 px-2 py-1 rounded bg-emerald-700 text-white text-xs"
                                >
                                  <CheckCircle2 size={12} className="inline" /> Approve
                                </button>
                                <button
                                  onClick={() => reviewTax(t.id, "rejected")}
                                  className="ml-1 px-2 py-1 rounded border border-rose-300 text-rose-700 text-xs"
                                >
                                  <XCircle size={12} className="inline" /> Reject
                                </button>
                              </>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-4">
      <div className="flex items-center gap-2 text-navy/60 text-xs">
        {icon} {label}
      </div>
      <div className={`mt-1 text-xl font-semibold ${accent ?? "text-navy"}`}>{value}</div>
    </div>
  );
}
