/**
 * Automated check: verify each published product's price is consistent across:
 *   - Homepage (/)
 *   - Browse page (/products)
 *   - Product detail page (/products/:id)
 *
 * Run with: bunx vitest run tests/integration/price-consistency.test.ts
 *
 * Set BASE_URL to override (defaults to https://www.aurumvault.store).
 */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.PRICE_CHECK_BASE_URL ?? "https://www.aurumvault.store";
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

const fmt = (cents: number) => {
  const dollars = cents / 100;
  // Match both "$14.99" and "$15" style renderings
  const withCents = `$${dollars.toFixed(2)}`;
  const whole = dollars % 1 === 0 ? `$${dollars.toFixed(0)}` : null;
  return { withCents, whole };
};

async function fetchHtml(path: string): Promise<string> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "user-agent": "AurumVault-PriceCheck/1.0" },
  });
  expect(res.ok, `${path} → HTTP ${res.status}`).toBe(true);
  return await res.text();
}

function priceAppears(html: string, cents: number): boolean {
  const { withCents, whole } = fmt(cents);
  if (html.includes(withCents)) return true;
  if (whole && html.includes(whole)) return true;
  return false;
}

describe("price consistency across homepage, browse, and PDP", () => {
  it("each published product shows the same price on all surfaces", async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data, error } = await supabase
      .from("marketplace_products")
      .select("id,title,price_cents")
      .eq("published", true)
      .eq("status", "approved");
    expect(error).toBeNull();
    const products = data ?? [];
    expect(products.length).toBeGreaterThan(0);

    const [homeHtml, browseHtml] = await Promise.all([
      fetchHtml("/"),
      fetchHtml("/products"),
    ]);

    const failures: string[] = [];

    for (const p of products) {
      const cents = p.price_cents as number;
      const pdpHtml = await fetchHtml(`/products/${p.id}`);
      const { withCents } = fmt(cents);

      if (!priceAppears(pdpHtml, cents)) {
        failures.push(`PDP missing ${withCents} for "${p.title}"`);
      }
      // Browse should list every published product
      if (!priceAppears(browseHtml, cents)) {
        failures.push(`Browse missing ${withCents} for "${p.title}"`);
      }
      // Homepage may not feature every product; only assert when title is present
      if (homeHtml.includes(p.title as string) && !priceAppears(homeHtml, cents)) {
        failures.push(`Home shows "${p.title}" but missing price ${withCents}`);
      }
    }

    expect(failures, failures.join("\n")).toEqual([]);
  }, 60_000);
});
