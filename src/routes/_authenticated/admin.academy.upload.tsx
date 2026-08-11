import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { Loader2, Upload, ArrowLeft, FileJson, CheckCircle2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/academy/upload")({
  head: () => ({
    meta: [
      { title: "Bulk Import Academy Article — AurumVault Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AcademyUploadRoute,
});

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
  { value: "financial-freedom", label: "Financial Freedom" },
  { value: "ai-productivity", label: "AI & Productivity" },
  { value: "digital-publishing", label: "Digital Publishing" },
  { value: "kingdom-living", label: "Kingdom Living" },
  { value: "entrepreneurship", label: "Entrepreneurship" },
];
const CATEGORY_VALUES = CATEGORIES.map((c) => c.value);

/** Loose category matching so real-world files (e.g. "AI & Productivity") import cleanly. */
const CATEGORY_ALIASES: Record<string, string> = {
  ai: "ai-productivity",
  aiproductivity: "ai-productivity",
  productivity: "ai-productivity",
  aitools: "ai-productivity",
  finance: "financial-freedom",
  financial: "financial-freedom",
  financialfreedom: "financial-freedom",
  money: "financial-freedom",
  credit: "financial-freedom",
  publishing: "digital-publishing",
  digitalpublishing: "digital-publishing",
  selfpublishing: "digital-publishing",
  writing: "digital-publishing",
  kingdom: "kingdom-living",
  kingdomliving: "kingdom-living",
  faith: "kingdom-living",
  business: "entrepreneurship",
  entrepreneur: "entrepreneurship",
  entrepreneurship: "entrepreneurship",
  startup: "entrepreneurship",
};

/** Returns a valid Academy category, or null when nothing matches. */
function normalizeCategory(input: string): string | null {
  const key = input.toLowerCase().replace(/\band\b|&/g, "").replace(/[^a-z0-9]/g, "");
  if (!key) return null;
  const exact = CATEGORY_VALUES.find((v) => v.replace(/-/g, "") === key);
  if (exact) return exact;
  if (CATEGORY_ALIASES[key]) return CATEGORY_ALIASES[key];
  const partial = CATEGORY_VALUES.find(
    (v) => key.includes(v.replace(/-/g, "")) || v.replace(/-/g, "").includes(key),
  );
  return partial ?? null;
}



const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;

/** Ready-to-fill sample used by the download / copy / demo-fill buttons. */
const TEMPLATE_ARTICLE = {
  seo_title: "The Sample Academy Article",
  focus_keyword: "sample focus keyword",
  meta_description: "A concise description of the sample Academy article for search results.",
  secondary_keywords: ["supporting keyword one", "supporting keyword two"],
  url_slug: "sample-academy-article",
  canonical_url: "",
  schema_type: "Article",
  og_title: "The Sample Academy Article",
  og_description: "A social sharing description for the sample Academy article.",
  twitter_card: "summary_large_image",
  index_follow: true,
  subtitle: "A short supporting subtitle",
  category: "financial-freedom",
  difficulty: "beginner",
  author: "AurumVault Editorial",
  excerpt: "A short summary shown before the full Academy article.",
  tags: ["sample", "academy"],
  featured_image_alt: "Describe the featured image here",
  image_caption: "Optional caption for the featured image.",
  recommended_products: [] as string[],
  related_articles: [] as string[],
  body_markdown:
    "# The Sample Academy Article\n\nReplace this text with the full article body in Markdown. Include at least 50 characters so the article can be validated and saved.",
};


/* ------------------------------------------------------------------ */
/* JSON schema                                                         */
/* ------------------------------------------------------------------ */

const strArr = z
  .union([z.array(z.string()), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (!v) return [] as string[];
    if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
    return String(v)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  });

const optStr = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => (v === null || v === undefined ? "" : String(v).trim()));

const PayloadSchema = z.object({
  seo_title: z.string({ message: "seo_title is required" }).trim().min(3).max(200),
  body_markdown: z.string({ message: "body_markdown is required" }).trim().min(50),
  category: z
    .string({ message: "category is required" })
    .trim()
    .min(1)
    .transform((v) => v.toLowerCase()),

  focus_keyword: optStr,
  meta_description: optStr,
  secondary_keywords: strArr,
  url_slug: optStr,
  canonical_url: optStr,
  schema_type: optStr,
  og_title: optStr,
  og_description: optStr,
  twitter_card: optStr,
  index_follow: z.union([z.boolean(), z.string(), z.null(), z.undefined()]).optional(),
  subtitle: optStr,
  difficulty: optStr,
  author: optStr,
  excerpt: optStr,
  tags: strArr,
  featured_image_alt: optStr,
  image_caption: optStr,
  recommended_products: strArr,
  related_articles: strArr,
});

type Payload = z.infer<typeof PayloadSchema>;

type FormState = {
  title: string;
  subtitle: string;
  slug: string;
  category: string;
  difficulty: string;
  author_name: string;
  excerpt: string;
  body: string;
  meta_title: string;
  meta_description: string;
  focus_keyword: string;
  secondary_keywords: string;
  canonical_url: string;
  schema_type: string;
  og_title: string;
  og_description: string;
  twitter_card: string;
  robots_index: boolean;
  robots_follow: boolean;
  tags: string;
  cover_alt: string;
  cover_caption: string;
  recommended_products: string[];
  related_articles: string[];
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function parseIndexFollow(v: unknown): { index: boolean; follow: boolean } {
  if (v === undefined || v === null || v === "") return { index: true, follow: true };
  if (typeof v === "boolean") return { index: v, follow: v };
  const s = String(v).toLowerCase();
  return { index: !s.includes("noindex"), follow: !s.includes("nofollow") };
}

function toForm(p: Payload): FormState {
  const idxf = parseIndexFollow(p.index_follow);
  const difficulty = DIFFICULTIES.includes(p.difficulty.toLowerCase() as never)
    ? p.difficulty.toLowerCase()
    : "beginner";
  return {
    title: p.seo_title,
    subtitle: p.subtitle,
    slug: p.url_slug ? slugify(p.url_slug) : slugify(p.seo_title),
    category: p.category,
    difficulty,
    author_name: p.author || "AurumVault Editorial",
    excerpt: p.excerpt,
    body: p.body_markdown,
    meta_title: p.seo_title,
    meta_description: p.meta_description,
    focus_keyword: p.focus_keyword,
    secondary_keywords: p.secondary_keywords.join(", "),
    canonical_url: p.canonical_url,
    schema_type: p.schema_type || "Article",
    og_title: p.og_title || p.seo_title,
    og_description: p.og_description || p.meta_description,
    twitter_card: p.twitter_card || "summary_large_image",
    robots_index: idxf.index,
    robots_follow: idxf.follow,
    tags: p.tags.join(", "),
    cover_alt: p.featured_image_alt,
    cover_caption: p.image_caption,
    recommended_products: p.recommended_products,
    related_articles: p.related_articles,
  };
}

/** Minimal markdown → HTML (mirrors the live article renderer). */
function renderMarkdown(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (t: string) =>
    esc(t)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");
  const out: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      closeList();
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      continue;
    }
    const li = line.match(/^[-*]\s+(.*)$/);
    if (li) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(li[1])}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join("\n");
}

