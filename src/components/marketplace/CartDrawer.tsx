import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Loader2, Minus, Plus, ShoppingBag, Tag, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart } from "@/hooks/use-av-store";
import { ProductCover } from "./ProductCover";
import { StripeEmbeddedCartCheckout } from "@/components/StripeEmbeddedCheckout";

const PROMO_CODES: Record<string, { kind: "pct" | "flat"; value: number; label: string }> = {
  AURUM10: { kind: "pct", value: 10, label: "10% off" },
  VAULT20: { kind: "pct", value: 20, label: "20% off" },
  FIRST5: { kind: "flat", value: 5, label: "$5 off" },
};

export function CartDrawer() {
  const cart = useCart();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"cart" | "checkout">("cart");
  const [promo, setPromo] = useState<string>("");
  const [promoError, setPromoError] = useState<string>("");
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      setStep("cart");
    };
    window.addEventListener("av:cart:open", onOpen);
    return () => window.removeEventListener("av:cart:open", onOpen);
  }, []);

  useEffect(() => {
    if (cart.items.length === 0 && step === "checkout") setStep("cart");
  }, [cart.items.length, step]);

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
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        >
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="flex items-center gap-2 font-display text-lg font-bold text-ink">
                <ShoppingBag size={18} className="text-gold" />
                {step === "cart" ? `Your Cart (${cart.count})` : "Secure Checkout"}
              </div>
              <div className="flex items-center gap-1">
                <Link
                  to="/cart"
                  onClick={() => setOpen(false)}
                  className="hidden items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-caps text-mute hover:bg-muted hover:text-ink sm:inline-flex"
                >
                  Full cart <ExternalLink size={11} />
                </Link>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close cart"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-mute hover:bg-muted"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Progress steps */}
            <ol className="flex items-center gap-2 border-b border-line bg-[#fafaf7] px-5 py-3 text-[11px] font-semibold uppercase tracking-caps">
              <Step active={step === "cart"} done={step === "checkout"} label="1. Cart" />
              <span className="h-px flex-1 bg-line" />
              <Step active={step === "checkout"} label="2. Payment" />
              <span className="h-px flex-1 bg-line" />
              <Step label="3. Delivery" />
            </ol>

            {/* Body */}
            {step === "cart" ? (
              <div className="flex flex-1 flex-col overflow-hidden">
                {cart.items.length === 0 ? (
                  <EmptyCart onClose={() => setOpen(false)} />
                ) : (
                  <>
                    <div className="flex-1 overflow-y-auto px-5 py-4">
                      <ul className="space-y-4">
                        {cart.items.map((it) => (
                          <li key={it.id} className="flex gap-3">
                            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-[#f5f4ef]">
                              <ProductCover
                                title={it.title}
                                category={it.category}
                                productId={it.id}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="flex flex-1 flex-col">
                              <div className="text-[10px] font-semibold uppercase tracking-caps text-gold">
                                {it.category}
                              </div>
                              <div className="line-clamp-2 text-sm font-semibold text-ink">
                                {it.title}
                              </div>
                              <div className="mt-1 flex items-center justify-between">
                                <div className="inline-flex items-center rounded-full border border-line">
                                  <button
                                    aria-label="Decrease"
                                    onClick={() => cart.setQty(it.id, it.qty - 1)}
                                    className="flex h-7 w-7 items-center justify-center text-mute hover:text-ink"
                                  >
                                    <Minus size={12} />
                                  </button>
                                  <span className="w-6 text-center text-xs font-bold text-ink">
                                    {it.qty}
                                  </span>
                                  <button
                                    aria-label="Increase"
                                    onClick={() => cart.setQty(it.id, it.qty + 1)}
                                    className="flex h-7 w-7 items-center justify-center text-mute hover:text-ink"
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
                                <div className="font-display text-sm font-bold text-gold">
                                  ${(it.price * it.qty).toFixed(2)}
                                </div>
                              </div>
                            </div>
                            <button
                              aria-label="Remove"
                              onClick={() => cart.remove(it.id)}
                              className="self-start text-mute hover:text-red-500"
                            >
                              <Trash2 size={14} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Promo */}
                    <div className="border-t border-line px-5 py-4">
                      <label className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-caps text-mute">
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
                      {promoError && (
                        <p className="mt-1 text-xs text-red-500">{promoError}</p>
                      )}
                      {appliedPromo && (
                        <p className="mt-1 text-xs font-semibold text-emerald">
                          ✓ {appliedPromo} applied — {PROMO_CODES[appliedPromo].label}
                        </p>
                      )}
                    </div>

                    {/* Summary */}
                    <div className="space-y-2 border-t border-line px-5 py-4 text-sm">
                      <Row label="Subtotal" value={`$${cart.subtotal.toFixed(2)}`} />
                      {discount > 0 && (
                        <Row
                          label="Discount"
                          value={`-$${discount.toFixed(2)}`}
                          accent
                        />
                      )}
                      <div className="flex items-center justify-between pt-2 text-base font-bold text-ink">
                        <span>Total</span>
                        <span className="font-display text-xl text-gold">
                          ${total.toFixed(2)}
                        </span>
                      </div>
                      <button
                        onClick={() => setStep("checkout")}
                        disabled={total < 0.5}
                        className="mt-3 w-full rounded-full bg-gold py-3 text-sm font-bold text-navy shadow-gold-glow transition disabled:opacity-50"
                      >
                        Proceed to Checkout
                      </button>
                      <p className="text-center text-[11px] text-mute">
                        Instant delivery · 30-day money-back guarantee
                      </p>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-1 flex-col overflow-y-auto p-3">
                <button
                  onClick={() => setStep("cart")}
                  className="mb-2 self-start text-xs font-semibold text-mute hover:text-ink"
                >
                  ← Back to cart
                </button>
                <CheckoutMount items={cart.items} promoCode={appliedPromo} />
              </div>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
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
      <div className="flex flex-1 items-center justify-center text-sm text-mute">
        <Loader2 className="mr-2 animate-spin" size={14} /> Preparing checkout...
      </div>
    );
  }
  return <StripeEmbeddedCartCheckout items={items} promoCode={promoCode} />;
}

function Step({ active, done, label }: { active?: boolean; done?: boolean; label: string }) {
  return (
    <li
      className={`${
        active ? "text-gold" : done ? "text-emerald" : "text-mute"
      }`}
    >
      {label}
    </li>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-mute">{label}</span>
      <span className={`${accent ? "text-emerald font-semibold" : "text-ink"}`}>
        {value}
      </span>
    </div>
  );
}

function EmptyCart({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f5f4ef]">
        <ShoppingBag size={28} className="text-gold" />
      </div>
      <h3 className="mt-5 font-display text-xl font-bold text-ink">
        Your vault is empty
      </h3>
      <p className="mt-1 max-w-xs text-sm text-mute">
        Add a purpose-driven resource and it will appear here, ready for instant delivery.
      </p>
      <Link
        to="/products"
        onClick={onClose}
        className="mt-6 rounded-full bg-gold px-6 py-2.5 text-sm font-bold text-navy"
      >
        Browse the Vault
      </Link>
    </div>
  );
}
