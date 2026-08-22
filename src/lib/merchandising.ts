/** Pure AOV / attach-rate math shared by the dashboard and its tests. */

export type OrderLine = {
  orderId: string;
  amountCents: number;
  bundleId: string | null;
  isBump: boolean;
};

export type PeriodMetrics = {
  orders: number;
  revenueCents: number;
  aovCents: number | null;
  itemsPerOrder: number | null;
  bundleOrders: number;
  bundleRevenueCents: number;
  bundleAttachRatePct: number | null;
  bumpAttachRatePct: number | null;
};

export function summarizePeriod(lines: OrderLine[]): PeriodMetrics {
  const orderIds = new Set(lines.map((l) => l.orderId));
  const orders = orderIds.size;
  const revenueCents = lines.reduce((n, l) => n + l.amountCents, 0);
  const bundleOrderIds = new Set(
    lines.filter((l) => l.bundleId).map((l) => l.orderId),
  );
  const bumpOrderIds = new Set(lines.filter((l) => l.isBump).map((l) => l.orderId));
  const bundleRevenueCents = lines
    .filter((l) => l.bundleId)
    .reduce((n, l) => n + l.amountCents, 0);

  return {
    orders,
    revenueCents,
    aovCents: orders > 0 ? Math.round(revenueCents / orders) : null,
    itemsPerOrder: orders > 0 ? +(lines.length / orders).toFixed(2) : null,
    bundleOrders: bundleOrderIds.size,
    bundleRevenueCents,
    bundleAttachRatePct:
      orders > 0 ? +((bundleOrderIds.size / orders) * 100).toFixed(1) : null,
    bumpAttachRatePct:
      orders > 0 ? +((bumpOrderIds.size / orders) * 100).toFixed(1) : null,
  };
}

export function pctChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return +(((current - previous) / previous) * 100).toFixed(1);
}
