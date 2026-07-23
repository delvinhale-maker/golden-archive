import { createServerFn } from "@tanstack/react-start";

const SITEMAP_URL = "https://www.aurumvault.store/sitemap.xml";

/**
 * Ping search engines that the sitemap has changed.
 * Google deprecated the sitemap ping endpoint in 2023 but still returns
 * a soft 200/404; Bing/IndexNow still honors it. Failures are ignored
 * so this never blocks a publish.
 */
export const pingSearchEngines = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ google: number | null; bing: number | null }> => {
    const encoded = encodeURIComponent(SITEMAP_URL);
    const targets = {
      google: `https://www.google.com/ping?sitemap=${encoded}`,
      bing: `https://www.bing.com/ping?sitemap=${encoded}`,
    };
    const results: { google: number | null; bing: number | null } = {
      google: null,
      bing: null,
    };
    await Promise.all(
      (Object.entries(targets) as Array<["google" | "bing", string]>).map(
        async ([key, url]) => {
          try {
            const res = await fetch(url, { method: "GET" });
            results[key] = res.status;
          } catch {
            results[key] = null;
          }
        },
      ),
    );
    return results;
  },
);
