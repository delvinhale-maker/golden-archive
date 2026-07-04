import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type QARow = {
  id: string;
  product_id: string;
  asker_name: string;
  question: string;
  answer: string | null;
  answerer_name: string | null;
  answered_by_admin: boolean;
  answered_at: string | null;
  created_at: string;
};

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const listQA = createServerFn({ method: "GET" })
  .inputValidator((input: { productId: string }) => input)
  .handler(async ({ data }): Promise<{ count: number; items: QARow[] }> => {
    const sb = publicClient();
    const { data: rows, error } = await (sb as any).rpc("list_product_qa", {
      _product_id: data.productId,
    });
    if (error) throw error;
    const items = (rows ?? []) as QARow[];
    return { count: items.length, items };
  });



export const askQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string; question: string }) => input)
  .handler(async ({ data, context }) => {
    const q = data.question.trim();
    if (q.length < 4) throw new Error("Question is too short");
    if (q.length > 1000) throw new Error("Question is too long");
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    const { error, data: inserted } = await supabase
      .from("product_qa")
      .insert({
        product_id: data.productId,
        asker_user_id: userId,
        asker_name: profile?.display_name ?? "AurumVault reader",
        question: q,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: inserted.id };
  });

export const answerQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { questionId: string; answer: string }) => input)
  .handler(async ({ data, context }) => {
    const a = data.answer.trim();
    if (a.length < 2) throw new Error("Answer is too short");
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only admins can answer");
    const { error } = await supabase
      .from("product_qa")
      .update({
        answer: a,
        answerer_user_id: userId,
        answerer_name: "AurumVault",
        answered_by_admin: true,
        answered_at: new Date().toISOString(),
      })
      .eq("id", data.questionId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { questionId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("product_qa")
      .delete()
      .eq("id", data.questionId);
    if (error) throw error;
    return { ok: true };
  });
