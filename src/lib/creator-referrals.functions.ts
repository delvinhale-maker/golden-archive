import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const codeSchema = z.object({
  code: z.string().trim().min(6).max(16).regex(/^[A-Z0-9]+$/i),
});

export const attachCreatorReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => codeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: ok, error } = await (supabase as any).rpc("record_creator_referral", {
      _code: data.code.toUpperCase(),
    });
    if (error) return { attributed: false, error: error.message };
    return { attributed: !!ok };
  });

export type CreatorReferralStats = {
  referred_count: number;
  active_count: number;
  gmv_cents: number;
  bonus_cents: number;
};

export const getCreatorReferralStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorReferralStats> => {
    const { supabase } = context;
    const { data, error } = await (supabase as any).rpc("get_creator_referral_stats");
    if (error) throw new Error(error.message);
    return (data ?? { referred_count: 0, active_count: 0, gmv_cents: 0, bonus_cents: 0 }) as CreatorReferralStats;
  });
