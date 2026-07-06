import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const CODE_RE = /^[A-Z0-9]{6,16}$/;

function serverPublicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } },
  );
}

function generateCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

// ============================================================
// Creator-side: manage own program
// ============================================================

export const getMyProgram = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("creator_affiliate_programs" as any)
      .select("*")
      .eq("creator_id", context.userId)
      .maybeSingle();
    return (data as any) ?? {
      creator_id: context.userId,
      enabled: false,
      commission_rate_pct: 20,
      terms: null,
    };
  });

export const updateMyProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { enabled: boolean; commission_rate_pct: number; terms?: string | null }) => {
    const rate = Number(data.commission_rate_pct);
    if (!Number.isFinite(rate) || rate < 1 || rate > 50) throw new Error("Rate must be 1–50%");
    return {
      enabled: !!data.enabled,
      commission_rate_pct: Math.round(rate * 100) / 100,
      terms: data.terms?.trim() || null,
    };
  })
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("creator_affiliate_programs")
      .upsert({ creator_id: context.userId, ...data }, { onConflict: "creator_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyAffiliates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: affiliates } = await (context.supabase as any)
      .from("creator_affiliates")
      .select("id, affiliate_user_id, referral_code, status, joined_at")
      .eq("creator_id", context.userId)
      .order("joined_at", { ascending: false });

    const rows = (affiliates ?? []) as Array<{
      id: string;
      affiliate_user_id: string;
      referral_code: string;
      status: string;
      joined_at: string;
    }>;

    if (rows.length === 0) return [];

    const codes = rows.map((r) => r.referral_code);
    const affIds = rows.map((r) => r.affiliate_user_id);

    const [clicksRes, commsRes, profilesRes] = await Promise.all([
      (context.supabase as any)
        .from("affiliate_referral_clicks")
        .select("referral_code")
        .in("referral_code", codes),
      (context.supabase as any)
        .from("affiliate_commissions")
        .select("referral_code, commission_cents, status")
        .in("referral_code", codes),
      context.supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", affIds),
    ]);

    const clickCount: Record<string, number> = {};
    for (const c of ((clicksRes.data ?? []) as Array<{ referral_code: string }>)) {
      clickCount[c.referral_code] = (clickCount[c.referral_code] ?? 0) + 1;
    }
    const earnedByCode: Record<string, number> = {};
    const owedByCode: Record<string, number> = {};
    const salesByCode: Record<string, number> = {};
    for (const c of ((commsRes.data ?? []) as Array<{
      referral_code: string;
      commission_cents: number;
      status: string;
    }>)) {
      earnedByCode[c.referral_code] = (earnedByCode[c.referral_code] ?? 0) + c.commission_cents;
      salesByCode[c.referral_code] = (salesByCode[c.referral_code] ?? 0) + 1;
      if (c.status === "pending") {
        owedByCode[c.referral_code] = (owedByCode[c.referral_code] ?? 0) + c.commission_cents;
      }
    }
    const profileById = new Map<string, { display_name: string | null; avatar_url: string | null }>();
    for (const p of ((profilesRes.data ?? []) as Array<{ id: string; display_name: string | null; avatar_url: string | null }>)) {
      profileById.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url });
    }

    return rows.map((r) => ({
      id: r.id,
      affiliate_user_id: r.affiliate_user_id,
      display_name: profileById.get(r.affiliate_user_id)?.display_name ?? "Affiliate",
      avatar_url: profileById.get(r.affiliate_user_id)?.avatar_url ?? null,
      referral_code: r.referral_code,
      status: r.status,
      joined_at: r.joined_at,
      clicks: clickCount[r.referral_code] ?? 0,
      sales: salesByCode[r.referral_code] ?? 0,
      earned_cents: earnedByCode[r.referral_code] ?? 0,
      owed_cents: owedByCode[r.referral_code] ?? 0,
    }));
  });

export const listMyCommissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any)
      .from("affiliate_commissions")
      .select("id, order_id, affiliate_user_id, referral_code, sale_amount_cents, commission_cents, commission_rate_pct, status, created_at")
      .eq("creator_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    return (data ?? []) as Array<{
      id: string;
      order_id: string;
      affiliate_user_id: string;
      referral_code: string;
      sale_amount_cents: number;
      commission_cents: number;
      commission_rate_pct: number;
      status: string;
      created_at: string;
    }>;
  });

