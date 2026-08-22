import { logStorefrontEvent } from "@/lib/storefront.functions";

/**
 * Fire-and-forget storefront attribution from the browser. Never awaited and
 * never throws — a tracking failure must not affect what the visitor sees.
 */
export function trackStorefront(
  kind: "storefront_view" | "product_click" | "share" | "qr",
  creatorUserId: string,
  productId?: string | null,
) {
  try {
    const params =
      typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
    void logStorefrontEvent({
      data: {
        creatorUserId,
        kind,
        productId: productId ?? null,
        utmSource: params?.get("utm_source") ?? null,
        utmMedium: params?.get("utm_medium") ?? null,
        utmCampaign: params?.get("utm_campaign") ?? null,
      },
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
