import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createProductCheckout } from "@/lib/payments.functions";

interface Props {
  productId: string;
  returnUrl?: string;
}

export function StripeEmbeddedProductCheckout({ productId, returnUrl }: Props) {
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
