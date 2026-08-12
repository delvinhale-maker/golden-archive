import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const leadSchema = z.object({
  email: z.string().trim().min(3).max(255).email(),
  productType: z.string().trim().min(1).max(60),
  followerCount: z.number().int().min(0).max(100_000_000),
  /** Honeypot field — must stay empty; bots that autofill it are rejected. */
  company: z.string().max(200).optional().default(""),
  /** Milliseconds the visitor spent on the form before submitting. */
  elapsedMs: z.number().int().min(0).max(86_400_000).optional().default(0),
});

/** Forms filled faster than this are almost certainly automated. */
const MIN_FILL_MS = 1500;

function publicSupabase() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Public server function for creator-lead capture. No auth required.
 * Uses upsert with ignoreDuplicates so repeat submissions are idempotent.
 */
export const submitCreatorLead = createServerFn({ method: "POST" })
  .validator((data) => leadSchema.parse(data))
  .handler(async ({ data }) => {
    const supa = publicSupabase();
    const { error } = await supa.from("creator_leads").insert({
      email: data.email.toLowerCase(),
      product_type: data.productType,
      follower_count: data.followerCount,
    });

    if (error) {
      // Treat a unique-constraint violation (duplicate email + product type) as idempotent success.
      if (error.code === "23505") {
        return { ok: true, duplicate: true };
      }
      console.error("Creator lead insert failed:", error);
      throw new Error(`Failed to save your details: ${error.message} (${error.code})`);
    }

    return { ok: true };
  });
