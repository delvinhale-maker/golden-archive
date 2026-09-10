from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text()
    if new in text:
        print(f"SKIP {label}: already applied")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one anchor, found {count}")
    p.write_text(text.replace(old, new, 1))
    print(f"APPLY {label}")


mp = "src/lib/marketplace.functions.ts"
replace_once(
    mp,
    "  delivery_contents?: string[] | null;\n};",
    "  delivery_contents?: string[] | null;\n  seo_title?: string | null;\n  seo_description?: string | null;\n  seo_image_alt?: string | null;\n  seo_og_title?: string | null;\n  seo_og_description?: string | null;\n  seo_robots_index?: boolean | null;\n  seo_robots_follow?: boolean | null;\n};",
    "DbProductRow SEO fields",
)
replace_once(
    mp,
    "    productType: r.product_type ?? null,\n    deliveryContents: Array.isArray(r.delivery_contents) ? r.delivery_contents : [],\n  };",
    "    productType: r.product_type ?? null,\n    deliveryContents: Array.isArray(r.delivery_contents) ? r.delivery_contents : [],\n    ...(Object.prototype.hasOwnProperty.call(r, \"seo_title\")\n      ? {\n          seoTitle: r.seo_title?.trim() || null,\n          seoDescription: r.seo_description?.trim() || null,\n          seoImageAlt: r.seo_image_alt?.trim() || null,\n          seoOgTitle: r.seo_og_title?.trim() || null,\n          seoOgDescription: r.seo_og_description?.trim() || null,\n          seoRobotsIndex: r.seo_robots_index ?? true,\n          seoRobotsFollow: r.seo_robots_follow ?? true,\n        }\n      : {}),\n  };",
    "detail-only SEO mapping",
)
replace_once(
    mp,
    "  /** What the buyer receives (formats/assets) — descriptive, not taxonomy. */\n  deliveryContents?: string[];\n};",
    "  /** What the buyer receives (formats/assets) — descriptive, not taxonomy. */\n  deliveryContents?: string[];\n  /** SEO Phase 2 overrides populated on product-detail reads only. */\n  seoTitle?: string | null;\n  seoDescription?: string | null;\n  seoImageAlt?: string | null;\n  seoOgTitle?: string | null;\n  seoOgDescription?: string | null;\n  seoRobotsIndex?: boolean;\n  seoRobotsFollow?: boolean;\n  /** Internal planning-only fields; never selected into public product reads. */\n  seoFocusKeyword?: never;\n  seoSecondaryKeywords?: never;\n};",
    "Product SEO fields",
)
replace_once(
    mp,
    '"id,slug,title,category,subcategory,product_type,delivery_contents,price_cents,compare_at_price_cents,cover_url,description,seller_id,created_at,ai_review_status,ai_review_score,status,published,is_preorder,release_date,released_at,preorder_note,admin_notes,file_path,preview_pages" as const;',
    '"id,slug,title,category,subcategory,product_type,delivery_contents,price_cents,compare_at_price_cents,cover_url,description,seller_id,created_at,ai_review_status,ai_review_score,status,published,is_preorder,release_date,released_at,preorder_note,admin_notes,file_path,preview_pages,seo_title,seo_description,seo_image_alt,seo_og_title,seo_og_description,seo_robots_index,seo_robots_follow" as const;',
    "detail SELECT SEO fields",
)

# Generated Supabase types: add only Phase 2 fields inside marketplace_products.
types_path = Path("src/integrations/supabase/types.ts")
types = types_path.read_text()
start = types.index("      marketplace_products: {")
end = types.index("      product_subcategories: {", start)
block = types[start:end]
if "seo_title: string | null" not in block:
    lines = block.splitlines()
    seller_indexes = [i for i, line in enumerate(lines) if line.strip().startswith("seller_id")]
    if len(seller_indexes) != 3:
        raise SystemExit(f"marketplace_products generated types: expected 3 seller_id anchors, found {len(seller_indexes)}")
    row_fields = [
        "          seo_description: string | null",
        "          seo_focus_keyword: string | null",
        "          seo_image_alt: string | null",
        "          seo_og_description: string | null",
        "          seo_og_title: string | null",
        "          seo_robots_follow: boolean",
        "          seo_robots_index: boolean",
        "          seo_secondary_keywords: string[]",
        "          seo_title: string | null",
        "          seo_updated_at: string | null",
    ]
    optional_fields = [line.replace(":", "?:", 1) for line in row_fields]
    for ordinal, idx in reversed(list(enumerate(seller_indexes))):
        fields = row_fields if ordinal == 0 else optional_fields
        lines[idx + 1:idx + 1] = fields
    new_block = "\n".join(lines) + ("\n" if block.endswith("\n") else "")
    types_path.write_text(types[:start] + new_block + types[end:])
    print("APPLY narrow marketplace_products generated SEO types")
else:
    print("SKIP generated SEO types: already applied")

