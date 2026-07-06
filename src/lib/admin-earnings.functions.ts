import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type AdminEarningsSummary = {
  gross_revenue_cents: number;
  platform_fees_cents: number;
  creator_earnings_cents: number;
  paid_out_cents: number;
  pending_balance_cents: number;
  order_count: number;
  seller_count: number;
  pending_request_count: number;
  currency: string;
};

export type AdminPayoutRequest = {
  id: string;
  seller_id: string;
  seller_name: string | null;
  amount_cents: number;
  currency: string;
  status: "pending" | "approved" | "rejected" | "paid";
  seller_note: string | null;
  admin_note: string | null;
  method_snapshot: Record<string, string> | null;
  created_at: string;
  decided_at: string | null;
};

export type AdminTaxForm = {
  id: string;
  seller_id: string;
  seller_name: string | null;
  form_type: "W9" | "W8BEN";
  file_path: string;
  status: "submitted" | "approved" | "rejected";
  admin_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("forbidden");
}

export const getAdminEarningsSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminEarningsSummary> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [orders, itemAgg, balAgg, payoutAgg, sellerCount, reqAgg] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "paid"),
      supabaseAdmin
        .from("order_items")
        .select("unit_amount_cents, platform_fee_cents, seller_amount_cents"),
      supabaseAdmin
        .from("seller_balances")
        .select("pending_cents, paid_cents, currency"),
      supabaseAdmin.from("seller_payouts").select("amount_cents"),
      supabaseAdmin
        .from("seller_balances")
        .select("seller_id", { count: "exact", head: true }),
      supabaseAdmin
        .from("payout_requests" as any)
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

    let gross = 0;
    let fees = 0;
    let sellerEarnings = 0;
    (itemAgg.data ?? []).forEach((r) => {
      gross += Number(r.unit_amount_cents ?? 0);
      fees += Number(r.platform_fee_cents ?? 0);
      sellerEarnings += Number(r.seller_amount_cents ?? 0);
    });
    let pending = 0;
    let paid = 0;
    let currency = "usd";
    (balAgg.data ?? []).forEach((r) => {
      pending += Number(r.pending_cents ?? 0);
      paid += Number(r.paid_cents ?? 0);
      if (r.currency) currency = r.currency;
    });
    const paidTotal = (payoutAgg.data ?? []).reduce(
      (acc, r) => acc + Number(r.amount_cents ?? 0),
      0,
    );

    return {
      gross_revenue_cents: gross,
      platform_fees_cents: fees,
      creator_earnings_cents: sellerEarnings,
      paid_out_cents: paidTotal || paid,
      pending_balance_cents: pending,
      order_count: orders.count ?? 0,
      seller_count: sellerCount.count ?? 0,
      pending_request_count: reqAgg.count ?? 0,
      currency,
    };
  });

export const adminListPayoutRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminPayoutRequest[]> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await supabaseAdmin
      .from("payout_requests" as any)
      .select(
        "id, seller_id, amount_cents, currency, status, seller_note, admin_note, method_snapshot, created_at, decided_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);

    const sellerIds = Array.from(new Set((rows ?? []).map((r: any) => r.seller_id)));
    const { data: profiles } = sellerIds.length
      ? await supabaseAdmin.from("profiles").select("id, display_name").in("id", sellerIds)
      : { data: [] as { id: string; display_name: string | null }[] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

    return ((rows ?? []) as any[]).map((r) => ({
      ...r,
      seller_name: nameMap.get(r.seller_id) ?? null,
    })) as AdminPayoutRequest[];
  });

const decideSchema = z.object({
  request_id: z.string().uuid(),
  approve: z.boolean(),
  method: z.string().max(50).optional().nullable(),
  admin_note: z.string().max(1000).optional().nullable(),
  mark_paid: z.boolean().default(true),
});

export const adminDecidePayoutRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => decideSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Snapshot request BEFORE decision so we know the seller/amount even on reject.
    const { data: reqRow } = await supabaseAdmin
      .from("payout_requests" as any)
      .select("seller_id, amount_cents, currency")
      .eq("id", data.request_id)
      .maybeSingle();

    const { supabase } = context;
    const { data: result, error } = await (supabase.rpc as any)(
      "admin_decide_payout_request",
      {
        _request_id: data.request_id,
        _approve: data.approve,
        _method: data.method ?? null,
        _admin_note: data.admin_note ?? null,
        _mark_paid: data.mark_paid,
      },
    );
    if (error) throw new Error(error.message);

    const r = reqRow as { seller_id: string; amount_cents: number; currency: string } | null;
    if (r) {
      try {
        const { sendPayoutEmail } = await import("./payout-emails.server");
        const kind = !data.approve
          ? "declined"
          : data.mark_paid
            ? "paid"
            : "approved";
        await sendPayoutEmail({
          kind,
          sellerId: r.seller_id,
          amountCents: Number(r.amount_cents),
          currency: r.currency,
          method: data.method ?? null,
          adminNote: data.admin_note ?? null,
          requestId: data.request_id,
        });
      } catch (e) {
        console.error("payout decision email failed", e);
      }
    }

    return { seller_payout_id: (result as string) ?? null };
  });

export const adminListTaxForms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminTaxForm[]> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("creator_tax_forms" as any)
      .select("id, seller_id, form_type, file_path, status, admin_note, submitted_at, reviewed_at")
      .order("submitted_at", { ascending: false })
      .limit(200);
    const sellerIds = Array.from(new Set((rows ?? []).map((r: any) => r.seller_id)));
    const { data: profiles } = sellerIds.length
      ? await supabaseAdmin.from("profiles").select("id, display_name").in("id", sellerIds)
      : { data: [] as { id: string; display_name: string | null }[] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
    return ((rows ?? []) as any[]).map((r) => ({
      ...r,
      seller_name: nameMap.get(r.seller_id) ?? null,
    })) as AdminTaxForm[];
  });

const signSchema = z.object({ file_path: z.string().min(3).max(300) });

export const adminSignTaxFormUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => signSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("tax-forms")
      .createSignedUrl(data.file_path, 60 * 10);
    if (error || !signed) throw new Error(error?.message ?? "sign failed");
    return { url: signed.signedUrl };
  });

const reviewSchema = z.object({
  form_id: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
  admin_note: z.string().max(1000).optional().nullable(),
});

export const adminReviewTaxForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reviewSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("creator_tax_forms" as any)
      .update({
        status: data.status,
        admin_note: data.admin_note ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .eq("id", data.form_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
