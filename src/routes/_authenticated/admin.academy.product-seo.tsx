import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Copy, FileJson, Loader2, Upload } from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/academy/product-seo")({
  head: () => ({
    meta: [
      { title: "Product SEO JSON — AurumVault Admin" },
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
    if (value === null) return [] as string[];
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
    seo_focus_keyword: optionalText(200),
    seo_secondary_keywords: secondaryKeywords,
    seo_image_alt: optionalText(300),
    seo_og_title: optionalText(200),
    seo_og_description: optionalText(500),
    seo_robots_index: z.boolean().optional().default(true),
    seo_robots_follow: z.boolean().optional().default(true),
  })
  .superRefine((value, ctx) => {
    if (!value.product_id && !value.product_slug) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["product_id"],
        message: "Provide product_id or product_slug so the update targets exactly one product.",
      });
    }
  });

type ProductSeoPayload = z.infer<typeof ProductSeoPayloadSchema>;

type ResolvedProduct = {
  id: string;
  slug: string | null;
  title: string;
  status: string;
  published: boolean;
};

const TEMPLATE = {
  product_slug: "group-chat-disaster",
  seo_title: "The Group Chat Disaster | Middle Grade Money Story | AurumVault",
  seo_description:
    "A funny middle-grade story about money, status, friendship and the pressure to look rich — with practical lessons young readers can actually use.",
  seo_focus_keyword: "middle grade money book",
  seo_secondary_keywords: ["financial literacy for kids", "money story for children"],
  seo_image_alt: "Cover of The Group Chat Disaster middle-grade money book",
  seo_og_title: "The Group Chat Disaster — A Money Story for Young Readers",
  seo_og_description:
    "A relatable story that helps young readers think differently about money, image and friendship.",
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [rawJson, setRawJson] = useState(JSON.stringify(TEMPLATE, null, 2));
  const [payload, setPayload] = useState<ProductSeoPayload | null>(null);
  const [product, setProduct] = useState<ResolvedProduct | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);

  const templateText = useMemo(() => JSON.stringify(TEMPLATE, null, 2), []);

  async function parseAndResolve(text = rawJson) {
    setErrors([]);
    setPayload(null);
    setProduct(null);
    let decoded: unknown;
    try {
      decoded = JSON.parse(text.replace(/^\uFEFF/, "").trim());
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
    let query = supabase
      .from("marketplace_products")
      .select("id,slug,title,status,published");
    if (parsed.data.product_id) query = query.eq("id", parsed.data.product_id);
    if (parsed.data.product_slug) query = query.eq("slug", parsed.data.product_slug);
    const { data, error } = await query.limit(2);
    setResolving(false);

    if (error) {
      setErrors([error.message]);
      return;
    }
    if (!data || data.length !== 1) {
      setErrors([
        data?.length
          ? "The selector matched more than one product. Use product_id for an exact target."
          : "No product matched that product_id/product_slug. Nothing was changed.",
      ]);
      return;
    }

    setPayload(parsed.data);
    setProduct(data[0] as ResolvedProduct);
    toast.success("Product resolved. Review the SEO-only patch before saving.");
  }

  async function saveSeo() {
    if (!payload || !product) return;
    setSaving(true);

    const normalizeNullable = (value: string | null | undefined) =>
      value === undefined ? undefined : value?.trim() ? value.trim() : null;

    const patch: Record<string, unknown> = {
      ...(payload.seo_title !== undefined
        ? { seo_title: normalizeNullable(payload.seo_title) }
        : {}),
      ...(payload.seo_description !== undefined
        ? { seo_description: normalizeNullable(payload.seo_description) }
        : {}),
      ...(payload.seo_focus_keyword !== undefined
        ? { seo_focus_keyword: normalizeNullable(payload.seo_focus_keyword) }
        : {}),
      ...(payload.seo_secondary_keywords !== undefined
        ? { seo_secondary_keywords: payload.seo_secondary_keywords }
        : {}),
      ...(payload.seo_image_alt !== undefined
        ? { seo_image_alt: normalizeNullable(payload.seo_image_alt) }
        : {}),
      ...(payload.seo_og_title !== undefined
        ? { seo_og_title: normalizeNullable(payload.seo_og_title) }
        : {}),
      ...(payload.seo_og_description !== undefined
        ? { seo_og_description: normalizeNullable(payload.seo_og_description) }
        : {}),
      seo_robots_index: payload.seo_robots_index,
      seo_robots_follow: payload.seo_robots_follow,
      seo_updated_at: new Date().toISOString(),
    };

    // The migration lands before this route is published. Keep the compatibility
    // cast scoped to this one SEO-only update until generated Supabase types catch up.
    const { error } = await (supabase.from("marketplace_products") as any)
      .update(patch)
      .eq("id", product.id);

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`SEO metadata saved for “${product.title}”.`);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setErrors(["File is larger than 2 MB."]);
      return;
    }
    try {
      const text = await file.text();
      setRawJson(text);
      await parseAndResolve(text);
    } catch {
      setErrors(["The browser could not read that file. Paste the JSON instead."]);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([templateText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aurumvault-product-seo-template.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyTemplate() {
    await navigator.clipboard.writeText(templateText);
    toast.success("Product SEO template copied.");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/admin/academy/upload"
            className="inline-flex items-center gap-1 text-sm text-mute hover:text-ink"
          >
            <ArrowLeft size={14} /> Academy JSON importer
          </Link>
          <h1 className="mt-3 font-serif text-3xl text-ink">Product SEO JSON</h1>
          <p className="mt-2 max-w-3xl text-sm text-mute">
            Admin-only metadata editor. It can change SEO fields only; product slugs, pricing,
            publishing state, files and creator ownership are outside this tool.
          </p>
        </div>
        <Link
          to="/admin/products"
          className="rounded-full border border-ink/15 bg-white px-4 py-2 text-sm text-ink hover:bg-ink/5"
        >
          All products
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink">Upload or paste one SEO object</h2>
              <p className="mt-1 text-xs text-mute">Use product_id or product_slug as the write selector.</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-ink"
            >
              <Upload size={15} /> Upload JSON
            </button>
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
              {errors.map((error) => (
                <div key={error}>{error}</div>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void parseAndResolve()}
              disabled={resolving}
              className="inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {resolving ? <Loader2 size={15} className="animate-spin" /> : <FileJson size={15} />}
              Validate & resolve product
            </button>
            <button
              type="button"
              onClick={downloadTemplate}
              className="rounded-full border border-ink/15 px-4 py-2.5 text-sm text-ink"
            >
              Download template
            </button>
            <button
              type="button"
              onClick={() => void copyTemplate()}
              className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-4 py-2.5 text-sm text-ink"
            >
              <Copy size={14} /> Copy template
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-ink">Review target</h2>
            {!product ? (
              <p className="mt-3 text-sm text-mute">Validate a payload to resolve its exact product.</p>
            ) : (
              <div className="mt-3 space-y-3 text-sm">
                <div className="rounded-xl bg-paper/60 p-4">
                  <div className="font-semibold text-ink">{product.title}</div>
                  <div className="mt-1 break-all text-xs text-mute">ID: {product.id}</div>
                  <div className="mt-1 break-all text-xs text-mute">Slug: {product.slug ?? "—"}</div>
                  <div className="mt-1 text-xs text-mute">
                    {product.status} · {product.published ? "published" : "not published"}
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 size={15} /> SEO-only update boundary
                  </div>
                  <p className="mt-2 text-xs">
                    Save writes only the supported SEO columns and seo_updated_at.
                  </p>
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
          </section>

          <section className="rounded-2xl border border-ink/10 bg-paper/60 p-5 text-xs text-mute">
            <h3 className="font-semibold text-ink">Search-engine behavior</h3>
            <p className="mt-2">
              Focus and secondary keywords are planning fields only. AurumVault does not emit a
              legacy meta-keywords tag. Published products default to index,follow unless this SEO
              record explicitly changes those flags.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
