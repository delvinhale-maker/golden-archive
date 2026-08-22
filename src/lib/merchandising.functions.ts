import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type OrderLine, type PeriodMetrics, pctChange, summarizePeriod } from "@/lib/merchandising";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function assertAdmin(context: any) {
  const { data: role } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) throw new Error("Forbidden");
}

export type MerchandisingReport = {
  days: number;
  current: PeriodMetrics;
  previous: PeriodMetrics;
  aovChangePct: number | null;
  attachChangePct: number | null;
  surfaces: { surface: string; impressions: number; clicks: number; ctrPct: number | null }[];
  bundles: {
    id: string;
    name: string;
    impressions: number;
    clicks: number;
    addToCart: number;
    orders: number;
    revenueCents: number;
    conversionPct: number | null;
  }[];
  weakestStep: string | null;
};

export const getMerchandisingReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { days?: number } | undefined) => {
    const days = input?.days ?? 30;
    if (![7, 30, 90].includes(days)) throw new Error("Invalid range");
    return { days };
  })
  .handler(async ({ data, context }): Promise<MerchandisingReport> => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const days = data.days;
    const now = Date.now();
    const startCurrent = new Date(now - days * 86400000).toISOString();
    const startPrevious = new Date(now - days * 2 * 86400000).toISOString();

    const { data: orderRows } = await sb
      .from("orders")
      .select("id,created_at,status")
      .gte("created_at", startPrevious)
      .limit(10000);
    const orders = ((orderRows ?? []) as any[]).filter((o) =>
      ["paid", "completed", "fulfilled"].includes(o.status),
    );
    const orderIds = orders.map((o) => o.id);

    const { data: lineRows } = orderIds.length
      ? await sb
          .from("order_items")
          .select("order_id,unit_amount_cents,bundle_id,is_bump")
          .in("order_id", orderIds)
          .limit(20000)
      : { data: [] };

    const createdAt = new Map(orders.map((o) => [o.id, o.created_at as string]));
    const toLine = (l: any): OrderLine => ({
      orderId: l.order_id,
      amountCents: Number(l.unit_amount_cents ?? 0),
      bundleId: l.bundle_id ?? null,
      isBump: !!l.is_bump,
    });
    const allLines = ((lineRows ?? []) as any[]).map((l) => ({
      line: toLine(l),
      at: createdAt.get(l.order_id) ?? "",
    }));

    const currentLines = allLines.filter((x) => x.at >= startCurrent).map((x) => x.line);
    const previousLines = allLines
      .filter((x) => x.at < startCurrent && x.at >= startPrevious)
      .map((x) => x.line);

    const current = summarizePeriod(currentLines);
    const previous = summarizePeriod(previousLines);

    const { data: eventRows } = await sb
      .from("merch_events")
      .select("kind,surface,bundle_id")
      .gte("created_at", startCurrent)
      .limit(50000);
    const events = (eventRows ?? []) as any[];

    const surfaceKeys = Array.from(new Set(events.map((e) => e.surface)));
    const surfaces = surfaceKeys.map((surface) => {
      const impressions = events.filter(
        (e) => e.surface === surface && e.kind === "impression",
      ).length;
      const clicks = events.filter((e) => e.surface === surface && e.kind === "click").length;
      return {
        surface,
        impressions,
        clicks,
        ctrPct: impressions > 0 ? +((clicks / impressions) * 100).toFixed(1) : null,
      };
    });

    const { data: bundleRows } = await sb
      .from("marketplace_bundles")
      .select("id,name")
      .limit(200);
    const bundles = ((bundleRows ?? []) as any[]).map((b) => {
      const evs = events.filter((e) => e.bundle_id === b.id);
      const ls = currentLines.filter((l) => l.bundleId === b.id);
      const bundleOrderIds = new Set(ls.map((l) => l.orderId));
      const impressions = evs.filter((e) => e.kind === "impression").length;
      return {
        id: b.id as string,
        name: b.name as string,
        impressions,
        clicks: evs.filter((e) => e.kind === "click").length,
        addToCart: evs.filter((e) => e.kind === "add_to_cart").length,
        orders: bundleOrderIds.size,
        revenueCents: ls.reduce((n, l) => n + l.amountCents, 0),
        conversionPct:
          impressions > 0 ? +((bundleOrderIds.size / impressions) * 100).toFixed(1) : null,
      };
    });

    // Weakest step: the funnel hop with the biggest proportional drop, only
    // reported when there is enough data to be meaningful.
    let weakestStep: string | null = null;
    const totalImpressions = events.filter((e) => e.kind === "impression").length;
    const totalClicks = events.filter((e) => e.kind === "click").length;
    const totalAdds = events.filter((e) => e.kind === "add_to_cart").length;
    if (totalImpressions >= 20) {
      const hops: { label: string; rate: number }[] = [
        { label: "View → Click", rate: totalClicks / Math.max(1, totalImpressions) },
        { label: "Click → Add to cart", rate: totalAdds / Math.max(1, totalClicks) },
        {
          label: "Add to cart → Purchase",
          rate: current.bundleOrders / Math.max(1, totalAdds),
        },
      ];
      weakestStep = hops.sort((a, b) => a.rate - b.rate)[0]!.label;
    }

    return {
      days,
      current,
      previous,
      aovChangePct: pctChange(current.aovCents, previous.aovCents),
      attachChangePct: pctChange(current.bundleAttachRatePct, previous.bundleAttachRatePct),
      surfaces: surfaces.sort((a, b) => b.impressions - a.impressions),
      bundles: bundles.sort((a, b) => b.revenueCents - a.revenueCents),
      weakestStep,
    };
  });

