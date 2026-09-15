import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  resolveProductSeoTarget,
  saveProductSeoMetadata,
  type ProductSeoTarget,
} from "@/lib/product-seo-admin.functions";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { Loader2, Upload, ArrowLeft, FileJson, CheckCircle2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/academy/product-seo")({
  head: () => ({
    meta: [
      { title: "Product SEO Metadata — AurumVault Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ProductSeoRoute,
});

/* ------------------------------------------------------------------ */
/* Template                                                            */
/* ------------------------------------------------------------------ */

const TEMPLATE_PRODUCT_SEO = {
  product_slug: "example-product-slug",
  seo_title: "Example Product Title | AurumVault",
  seo_description:
    "A concise, compelling search-result description for this specific product page.",
  seo_focus_keyword: "internal planning keyword (never rendered)",
  seo_secondary_keywords: ["supporting keyword one", "supporting keyword two"],
  seo_image_alt: "Describe the primary product image here",
  seo_og_title: "Example Product Title",
  seo_og_description: "A social sharing description for this product.",
  seo_robots_index: true,
  seo_robots_follow: true,
};

/* ------------------------------------------------------------------ */
/* JSON schema                                                         */
/* ------------------------------------------------------------------ */

const keywordList = z
  .union([z.array(z.string()), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return [] as string[];
    if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
    return String(v)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  });

const optStr = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => (v === undefined ? undefined : v === null ? null : String(v).trim()));

const optBool = z
  .union([z.boolean(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return undefined;
    if (typeof v === "boolean") return v;
    const s = String(v).toLowerCase().trim();
    return !(s === "false" || s === "no" || s === "0" || s.includes("no"));
  });

const PayloadSchema = z
  .object({
    product_id: optStr,
    product_slug: optStr,
    /** Display only — never used as the write selector. */
    title: optStr,
    seo_title: optStr,
    seo_description: optStr,
    seo_focus_keyword: optStr,
    seo_secondary_keywords: keywordList,
    seo_image_alt: optStr,
    seo_og_title: optStr,
    seo_og_description: optStr,
    seo_robots_index: optBool,
    seo_robots_follow: optBool,
  })
  .refine((d) => Boolean(d.product_id) !== Boolean(d.product_slug), {
    message: "exactly one of product_id or product_slug is required — title alone cannot select a product.",
    path: ["product_id"],
  })
  .refine((d) => d.seo_title == null || d.seo_title.length <= 200, {
    message: "seo_title must be 200 characters or fewer.",
    path: ["seo_title"],
  })
  .refine((d) => d.seo_description == null || d.seo_description.length <= 500, {
    message: "seo_description must be 500 characters or fewer.",
    path: ["seo_description"],
  })
  .refine((d) => d.seo_image_alt == null || d.seo_image_alt.length <= 300, {
    message: "seo_image_alt must be 300 characters or fewer.",
    path: ["seo_image_alt"],
  });

type Payload = z.output<typeof PayloadSchema>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/* ------------------------------------------------------------------ */
/* Route component                                                     */
/* ------------------------------------------------------------------ */

function ProductSeoRoute() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

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
  }, [user, loading, navigate]);

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
      <ProductSeoTool />
    </MarketShell>
  );
}

/* ------------------------------------------------------------------ */

