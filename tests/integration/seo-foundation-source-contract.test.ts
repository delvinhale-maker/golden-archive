import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("SEO foundation source contracts", () => {
  it("catalog listing query selects slug for canonical ProductCard links", () => {
    expect(read("src/lib/marketplace.functions.ts")).toContain(
      '"id,slug,title,category,subcategory,product_type,delivery_contents',
    );
  });

  it("product loader performs a permanent canonical redirect", () => {
    const source = read("src/routes/products.$id.tsx");
    expect(source).toContain('result.kind === "redirect"');
    expect(source).toContain("statusCode: 301");
  });

  it("sitemap has image namespace and new acquisition route", () => {
    const source = read("src/routes/sitemap[.]xml.ts");
    expect(source).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(source).toContain('/tools/ai-likeness-rights-risk-checker');
  });
});
