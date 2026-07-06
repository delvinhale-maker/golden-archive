import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyOrderBumps,
  listMyProductsForBumpPicker,
  upsertOrderBump,
  deleteOrderBump,
} from "@/lib/order-bumps.functions";

export const Route = createFileRoute("/_authenticated/dashboard/bumps/$id")({
  component: BumpsPage,
});

type Row = {
  id?: string;
  bumpProductId: string;
  discountPercent: number;
  sortOrder: number;
};

const MAX = 3;

function BumpsPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<Row[]>([]);
  const [products, setProducts] = useState<
    { id: string; title: string; price_cents: number }[]
  >([]);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: prod } = await supabase
          .from("marketplace_products")
          .select("title,seller_id")
          .eq("id", id)
          .maybeSingle();
        if (cancelled) return;
        if (!prod || prod.seller_id !== user.id) {
          toast.error("You don't have access to this product");
          navigate({ to: "/dashboard" });
          return;
        }
        setTitle(prod.title);
        const [bumps, myProducts] = await Promise.all([
          listMyOrderBumps({ data: { productId: id } }),
          listMyProductsForBumpPicker({ data: { excludeProductId: id } }),
        ]);
        if (cancelled) return;
        setExisting(
          (bumps as any[]).map((b) => ({
            id: b.id,
            bumpProductId: b.bump_product_id,
            discountPercent: b.discount_percent,
            sortOrder: b.sort_order,
          })),
        );
        setProducts(myProducts as any);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user, authLoading, navigate]);

  const available = useMemo(
    () =>
      products.filter(
        (p) => !existing.some((e) => e.bumpProductId === p.id),
      ),
    [products, existing],
  );

  async function addBump(bumpProductId: string) {
    if (existing.length >= MAX) {
      toast.error(`Max ${MAX} bumps per product`);
      return;
    }
    try {
      await upsertOrderBump({
        data: {
          productId: id,
          bumpProductId,
          discountPercent: 0,
          sortOrder: existing.length,
        },
      });
      const bumps = await listMyOrderBumps({ data: { productId: id } });
      setExisting(
        (bumps as any[]).map((b) => ({
          id: b.id,
          bumpProductId: b.bump_product_id,
          discountPercent: b.discount_percent,
          sortOrder: b.sort_order,
        })),
      );
      toast.success("Bump added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function saveDiscount(row: Row, pct: number) {
    setSaving(true);
    try {
      await upsertOrderBump({
        data: {
          productId: id,
          bumpProductId: row.bumpProductId,
          discountPercent: pct,
          sortOrder: row.sortOrder,
        },
      });
      setExisting((rows) =>
        rows.map((r) =>
          r.bumpProductId === row.bumpProductId ? { ...r, discountPercent: pct } : r,
        ),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeBump(row: Row) {
    if (!row.id) return;
    if (!confirm("Remove this bump?")) return;
    try {
      await deleteOrderBump({ data: { bumpId: row.id } });
      setExisting((rows) => rows.filter((r) => r.id !== row.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  if (loading) {
    return (
      <PublisherShell accent={ACCENTS.publishStep2}>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <Loader2 className="mx-auto animate-spin text-gold" />
        </div>
      </PublisherShell>
    );
  }

  const byId = new Map(products.map((p) => [p.id, p]));

  return (
    <PublisherShell accent={ACCENTS.publishStep2}>
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <Link
          to="/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-sm text-mute hover:text-ink"
        >
          <ArrowLeft size={14} /> Back to Bookshelf
        </Link>
        <h1 className="font-display text-2xl font-bold text-ink md:text-3xl">
          Order bumps · {title}
        </h1>
        <p className="mt-2 text-sm text-mute">
          Offer up to {MAX} one-click upsells at checkout — from your own catalog. Great for
          checklists, templates, or bonus PDFs.
        </p>

        <div className="mt-8 space-y-3">
          {existing.length === 0 && (
            <div className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-sm text-mute">
              No bumps yet. Add one below.
            </div>
          )}
          {existing.map((row) => {
            const p = byId.get(row.bumpProductId);
            const base = p ? p.price_cents / 100 : 0;
            const bumpPrice = base * (1 - row.discountPercent / 100);
            return (
              <div
                key={row.bumpProductId}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-white p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-ink">
                    {p?.title ?? "(unavailable)"}
                  </div>
                  <div className="text-xs text-mute">
                    Base ${base.toFixed(2)} → Bump ${bumpPrice.toFixed(2)}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-mute">
                  Discount %
                  <input
                    type="number"
                    min={0}
                    max={90}
                    step={1}
                    value={row.discountPercent}
                    onChange={(e) => {
                      const pct = Math.max(0, Math.min(90, Number(e.target.value) || 0));
                      setExisting((rows) =>
                        rows.map((r) =>
                          r.bumpProductId === row.bumpProductId
                            ? { ...r, discountPercent: pct }
                            : r,
                        ),
                      );
                    }}
                    onBlur={(e) => saveDiscount(row, Number(e.target.value) || 0)}
                    className="w-16 rounded-lg border border-line px-2 py-1 text-sm outline-none focus:border-gold"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeBump(row)}
                  className="rounded-full p-2 text-red-600 hover:bg-red-50"
                  aria-label="Remove bump"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>

        {existing.length < MAX && (
          <div className="mt-6 rounded-xl border border-line bg-white p-5">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-caps text-mute">
              Add a bump
            </div>
            {available.length === 0 ? (
              <p className="text-sm text-mute">
                No eligible products. Publish more products first.
              </p>
            ) : (
              <div className="space-y-2">
                {available.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-ink">{p.title}</div>
                      <div className="text-xs text-mute">${(p.price_cents / 100).toFixed(2)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addBump(p.id)}
                      disabled={saving}
                      className="inline-flex h-8 items-center gap-1 rounded-full bg-navy px-3 text-xs font-bold text-white hover:brightness-110"
                    >
                      <Plus size={12} /> Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PublisherShell>
  );
}
