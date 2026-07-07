import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Minus, Plus, ShieldCheck, ShoppingBag, Tag, Trash2, Truck } from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { ProductCover } from "@/components/marketplace/ProductCover";
import { useCart } from "@/hooks/use-av-store";
import { StripeEmbeddedCartCheckout } from "@/components/StripeEmbeddedCheckout";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Cart — AurumVault" },
      { name: "description", content: "Review your AurumVault cart and checkout securely." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CartPage,
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback error={error} reset={reset} title="Cart isn't loading" />
  ),
});

const PROMO_CODES: Record<string, { kind: "pct" | "flat"; value: number; label: string }> = {
  AURUM10: { kind: "pct", value: 10, label: "10% off" },
  VAULT20: { kind: "pct", value: 20, label: "20% off" },
  FIRST5: { kind: "flat", value: 5, label: "$5 off" },
};

function CartPage() {
  const cart = useCart();
  const [promo, setPromo] = useState("");
  const [promoError, setPromoError] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  const promoDef = appliedPromo ? PROMO_CODES[appliedPromo] : null;
  const discount =
    promoDef?.kind === "pct"
      ? +(cart.subtotal * (promoDef.value / 100)).toFixed(2)
      : promoDef
        ? Math.min(promoDef.value, cart.subtotal)
        : 0;
  const total = Math.max(0, cart.subtotal - discount);

  const applyPromo = () => {
    const code = promo.trim().toUpperCase();
    if (!code) return;
    if (!PROMO_CODES[code]) {
      setPromoError("That code isn't valid.");
      setAppliedPromo(null);
      return;
    }
    setAppliedPromo(code);
    setPromoError("");
  };

  return (
    <MarketShell>
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">
          Shopping Cart
        </h1>
        <p className="mt-1 text-sm text-mute">
          {cart.count} {cart.count === 1 ? "item" : "items"}
        </p>

        {cart.items.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-line bg-white py-16 text-center">
            <ShoppingBag size={36} className="mx-auto text-gold-ink" />
            <p className="mt-4 font-display text-xl font-bold text-ink">Your cart is empty</p>
            <p className="mt-1 text-sm text-mute">Discover premium digital products in the Vault.</p>
            <Link
              to="/products"
              className="mt-6 inline-block rounded-full bg-gold px-6 py-2.5 text-sm font-bold text-navy"
            >
              Browse the Vault
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
            {/* Items */}
            <ul className="space-y-3">
              {cart.items.map((it) => (
                <li
                  key={it.id}
                  className="flex gap-4 rounded-xl border border-line bg-white p-4"
                >
                  <Link
                    to="/products/$id"
                    params={{ id: it.id }}
                    className="block h-28 w-24 flex-shrink-0 overflow-hidden rounded bg-[#f5f4ef]"
                  >
                    <ProductCover
                      title={it.title}
                      category={it.category}
                      productId={it.id}
                      className="h-full w-full object-cover"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[10px] font-semibold uppercase tracking-caps text-gold-ink">
                      {it.category}
                    </span>
                    <Link
                      to="/products/$id"
                      params={{ id: it.id }}
                      className="line-clamp-2 font-display font-bold text-ink hover:text-navy"
                    >
                      {it.title}
                    </Link>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="inline-flex items-center rounded-full border border-line">
                        <button
                          aria-label="Decrease"
                          onClick={() => cart.setQty(it.id, it.qty - 1)}
                          className="flex h-8 w-8 items-center justify-center text-mute hover:text-ink"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-7 text-center text-sm font-bold text-ink">{it.qty}</span>
                        <button
                          aria-label="Increase"
                          onClick={() => cart.setQty(it.id, it.qty + 1)}
                          className="flex h-8 w-8 items-center justify-center text-mute hover:text-ink"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => cart.remove(it.id)}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-mute hover:bg-muted hover:text-red-600"
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                  </div>
                  <div className="font-display text-lg font-bold text-gold-ink tabular-nums whitespace-nowrap">
                    ${(it.price * it.qty).toFixed(2)}
                  </div>
                </li>
              ))}
            </ul>

            {/* Summary */}
            <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start">
              <div className="rounded-xl border border-line bg-white p-5">
                <h2 className="font-display text-lg font-bold text-ink">Order Summary</h2>
                <div className="mt-4 space-y-2 text-sm">
                  <Row label="Subtotal" value={`$${cart.subtotal.toFixed(2)}`} />
                  {discount > 0 && (
                    <Row label="Discount" value={`-$${discount.toFixed(2)}`} accent />
                  )}
                  <Row label="Delivery" value="Instant" />
                  <div className="flex items-center justify-between border-t border-line pt-3 text-base font-bold text-ink">
                    <span>Total</span>
                    <span className="font-display text-xl text-gold-ink">${total.toFixed(2)}</span>
                  </div>
                </div>

                <label className="mt-5 mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-caps text-mute">
                  <Tag size={12} /> Promo code
                </label>
                <div className="flex gap-2">
                  <input
                    value={promo}
                    onChange={(e) => {
                      setPromo(e.target.value);
                      setPromoError("");
                    }}
                    placeholder="AURUM10"
                    className="h-10 flex-1 rounded-full border border-line bg-white px-4 text-sm uppercase tracking-wider text-ink focus:border-gold focus:outline-none"
                  />
                  <button
                    onClick={applyPromo}
                    className="rounded-full bg-navy px-4 text-xs font-bold text-white hover:bg-navy/90"
                  >
                    Apply
                  </button>
                </div>
                {promoError && <p className="mt-1 text-xs text-red-500">{promoError}</p>}
                {appliedPromo && (
                  <p className="mt-1 text-xs font-semibold text-emerald-600">
                    ✓ {appliedPromo} applied — {PROMO_CODES[appliedPromo].label}
                  </p>
                )}

                <button
                  onClick={() => setShowCheckout(true)}
                  disabled={total < 0.5}
                  className="mt-5 w-full rounded-full bg-gold py-3 text-sm font-bold text-navy shadow-gold-glow transition disabled:opacity-50"
                >
                  Proceed to Checkout
                </button>
                <p className="mt-2 text-center text-[11px] text-mute">
                  Secure payment · 30-day money-back guarantee
                </p>
              </div>

              <ul className="space-y-2 rounded-xl border border-line bg-[#fafaf7] p-4 text-xs text-mute">
                <li className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-gold-ink" /> SSL-encrypted checkout
                </li>
                <li className="flex items-center gap-2">
                  <Truck size={14} className="text-gold-ink" /> Instant digital delivery
                </li>
              </ul>
            </aside>
          </div>
        )}

        {/* Inline checkout panel */}
        {showCheckout && cart.items.length > 0 && (
          <div className="mt-10 rounded-2xl border border-line bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-ink">Secure Checkout</h2>
              <button
                onClick={() => setShowCheckout(false)}
                className="text-xs font-semibold text-mute hover:text-ink"
              >
                ← Back to cart
              </button>
            </div>
            <CheckoutMount items={cart.items} promoCode={appliedPromo} />
          </div>
        )}
      </div>
    </MarketShell>
  );
}

function CheckoutMount({
  items,
  promoCode,
}: {
  items: ReturnType<typeof useCart>["items"];
  promoCode: string | null;
}) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-mute">
        <Loader2 className="mr-2 animate-spin" size={14} /> Preparing checkout...
      </div>
    );
  }
  return <StripeEmbeddedCartCheckout items={items} promoCode={promoCode} />;
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-mute">{label}</span>
      <span
        className={`font-semibold tabular-nums ${accent ? "text-emerald-600" : "text-ink"}`}
      >
        {value}
      </span>
    </div>
  );
}
