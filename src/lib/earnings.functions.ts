import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type PayoutMethod = {
  seller_id: string;
  method: "bank" | "paypal" | "wise" | "other";
  details: Record<string, string>;
  updated_at: string;
};

export type PayoutRequestRow = {
  id: string;
  seller_id: string;
  amount_cents: number;
  currency: string;
  status: "pending" | "approved" | "rejected" | "paid";
  seller_note: string | null;
  admin_note: string | null;
  method_snapshot: Record<string, string> | null;
  decided_at: string | null;
  created_at: string;
  seller_payout_id: string | null;
};

export type PayoutHistoryRow = {
  id: string;
  amount_cents: number;
  currency: string;
  method: string | null;
  note: string | null;
  paid_at: string;
};

export type TaxFormRow = {
  id: string;
  form_type: "W9" | "W8BEN";
  file_path: string;
  status: "submitted" | "approved" | "rejected";
  admin_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

export type MyEarningsSummary = {
  pending_cents: number;
  paid_cents: number;
  lifetime_cents: number;
  currency: string;
  has_method: boolean;
  has_tax_form: boolean;
  email_verified: boolean;
  email: string | null;
  open_request: PayoutRequestRow | null;
  requests: PayoutRequestRow[];
  payouts: PayoutHistoryRow[];
};

export const getMyEarnings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyEarningsSummary> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;

    const [bal, method, requests, payouts, tax] = await Promise.all([
      supabaseAdmin
        .from("seller_balances")
        .select("pending_cents, paid_cents, currency")
        .eq("seller_id", uid)
        .maybeSingle(),
      supabaseAdmin
        .from("creator_payout_methods" as any)
        .select("seller_id")
        .eq("seller_id", uid)
        .maybeSingle(),
      supabaseAdmin
        .from("payout_requests" as any)
        .select("*")
        .eq("seller_id", uid)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("seller_payouts")
        .select("id, amount_cents, currency, method, note, paid_at")
        .eq("seller_id", uid)
        .order("paid_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("creator_tax_forms" as any)
        .select("id")
        .eq("seller_id", uid)
        .neq("status", "rejected")
        .limit(1),
    ]);

    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(uid);
    const authUser = userRes?.user;
    const emailVerified = Boolean(
      authUser?.email_confirmed_at || (authUser as any)?.confirmed_at,
    );

    const pending = Number(bal.data?.pending_cents ?? 0);
    const paid = Number(bal.data?.paid_cents ?? 0);
    const reqs = ((requests.data ?? []) as unknown as PayoutRequestRow[]);
    const openReq = reqs.find((r) => r.status === "pending" || r.status === "approved") ?? null;

    return {
      pending_cents: pending,
      paid_cents: paid,
      lifetime_cents: pending + paid,
      currency: bal.data?.currency ?? "usd",
      has_method: !!method.data,
      has_tax_form: ((tax.data ?? []) as unknown[]).length > 0,
      email_verified: emailVerified,
      email: authUser?.email ?? null,
      open_request: openReq,
      requests: reqs,
      payouts: (payouts.data ?? []) as PayoutHistoryRow[],
    };
  });

export const getMyPayoutMethod = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PayoutMethod | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("creator_payout_methods" as any)
      .select("seller_id, method, details, updated_at")
      .eq("seller_id", context.userId)
      .maybeSingle();
    return (data as PayoutMethod | null) ?? null;
  });

const upsertMethodSchema = z.object({
  method: z.enum(["bank", "paypal", "wise", "other"]),
  details: z
    .record(z.string(), z.string().max(500))
    .refine((d) => Object.keys(d).length <= 20, { message: "too many fields" }),
});

export const upsertPayoutMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertMethodSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("creator_payout_methods" as any)
      .upsert(
        {
          seller_id: context.userId,
          method: data.method,
          details: data.details,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "seller_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const requestPayoutSchema = z.object({
  amount_cents: z.number().int().min(2500).max(10_000_000),
  note: z.string().max(500).optional().nullable(),
});

export const requestPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => requestPayoutSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: req, error } = await (supabase.rpc as any)("request_payout", {
      _amount_cents: data.amount_cents,
      _note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    const requestId = req as string;
    try {
      const { sendPayoutEmail } = await import("./payout-emails.server");
      await sendPayoutEmail({
        kind: "submitted",
        sellerId: context.userId,
        amountCents: data.amount_cents,
        requestId,
      });
    } catch (e) {
      console.error("payout submitted email failed", e);
    }
    return { request_id: requestId };
  });

const submitTaxSchema = z.object({
  form_type: z.enum(["W9", "W8BEN"]),
  file_path: z.string().min(3).max(300),
});

export const submitTaxForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => submitTaxSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Validate the path is under the seller's own folder.
    const expectedPrefix = `${context.userId}/`;
    if (!data.file_path.startsWith(expectedPrefix)) {
      throw new Error("invalid path");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("creator_tax_forms" as any)
      .insert({
        seller_id: context.userId,
        form_type: data.form_type,
        file_path: data.file_path,
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyTaxForms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TaxFormRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("creator_tax_forms" as any)
      .select("id, form_type, file_path, status, admin_note, submitted_at, reviewed_at")
      .eq("seller_id", context.userId)
      .order("submitted_at", { ascending: false })
      .limit(20);
    return ((data ?? []) as unknown) as TaxFormRow[];
  });
