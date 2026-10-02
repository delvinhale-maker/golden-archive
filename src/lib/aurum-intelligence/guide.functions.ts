import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildDeterministicIntent } from "./intent";
import { rankProducts } from "./ranking";
import { buildAurumProof } from "./proof";

const guideInput = z.object({
  sessionId: z.string().uuid(),
  channel: z.enum(["text", "voice"]).default("text"),
  input: z.string().trim().min(2).max(4000),
  analyticsConsent: z.boolean().default(false),
  personalizationConsent: z.boolean().default(false),
});

function objectiveKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
}

export const askAurumGuide = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => guideInput.parse(input))
  .handler(async ({ data }) => {
    const intent = buildDeterministicIntent({
      sessionId: data.sessionId,
      channel: data.channel,
      rawInput: data.input,
      analyticsConsent: data.analyticsConsent,
      personalizationConsent: data.personalizationConsent,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("marketplace_products")
      .select("id,title,category,subcategory,description,product_type,rating,review_count,ai_review_status,ai_review_score,seller_id,slug")
      .eq("status", "approved")
      .eq("published", true)
      .limit(250);

    const products = (rows ?? []).map((row: any) => ({
      id: row.id as string,
      title: row.title as string,
      category: row.category as string,
      subcategory: row.subcategory as string | null,
      description: row.description as string | undefined,
      productType: row.product_type as string | null,
      rating: Number(row.rating ?? 0),
      reviewCount: Number(row.review_count ?? 0),
      slug: row.slug as string | null,
      aiReviewStatus: row.ai_review_status ?? null,
      aiReviewScore: row.ai_review_score ?? null,
    }));
    const ranked = rankProducts(intent.objective, intent.needs, products).slice(0, 5);
    const byId = new Map(products.map((p) => [p.id, p]));
    const recommendations = ranked.filter((r) => r.score >= 0.12).map((r) => {
      const p = byId.get(r.productId)!;
      return { ...r, product: p };
    });
    const confidence = recommendations[0]?.score ?? 0;

    if (data.analyticsConsent) {
      await (supabaseAdmin.from("aurum_intent_events") as any).insert({
        session_id: data.sessionId,
        channel: data.channel,
        objective_key: objectiveKey(intent.objective),
        stage: intent.stage,
        category_hints: intent.categoryHints,
        analytics_consent: true,
        personalization_consent: data.personalizationConsent,
        result_count: recommendations.length,
        recommendation_confidence: confidence,
      });
    }

    return {
      intent: { objective: intent.objective, stage: intent.stage, confidence: intent.confidence },
      recommendations,
      message: recommendations.length
        ? "I found a few options that match what you're trying to accomplish. You stay in control of what to explore or buy."
        : "I understand what you're trying to accomplish, but I don't have a strong marketplace match yet. I've kept the request private unless you opted into anonymous marketplace analytics.",
    };
  });

export const getAurumProof = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ productId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: product }, { data: proof }] = await Promise.all([
      supabaseAdmin.from("marketplace_products").select("id,seller_id,ai_review_status,ai_review_score,status,published,created_at").eq("id", data.productId).maybeSingle(),
      (supabaseAdmin.from("aurum_product_proof") as any).select("version,product_reviewed,evidence,updated_at").eq("product_id", data.productId).maybeSingle(),
    ]);
    if (!product || product.status !== "approved" || !product.published) return null;
    const { data: creator } = await supabaseAdmin.from("seller_applications").select("status,brand_slug").eq("user_id", product.seller_id).maybeSingle();
    return buildAurumProof({
      productId: product.id,
      creatorVerified: creator?.status === "approved" && !!creator?.brand_slug,
      aiReviewStatus: (product.ai_review_status as any) ?? null,
      aiReviewScore: product.ai_review_score ?? null,
      version: proof?.version ?? null,
      publishedAt: product.created_at ?? null,
      updatedAt: proof?.updated_at ?? null,
      evidence: Array.isArray(proof?.evidence) ? proof.evidence : [],
    });
  });
