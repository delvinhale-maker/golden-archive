from pathlib import Path

route = Path("src/routes/_authenticated/admin.academy.product-seo.tsx")
s = route.read_text()

if 'import { useServerFn } from "@tanstack/react-start";' not in s:
    anchor = 'import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";\n'
    if anchor not in s:
        raise SystemExit("router import anchor missing")
    s = s.replace(anchor, anchor + 'import { useServerFn } from "@tanstack/react-start";\n', 1)

admin_import = (
    'import { resolveProductSeoTarget, saveProductSeoMetadata } '
    'from "@/lib/product-seo-admin.functions";\n'
)
if admin_import not in s:
    anchor = 'import { useAuth } from "@/hooks/use-auth";\n'
    if anchor not in s:
        raise SystemExit("useAuth import anchor missing")
    s = s.replace(anchor, anchor + admin_import, 1)

marker = "function ProductSeoEditor() {\n"
if marker not in s:
    raise SystemExit("ProductSeoEditor marker missing")
if "useServerFn(resolveProductSeoTarget)" not in s:
    s = s.replace(
        marker,
        marker
        + "  const resolveSeoTarget = useServerFn(resolveProductSeoTarget);\n"
        + "  const saveSeoServer = useServerFn(saveProductSeoMetadata);\n",
        1,
    )

start = s.index("  async function parseAndResolve(")
end = s.index("  async function onFile(", start)
replacement = '''  async function parseAndResolve(text = rawJson) {
    setErrors([]);
    setPayload(null);
    setProduct(null);
    let decoded: unknown;
    try {
      decoded = JSON.parse(text.replace(/^\\uFEFF/, "").trim());
    } catch {
      setErrors(["The content is not valid JSON."]);
      return;
    }
    if (Array.isArray(decoded)) {
      setErrors(["Upload one product SEO object at a time, not an array."]);
      return;
    }

    const parsed = ProductSeoPayloadSchema.safeParse(decoded);
    if (!parsed.success) {
      setErrors(
        parsed.error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`),
      );
      return;
    }

    setResolving(true);
    try {
      const resolved = await resolveSeoTarget({
        data: {
          product_id: parsed.data.product_id,
          product_slug: parsed.data.product_slug,
        },
      });
      setPayload(parsed.data);
      setProduct(resolved);
      toast.success("Product resolved. Review the SEO-only patch before saving.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Could not resolve that product."]);
    } finally {
      setResolving(false);
    }
  }

  async function saveSeo() {
    if (!payload || !product) return;
    setSaving(true);
    try {
      await saveSeoServer({
        data: {
          product_id: product.id,
          seo_title: payload.seo_title,
          seo_description: payload.seo_description,
          seo_focus_keyword: payload.seo_focus_keyword,
          seo_secondary_keywords: payload.seo_secondary_keywords,
          seo_image_alt: payload.seo_image_alt,
          seo_og_title: payload.seo_og_title,
          seo_og_description: payload.seo_og_description,
          seo_robots_index: payload.seo_robots_index,
          seo_robots_follow: payload.seo_robots_follow,
        },
      });
      toast.success(`SEO metadata saved for “${product.title}”.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save SEO metadata.");
    } finally {
      setSaving(false);
    }
  }

'''
s = s[:start] + replacement + s[end:]

editor = s[s.index(marker):]
if '.from("marketplace_products")' in editor:
    raise SystemExit("browser marketplace_products access remains in ProductSeoEditor")
if ".update(" in editor:
    raise SystemExit("browser update remains in ProductSeoEditor")

route.write_text(s)
print("Phase 2 admin route hardened")
