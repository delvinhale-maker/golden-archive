import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const leadSchema = z.object({
  email: z.string().trim().min(3).max(255).email(),
  productType: z.string().trim().min(1).max(60),
  followerCount: z.number().int().min(0).max(100_000_000),
});

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
  .inputValidator((data) => leadSchema.parse(data))
  .handler(async ({ data }) => {
    const supa = publicSupabase();
    const { error } = await supa.from("creator_leads").upsert(
      {
        email: data.email.toLowerCase(),
        product_type: data.productType,
        follower_count: data.followerCount,
      },
      { onConflict: "email,product_type", ignoreDuplicates: true },
    );

    if (error) {
      throw new Error("Failed to save your details. Please try again.");
    }

    return { ok: true };
  });
