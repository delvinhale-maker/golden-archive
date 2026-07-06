/**
 * Storefront robots-meta integration test.
 *
 * Renders `/store/:slug` against the running dev server and confirms:
 *   - Unapproved / missing slug → `<meta name="robots" content="noindex, follow">`
 *   - Approved slug             → `<meta name="robots" content="index, follow">`
 *
 * The approved-slug assertion is skipped (with a clear message) when the
 * project has no approved seller_application with a brand_slug yet.
 *
 * Run: bun test tests/integration/store-robots-meta.test.ts
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = process.env.STORE_TEST_BASE_URL ?? "http://localhost:8080";

function readEnv(key: string): string | undefined {
  try {
    const raw = readFileSync(join(process.cwd(), ".env"), "utf8");
    const line = raw.split("\n").find((l) => l.startsWith(`${key}=`));
    return line?.slice(key.length + 1).trim();
  } catch {
    return undefined;
  }
}

async function fetchHtml(path: string): Promise<{ status: number; html: string }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { accept: "text/html" },
    redirect: "follow",
  });
  return { status: res.status, html: await res.text() };
}

function robotsContent(html: string): string | null {
  const m = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']robots["']/i);
  return m ? m[1] : null;
}

async function findApprovedSlug(): Promise<string | null> {
  const url = readEnv("VITE_SUPABASE_URL");
  const key = readEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key) return null;
  const endpoint = `${url}/rest/v1/seller_applications?status=eq.approved&brand_slug=not.is.null&select=brand_slug&limit=1`;
  try {
    const res = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ brand_slug: string | null }>;
    return rows[0]?.brand_slug ?? null;
  } catch {
    return null;
  }
}

describe("Storefront robots meta", () => {
  it("returns noindex,follow for an unapproved/missing slug", async () => {
    const { status, html } = await fetchHtml("/store/__nonexistent-robots-test__");
    // Not-found still SSRs a page — status may be 404, robots meta must be present.
    expect([200, 404]).toContain(status);
    const robots = robotsContent(html);
    expect(robots, `no robots meta returned for missing slug; got status ${status}`).not.toBeNull();
    expect(robots!.replace(/\s+/g, "")).toBe("noindex,follow");
  });

  it("returns index,follow for an approved storefront", async () => {
    const slug = await findApprovedSlug();
    if (!slug) {
      console.warn(
        "[store-robots-meta] no approved seller_application with brand_slug found — skipping approved-branch assertion.",
      );
      return;
    }
    const { status, html } = await fetchHtml(`/store/${slug}`);
    expect(status).toBe(200);
    const robots = robotsContent(html);
    expect(robots, `no robots meta returned for approved slug ${slug}`).not.toBeNull();
    expect(robots!.replace(/\s+/g, "")).toBe("index,follow");
  });
});
