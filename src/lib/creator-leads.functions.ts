import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const leadSchema = z.object({
  email: z.string().trim().min(3).max(255).email(),
  productType: z.string().trim().min(1).max(60),
  followerCount: z.number().int().min(0).max(100_000_000),
  /** Which CTA the submission came from (hero, footer, sticky…). */
  ctaSource: z.string().trim().max(60).optional().default("unknown"),
  /** Honeypot field — must stay empty; bots that autofill it are rejected. */
  company: z.string().max(200).optional().default(""),
  /** Milliseconds the visitor spent on the form before submitting. */
  elapsedMs: z.number().int().min(0).max(86_400_000).optional().default(0),
});

/** Forms filled faster than this are almost certainly automated. */
const MIN_FILL_MS = 1500;
/** Max submissions accepted per hour from the same visitor fingerprint. */
const MAX_PER_HOUR = 5;

function publicSupabase() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

/** SHA-256 of the caller IP so we never store a raw address. */
async function callerFingerprint(): Promise<string | null> {
  let headers: Headers;
  try {
    headers = getRequest().headers;
  } catch {
    return null;
  }
  const ip =
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null;
  if (!ip) return null;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`creator-lead:${ip}`));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Public server function for creator-lead capture. No auth required.
 * Spam protection: honeypot + minimum fill time, then a per-IP hourly rate limit.
 */
export const submitCreatorLead = createServerFn({ method: "POST" })
  .validator((data) => leadSchema.parse(data))
  .handler(async ({ data }) => {
    // Lightweight challenge: honeypot + minimum fill time. Bots see a fake
    // success so they don't retry with a different strategy.
    if (data.company.trim().length > 0 || data.elapsedMs < MIN_FILL_MS) {
      return { ok: true, duplicate: false };
    }

    const supa = publicSupabase();

    const ipHash = await callerFingerprint();
    if (ipHash) {
      const { data: allowed, error: rlError } = await supa.rpc("check_creator_lead_rate_limit", {
        _ip_hash: ipHash,
        _max_per_hour: MAX_PER_HOUR,
      });
      if (rlError) {
        console.error("Creator lead rate-limit check failed:", rlError);
      } else if (allowed === false) {
        throw new Error("Too many signups from this connection. Please try again in an hour.");
      }
    }


    const { error } = await supa.from("creator_leads").insert({
      email: data.email.toLowerCase(),
      product_type: data.productType,
      follower_count: data.followerCount,
      cta_source: data.ctaSource,
    });

    if (error) {
      // Treat a unique-constraint violation (duplicate email + product type) as idempotent success.
      if (error.code === "23505") {
        return { ok: true, duplicate: true };
      }
      console.error("Creator lead insert failed:", error);
      throw new Error(`Failed to save your details: ${error.message} (${error.code})`);
    }

    // Confirmation + team notification are best-effort; delivery problems must not fail the signup.
    const {
      sendCreatorStarterKitEmail,
      sendCreatorSignupConfirmation,
      sendCreatorLeadAdminAlert,
    } = await import("@/lib/creator-lead-email.server");
    await sendCreatorStarterKitEmail(data.email.toLowerCase(), data.productType);
    await sendCreatorSignupConfirmation(data.email.toLowerCase(), data.productType);
    await sendCreatorLeadAdminAlert({
      email: data.email.toLowerCase(),
      productType: data.productType,
      followerCount: data.followerCount,
      ctaSource: data.ctaSource,
    });

    return { ok: true };
  });

const resendSchema = z.object({
  email: z.string().trim().min(3).max(255).email(),
  productType: z.string().trim().min(1).max(60),
});

/** Max resend requests accepted per hour from the same visitor fingerprint. */
const MAX_RESENDS_PER_HOUR = 3;

/**
 * Re-sends the Seller Starter Kit confirmation email. Only works for an email
 * that already exists in creator_leads, and is rate limited per IP.
 */
export const resendCreatorStarterKit = createServerFn({ method: "POST" })
  .validator((data) => resendSchema.parse(data))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const supa = publicSupabase();

    const ipHash = await callerFingerprint();
    if (ipHash) {
      const { data: allowed, error: rlError } = await supa.rpc("check_creator_lead_rate_limit", {
        _ip_hash: ipHash,
        _max_per_hour: MAX_RESENDS_PER_HOUR,
      });
      if (rlError) {
        console.error("Starter kit resend rate-limit check failed:", rlError);
      } else if (allowed === false) {
        throw new Error("Too many resend requests. Please try again in an hour.");
      }
    }

    const { sendCreatorStarterKitEmail } = await import("@/lib/creator-lead-email.server");
    const result = await sendCreatorStarterKitEmail(email, data.productType);

    // Never re-mail an unsubscribed/suppressed address; tell the requester instead.
    if (!result.sent && result.reason === "opted_out") {
      throw new Error(
        "This email has unsubscribed from AurumVault emails, so we can't send it again. Use the download link on this page, or contact support@aurumvault.store to resubscribe.",
      );
    }
    if (!result.sent) {
      throw new Error("We couldn't send the email just now. Please try again in a moment.");
    }

    return { ok: true };
  });

/**
 * Notifies the AurumVault team that a signed-in creator submitted a seller
 * application. Auth-gated (only real applicants can trigger it) and
 * best-effort: never fails the application flow.
 */
export const notifyAdminOfSellerApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { brandName?: string; categories?: string[] } | undefined) => ({
    brandName: (input?.brandName ?? "").toString().trim().slice(0, 120),
    categories: (input?.categories ?? []).slice(0, 10).map((c) => String(c).slice(0, 60)),
  }))
  .handler(async ({ context, data }) => {
    const email = (context.claims?.email as string | undefined) ?? null;
    if (!email) return { ok: false as const };
    const { sendCreatorLeadAdminAlert } = await import("@/lib/creator-lead-email.server");
    await sendCreatorLeadAdminAlert({
      email,
      productType: data.categories.length
        ? `Seller application — ${data.categories.join(", ")}`
        : "Seller application",
      followerCount: 0,
      ctaSource: data.brandName ? `sell (${data.brandName})` : "sell",
    });
    return { ok: true as const };
  });