/* ------------------------- Recommendation admin ------------------------- */

export type RecommendationRow = {
  id: string;
  productId: string;
  productTitle: string;
  kind: string;
  position: number;
  active: boolean;
  targetLabel: string;
  targetType: "product" | "bundle";
};

export const adminListRecommendations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecommendationRow[]> => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const { data: rows } = await sb
      .from("product_recommendations")
      .select("id,product_id,recommended_product_id,recommended_bundle_id,kind,position,active")
      .order("position", { ascending: true })
      .limit(500);
    const recs = (rows ?? []) as any[];
    if (!recs.length) return [];

    const productIds = Array.from(
      new Set(
        recs.flatMap((r) => [r.product_id, r.recommended_product_id].filter(Boolean)),
      ),
    );
    const bundleIds = Array.from(
      new Set(recs.map((r) => r.recommended_bundle_id).filter(Boolean)),
    );
    const { data: prods } = productIds.length
      ? await sb.from("marketplace_products").select("id,title").in("id", productIds)
      : { data: [] };
    const { data: bundles } = bundleIds.length
      ? await sb.from("marketplace_bundles").select("id,name").in("id", bundleIds)
      : { data: [] };
    const titleOf = new Map(((prods ?? []) as any[]).map((p) => [p.id, p.title]));
    const nameOf = new Map(((bundles ?? []) as any[]).map((b) => [b.id, b.name]));

    return recs.map((r) => ({
      id: r.id,
      productId: r.product_id,
      productTitle: titleOf.get(r.product_id) ?? "(removed product)",
      kind: r.kind,
      position: r.position,
      active: r.active,
      targetType: r.recommended_bundle_id ? "bundle" : "product",
      targetLabel: r.recommended_bundle_id
        ? `Bundle: ${nameOf.get(r.recommended_bundle_id) ?? "(removed)"}`
        : (titleOf.get(r.recommended_product_id) ?? "(removed product)"),
    }));
  });

export const adminSaveRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      productId: string;
      recommendedProductId?: string;
      recommendedBundleId?: string;
      kind: string;
      position?: number;
    }) => {
      if (!UUID_RE.test(input.productId)) throw new Error("Invalid productId");
      const hasProduct = !!input.recommendedProductId;
      const hasBundle = !!input.recommendedBundleId;
      if (hasProduct === hasBundle) {
        throw new Error("Pick exactly one target — a product or a bundle");
      }
      if (hasProduct && !UUID_RE.test(input.recommendedProductId!)) {
        throw new Error("Invalid target product");
      }
      if (hasBundle && !UUID_RE.test(input.recommendedBundleId!)) {
        throw new Error("Invalid target bundle");
      }
      if (input.recommendedProductId === input.productId) {
        throw new Error("A product cannot recommend itself");
      }
      if (!["toolkit", "pairs_with", "also_need", "continue"].includes(input.kind)) {
        throw new Error("Invalid kind");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any)
      .from("product_recommendations")
      .insert({
        product_id: data.productId,
        recommended_product_id: data.recommendedProductId ?? null,
        recommended_bundle_id: data.recommendedBundleId ?? null,
        kind: data.kind,
        position: data.position ?? 10,
        active: true,
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!UUID_RE.test(input.id)) throw new Error("Invalid id");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any)
      .from("product_recommendations")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