export const markCommissionPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!/^[a-f0-9-]{36}$/.test(data.id)) throw new Error("Invalid id");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("affiliate_commissions")
      .update({ status: "paid" })
      .eq("id", data.id)
      .eq("creator_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Promoter-side: join & view own promotions
// ============================================================

export const findProgramByBrandSlug = createServerFn({ method: "GET" })
  .inputValidator((data: { brandSlug: string }) => {
    if (!/^[a-z0-9-]{2,80}$/.test(data.brandSlug)) throw new Error("Invalid slug");
    return data;
  })
  .handler(async ({ data }) => {
    const supabase = serverPublicClient();
    const { data: app } = await supabase
      .from("seller_applications")
      .select("user_id, brand_name, brand_slug, cover_url, extended_bio")
      .eq("brand_slug", data.brandSlug)
      .eq("status", "approved")
      .maybeSingle();
    if (!app) return { error: "Creator not found" as const };

    const { data: program } = await (supabase as any)
      .from("creator_affiliate_programs")
      .select("enabled, commission_rate_pct, terms")
      .eq("creator_id", (app as any).user_id)
      .maybeSingle();
    if (!program || !program.enabled) return { error: "Program not active" as const };

    return {
      creator: {
        id: (app as any).user_id,
        brand_name: (app as any).brand_name,
        brand_slug: (app as any).brand_slug,
        cover_url: (app as any).cover_url,
        extended_bio: (app as any).extended_bio,
      },
      program: {
        commission_rate_pct: program.commission_rate_pct,
        terms: program.terms,
      },
    };
  });

export const joinCreatorProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { creatorId: string }) => {
    if (!/^[a-f0-9-]{36}$/.test(data.creatorId)) throw new Error("Invalid creatorId");
    return data;
  })
  .handler(async ({ data, context }) => {
    if (data.creatorId === context.userId) throw new Error("You cannot promote your own products");

    // Verify program is enabled
    const { data: program } = await (context.supabase as any)
      .from("creator_affiliate_programs")
      .select("enabled")
      .eq("creator_id", data.creatorId)
      .maybeSingle();
    if (!program || !program.enabled) throw new Error("This program is not accepting affiliates");

    // Existing?
    const { data: existing } = await (context.supabase as any)
      .from("creator_affiliates")
      .select("id, referral_code")
      .eq("creator_id", data.creatorId)
      .eq("affiliate_user_id", context.userId)
      .maybeSingle();
    if (existing) return { ok: true, code: existing.referral_code, already: true };

    // Generate a unique code (retry up to 5x on collision)
    let code = generateCode();
    for (let i = 0; i < 5; i++) {
      const { data: hit } = await (context.supabase as any)
        .from("creator_affiliates")
        .select("id")
        .eq("referral_code", code)
        .maybeSingle();
      if (!hit) break;
      code = generateCode();
    }

    const { error } = await (context.supabase as any).from("creator_affiliates").insert({
      creator_id: data.creatorId,
      affiliate_user_id: context.userId,
      referral_code: code,
    });
    if (error) throw new Error(error.message);
    return { ok: true, code, already: false };
  });