/* ------------------------------------------------------------------ */
/* Route component                                                     */
/* ------------------------------------------------------------------ */

function AcademyUploadRoute() {
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
      <ImportTool />
    </MarketShell>
  );
}

/* ------------------------------------------------------------------ */

function ImportTool() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [step, setStep] = useState<"upload" | "edit" | "review">("upload");
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const handleText = (text: string, name: string) => {
    setErrors([]);
    setWarnings([]);
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
        setErrors([
          "This file contains a list of articles. Upload one article object at a time (a single { ... } object).",
        ]);
        return;
      }
    }
    const parsed = PayloadSchema.safeParse(raw);
    if (!parsed.success) {
      setErrors(
        parsed.error.issues.map((i) => {
          const field = i.path.join(".") || "payload";
          return `${field}: ${i.message}`;
        }),
      );
      return;
    }

    const nextWarnings: string[] = [];
    const matched = normalizeCategory(parsed.data.category);
    const category = matched ?? CATEGORY_VALUES[0];
    if (!matched) {
      nextWarnings.push(
        `category: "${parsed.data.category}" didn’t match an Academy category, so it was set to “${CATEGORIES[0].label}”. Pick the right one below before saving.`,
      );
    } else if (matched !== parsed.data.category) {
      nextWarnings.push(`category: "${parsed.data.category}" was matched to “${matched}”.`);
    }

    setFileName(name);
    setForm(toForm({ ...parsed.data, category }));
    setWarnings(nextWarnings);
    setStep("edit");
    toast.success("JSON parsed — every matching field was populated.");
  };


  const onFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!/\.json$/i.test(file.name) && file.type !== "application/json") {
      setErrors(["Only .json files are accepted."]);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrors(["File is larger than 2 MB."]);
      return;
    }
    handleText(await file.text(), file.name);
  };

  const saveDraft = async (publish: boolean) => {
    if (!form) return;
    if (!form.title.trim() || !form.body.trim() || !form.slug.trim()) {
      toast.error("Title, slug and body are required.");
      return;
    }
    setSaving(true);
    const words = form.body.trim().split(/\s+/).length;
    const slug = `${slugify(form.slug)}-${Date.now().toString(36).slice(-4)}`;
    const { data, error } = await supabase
      .from("academy_articles")
      .insert({
        slug,
        title: form.title.trim(),
        subtitle: form.subtitle || null,
        category: form.category,
        difficulty: form.difficulty as "beginner" | "intermediate" | "advanced",
        author_id: user?.id ?? null,
        author_name: form.author_name || "AurumVault Editorial",
        excerpt: form.excerpt || null,
        body: form.body,
        meta_title: form.meta_title || null,
        meta_description: form.meta_description || null,
        focus_keyword: form.focus_keyword || null,
        secondary_keywords: form.secondary_keywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        tags: form.tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        canonical_url: form.canonical_url || null,
        schema_type: form.schema_type || "Article",
        og_title: form.og_title || null,
        og_description: form.og_description || null,
        twitter_card: form.twitter_card || "summary_large_image",
        robots_index: form.robots_index,
        robots_follow: form.robots_follow,
        cover_alt: form.cover_alt || null,
        cover_caption: form.cover_caption || null,
        reading_time_min: Math.max(1, Math.round(words / 220)),
        word_count: words,
        status: publish ? "published" : "draft",
        published_at: publish ? new Date().toISOString() : null,
        archived: false,
        featured: false,
        pinned: false,
      })
      .select("id")
      .maybeSingle();

    if (error || !data) {
      setSaving(false);
      toast.error(error?.message ?? "Could not create the article.");
      return;
    }

    // Best-effort: link recommended products by title match.
    if (form.recommended_products.length) {
      for (let i = 0; i < form.recommended_products.length; i++) {
        const { data: prod } = await supabase
          .from("marketplace_products")
          .select("id")
          .ilike("title", `%${form.recommended_products[i]}%`)
          .eq("status", "approved")
          .limit(1)
          .maybeSingle();
        if (prod?.id) {
          await supabase
            .from("academy_article_products")
            .insert({ article_id: data.id, product_id: prod.id, sort_order: i });
        }
      }
    }

    setSaving(false);
    toast.success(publish ? "Article published." : "Draft created.");
    navigate({ to: "/admin/academy/$id", params: { id: data.id } });
  };

  const previewHtml = useMemo(() => (form ? renderMarkdown(form.body) : ""), [form?.body]);

  const templateText = JSON.stringify(TEMPLATE_ARTICLE, null, 2);

  /** Blob download — works on mobile browsers that ignore <a download> on static files. */
  const downloadTemplate = () => {
    try {
      const blob = new Blob([templateText], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "academy-article-template.json";
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
        to="/admin/academy"
        className="inline-flex items-center gap-2 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Academy articles
      </Link>

      <h1 className="mt-4 font-serif text-3xl text-ink">Bulk import an Academy article</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink/70">
        Drop in a single <code>.json</code> file, review the populated fields, then save as a draft
        or publish. Nothing goes live from the upload step.
      </p>

      {/* Steps */}
      <ol className="mt-6 flex flex-wrap items-center gap-2 text-xs">
        {(["upload", "edit", "review"] as const).map((s, i) => (
          <li
            key={s}
            className={`rounded-full border px-3 py-1 capitalize ${
              step === s ? "border-[#B8860B] bg-[#B8860B]/10 text-ink" : "border-ink/15 text-ink/50"
            }`}
          >
            {i + 1}. {s === "edit" ? "Review fields" : s === "review" ? "Preview" : "Upload JSON"}
          </li>
        ))}
      </ol>

      {errors.length > 0 && (
        <div className="mt-6 rounded-xl border border-red-300 bg-red-50 p-4">
          <div className="flex items-center gap-2 font-medium text-red-800">
            <AlertTriangle className="h-4 w-4" /> This file couldn’t be imported
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-red-700/80">
            No fields were populated — fix the file and upload again.
          </p>
        </div>
      )}

      {/* Step 1 — upload */}
      {step === "upload" && (
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
            <p className="mt-3 text-sm text-ink/70">Drag a .json article file here</p>
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
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </div>

          <details open className="rounded-xl border border-ink/10 bg-white p-4 text-sm">
            <summary className="cursor-pointer font-medium text-ink">
              Or paste the JSON directly
            </summary>
            <PasteBox onSubmit={(t) => handleText(t, "pasted.json")} template={templateText} />
          </details>

          <div className="flex flex-col gap-3 rounded-xl border border-[#B8860B]/25 bg-[#B8860B]/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-ink">Need the right format?</p>
              <p className="mt-1 text-xs text-ink/60">
                Download a ready-to-fill template with every supported Academy field.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadTemplate}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#B8860B] bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-[#B8860B]/10 focus:outline-none focus:ring-2 focus:ring-[#B8860B]/40"
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
              <button
                type="button"
                onClick={() => handleText(templateText, "template.json")}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm font-medium text-ink/80 hover:bg-ink/5"
              >
                Use template
              </button>
            </div>
          </div>


          <p className="text-xs text-ink/50">
            Required: <code>seo_title</code>, <code>category</code>, <code>body_markdown</code>.
            Everything else is optional and defaults sensibly.
          </p>
        </div>
      )}

      {/* Step 2 — edit */}
      {step === "edit" && form && (
        <div className="mt-6 space-y-6">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4" /> Populated from {fileName}
          </div>

          <Section title="Article">
            <Field label="Title">
              <input className={inputCls} value={form.title} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <Field label="Subtitle">
              <input className={inputCls} value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
            </Field>
            <Field label="URL slug">
              <input className={inputCls} value={form.slug} onChange={(e) => set("slug", e.target.value)} />
            </Field>
            <Field label="Category">
              <select className={inputCls} value={form.category} onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Difficulty">
              <select className={inputCls} value={form.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Author">
              <input className={inputCls} value={form.author_name} onChange={(e) => set("author_name", e.target.value)} />
            </Field>
            <Field label="Excerpt" wide>
              <textarea className={inputCls} rows={2} value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
            </Field>
            <Field label="Body (markdown)" wide>
              <textarea
                className={`${inputCls} font-mono text-xs`}
                rows={14}
                value={form.body}
                onChange={(e) => set("body", e.target.value)}
              />
            </Field>
          </Section>

          <Section title="SEO & social">
            <Field label="Meta title">
              <input className={inputCls} value={form.meta_title} onChange={(e) => set("meta_title", e.target.value)} />
            </Field>
            <Field label="Focus keyword">
              <input className={inputCls} value={form.focus_keyword} onChange={(e) => set("focus_keyword", e.target.value)} />
            </Field>
            <Field label="Meta description" wide>
              <textarea className={inputCls} rows={2} value={form.meta_description} onChange={(e) => set("meta_description", e.target.value)} />
            </Field>
            <Field label="Secondary keywords (comma separated)" wide>
              <input className={inputCls} value={form.secondary_keywords} onChange={(e) => set("secondary_keywords", e.target.value)} />
            </Field>
            <Field label="Tags (comma separated)" wide>
              <input className={inputCls} value={form.tags} onChange={(e) => set("tags", e.target.value)} />
            </Field>
            <Field label="Canonical URL">
              <input className={inputCls} value={form.canonical_url} onChange={(e) => set("canonical_url", e.target.value)} />
            </Field>
            <Field label="Schema type">
              <input className={inputCls} value={form.schema_type} onChange={(e) => set("schema_type", e.target.value)} />
            </Field>
            <Field label="OG title">
              <input className={inputCls} value={form.og_title} onChange={(e) => set("og_title", e.target.value)} />
            </Field>
            <Field label="Twitter card">
              <input className={inputCls} value={form.twitter_card} onChange={(e) => set("twitter_card", e.target.value)} />
            </Field>
            <Field label="OG description" wide>
              <textarea className={inputCls} rows={2} value={form.og_description} onChange={(e) => set("og_description", e.target.value)} />
            </Field>
            <Field label="Featured image alt">
              <input className={inputCls} value={form.cover_alt} onChange={(e) => set("cover_alt", e.target.value)} />
            </Field>
            <Field label="Image caption">
              <input className={inputCls} value={form.cover_caption} onChange={(e) => set("cover_caption", e.target.value)} />
            </Field>
            <Field label="Indexing" wide>
              <div className="flex gap-6 text-sm text-ink/80">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.robots_index} onChange={(e) => set("robots_index", e.target.checked)} />
                  index
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.robots_follow} onChange={(e) => set("robots_follow", e.target.checked)} />
                  follow
                </label>
              </div>
            </Field>
          </Section>

          {(form.recommended_products.length > 0 || form.related_articles.length > 0) && (
            <Section title="From the file">
              <Field label="Recommended products (matched by title on save)" wide>
                <p className="text-sm text-ink/70">{form.recommended_products.join(", ") || "—"}</p>
              </Field>
              <Field label="Related articles (reference only)" wide>
                <p className="text-sm text-ink/70">{form.related_articles.join(", ") || "—"}</p>
              </Field>
            </Section>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStep("review")}
              className="rounded-lg bg-[#B8860B] px-5 py-2.5 text-sm font-medium text-white"
            >
              Preview article
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(null);
                setFileName("");
                setStep("upload");
              }}
              className="rounded-lg border border-ink/20 px-5 py-2.5 text-sm text-ink"
            >
              Start over
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — review */}
      {step === "review" && form && (
        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border border-ink/10 bg-white p-6">
            <p className="text-xs uppercase tracking-wide text-[#B8860B]">
              {CATEGORIES.find((c) => c.value === form.category)?.label ?? form.category} ·{" "}
              {form.difficulty}
            </p>
            <h2 className="mt-2 font-serif text-3xl text-ink">{form.title}</h2>
            {form.subtitle && <p className="mt-2 text-lg text-ink/70">{form.subtitle}</p>}
            <p className="mt-2 text-sm text-ink/50">
              By {form.author_name} · /academy/article/{slugify(form.slug)}
            </p>
            {form.excerpt && <p className="mt-4 italic text-ink/75">{form.excerpt}</p>}
            <div
              className="prose prose-lg mt-6 max-w-none prose-headings:font-serif prose-headings:text-ink prose-p:text-ink/80 prose-strong:text-ink prose-a:text-[#B8860B]"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>

          <div className="rounded-2xl border border-ink/10 bg-white p-6 text-sm">
            <h3 className="font-medium text-ink">Search & social preview</h3>
            <div className="mt-3 space-y-1">
              <p className="text-[#1a0dab]">{form.meta_title || form.title}</p>
              <p className="text-emerald-700">
                {form.canonical_url || `https://www.aurumvault.store/academy/article/${slugify(form.slug)}`}
              </p>
              <p className="text-ink/70">{form.meta_description || "—"}</p>
            </div>
            <dl className="mt-4 grid gap-2 sm:grid-cols-2">
              <Meta k="Focus keyword" v={form.focus_keyword} />
              <Meta k="Secondary keywords" v={form.secondary_keywords} />
              <Meta k="Tags" v={form.tags} />
              <Meta k="Schema type" v={form.schema_type} />
              <Meta k="OG title" v={form.og_title} />
              <Meta k="OG description" v={form.og_description} />
              <Meta k="Twitter card" v={form.twitter_card} />
              <Meta k="Robots" v={`${form.robots_index ? "index" : "noindex"}, ${form.robots_follow ? "follow" : "nofollow"}`} />
              <Meta k="Featured image alt" v={form.cover_alt} />
              <Meta k="Image caption" v={form.cover_caption} />
            </dl>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveDraft(false)}
              className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save as draft
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveDraft(true)}
              className="rounded-lg bg-[#B8860B] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              Publish now
            </button>
            <button
              type="button"
              onClick={() => setStep("edit")}
              className="rounded-lg border border-ink/20 px-5 py-2.5 text-sm text-ink"
            >
              Back to fields
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <h2 className="font-serif text-lg text-ink">{title}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink/50">
        {label}
      </span>
      {children}
    </label>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink/45">{k}</dt>
      <dd className="text-ink/80">{v || "—"}</dd>
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
        placeholder='{ "seo_title": "...", "category": "financial-freedom", "body_markdown": "# ..." }'
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
        {text && (
          <button
            type="button"
            onClick={() => setText("")}
            className="rounded-lg border border-ink/20 bg-white px-4 py-2 text-sm font-medium text-ink/60"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

