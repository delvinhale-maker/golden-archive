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
          { path: "/sell", changefreq: "monthly", priority: "0.7" },
          { path: "/auth", changefreq: "yearly", priority: "0.3" },
        ];

        // Pull every published, approved product directly from the public Data API
        // using the publishable key. Narrow `TO anon` SELECT policy on
        // marketplace_products gates this read.
        try {
          const url = process.env.SUPABASE_URL;
          const key = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (url && key) {
            const res = await fetch(
              `${url}/rest/v1/marketplace_products?select=id,updated_at&status=eq.approved&published=eq.true`,
              {
                headers: {
                  apikey: key,
                  Authorization: `Bearer ${key}`,
                  Accept: "application/json",
                },
              },
            );
            if (res.ok) {
              const rows = (await res.json()) as Array<{
                id: string;
                updated_at?: string | null;
              }>;
              for (const row of rows) {
                entries.push({
                  path: `/products/${row.id}`,
                  lastmod: row.updated_at
                    ? new Date(row.updated_at).toISOString().slice(0, 10)
                    : undefined,
                  changefreq: "weekly",
                  priority: "0.8",
                });
              }
            }
          }
        } catch {
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
