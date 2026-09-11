import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Copy, Download, FileJson, Loader2 } from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  resolveProductSeoTarget,
  saveProductSeoMetadata,
  type ProductSeoTarget,
} from "@/lib/product-seo-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/academy/product-seo")({
  head: () => ({
    meta: [
      { title: "Product SEO Metadata — AurumVault Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ProductSeoRoute,
});

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const secondaryKeywords = z
  .union([z.array(z.string()), z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === null || value === "") return [] as string[];
    const items = Array.isArray(value) ? value : value.split(",");
    return [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(0, 50);
  });

const ProductSeoPayloadSchema = z
  .object({
    product_id: z.string().uuid().optional(),
    product_slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "product_slug must be a clean lowercase slug")
      .optional(),
    seo_title: optionalText(200),
    seo_description: optionalText(500),
    seo_focus_keyword: optionalText(300),
    seo_secondary_keywords: secondaryKeywords,
    seo_image_alt: optionalText(300),
    seo_og_title: optionalText(300),
    seo_og_description: optionalText(500),
    seo_robots_index: z.boolean().optional(),
    seo_robots_follow: z.boolean().optional(),
  })
  .refine((value) => Boolean(value.product_id) !== Boolean(value.product_slug), {
    path: ["product_id"],
    message: "exactly one of product_id or product_slug is required",
  });

type ProductSeoPayload = z.output<typeof ProductSeoPayloadSchema>;

const TEMPLATE: ProductSeoPayload = {
  product_slug: "group-chat-disaster",
  seo_title: "The Group Chat Disaster | AurumVault",
  seo_description:
    "A compelling search-result description for this product page, written for people first.",
  seo_focus_keyword: "internal planning keyword",
  seo_secondary_keywords: ["supporting keyword one", "supporting keyword two"],
  seo_image_alt: "Descriptive alt text for the primary product cover",
  seo_og_title: "The Group Chat Disaster",
  seo_og_description: "A concise social sharing description for this product.",
  seo_robots_index: true,
  seo_robots_follow: true,
};

function ProductSeoRoute() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setChecking(false);
      navigate({ to: "/auth" });
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        const ok = data?.role === "admin";
        setIsAdmin(ok);
        setChecking(false);
        if (!ok) navigate({ to: "/dashboard" });
      });
  }, [loading, navigate, user]);

  if (loading || checking) {
    return (
      <MarketShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-ink/40" />
        </div>
      </MarketShell>
    );
  }
  if (!isAdmin) return null;

  return (
    <MarketShell>
      <ProductSeoEditor />
    </MarketShell>
  );
}

