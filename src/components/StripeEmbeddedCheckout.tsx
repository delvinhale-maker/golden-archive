import { useEffect, useRef, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createProductCheckout, createCartCheckout } from "@/lib/payments.functions";
import type { CartItem } from "@/hooks/use-av-store";
import { AlertCircle, Loader2 } from "lucide-react";

const SKELETON_TIMEOUT_MS = 12000;

function CheckoutFrame({
  fetchClientSecret,
}: {
  fetchClientSecret: () => Promise<string>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [stuck, setStuck] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const startedAt = useRef<number>(Date.now());

  // Wrap so we can capture failures from Stripe's internal call.
  const wrapped = async () => {
    try {
      const cs = await fetchClientSecret();
      return cs;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
      throw err;
    }
  };

  useEffect(() => {
    startedAt.current = Date.now();
    setStuck(false);
    const t = setTimeout(() => setStuck(true), SKELETON_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [attempt]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Checkout couldn't start.</p>
            <p className="mt-1 text-red-700/90">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setAttempt((a) => a + 1);
              }}
              className="mt-3 rounded-full bg-navy px-4 py-1.5 text-xs font-bold text-white"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="checkout" className="relative">
      <EmbeddedCheckoutProvider
        key={attempt}
        stripe={getStripe()}
        options={{ fetchClientSecret: wrapped }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
      {stuck && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <span className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Checkout is taking longer than usual.
          </span>
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            className="rounded-full bg-amber-600 px-3 py-1 font-semibold text-white"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

interface ProductProps {
  productId: string;
  returnUrl?: string;
}

export function StripeEmbeddedProductCheckout({ productId, returnUrl }: ProductProps) {
  const fetchClientSecret = async (): Promise<string> => {
    const result = await createProductCheckout({
      data: {
        productId,
        returnUrl:
          returnUrl ??
          `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Stripe did not return a client secret");
    return result.clientSecret;
  };

  return <CheckoutFrame fetchClientSecret={fetchClientSecret} />;
}

interface CartProps {
  items: CartItem[];
  promoCode?: string | null;
  returnUrl?: string;
}

export function StripeEmbeddedCartCheckout({ items, promoCode, returnUrl }: CartProps) {
  const fetchClientSecret = async (): Promise<string> => {
    if (!items.length) throw new Error("Your cart is empty.");
    const result = await createCartCheckout({
      data: {
        items: items.map((i) => ({
          id: i.id,
          title: i.title,
          priceCents: Math.round(i.price * 100),
          qty: i.qty,
        })),
        promoCode: promoCode ?? undefined,
        returnUrl:
          returnUrl ??
          `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Stripe did not return a client secret");
    return result.clientSecret;
  };

  return <CheckoutFrame fetchClientSecret={fetchClientSecret} />;
}

