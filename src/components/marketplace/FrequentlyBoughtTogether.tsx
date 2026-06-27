import { useEffect, useState } from "react";
import { Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { ProductCover } from "./ProductCover";
import { getProducts, type Product } from "@/lib/marketplace.functions";
import { useCart } from "@/hooks/use-av-store";

export function FrequentlyBoughtTogether({ product }: { product: Product }) {
  const [partners, setPartners] = useState<Product[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const cart = useCart();

  useEffect(() => {
    let active = true;
    getProducts({ data: { category: product.category, page: 1 } })
      .then((res) => {
        if (!active) return;
        const others = res.items.filter((p) => p.id !== product.id).slice(0, 2);
        setPartners(others);
        const init: Record<string, boolean> = { [product.id]: true };
        for (const p of others) init[p.id] = true;
        setPicked(init);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [product.id, product.category]);

  if (partners.length === 0) return null;

  const all = [product, ...partners];
  const selected = all.filter((p) => picked[p.id]);
  const total = selected.reduce((s, p) => s + Number(p.price), 0);

  const addAll = () => {
    for (const p of selected) {
      cart.add({
        id: p.id,
        title: p.title,
        price: Number(p.price),
        category: p.category,
        image: p.image,
      });
    }
    toast.success(`Added ${selected.length} item${selected.length === 1 ? "" : "s"} to cart`);
  };

  return (
    <section className="mt-12 rounded-2xl border border-line bg-white p-5 md:p-7">
      <h2 className="font-display text-xl font-bold text-ink md:text-2xl">
        Frequently bought together
      </h2>

      <div className="mt-5 flex flex-col items-stretch gap-4 md:flex-row md:items-center">
        <div className="flex flex-1 items-center gap-3 overflow-x-auto pb-1">
          {all.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3">
              <label className="flex w-[120px] shrink-0 cursor-pointer flex-col gap-2 md:w-[140px]">
                <div className="relative aspect-[1.6/1] overflow-hidden rounded-md bg-[#f5f4ef] ring-1 ring-line">
                  {p.image && /^https?:\/\//.test(p.image) ? (
                    <img
                      src={p.image}
                      alt={p.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ProductCover
                      title={p.title}
                      category={p.category}
                      productId={p.id}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={!!picked[p.id]}
                    onChange={(e) =>
                      setPicked((prev) => ({ ...prev, [p.id]: e.target.checked }))
                    }
                    className="mt-0.5 accent-[var(--gold)]"
                    disabled={i === 0}
                  />
                  <div className="min-w-0">
                    <div className="line-clamp-2 text-xs font-semibold text-ink">
                      {p.title}
                    </div>
                    <div className="mt-0.5 text-xs font-bold text-gold">
                      ${Number(p.price).toFixed(2)}
                    </div>
                  </div>
                </div>
              </label>
              {i < all.length - 1 && (
                <Plus size={16} className="shrink-0 text-mute" aria-hidden />
              )}
            </div>
          ))}
        </div>

        <div className="md:w-[220px]">
          <div className="text-xs uppercase tracking-caps text-mute">
            Bundle price
          </div>
          <div className="mt-1 font-display text-2xl font-bold text-ink">
            ${total.toFixed(2)}
          </div>
          <button
            type="button"
            onClick={addAll}
            disabled={selected.length === 0}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-bold text-navy shadow-gold-glow disabled:opacity-50"
          >
            <ShoppingCart size={14} /> Add {selected.length} to cart
          </button>
        </div>
      </div>
    </section>
  );
}
