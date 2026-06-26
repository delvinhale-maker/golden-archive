import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Category codes stored in marketplace_products.category
const CATEGORY_CODES = [
  "ebooks",
  "courses",
  "templates",
  "audio",
  "leadership",
] as const;

type CategoryCode = (typeof CATEGORY_CODES)[number];

const DISPLAY_LABEL: Record<CategoryCode, string> = {
  ebooks: "eBooks",
  courses: "Courses",
  templates: "Templates",
  audio: "Audio",
  leadership: "Leadership",
};

export const Route = createFileRoute("/api/public/health/categories")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = `${url.protocol}//${url.host}`;

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            auth: {
              storage: undefined,
              persistSession: false,
              autoRefreshToken: false,
            },
          },
        );

        const results = await Promise.all(
          CATEGORY_CODES.map(async (code) => {
            const label = DISPLAY_LABEL[code];
            const publicUrl = `${origin}/products?category=${encodeURIComponent(label)}`;
            try {
              const { data, error, count } = await supabase
                .from("marketplace_products")
                .select("id,title", { count: "exact" })
                .eq("status", "approved")
                .eq("category", code);

              if (error) {
                return {
                  category: label,
                  url: publicUrl,
                  ok: false,
                  approvedCount: 0,
                  sample: [] as Array<{ id: string; title: string }>,
                  error: error.message,
                };
              }

              const items = (data ?? []) as Array<{ id: string; title: string }>;
              return {
                category: label,
                url: publicUrl,
                // "OK" means the storefront query for this category works.
                // An empty category is still OK (just no products yet).
                ok: true,
                approvedCount: count ?? items.length,
                sample: items.slice(0, 3),
              };
            } catch (e) {
              return {
                category: label,
                url: publicUrl,
                ok: false,
                approvedCount: 0,
                sample: [],
                error: e instanceof Error ? e.message : String(e),
              };
            }
          }),
        );

        const allOk = results.every((r) => r.ok);
        const populated = results.filter((r) => r.approvedCount > 0).length;

        return Response.json(
          {
            ok: allOk,
            checkedAt: new Date().toISOString(),
            origin,
            summary: {
              categoriesChecked: results.length,
              categoriesWithProducts: populated,
              totalApproved: results.reduce((s, r) => s + r.approvedCount, 0),
            },
            results,
          },
          {
            status: allOk ? 200 : 500,
            headers: { "Cache-Control": "no-store" },
          },
        );
      },
    },
  },
});
