import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://www.aurumvault.store";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/products", changefreq: "daily", priority: "0.9" },
          { path: "/academy", changefreq: "daily", priority: "0.9" },
          { path: "/bundles", changefreq: "weekly", priority: "0.8" },
          // Brand / entity pages
          { path: "/about", changefreq: "monthly", priority: "0.8" },
          { path: "/about/trust", changefreq: "monthly", priority: "0.8" },
          { path: "/contact", changefreq: "monthly", priority: "0.5" },
          { path: "/support", changefreq: "monthly", priority: "0.5" },
          // Category / collection landing pages
          { path: "/creator-business-tools", changefreq: "weekly", priority: "0.8" },
          { path: "/business-systems", changefreq: "weekly", priority: "0.8" },
          { path: "/content-creator-templates", changefreq: "weekly", priority: "0.8" },
          { path: "/caption-templates", changefreq: "weekly", priority: "0.7" },
          { path: "/collections/film-tv-creator-production", changefreq: "weekly", priority: "0.7" },
          { path: "/kingdom-picks", changefreq: "weekly", priority: "0.6" },
          { path: "/vault", changefreq: "weekly", priority: "0.6" },
          // Creator acquisition
          { path: "/sell", changefreq: "monthly", priority: "0.7" },
          { path: "/sell-with-us", changefreq: "monthly", priority: "0.6" },
          { path: "/become-a-creator", changefreq: "monthly", priority: "0.7" },
          { path: "/creator-earnings", changefreq: "monthly", priority: "0.6" },
          { path: "/creator-starter-pack", changefreq: "monthly", priority: "0.6" },
          { path: "/founding-100", changefreq: "monthly", priority: "0.6" },
          { path: "/affiliates", changefreq: "monthly", priority: "0.5" },
          // Policies
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/refunds", changefreq: "yearly", priority: "0.3" },
          { path: "/affiliate-disclosure", changefreq: "yearly", priority: "0.3" },
          { path: "/creator-agreement", changefreq: "yearly", priority: "0.3" },
          { path: "/creator-terms", changefreq: "yearly", priority: "0.3" },
        ];


        // Pull every published, approved product directly from the public Data API
        // using the publishable key. Narrow `TO anon` SELECT policy on
        // marketplace_products gates this read.
        try {
          const url = process.env.SUPABASE_URL;
          const key = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (url && key) {
            const headers = {
              apikey: key,
              Authorization: `Bearer ${key}`,
              Accept: "application/json",
            };
            const logFailure = async (label: string, res: Response) => {
              let body = "";
              try {
                body = (await res.text()).slice(0, 500);
              } catch {
                body = "<unreadable body>";
              }
              console.error(
                `[sitemap] ${label} query failed: HTTP ${res.status} ${res.statusText} — ${body}`,
              );
            };

            const [prodRes, storeRes, catRes, articleRes] = await Promise.all([
              fetch(
                `${url}/rest/v1/marketplace_products?select=id&status=eq.approved&published=eq.true`,
                { headers },
              ),
              fetch(
                `${url}/rest/v1/seller_applications?select=brand_slug,created_at&status=eq.approved`,
                { headers },
              ),
              fetch(`${url}/rest/v1/academy_categories?select=slug`, { headers }),
              fetch(
                `${url}/rest/v1/academy_articles?select=slug,updated_at&status=eq.published`,
                { headers },
              ),
            ]);
            if (prodRes.ok) {
              const rows = (await prodRes.json()) as Array<{ id: string }>;
              for (const row of rows) {
                entries.push({
                  path: `/products/${row.id}`,
                  changefreq: "weekly",
                  priority: "0.8",
                });
              }
            } else {
              await logFailure("marketplace_products", prodRes);
            }
            if (storeRes.ok) {
              const stores = (await storeRes.json()) as Array<{
                brand_slug: string | null;
                created_at?: string | null;
              }>;
              for (const s of stores) {
                if (!s.brand_slug) continue;
                entries.push({
                  path: `/store/${s.brand_slug}`,
                  lastmod: s.created_at
                    ? new Date(s.created_at).toISOString().slice(0, 10)
                    : undefined,
                  changefreq: "weekly",
                  priority: "0.7",
                });
              }
            } else {
              await logFailure("seller_applications", storeRes);
            }
            if (catRes.ok) {
              const cats = (await catRes.json()) as Array<{ slug: string }>;
              for (const c of cats) {
                entries.push({
                  path: `/academy/${c.slug}`,
                  changefreq: "weekly",
                  priority: "0.7",
                });
              }
            } else {
              await logFailure("academy_categories", catRes);
            }
            if (articleRes.ok) {
              const arts = (await articleRes.json()) as Array<{
                slug: string;
                updated_at?: string | null;
              }>;
              for (const a of arts) {
                entries.push({
                  path: `/academy/article/${a.slug}`,
                  lastmod: a.updated_at
                    ? new Date(a.updated_at).toISOString().slice(0, 10)
                    : undefined,
                  changefreq: "weekly",
                  priority: "0.8",
                });
              }
            } else {
              await logFailure("academy_articles", articleRes);
            }
          }
        } catch (err) {
          console.error("[sitemap] dynamic entry fetch threw:", err);
          // Sitemap should still render with static routes if the DB read fails
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
