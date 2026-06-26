import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const ReviewSchema = z.object({
  score: z.number().min(0).max(100),
  status: z.enum(["pass", "warn", "fail"]),
  issues: z.array(
    z.object({
      severity: z.enum(["low", "medium", "high"]),
      area: z.enum(["title", "description", "cover", "policy", "category", "other"]),
      message: z.string(),
    }),
  ),
  cover_moderation: z.object({
    safe: z.boolean(),
    notes: z.string(),
  }),
  suggested_seo_title: z.string(),
  suggested_blurb: z.string(),
  suggested_tags: z.array(z.string()).max(8),
});

export type AIReviewResult = z.infer<typeof ReviewSchema>;

export const reviewProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ productId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Must be admin OR product owner
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const { data: product, error: pErr } = await supabase
      .from("marketplace_products")
      .select("id, seller_id, title, description, category, price_cents, cover_url")
      .eq("id", data.productId)
      .maybeSingle();
    if (pErr || !product) throw new Error("Product not found");
    if (!isAdmin && product.seller_id !== userId) throw new Error("Forbidden");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const userParts: Array<
      { type: "text"; text: string } | { type: "image"; image: URL }
    > = [
      {
        type: "text",
        text: `Review this marketplace product for AurumVault, a premium digital products marketplace (eBooks, courses, templates, audio, leadership).

CATEGORY: ${product.category}
TITLE: ${product.title}
PRICE: $${(product.price_cents / 100).toFixed(2)}
DESCRIPTION:
${product.description}

Evaluate:
1. Title quality — clear, specific, not spammy or all-caps
2. Description — substantive, well-formed, free of obvious AI/PLR filler, policy-compliant
3. Category fit
4. Cover image (if shown) — professional, not NSFW, no copyrighted logos/characters (Disney, Marvel, sports teams), readable, not blurry/low-res
5. Pricing reasonableness for the category

Score 0-100. status = "pass" (>=75 & no high-severity issues), "warn" (50-74 or medium issues), "fail" (<50 or any high-severity policy issue).

Then write a polished SEO blurb (140-160 chars) and a refined SEO title (<60 chars) suitable for the product page meta description and 3-6 short tags.`,
      },
    ];

    if (product.cover_url) {
      try {
        userParts.push({ type: "image", image: new URL(product.cover_url) });
      } catch {
        // ignore invalid url
      }
    }

    const { output } = await generateText({
      model,
      output: Output.object({ schema: ReviewSchema }),
      messages: [
        {
          role: "system",
          content:
            "You are a strict but fair marketplace content reviewer. Be concise. Flag policy issues (copyright, NSFW, hate, misleading claims) as high severity. Output valid JSON only.",
        },
        { role: "user", content: userParts },
      ],
    });

    // Persist
    const { error: updErr } = await supabase
      .from("marketplace_products")
      .update({
        ai_review_status: output.status,
        ai_review_score: output.score,
        ai_review_issues: output.issues,
        ai_review_blurb: output.suggested_blurb,
        ai_review_seo_title: output.suggested_seo_title,
        ai_review_tags: output.suggested_tags,
        ai_reviewed_at: new Date().toISOString(),
      })
      .eq("id", product.id);
    if (updErr) throw updErr;

    return output;
  });