export const listMyPromotions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows } = await (context.supabase as any)
      .from("creator_affiliates")
      .select("id, creator_id, referral_code, status, joined_at")
      .eq("affiliate_user_id", context.userId)
      .order("joined_at", { ascending: false });

    const list = (rows ?? []) as Array<{
      id: string;
      creator_id: string;
      referral_code: string;
      status: string;
      joined_at: string;
    }>;
    if (list.length === 0) return [];

    const codes = list.map((r) => r.referral_code);
    const creatorIds = list.map((r) => r.creator_id);

    const [clicksRes, commsRes, appsRes] = await Promise.all([
      (context.supabase as any)
        .from("affiliate_referral_clicks")
        .select("referral_code")
        .in("referral_code", codes),
      (context.supabase as any)
        .from("affiliate_commissions")
        .select("referral_code, commission_cents, status")
        .in("referral_code", codes),
      context.supabase
        .from("seller_applications")
        .select("user_id, brand_name, brand_slug, cover_url")
        .in("user_id", creatorIds),
    ]);

    const clickCount: Record<string, number> = {};
    for (const c of ((clicksRes.data ?? []) as Array<{ referral_code: string }>)) {
      clickCount[c.referral_code] = (clickCount[c.referral_code] ?? 0) + 1;
    }
    const earned: Record<string, number> = {};
    const pending: Record<string, number> = {};
    const sales: Record<string, number> = {};
    for (const c of ((commsRes.data ?? []) as Array<{
      referral_code: string; commission_cents: number; status: string;
    }>)) {
      earned[c.referral_code] = (earned[c.referral_code] ?? 0) + c.commission_cents;
      sales[c.referral_code] = (sales[c.referral_code] ?? 0) + 1;
      if (c.status === "pending") pending[c.referral_code] = (pending[c.referral_code] ?? 0) + c.commission_cents;
    }
    const creatorInfo = new Map<string, { brand_name: string | null; brand_slug: string | null; cover_url: string | null }>();
    for (const a of ((appsRes.data ?? []) as Array<{ user_id: string; brand_name: string | null; brand_slug: string | null; cover_url: string | null }>)) {
      creatorInfo.set(a.user_id, { brand_name: a.brand_name, brand_slug: a.brand_slug, cover_url: a.cover_url });
    }

    return list.map((r) => ({
      id: r.id,
      creator_id: r.creator_id,
      brand_name: creatorInfo.get(r.creator_id)?.brand_name ?? "Creator",
      brand_slug: creatorInfo.get(r.creator_id)?.brand_slug ?? null,
      cover_url: creatorInfo.get(r.creator_id)?.cover_url ?? null,
      referral_code: r.referral_code,
      status: r.status,
      joined_at: r.joined_at,
      clicks: clickCount[r.referral_code] ?? 0,
      sales: sales[r.referral_code] ?? 0,
      earned_cents: earned[r.referral_code] ?? 0,
      pending_cents: pending[r.referral_code] ?? 0,
    }));
  });

// ============================================================
// Public: click logging + code resolution (used by webhook)
// ============================================================

export const logAffiliateClick = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string; productId?: string | null }) => {
    const code = (data.code ?? "").toUpperCase().trim();
    if (!CODE_RE.test(code)) throw new Error("Invalid code");
    if (data.productId && !/^[a-f0-9-]{36}$/.test(data.productId)) throw new Error("Invalid productId");
    return { code, productId: data.productId ?? null };
  })
  .handler(async ({ data }) => {
    const supabase = serverPublicClient();
    await supabase.from("affiliate_referral_clicks" as any).insert({
      referral_code: data.code,
      product_id: data.productId,
    } as any);
    return { ok: true };
  });

/**
 * Resolve an affiliate code + product-seller combination to a commission tuple.
 * Server-side helper called from the payments webhook. Returns null when the
 * code doesn't match the product's seller (cross-creator referrals ignored).
 */
export async function resolveAffiliateForOrderItem(
  code: string | undefined | null,
  sellerId: string,
): Promise<{
  affiliate_user_id: string;
  creator_id: string;
  referral_code: string;
  commission_rate_pct: number;
} | null> {
  if (!code) return null;
  const trimmed = code.toUpperCase().trim();
  if (!CODE_RE.test(trimmed)) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: aff } = await (supabaseAdmin as any)
    .from("creator_affiliates")
    .select("affiliate_user_id, creator_id, referral_code, status")
    .eq("referral_code", trimmed)
    .maybeSingle();
  if (!aff || aff.status !== "active") return null;
  if (aff.creator_id !== sellerId) return null;

  const { data: prog } = await (supabaseAdmin as any)
    .from("creator_affiliate_programs")
    .select("enabled, commission_rate_pct")
    .eq("creator_id", aff.creator_id)
    .maybeSingle();
  if (!prog || !prog.enabled) return null;

  return {
    affiliate_user_id: aff.affiliate_user_id,
    creator_id: aff.creator_id,
    referral_code: aff.referral_code,
    commission_rate_pct: Number(prog.commission_rate_pct),
  };
}