pr = "src/routes/products.$id.tsx"
replace_once(
    pr,
    '    const desc = rawDesc.length > 160 ? `${rawDesc.slice(0, 157)}…` : rawDesc;',
    '''    // SEO Phase 2 overrides affect search/social metadata only. The visible\n    // product description remains the source for Product JSON-LD.\n    const seoTitle = p?.seoTitle?.trim();\n    if (seoTitle) baseTitle = seoTitle;\n    const seoDescription = p?.seoDescription?.trim();\n    const metaSource = seoDescription || rawDesc;\n    const desc = metaSource.length > 160 ? `${metaSource.slice(0, 157)}…` : metaSource;\n    const ogTitle = p?.seoOgTitle?.trim() || baseTitle;\n    const ogDescRaw = p?.seoOgDescription?.trim() || metaSource;\n    const ogDesc = ogDescRaw.length > 200 ? `${ogDescRaw.slice(0, 197)}…` : ogDescRaw;\n    const robots = isUnpublished\n      ? "noindex, follow"\n      : `${p?.seoRobotsIndex === false ? "noindex" : "index"}, ${\n          p?.seoRobotsFollow === false ? "nofollow" : "follow"\n        }`;''',
    "SEO metadata precedence",
)
replace_once(
    pr,
    '''    const imageAlt = p?.title\n      ? `Cover for ${p.title} on AurumVault`\n      : "AurumVault | Digital Product Marketplace for Creators";''',
    '''    const imageAlt =\n      p?.seoImageAlt?.trim() ||\n      (p?.title\n        ? `Cover for ${p.title} on AurumVault`\n        : "AurumVault | Digital Product Marketplace for Creators");''',
    "SEO image alt metadata",
)
replace_once(pr, '{ name: "robots", content: isUnpublished ? "noindex, follow" : "index, follow" },', '{ name: "robots", content: robots },', "robots flags")
replace_once(pr, '{ property: "og:title", content: baseTitle },', '{ property: "og:title", content: ogTitle },', "OG title")
replace_once(pr, '{ property: "og:description", content: desc },', '{ property: "og:description", content: ogDesc },', "OG description")
replace_once(pr, '{ name: "twitter:title", content: baseTitle },', '{ name: "twitter:title", content: ogTitle },', "Twitter title")
replace_once(pr, '{ name: "twitter:description", content: desc },', '{ name: "twitter:description", content: ogDesc },', "Twitter description")

p = Path(pr)
text = p.read_text()
plain_alt = text.count("alt={product.title}")
seo_alt = text.count("alt={product.seoImageAlt?.trim() || product.title}")
if plain_alt == 2 and seo_alt == 0:
    p.write_text(text.replace("alt={product.title}", "alt={product.seoImageAlt?.trim() || product.title}"))
    print("APPLY visible product image alts")
elif plain_alt == 0 and seo_alt == 2:
    print("SKIP visible product image alts: already applied")
else:
    raise SystemExit(f"product image alt anchors: unexpected plain={plain_alt} seo={seo_alt}")

sm = "src/routes/sitemap[.]xml.ts"
replace_once(
    sm,
    'marketplace_products?select=id,slug,updated_at&status=eq.approved&published=eq.true',
    'marketplace_products?select=id,slug,updated_at,seo_robots_index&status=eq.approved&published=eq.true',
    "sitemap SEO robots selection",
)
replace_once(
    sm,
    '                updated_at?: string | null;\n              }>;',
    '                updated_at?: string | null;\n                seo_robots_index?: boolean | null;\n              }>;',
    "sitemap SEO robots type",
)
replace_once(
    sm,
    '              for (const row of rows) {\n                // Prefer the clean, canonical slug URL; fall back to the UUID',
    '              for (const row of rows) {\n                if (row.seo_robots_index === false) continue;\n                // Prefer the clean, canonical slug URL; fall back to the UUID',
    "sitemap excludes noindex products",
)

au = "src/routes/_authenticated/admin.academy.upload.tsx"
replace_once(
    au,
    '''      <p className="mt-2 max-w-2xl text-sm text-ink/70">\n        Drop in a single <code>.json</code> file, review the populated fields, then save as a draft\n        or publish. Nothing goes live from the upload step.\n      </p>''',
    '''      <p className="mt-2 max-w-2xl text-sm text-ink/70">\n        Drop in a single <code>.json</code> file, review the populated fields, then save as a draft\n        or publish. Nothing goes live from the upload step.\n      </p>\n\n      <div className="mt-4 flex flex-col gap-2 rounded-xl border border-ink/10 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">\n        <p className="text-sm text-ink/70">\n          Editing search metadata for an existing product instead of an article?\n        </p>\n        <Link\n          to="/admin/academy/product-seo"\n          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#B8860B] bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-[#B8860B]/10"\n        >\n          <FileJson className="h-4 w-4" /> Open the Product SEO editor\n        </Link>\n      </div>''',
    "Academy importer Product SEO entry point",
)
