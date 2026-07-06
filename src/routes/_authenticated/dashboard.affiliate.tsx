import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Share2, Users, DollarSign, MousePointerClick, Store, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  getMyProgram,
  updateMyProgram,
  listMyAffiliates,
  listMyCommissions,
  markCommissionPaid,
  listMyPromotions,
} from "@/lib/creator-affiliate.functions";

export const Route = createFileRoute("/_authenticated/dashboard/affiliate")({
  component: AffiliatePage,
});

type ProgramRow = { enabled: boolean; commission_rate_pct: number; terms: string | null };
type AffiliateRow = Awaited<ReturnType<typeof listMyAffiliates>>[number];
type CommissionRow = Awaited<ReturnType<typeof listMyCommissions>>[number];
type PromotionRow = Awaited<ReturnType<typeof listMyPromotions>>[number];

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function AffiliatePage() {
  const { user } = useAuth();
  const [isSeller, setIsSeller] = useState(false);
  const [brandSlug, setBrandSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [affiliates, setAffiliates] = useState<AffiliateRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [saving, setSaving] = useState(false);

  const getProgramFn = useServerFn(getMyProgram);
  const updateProgramFn = useServerFn(updateMyProgram);
  const listAffFn = useServerFn(listMyAffiliates);
  const listCommFn = useServerFn(listMyCommissions);
  const markPaidFn = useServerFn(markCommissionPaid);
  const listPromoFn = useServerFn(listMyPromotions);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) return;
      setLoading(true);

      // Check if seller (approved application)
      const { data: app } = await supabase
        .from("seller_applications")
        .select("brand_slug, status")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();

      const seller = !!app;
      const slug = (app as any)?.brand_slug ?? null;

      const [pg, promos, comms, affs] = await Promise.all([
        seller ? getProgramFn() : Promise.resolve(null),
        listPromoFn(),
        seller ? listCommFn() : Promise.resolve([]),
        seller ? listAffFn() : Promise.resolve([]),
      ]);

      if (cancelled) return;
      setIsSeller(seller);
      setBrandSlug(slug);
      setProgram(pg as any);
      setPromotions(promos as any);
      setCommissions(comms as any);
      setAffiliates(affs as any);
      setLoading(false);
    }
    load().catch((e) => {
      console.error(e);
      toast.error("Failed to load affiliate data");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user, getProgramFn, listAffFn, listCommFn, listPromoFn]);

  const totalOwed = useMemo(
    () =>
      commissions
        .filter((c) => c.status === "pending")
        .reduce((sum, c) => sum + c.commission_cents, 0),
    [commissions],
  );
  const totalPaid = useMemo(
    () =>
      commissions
        .filter((c) => c.status === "paid")
        .reduce((sum, c) => sum + c.commission_cents, 0),
    [commissions],
  );
  const totalEarned = useMemo(
    () => promotions.reduce((sum, p) => sum + p.earned_cents, 0),
    [promotions],
  );
  const totalPending = useMemo(
    () => promotions.reduce((sum, p) => sum + p.pending_cents, 0),
    [promotions],
  );

  async function saveProgram() {
    if (!program) return;
    setSaving(true);
    try {
      await updateProgramFn({
        data: {
          enabled: program.enabled,
          commission_rate_pct: program.commission_rate_pct,
          terms: program.terms,
        },
      });
      toast.success("Program updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Copied to clipboard"))
      .catch(() => toast.error("Copy failed"));
  }

  const joinUrl = brandSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/a/${brandSlug}`
    : null;

  async function handleMarkPaid(id: string) {
    try {
      await markPaidFn({ data: { id } });
      setCommissions((prev) => prev.map((c) => (c.id === id ? { ...c, status: "paid" } : c)));
      toast.success("Marked paid");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  return (
    <PublisherShell accent={ACCENTS.earn}>
      <div className="mx-auto max-w-6xl px-4 md:px-8 py-8 space-y-10">
        <header className="space-y-2">
          <h1 className="font-serif text-3xl md:text-4xl text-navy">Affiliate program</h1>
          <p className="text-slate-600 text-sm max-w-2xl">
            Earn commissions by promoting other creators, or invite others to promote your products.
            Commissions are tracked here — you settle payments with affiliates directly.
          </p>
        </header>

        {loading && <div className="text-slate-500">Loading…</div>}

        {!loading && isSeller && program && (
          <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70 p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-3">
              <Store className="w-5 h-5 text-emerald-700" />
              <h2 className="font-serif text-xl text-navy">Your affiliate program</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 border border-slate-200">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={program.enabled}
                  onChange={(e) => setProgram({ ...program, enabled: e.target.checked })}
                />
                <div>
                  <div className="font-medium text-navy">Enable program</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Let others promote your products for a commission.
                  </div>
                </div>
              </label>

              <label className="rounded-xl bg-slate-50 p-4 border border-slate-200 block">
                <div className="font-medium text-navy mb-1">Commission rate</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    step={0.5}
                    value={program.commission_rate_pct}
                    onChange={(e) =>
                      setProgram({ ...program, commission_rate_pct: Number(e.target.value) })
                    }
                    className="w-24 rounded-md border border-slate-300 px-2 py-1"
                  />
                  <span className="text-slate-600">%</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">Between 1% and 50%.</div>
              </label>

              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <div className="font-medium text-navy mb-1">Share join link</div>
                {joinUrl ? (
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={joinUrl}
                      className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                    <button
                      onClick={() => copy(joinUrl)}
                      className="p-2 rounded-md bg-navy text-white hover:bg-navy/90"
                      aria-label="Copy"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-amber-700">
                    Set a brand slug in your storefront to share a join URL.
                  </div>
                )}
              </div>
            </div>

            <label className="block">
              <div className="font-medium text-navy mb-1">Terms (optional)</div>
              <textarea
                rows={3}
                value={program.terms ?? ""}
                onChange={(e) => setProgram({ ...program, terms: e.target.value })}
                placeholder="Rules affiliates should follow (e.g. no paid search on brand terms)"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <div className="flex justify-end">
              <button
                onClick={saveProgram}
                disabled={saving}
                className="rounded-md bg-emerald-700 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-800 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              <StatCard icon={<Users className="w-4 h-4" />} label="Affiliates" value={affiliates.length.toString()} />
              <StatCard icon={<MousePointerClick className="w-4 h-4" />} label="Total clicks" value={affiliates.reduce((s, a) => s + a.clicks, 0).toString()} />
              <StatCard icon={<DollarSign className="w-4 h-4" />} label="Commissions owed" value={fmt(totalOwed)} />
              <StatCard icon={<DollarSign className="w-4 h-4" />} label="Commissions paid" value={fmt(totalPaid)} />
            </div>

            {affiliates.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">Affiliate</th>
                      <th className="text-left px-3 py-2">Code</th>
                      <th className="text-right px-3 py-2">Clicks</th>
                      <th className="text-right px-3 py-2">Sales</th>
                      <th className="text-right px-3 py-2">Earned</th>
                      <th className="text-right px-3 py-2">Owed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {affiliates.map((a) => (
                      <tr key={a.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">{a.display_name}</td>
                        <td className="px-3 py-2 font-mono text-xs">{a.referral_code}</td>
                        <td className="px-3 py-2 text-right">{a.clicks}</td>
                        <td className="px-3 py-2 text-right">{a.sales}</td>
                        <td className="px-3 py-2 text-right">{fmt(a.earned_cents)}</td>
                        <td className="px-3 py-2 text-right font-medium">{fmt(a.owed_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {commissions.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-navy">Recent commissions</h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                      <tr>
                        <th className="text-left px-3 py-2">Date</th>
                        <th className="text-left px-3 py-2">Code</th>
                        <th className="text-right px-3 py-2">Sale</th>
                        <th className="text-right px-3 py-2">Rate</th>
                        <th className="text-right px-3 py-2">Commission</th>
                        <th className="text-left px-3 py-2">Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {commissions.map((c) => (
                        <tr key={c.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-xs text-slate-600">
                            {new Date(c.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{c.referral_code}</td>
                          <td className="px-3 py-2 text-right">{fmt(c.sale_amount_cents)}</td>
                          <td className="px-3 py-2 text-right">{c.commission_rate_pct}%</td>
                          <td className="px-3 py-2 text-right font-medium">{fmt(c.commission_cents)}</td>
                          <td className="px-3 py-2">
                            <span
                              className={
                                "inline-block px-2 py-0.5 rounded-full text-xs " +
                                (c.status === "paid"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : c.status === "void"
                                    ? "bg-slate-100 text-slate-600"
                                    : "bg-amber-100 text-amber-800")
                              }
                            >
                              {c.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {c.status === "pending" && (
                              <button
                                onClick={() => handleMarkPaid(c.id)}
                                className="text-xs text-emerald-700 hover:underline"
                              >
                                Mark paid
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70 p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <Share2 className="w-5 h-5 text-navy" />
            <h2 className="font-serif text-xl text-navy">Products you promote</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard icon={<Users className="w-4 h-4" />} label="Creators" value={promotions.length.toString()} />
            <StatCard icon={<DollarSign className="w-4 h-4" />} label="Earned" value={fmt(totalEarned)} />
            <StatCard icon={<DollarSign className="w-4 h-4" />} label="Pending" value={fmt(totalPending)} />
          </div>

          {promotions.length === 0 && !loading && (
            <div className="rounded-xl bg-slate-50 p-6 text-sm text-slate-600 border border-dashed border-slate-300">
              You aren't promoting anyone yet. Ask a creator for their affiliate link, or visit their
              storefront to check if their program is open.
            </div>
          )}

          {promotions.length > 0 && (
            <div className="space-y-3">
              {promotions.map((p) => {
                const url =
                  typeof window !== "undefined"
                    ? `${window.location.origin}/creator/${p.brand_slug ?? p.creator_id}?ref=${p.referral_code}`
                    : `?ref=${p.referral_code}`;
                return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center gap-4"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {p.cover_url ? (
                        <img
                          src={p.cover_url}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-navy truncate">{p.brand_name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
                          <span>{p.clicks} clicks</span>
                          <span>{p.sales} sales</span>
                          <span>Earned {fmt(p.earned_cents)}</span>
                          {p.brand_slug && (
                            <Link
                              to="/a/$brandSlug"
                              params={{ brandSlug: p.brand_slug }}
                              className="text-emerald-700 hover:underline inline-flex items-center gap-1"
                            >
                              Terms <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <input
                        readOnly
                        value={url}
                        className="flex-1 md:w-80 rounded-md border border-slate-300 px-2 py-1 text-xs font-mono"
                      />
                      <button
                        onClick={() => copy(url)}
                        className="p-2 rounded-md bg-navy text-white hover:bg-navy/90"
                        aria-label="Copy link"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </PublisherShell>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="text-xl font-semibold text-navy mt-1">{value}</div>
    </div>
  );
}
