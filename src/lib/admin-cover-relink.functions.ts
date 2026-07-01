import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Admin utility: for approved Illustrious Capital products with missing/empty
// cover_url, attach the newest available upload from product-covers/{sellerId}/
// using a long-lived signed URL. Idempotent.
export const relinkMissingCovers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supa = context.supabase;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Only admins may run this.
    const { data: roleRow } = await supa
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Response("Forbidden", { status: 403 });

    const { data: products, error } = await supabaseAdmin
      .from("marketplace_products")
      .select("id, title, seller_id, cover_url")
      .eq("status", "approved")
      .eq("published", true);
    if (error) throw error;

    const results: Array<{ id: string; title: string; action: string }> = [];

    for (const p of products ?? []) {
      if (p.cover_url && p.cover_url.trim().length > 0) {
        results.push({ id: p.id, title: p.title, action: "already-linked" });
        continue;
      }
      const { data: files } = await supabaseAdmin.storage
        .from("product-covers")
        .list(p.seller_id, {
          limit: 100,
          sortBy: { column: "created_at", order: "desc" },
        });
      const first = files?.[0];
      if (!first) {
        results.push({ id: p.id, title: p.title, action: "no-uploads-found" });
        continue;
      }
      const path = `${p.seller_id}/${first.name}`;
      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from("product-covers")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (signErr || !signed?.signedUrl) {
        results.push({ id: p.id, title: p.title, action: "sign-failed" });
        continue;
      }
      await supabaseAdmin
        .from("marketplace_products")
        .update({ cover_url: signed.signedUrl })
        .eq("id", p.id);
      results.push({
        id: p.id,
        title: p.title,
        action: `linked:${first.name}`,
      });
    }

    return { ok: true, results };
  });
