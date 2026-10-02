import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toMerchantSignal } from "./gaps";
import { buildMerchantEnvelope } from "./merchant";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("forbidden");
}

export const getMerchantIntelligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin.from("aurum_marketplace_gap_signals") as any)
      .select("objective_key,category_hint,request_count,no_result_count,low_confidence_count,conversion_count,first_seen_at,last_seen_at")
      .order("request_count", { ascending: false }).limit(50);
    const rows = (data ?? []).map((row: any) => ({
      objectiveKey: row.objective_key, categoryHint: row.category_hint, requestCount: Number(row.request_count),
      resultCount: 0, noResultCount: Number(row.no_result_count), lowConfidenceCount: Number(row.low_confidence_count),
      conversionCount: Number(row.conversion_count), firstSeenAt: row.first_seen_at, lastSeenAt: row.last_seen_at,
    }));
    const signals = rows.map(toMerchantSignal).sort((a: any,b: any)=>b.demandScore-a.demandScore);
    return buildMerchantEnvelope(signals);
  });
