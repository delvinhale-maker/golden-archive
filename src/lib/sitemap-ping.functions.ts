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

/**
 * Notify search engines that specific public URLs changed (IndexNow) and that
 * the sitemap should be re-read. Call this only on meaningful publish /
 * update / unpublish events — never on every render.
 *
 * Never throws: IndexNow problems must not break publishing workflows.
 * Failures are logged server-side (`[indexnow] ...`) and reported in the
 * return value so callers can surface them if useful.
 */
export const notifySearchEngines = createServerFn({ method: "POST" })
  .inputValidator((data: { paths: string[] }) => ({
    paths: Array.isArray(data?.paths)
      ? data.paths.filter((p) => typeof p === "string").slice(0, 100)
      : [],
  }))
  .handler(async ({ data }) => {
    const { submitToIndexNow } = await import("./indexnow.server");
    const indexnow = await submitToIndexNow(
      data.paths.length ? data.paths : ["/"],
    );
    return { indexnow };
  });