function ProductSeoEditor() {
  const resolveTarget = useServerFn(resolveProductSeoTarget);
  const saveMetadata = useServerFn(saveProductSeoMetadata);
  const templateText = useMemo(() => JSON.stringify(TEMPLATE, null, 2), []);
  const [rawJson, setRawJson] = useState(templateText);
  const [payload, setPayload] = useState<ProductSeoPayload | null>(null);
  const [product, setProduct] = useState<ProductSeoTarget | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);

  async function parseAndResolve() {
    setErrors([]);
    setPayload(null);
    setProduct(null);
    let decoded: unknown;
    try {
      decoded = JSON.parse(rawJson.replace(/^\uFEFF/, "").trim());
    } catch {
      setErrors(["The content is not valid JSON."]);
      return;
    }
    if (Array.isArray(decoded)) {
      setErrors(["Use one product SEO object at a time, not an array."]);
      return;
    }

    const parsed = ProductSeoPayloadSchema.safeParse(decoded);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`));
      return;
    }

    setResolving(true);
    try {
      const selector = parsed.data.product_id
        ? { product_id: parsed.data.product_id }
        : { product_slug: parsed.data.product_slug! };
      const resolved = await resolveTarget({ data: selector });
      setPayload(parsed.data);
      setProduct(resolved);
      toast.success("Product resolved. Review the SEO-only changes before saving.");
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
      await saveMetadata({
        data: {
          product_id: product.id,
          ...(payload.seo_title !== undefined ? { seo_title: payload.seo_title } : {}),
          ...(payload.seo_description !== undefined ? { seo_description: payload.seo_description } : {}),
          ...(payload.seo_focus_keyword !== undefined ? { seo_focus_keyword: payload.seo_focus_keyword } : {}),
          ...(payload.seo_secondary_keywords !== undefined
            ? { seo_secondary_keywords: payload.seo_secondary_keywords }
            : {}),
          ...(payload.seo_image_alt !== undefined ? { seo_image_alt: payload.seo_image_alt } : {}),
          ...(payload.seo_og_title !== undefined ? { seo_og_title: payload.seo_og_title } : {}),
          ...(payload.seo_og_description !== undefined
            ? { seo_og_description: payload.seo_og_description }
            : {}),
          ...(payload.seo_robots_index !== undefined
            ? { seo_robots_index: payload.seo_robots_index }
            : {}),
          ...(payload.seo_robots_follow !== undefined
            ? { seo_robots_follow: payload.seo_robots_follow }
            : {}),
        },
      });
      toast.success(`SEO metadata saved for “${product.title}”.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save SEO metadata.");
    } finally {
      setSaving(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([templateText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "aurumvault-product-seo-template.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyTemplate() {
    await navigator.clipboard.writeText(templateText);
    toast.success("Product SEO template copied.");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <Link to="/admin/academy/upload" className="inline-flex items-center gap-1 text-sm text-mute hover:text-ink">
        <ArrowLeft size={14} /> Academy JSON importer
      </Link>
      <h1 className="mt-3 font-serif text-3xl text-ink">Product SEO metadata</h1>
      <p className="mt-2 max-w-3xl text-sm text-mute">
        Admin-only SEO editor. Product identity, slug, pricing, files, creator ownership and publishing state cannot be changed here.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-ink">One product SEO JSON object</h2>
            <div className="flex gap-2">
              <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-3 py-2 text-sm">
                <Download size={14} /> Template
              </button>
              <button type="button" onClick={() => void copyTemplate()} className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-3 py-2 text-sm">
                <Copy size={14} /> Copy
              </button>
            </div>
          </div>

          <textarea
            value={rawJson}
            onChange={(event) => setRawJson(event.target.value)}
            spellCheck={false}
            className="mt-4 min-h-[430px] w-full rounded-xl border border-ink/15 bg-paper/40 p-4 font-mono text-xs text-ink outline-none focus:border-gold"
            aria-label="Product SEO JSON"
          />

          {errors.length > 0 && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {errors.map((error) => <div key={error}>{error}</div>)}
            </div>
          )}

          <button
            type="button"
            onClick={() => void parseAndResolve()}
            disabled={resolving}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {resolving ? <Loader2 size={15} className="animate-spin" /> : <FileJson size={15} />}
            Validate & resolve product
          </button>
        </section>

        <aside className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-ink">Review target</h2>
          {!product ? (
            <p className="mt-3 text-sm text-mute">Validate the JSON to resolve its exact product.</p>
          ) : (
            <div className="mt-4 space-y-4 text-sm">
              <div className="rounded-xl bg-paper/60 p-4">
                <div className="font-semibold text-ink">{product.title}</div>
                <div className="mt-1 break-all text-xs text-mute">ID: {product.id}</div>
                <div className="mt-1 break-all text-xs text-mute">Slug: {product.slug ?? "—"}</div>
                <div className="mt-1 text-xs text-mute">{product.status} · {product.published ? "published" : "not published"}</div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 size={15} /> Server-enforced SEO-only write
                </div>
                <p className="mt-2 text-xs">The server re-checks admin access and can update only the Phase 2 SEO columns plus seo_updated_at.</p>
              </div>
              <button
                type="button"
                onClick={() => void saveSeo()}
                disabled={!payload || saving}
                className="w-full rounded-full bg-gold px-5 py-3 text-sm font-bold text-navy disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save SEO metadata"}
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
