import { logMerchEvent } from "@/lib/bundles.functions";
import { getSessionId } from "@/lib/cta-tracking";
import type { MerchSurface } from "@/lib/bundles";

/**
 * Fire-and-forget merchandising analytics from the browser. Never awaited by
 * the UI and never throws — tracking must not delay a click or an add-to-cart.
 */
export function trackMerch(
  kind: "impression" | "click" | "add_to_cart" | "upgrade",
  surface: MerchSurface,
  opts: { bundleId?: string; productId?: string; offerVersion?: string; amountCents?: number } = {},
) {
  try {
    void logMerchEvent({
      data: {
        kind,
        surface,
        sessionId: getSessionId(),
        ...opts,
      },
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
