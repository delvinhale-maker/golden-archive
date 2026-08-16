import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminCreatorLead = {
  email: string;
  productType: string;
  followerCount: number;
  ctaSource: string | null;
  createdAt: string;
};

/** Admin-only: most recent creator leads, for manual email resends. */
export const listCreatorLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number } | undefined) => ({
    limit: Math.min(Math.max(input?.limit ?? 25, 1), 100),
  }))
  .handler(async ({ context, data }): Promise<AdminCreatorLead[]> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("creator_leads")
      .select("email, product_type, follower_count, cta_source, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw error;

    return (rows ?? []).map((r) => ({
      email: r.email,
      productType: r.product_type,
      followerCount: r.follower_count ?? 0,
      ctaSource: r.cta_source ?? null,
      createdAt: r.created_at,
    }));
  });

const resendSchema = z.object({
  email: z.string().trim().min(3).max(255).email(),
  /** Optional override; defaults to the product type stored on the lead. */
  productType: z.string().trim().min(1).max(60).optional(),
});

export type AdminResendResult = {
  confirmation: { sent: boolean; reason?: string };
  starterKit: { sent: boolean; reason?: string };
};

/**
 * Admin-only: re-sends the signup confirmation and Seller Starter Kit emails
 * for an existing lead. No rate limit (admin-gated), but suppression /
 * unsubscribe state is still respected inside the senders.
 */
export const adminResendCreatorLeadEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => resendSchema.parse(input))
  .handler(async ({ context, data }): Promise<AdminResendResult> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const email = data.email.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lead, error } = await supabaseAdmin
      .from("creator_leads")
      .select("email, product_type")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!lead) throw new Error("No creator lead found for that email address.");

    const productType = data.productType ?? lead.product_type ?? "Other";

    const { sendCreatorSignupConfirmation, sendCreatorStarterKitEmail } = await import(
      "@/lib/creator-lead-email.server"
    );
    const confirmation = await sendCreatorSignupConfirmation(email, productType);
    const starterKit = await sendCreatorStarterKitEmail(email, productType);

    return {
      confirmation: confirmation.sent
        ? { sent: true }
        : { sent: false, reason: confirmation.reason },
      starterKit: starterKit.sent ? { sent: true } : { sent: false, reason: starterKit.reason },
    };
  });
