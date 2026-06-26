import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestUrl } from "@tanstack/react-start/server";
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
      .select("id, seller_id, title, description, category, price_cents, cover_url, ai_review_status")
      .eq("id", data.productId)
      .maybeSingle();
    if (pErr || !product) throw new Error("Product not found");
    if (!isAdmin && product.seller_id !== userId) throw new Error("Forbidden");
    const prevStatus = product.ai_review_status;

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

    // Notify seller on transition into a terminal state (pass / warn / fail).
    // Skip when status didn't actually change.
    if (output.status !== prevStatus && (output.status === "pass" || output.status === "warn" || output.status === "fail")) {
      try {
        await notifySellerOfReview({
          sellerId: product.seller_id,
          productId: product.id,
          productTitle: product.title,
          status: output.status,
          score: output.score,
          issues: output.issues,
          callerAuthHeader: getRequestHeader("Authorization") ?? null,
          host: getRequestHeader("host") ?? getRequestHeader("x-forwarded-host") ?? null,
          proto: getRequestHeader("x-forwarded-proto") ?? "https",
        });
      } catch (e) {
        console.error("notifySellerOfReview failed", e);
      }
    }

    return output;
  });

async function notifySellerOfReview(params: {
  sellerId: string;
  productId: string;
  productTitle: string;
  status: "pass" | "warn" | "fail";
  score: number;
  issues: AIReviewResult["issues"];
  callerAuthHeader: string | null;
  host: string | null;
  proto: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const approved = params.status === "pass";
  const uiStatus: "approved" | "needs-changes" = approved ? "approved" : "needs-changes";
  const title = approved
    ? `"${params.productTitle}" passed AI review`
    : `"${params.productTitle}" needs changes`;
  const body = approved
    ? `Score ${params.score}/100. Your product is approved and ready for the storefront.`
    : `Score ${params.score}/100. Review the flagged items and re-submit.`;
  const link = `/dashboard`;

  // In-app notification
  await supabaseAdmin.from("notifications").insert({
    user_id: params.sellerId,
    type: `product.review.${uiStatus}`,
    title,
    body,
    link,
    metadata: {
      productId: params.productId,
      score: params.score,
      status: uiStatus,
      issues: params.issues,
    },
  });

  // Look up seller email
  const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(params.sellerId);
  const email = userRes?.user?.email;
  if (!email) return;

  // Display name from profile
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("id", params.sellerId)
    .maybeSingle();

  // Internal call to the email send route, forwarding the caller's auth.
  if (!params.callerAuthHeader || !params.host) return;
  const url = `${params.proto}://${params.host}/lovable/email/transactional/send`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: params.callerAuthHeader },
    body: JSON.stringify({
      templateName: "product-review-update",
      recipientEmail: email,
      idempotencyKey: `product-review-${params.productId}-${uiStatus}-${Date.now()}`,
      templateData: {
        brandName: profile?.display_name ?? email.split("@")[0],
        productTitle: params.productTitle,
        status: uiStatus,
        score: params.score,
        issues: params.issues,
        productUrl: `https://aurumvault.store/products/${params.productId}`,
        siteUrl: "https://aurumvault.store",
      },
    }),
  });
}
