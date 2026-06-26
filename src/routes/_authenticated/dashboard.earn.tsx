import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { DollarSign, BookOpen, ShoppingBag, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard/earn")({
  component: EarnPage,
});

type OrderItem = { price_cents: number; created_at: string };

function EarnPage() {
  const { user } = useAuth();
  const [titles, setTitles] = useState(0);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ count }, { data: oi }] = await Promise.all([
        supabase
          .from("marketplace_products")
          .select("id", { count: "exact", head: true })
          .eq("seller_id", user.id),
        supabase
          .from("order_items")
          .select("price_cents, created_at, marketplace_products!inner(seller_id)")
          .eq("marketplace_products.seller_id", user.id),
      ]);
      setTitles(count ?? 0);
      setItems(((oi ?? []) as unknown) as OrderItem[]);
      setLoading(false);
    })();
  }, [user]);

  const ROYALTY = 0.91; // creator share (AurumVault takes 9%)
  const totalGross = items.reduce((s, i) => s + i.price_cents, 0) / 100;
  const totalRoyalty = totalGross * ROYALTY;
  const unitsSold = items.length;

  // monthly bar chart (last 6 months)
  const now = new Date();
  const months: { key: string; label: string; sales: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString(undefined, { month: "short" }),
      sales: 0,
    });
  }
  let monthRoyalty = 0;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  for (const it of items) {
    const d = new Date(it.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const m = months.find((x) => x.key === key);
    if (m) m.sales += (it.price_cents * ROYALTY) / 100;
    if (d >= monthStart) monthRoyalty += (it.price_cents * ROYALTY) / 100;
  }

  return (
    <PublisherShell accent={ACCENTS.earn}>
      <h1 className="font-display text-3xl md:text-4xl text-navy">Earn</h1>
      <p className="mt-1 text-mute">Your AurumVault royalty performance.</p>

      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<DollarSign size={18} />} label="Total Earnings" value={`$${totalRoyalty.toFixed(2)}`} />
        <StatCard icon={<BookOpen size={18} />} label="Titles" value={String(titles)} />
        <StatCard icon={<ShoppingBag size={18} />} label="Units Sold" value={String(unitsSold)} />
        <StatCard icon={<TrendingUp size={18} />} label="This Month" value={`$${monthRoyalty.toFixed(2)}`} />
      </div>

      <section className="mt-8 rounded-2xl bg-white border border-ink/10 p-6">
        <h2 className="font-display text-xl text-navy">Monthly royalties</h2>
        <p className="text-xs text-mute mt-1">Last 6 months. Royalty = 91% of net sale price.</p>
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
                  formatter={(v: number) => [`$${v.toFixed(2)}`, "Royalty"]}
                />
                <Bar dataKey="sales" fill="var(--page-accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-2xl bg-white border border-ink/10 p-6">
        <h3 className="font-display text-lg text-navy">How payouts work</h3>
        <p className="mt-2 text-sm text-mute">
          AurumVault takes <strong className="text-navy">9%</strong> per sale. You keep <strong className="text-navy">91%</strong>.
          Stripe Connect payouts roll out in Stage 2.
        </p>
      </section>
    </PublisherShell>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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
    </div>
  );
}