function ProductSeoTool() {
  const resolveSeoTarget = useServerFn(resolveProductSeoTarget);
  const saveSeo = useServerFn(saveProductSeoMetadata);
  const fileRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [product, setProduct] = useState<ProductSeoTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragging, setDragging] = useState(false);

  const templateText = JSON.stringify(TEMPLATE_PRODUCT_SEO, null, 2);

  /** Resolves exactly one existing product by id or slug. Never by title. */
  const resolveProduct = async (p: Payload): Promise<ProductSeoTarget | null> => {
    if (p.product_id && !UUID_RE.test(p.product_id)) {
      setErrors(["product_id is not a valid product identifier."]);
      return null;
    }
    if (p.product_slug && !SLUG_RE.test(p.product_slug)) {
      setErrors(["product_slug must be lowercase words separated by hyphens."]);
      return null;
    }
    try {
      return await resolveSeoTarget({
        data: p.product_id ? { product_id: p.product_id } : { product_slug: p.product_slug ?? "" },
      });
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Couldn’t resolve that product."]);
      return null;
    }
  };

  const handleText = async (text: string, name: string) => {
    setErrors([]);
    setSaved(false);
    setProduct(null);
    setPayload(null);
    let raw: unknown;
    try {
      raw = JSON.parse(text.replace(/^\uFEFF/, "").trim());
    } catch {
      setErrors(["The file is not valid JSON. Check for trailing commas or missing quotes."]);
      return;
    }
    if (Array.isArray(raw)) {
      if (raw.length === 1 && raw[0] && typeof raw[0] === "object") {
        raw = raw[0];
      } else {
        setErrors(["Upload one product object at a time (a single { ... } object)."]);
        return;
      }
    }
    const parsed = PayloadSchema.safeParse(raw);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => `${i.path.join(".") || "payload"}: ${i.message}`));
      return;
    }
    const resolved = await resolveProduct(parsed.data);
    if (!resolved) return;
    setFileName(name);
    setPayload(parsed.data);
    setProduct(resolved);
    toast.success("JSON parsed and product matched — review before saving.");
  };

  const onFile = async (file: File | undefined | null) => {
    if (!file) return;
    setErrors([]);
    if (/\.(pdf|docx?|png|jpe?g|zip|epub|mp4)$/i.test(file.name)) {
      setErrors(["That doesn’t look like a .json file."]);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrors(["File is larger than 2 MB."]);
      return;
    }
    let text = "";
    try {
      text = await file.text();
    } catch {
      setErrors(["Your browser couldn’t read that file — paste the JSON instead."]);
      return;
    }
    if (!text.trim()) {
      setErrors(["That file came through empty."]);
      return;
    }
    await handleText(text, file.name);
  };

  /**
   * Delegates the write to the admin-guarded server function, which re-verifies
   * the caller's admin role server-side and writes ONLY the SEO columns plus
   * seo_updated_at. Slug, title, description, category, price, status,
   * published, seller_id and files are never touched.
   */
  const save = async () => {
    if (!payload || !product) return;
    setSaving(true);
    try {
      await saveSeo({
        data: {
          product_id: product.id,
          ...(payload.seo_title !== undefined ? { seo_title: payload.seo_title } : {}),
          ...(payload.seo_description !== undefined ? { seo_description: payload.seo_description } : {}),
          ...(payload.seo_focus_keyword !== undefined ? { seo_focus_keyword: payload.seo_focus_keyword } : {}),
          ...(payload.seo_secondary_keywords !== undefined ? { seo_secondary_keywords: payload.seo_secondary_keywords } : {}),
          ...(payload.seo_image_alt !== undefined ? { seo_image_alt: payload.seo_image_alt } : {}),
          ...(payload.seo_og_title !== undefined ? { seo_og_title: payload.seo_og_title } : {}),
          ...(payload.seo_og_description !== undefined ? { seo_og_description: payload.seo_og_description } : {}),
          ...(payload.seo_robots_index !== undefined ? { seo_robots_index: payload.seo_robots_index } : {}),
          ...(payload.seo_robots_follow !== undefined ? { seo_robots_follow: payload.seo_robots_follow } : {}),
        },
      });
      setSaved(true);
      toast.success("Product SEO metadata saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn’t save the SEO metadata.");
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = () => {
    try {
      const blob = new Blob([templateText], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "product-seo-template.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast.success("Template downloaded.");
    } catch {
      toast.error("Download blocked — use “Copy JSON” instead.");
    }
  };

  const copyTemplate = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(templateText);
      } else {
        const ta = document.createElement("textarea");
        ta.value = templateText;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      toast.success("Template JSON copied to clipboard.");
    } catch {
      toast.error("Couldn’t copy — use Download template instead.");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        to="/admin/academy/upload"
        className="inline-flex items-center gap-2 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to the Academy JSON importer
      </Link>

      <h1 className="mt-4 font-serif text-3xl text-ink">Product SEO metadata</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink/70">
        Update search and social metadata for one existing product at a time. This editor writes SEO
        fields only — a product’s slug, title, description, category, price and publish status are
        left untouched, and it never creates or deletes products. Saving is authorized on the server:
        only an admin account can write these fields.
      </p>

      {errors.length > 0 && (
        <div className="mt-6 rounded-xl border border-red-300 bg-red-50 p-4">
          <div className="flex items-center gap-2 font-medium text-red-800">
            <AlertTriangle className="h-4 w-4" /> This file couldn’t be used
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-red-700/80">Nothing was saved.</p>
        </div>
      )}

      {!product && (
        <div className="mt-6 space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void onFile(e.dataTransfer.files?.[0]);
            }}
            className={`rounded-2xl border-2 border-dashed p-10 text-center transition ${
              dragging ? "border-[#B8860B] bg-[#B8860B]/5" : "border-ink/20 bg-white"
            }`}
          >
            <FileJson className="mx-auto h-8 w-8 text-ink/40" />
            <p className="mt-3 text-sm text-ink/70">Drag a .json product SEO file here</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white"
            >
              <Upload className="h-4 w-4" /> Choose file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.txt,application/json,text/json,text/plain,*/*"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </div>

          <details open className="rounded-xl border border-ink/10 bg-white p-4 text-sm">
            <summary className="cursor-pointer font-medium text-ink">
              Or paste the JSON directly
            </summary>
            <PasteBox onSubmit={(t) => void handleText(t, "pasted.json")} template={templateText} />
          </details>

          <div className="flex flex-col gap-3 rounded-xl border border-[#B8860B]/25 bg-[#B8860B]/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-ink">Need the right format?</p>
              <p className="mt-1 text-xs text-ink/60">
                Download a ready-to-fill template with every supported product SEO field.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadTemplate}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#B8860B] bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-[#B8860B]/10"
              >
                <FileJson className="h-4 w-4" /> Download template
              </button>
              <button
                type="button"
                onClick={() => void copyTemplate()}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm font-medium text-ink/80 hover:bg-ink/5"
              >
                Copy JSON
              </button>
            </div>
          </div>

          <p className="text-xs text-ink/50">
            Required: <code>product_id</code> or <code>product_slug</code>. A title on its own is
            never enough to pick a product. Focus and secondary keywords are stored for internal
            planning only and are never published as meta keywords.
          </p>
        </div>
      )}

      {product && payload && (
        <div className="mt-6 space-y-6">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4" /> Matched from {fileName}
          </div>

          <div className="rounded-2xl border border-ink/10 bg-white p-5">
            <h2 className="font-serif text-lg text-ink">Product being updated</h2>
            <dl className="mt-4 grid gap-2 sm:grid-cols-2">
              <Meta k="Title (unchanged)" v={product.title} />
              <Meta k="Current slug (unchanged)" v={product.slug ?? "—"} />
            </dl>
          </div>

          <div className="rounded-2xl border border-ink/10 bg-white p-5">
            <h2 className="font-serif text-lg text-ink">SEO fields to save</h2>
            <dl className="mt-4 grid gap-2 sm:grid-cols-2">
              <Meta k="SEO title" v={payload.seo_title} />
              <Meta k="Image alt" v={payload.seo_image_alt} />
              <Meta k="Meta description" v={payload.seo_description} />
              <Meta k="OG title" v={payload.seo_og_title} />
              <Meta k="OG description" v={payload.seo_og_description} />
              <Meta
                k="Robots"
                v={`${payload.seo_robots_index === undefined ? "unchanged" : payload.seo_robots_index ? "index" : "noindex"}, ${
                  payload.seo_robots_follow === undefined ? "unchanged" : payload.seo_robots_follow ? "follow" : "nofollow"
                }`}
              />
              <Meta k="Focus keyword (internal only)" v={payload.seo_focus_keyword} />
              <Meta
                k="Secondary keywords (internal only)"
                v={payload.seo_secondary_keywords?.join(", ") ?? "unchanged"}
              />
            </dl>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving || saved}
              onClick={() => void save()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#B8860B] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saved ? "Saved" : "Save SEO metadata"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPayload(null);
                setProduct(null);
                setFileName("");
                setSaved(false);
              }}
              className="rounded-lg border border-ink/20 px-5 py-2.5 text-sm text-ink"
            >
              Start over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-[#B8860B]";

function Meta({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink/45">{k}</dt>
      <dd className="break-words text-ink/80">{v || "—"}</dd>
    </div>
  );
}

function PasteBox({
  onSubmit,
  template,
}: {
  onSubmit: (text: string) => void;
  template?: string;
}) {
  const [text, setText] = useState("");
  return (
    <div className="mt-3 space-y-3">
      <textarea
        className={`${inputCls} font-mono text-xs`}
        rows={8}
        placeholder='{ "product_slug": "...", "seo_title": "...", "seo_description": "..." }'
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSubmit(text)}
          disabled={!text.trim()}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Parse JSON
        </button>
        {template && (
          <button
            type="button"
            onClick={() => setText(template)}
            className="rounded-lg border border-ink/20 bg-white px-4 py-2 text-sm font-medium text-ink/80"
          >
            Paste template here
          </button>
        )}
      </div>
    </div>
  );
}