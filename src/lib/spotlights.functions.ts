import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const UUID = z.string().uuid();

function publicSupabase() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type Spotlight = {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerSlug: string | null;
  month: string;
  headline: string;
  body: string;
  heroImageUrl: string | null;
};

export const getCurrentSpotlight = createServerFn({ method: "GET" }).handler(
  async (): Promise<Spotlight | null> => {
    const supa = publicSupabase();
    const { data: row } = await supa
      .from("creator_spotlights")
      .select("id,seller_id,month,headline,interview_body,hero_image_url")
      .eq("published", true)
      .order("month", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row) return null;
    const [{ data: profile }, { data: app }] = await Promise.all([
      supa.from("profiles").select("display_name").eq("id", row.seller_id).maybeSingle(),
      supa
        .from("seller_applications")
        .select("brand_slug,brand_name")
        .eq("user_id", row.seller_id)
        .maybeSingle(),
    ]);
    return {
      id: row.id,
      sellerId: row.seller_id,
      sellerName:
        app?.brand_name ?? profile?.display_name ?? "Featured Creator",
      sellerSlug: app?.brand_slug ?? null,
      month: row.month,
      headline: row.headline,
      body: row.interview_body,
      heroImageUrl: row.hero_image_url,
    };
  },
);

export type AdminSpotlight = Spotlight & { published: boolean };

export const adminListSpotlights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { data } = await context.supabase
      .from("creator_spotlights")
      .select(
        "id,seller_id,month,headline,interview_body,hero_image_url,published",
      )
      .order("month", { ascending: false })
      .limit(24);
    return (data ?? []).map((r) => ({
      id: r.id,
      sellerId: r.seller_id,
      month: r.month,
      headline: r.headline,
      body: r.interview_body,
      heroImageUrl: r.hero_image_url,
      published: r.published,
    }));
  });

export const adminUpsertSpotlight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      sellerId: string;
      month: string;
      headline: string;
      body: string;
      heroImageUrl?: string | null;
      published: boolean;
    }) => ({
      id: d.id ? UUID.parse(d.id) : undefined,
      sellerId: UUID.parse(d.sellerId),
      month: z.string().regex(/^\d{4}-\d{2}-01$/).parse(d.month),
      headline: z.string().trim().min(3).max(200).parse(d.headline),
      body: z.string().trim().max(20000).parse(d.body),
      heroImageUrl: d.heroImageUrl ?? null,
      published: !!d.published,
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const payload = {
      seller_id: data.sellerId,
      month: data.month,
      headline: data.headline,
      interview_body: data.body,
      hero_image_url: data.heroImageUrl,
      published: data.published,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("creator_spotlights")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("creator_spotlights")
      .upsert(payload, { onConflict: "month" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });
