type QueryClient = any;

function utcDayBounds(now: Date): { start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 86_400_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function sumPurchaseAmounts(rows: Array<{ amount?: number | string | null }>): number {
  return rows.reduce((total, row) => {
    const amount = typeof row.amount === "string" ? Number(row.amount) : row.amount;
    return typeof amount === "number" && Number.isFinite(amount) && amount > 0 ? total + amount : total;
  }, 0);
}

/**
 * Computes spend from server-recorded EXECUTION receipts for the current UTC day.
 * Receipt `created_at` is database generated and therefore cannot be shifted by an
 * API caller supplying a forged execution timestamp.
 */
export async function loadRecordedDailyPurchaseSpend(input: {
  client: QueryClient;
  workspaceId: string;
  passportId: string;
  now?: Date;
}): Promise<number> {
  const { start, end } = utcDayBounds(input.now ?? new Date());
  const { data: receipts, error: receiptError } = await input.client
    .from("authorization_receipts")
    .select("action_request_id")
    .eq("workspace_id", input.workspaceId)
    .eq("passport_id", input.passportId)
    .eq("receipt_kind", "EXECUTION")
    .eq("execution_status", "EXECUTED")
    .gte("created_at", start)
    .lt("created_at", end);
  if (receiptError) throw receiptError;

  const requestIds = [...new Set((receipts ?? []).map((row: any) => row.action_request_id).filter(Boolean))];
  if (requestIds.length === 0) return 0;

  const { data: requests, error: requestError } = await input.client
    .from("action_requests")
    .select("amount")
    .eq("workspace_id", input.workspaceId)
    .eq("passport_id", input.passportId)
    .eq("amount_kind", "PURCHASE")
    .in("id", requestIds);
  if (requestError) throw requestError;

  return sumPurchaseAmounts(requests ?? []);
}
