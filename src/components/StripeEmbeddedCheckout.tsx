import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createProductCheckout, createCartCheckout } from "@/lib/payments.functions";
import type { CartItem } from "@/hooks/use-av-store";

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

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}

interface CartProps {
  items: CartItem[];
  promoCode?: string | null;
  returnUrl?: string;
}

export function StripeEmbeddedCartCheckout({ items, promoCode, returnUrl }: CartProps) {
  const fetchClientSecret = async (): Promise<string> => {
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

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
