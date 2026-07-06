// Server-only helpers for creator affiliate resolution.
// Kept in a .server.ts file so it never ships to the client bundle.

const CODE_RE = /^[A-Z0-9]{6,16}$/;

/**
 * Resolve an affiliate code + product-seller combination.
 * Returns null when the code doesn't match the product's seller
 * (cross-creator referrals ignored) or the program is disabled.
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
