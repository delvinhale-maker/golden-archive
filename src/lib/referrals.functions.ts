import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CODE_RE = /^[A-Z0-9]{6,16}$/;

/**
 * Resolve an 8-char referral code (first 8 hex chars of the referrer's UUID,
 * uppercase, dashes stripped) back to a user id by scanning auth.users.
 * Returns null when no match, the code is invalid, or it points at the
 * caller themselves (self-referrals are not eligible).
 */
async function resolveReferrer(
  code: string,
  selfUserId: string,
): Promise<string | null> {
  if (!CODE_RE.test(code)) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Match on the lowercase, dash-stripped UUID prefix.
  const prefix = code.toLowerCase();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .filter("id", "gte", insertDashes(prefix + "0".repeat(32 - prefix.length)))
    .filter("id", "lte", insertDashes(prefix + "f".repeat(32 - prefix.length)))
    .limit(2);
  if (error || !data || data.length === 0) return null;
  const candidate = data.find((r) => r.id !== selfUserId);
  return candidate?.id ?? null;
}

function insertDashes(hex32: string): string {
  return `${hex32.slice(0, 8)}-${hex32.slice(8, 12)}-${hex32.slice(12, 16)}-${hex32.slice(16, 20)}-${hex32.slice(20, 32)}`;
}

export const attachReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string; source?: string }) => {
    if (!data?.code) throw new Error("code required");
    return { code: data.code.toUpperCase().trim(), source: data.source };
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; attached?: boolean; reason?: string }> => {
    const referrerId = await resolveReferrer(data.code, context.userId);
    if (!referrerId) return { ok: false, reason: "invalid_or_self" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // First-touch: ignore conflict on referred_user_id unique constraint.
    const { error } = await (supabaseAdmin as any).from("referrals").upsert(
      {
        referrer_user_id: referrerId,
        referred_user_id: context.userId,
        referral_code: data.code,
        source: data.source ?? null,
      },
      { onConflict: "referred_user_id", ignoreDuplicates: true },
    );
    if (error) {
      console.error("[referrals] attach failed", { error: error.message });
      return { ok: false, reason: "db_error" };
    }
    return { ok: true, attached: true };
  });

/** Resolve a code to a referrer user id from server contexts (e.g. checkout). */
export async function resolveReferralCode(
  code: string | undefined | null,
  selfUserId: string | null,
): Promise<string | null> {
  if (!code) return null;
  const trimmed = code.trim().toUpperCase();
  if (!CODE_RE.test(trimmed)) return null;
  return resolveReferrer(trimmed, selfUserId ?? "");
}
