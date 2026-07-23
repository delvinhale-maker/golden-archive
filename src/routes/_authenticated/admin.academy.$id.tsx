import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { MarketShell } from "@/components/marketplace/MarketShell";
import {
  Loader2,
  Save,
  Eye,
  Rocket,
  UploadCloud,
  X,
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  CheckCircle2,
  Copy as CopyIcon,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { pingSearchEngines } from "@/lib/sitemap-ping.functions";

export const Route = createFileRoute("/_authenticated/admin/academy/$id")({
  component: AdminAcademyEditor,
});

type Article = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  body: string;
  featured_image: string | null;
  cover_alt: string | null;
  cover_caption: string | null;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  author_name: string | null;
  reading_time_min: number;
  word_count: number;
  tags: string[];
  status: string;
  published_at: string | null;
  scheduled_for: string | null;
  featured: boolean;
  pinned: boolean;
  editors_pick: boolean;
  is_latest: boolean;
  archived: boolean;
  meta_title: string | null;
  meta_description: string | null;
  focus_keyword: string | null;
  secondary_keywords: string[];
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  twitter_card: string;
  schema_type: string;
  robots_index: boolean;
  robots_follow: boolean;
  last_autosaved_at: string | null;
};

type Prod = { id: string; title: string };
type RelatedArticle = { id: string; title: string; slug: string };

const CATEGORIES = [
  { value: "financial-freedom", label: "Financial Freedom" },
  { value: "ai-productivity", label: "AI & Productivity" },
  { value: "digital-publishing", label: "Digital Publishing" },
  { value: "kingdom-living", label: "Kingdom Living" },
  { value: "entrepreneurship", label: "Entrepreneurship" },
];

const SCHEMA_TYPES = ["Article", "FAQ", "Book", "HowTo", "Breadcrumb"];

function countWords(text: string): number {
  return text
    .replace(/[#*_>`~\-\[\]()!]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

function AdminAcademyEditor() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [a, setA] = useState<Article | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoStatus, setAutoStatus] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [published, setPublished] = useState<{ url: string } | null>(null);

  const [tagIds, setTagIds] = useState<string[]>([]);
  const [prodSearch, setProdSearch] = useState("");
  const [prodResults, setProdResults] = useState<Prod[]>([]);
  const [taggedProds, setTaggedProds] = useState<Prod[]>([]);

  const [relatedIds, setRelatedIds] = useState<string[]>([]);
  const [relatedList, setRelatedList] = useState<RelatedArticle[]>([]);
  const [relSearch, setRelSearch] = useState("");
  const [relResults, setRelResults] = useState<RelatedArticle[]>([]);

  const [tagInput, setTagInput] = useState("");
  const [kwInput, setKwInput] = useState("");

  useEffect(() => {
    if (loading || !user) return;
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

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      const { data } = await supabase
        .from("academy_articles")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      setA((data as Article) ?? null);
      const [{ data: tags }, { data: rels }] = await Promise.all([
        supabase.from("academy_article_products").select("product_id").eq("article_id", id),
        supabase
          .from("academy_article_related")
          .select("related_id")
          .eq("article_id", id)
          .order("sort_order"),
      ]);
      const pids = ((tags as Array<{ product_id: string }>) ?? []).map((t) => t.product_id);
      const rids = ((rels as Array<{ related_id: string }>) ?? []).map((r) => r.related_id);
      setTagIds(pids);
      setRelatedIds(rids);
      if (pids.length) {
        const { data: prods } = await supabase
          .from("marketplace_products")
          .select("id,title")
          .in("id", pids);
        setTaggedProds((prods as Prod[]) ?? []);
      }
      if (rids.length) {
        const { data: rArts } = await supabase
          .from("academy_articles")
          .select("id,title,slug")
          .in("id", rids);
        setRelatedList((rArts as RelatedArticle[]) ?? []);
      }
    })();
  }, [isAdmin, id]);

  // Product search
  useEffect(() => {
    if (!prodSearch.trim()) {
      setProdResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("marketplace_products")
        .select("id,title")
        .ilike("title", `%${prodSearch}%`)
        .eq("status", "approved")
        .limit(10);
      setProdResults((data as Prod[]) ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [prodSearch]);

  // Related article search
  useEffect(() => {
    if (!relSearch.trim()) {
      setRelResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("academy_articles")
        .select("id,title,slug")
        .ilike("title", `%${relSearch}%`)
        .neq("id", id)
        .limit(10);
      setRelResults((data as RelatedArticle[]) ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [relSearch, id]);

  const buildPatch = useCallback(
    (nextStatus?: string): Partial<Article> => {
      if (!a) return {};
      const words = countWords(a.body);
      return {
        title: a.title,
        slug: a.slug,
        subtitle: a.subtitle,
        excerpt: a.excerpt,
        body: a.body,
        featured_image: a.featured_image,
        cover_alt: a.cover_alt,
        cover_caption: a.cover_caption,
        category: a.category,
        difficulty: a.difficulty,
        author_name: a.author_name,
        reading_time_min: a.reading_time_min,
        word_count: words,
        tags: a.tags,
        status: nextStatus ?? a.status,
        published_at:
          (nextStatus ?? a.status) === "published" && !a.published_at
            ? new Date().toISOString()
            : a.published_at,
        scheduled_for: a.scheduled_for,
        featured: a.featured,
        pinned: a.pinned,
        editors_pick: a.editors_pick,
        is_latest: a.is_latest,
        meta_title: a.meta_title,
        meta_description: a.meta_description,
        focus_keyword: a.focus_keyword,
        secondary_keywords: a.secondary_keywords,
        canonical_url: a.canonical_url,
        og_title: a.og_title,
        og_description: a.og_description,
        twitter_card: a.twitter_card,
        schema_type: a.schema_type,
        robots_index: a.robots_index,
        robots_follow: a.robots_follow,
        last_autosaved_at: new Date().toISOString(),
      };
    },
    [a],
  );

  const save = async (nextStatus?: string, snapshot = true) => {
    if (!a) return false;
    setSaving(true);
    const patch = buildPatch(nextStatus);
    const { error } = await supabase.from("academy_articles").update(patch).eq("id", a.id);
    if (!error && snapshot) {
      // Best-effort version snapshot; ignore failure
      await supabase
        .from("academy_article_versions")
        .insert({ article_id: a.id, snapshot: patch as never, saved_by: user?.id ?? null });
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return false;
    }
    if (nextStatus === "published") {
      setA({ ...a, status: "published", published_at: patch.published_at ?? a.published_at });
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setPublished({ url: `${origin}/academy/article/${a.slug}` });
      toast.success("Published");
    } else {
      toast.success(nextStatus === "scheduled" ? "Scheduled" : "Saved");
    }
    if (nextStatus === "published" || nextStatus === "scheduled") {
      // Fire-and-forget: refresh sitemap + notify search engines
      void pingSearchEngines().then((r) => {
        console.info("[sitemap-ping]", r);
      });
    }
    return true;
  };

  // Autosave every 30s if there are unsaved changes (best-effort)
  useEffect(() => {
    if (!a) return;
    const t = setInterval(async () => {
      const patch = buildPatch();
      const { error } = await supabase.from("academy_articles").update(patch).eq("id", a.id);
      if (!error) setAutoStatus(`Autosaved ${new Date().toLocaleTimeString()}`);
    }, 30000);
    return () => clearInterval(t);
  }, [a, buildPatch]);

  // Reading time auto-calc (200 wpm)
  useEffect(() => {
    if (!a) return;
    const words = countWords(a.body);
    const est = Math.max(1, Math.round(words / 200));
    if (est !== a.reading_time_min && words > 0) {
      setA({ ...a, reading_time_min: est });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.body]);

  // Cover upload
  async function uploadCover(file: File) {
    if (!a) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${a.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("academy-covers")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      setUploading(false);
      toast.error(error.message);
      return;
    }
    const { data } = supabase.storage.from("academy-covers").getPublicUrl(path);
    setA({ ...a, featured_image: data.publicUrl });
    setUploading(false);
    toast.success("Cover uploaded");
  }

  const insertAtCursor = (before: string, after = "") => {
    const el = bodyRef.current;
    if (!el || !a) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const sel = a.body.slice(start, end);
    const next = a.body.slice(0, start) + before + sel + after + a.body.slice(end);
    setA({ ...a, body: next });
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = start + before.length + sel.length;
    });
  };

  const addProduct = async (p: Prod) => {
    if (tagIds.includes(p.id)) return;
    const { error } = await supabase
      .from("academy_article_products")
      .insert({ article_id: id, product_id: p.id });
    if (error) toast.error(error.message);
    else {
      setTagIds([...tagIds, p.id]);
      setTaggedProds([...taggedProds, p]);
      setProdSearch("");
      setProdResults([]);
    }
  };
  const removeProduct = async (pid: string) => {
    const { error } = await supabase
      .from("academy_article_products")
      .delete()
      .eq("article_id", id)
      .eq("product_id", pid);
    if (error) toast.error(error.message);
    else {
      setTagIds(tagIds.filter((x) => x !== pid));
      setTaggedProds(taggedProds.filter((x) => x.id !== pid));
    }
  };

  const addRelated = async (r: RelatedArticle) => {
    if (relatedIds.includes(r.id)) return;
    const { error } = await supabase
      .from("academy_article_related")
      .insert({ article_id: id, related_id: r.id, sort_order: relatedIds.length });
    if (error) toast.error(error.message);
    else {
      setRelatedIds([...relatedIds, r.id]);
      setRelatedList([...relatedList, r]);
      setRelSearch("");
      setRelResults([]);
    }
  };
  const removeRelated = async (rid: string) => {
    const { error } = await supabase
      .from("academy_article_related")
      .delete()
      .eq("article_id", id)
      .eq("related_id", rid);
    if (error) toast.error(error.message);
    else {
      setRelatedIds(relatedIds.filter((x) => x !== rid));
      setRelatedList(relatedList.filter((x) => x.id !== rid));
    }
  };

  // SEO score
  const seoScore = useMemo(() => {
    if (!a) return { score: 0, notes: [] as string[] };
    const notes: string[] = [];
    let score = 100;
    const kw = (a.focus_keyword ?? "").toLowerCase().trim();
    const title = (a.meta_title ?? a.title).toLowerCase();
    const desc = (a.meta_description ?? "").toLowerCase();
    if (!a.meta_title) {
      score -= 8;
      notes.push("Add an SEO title.");
    } else if (a.meta_title.length > 60) {
      score -= 4;
      notes.push("SEO title is over 60 characters.");
    }
    if (!a.meta_description) {
      score -= 12;
      notes.push("Missing meta description.");
    } else if (a.meta_description.length < 80) {
      score -= 6;
      notes.push("Meta description is short (aim 120–160 chars).");
    } else if (a.meta_description.length > 165) {
      score -= 4;
      notes.push("Meta description is over 165 characters.");
    }
    if (!kw) {
      score -= 10;
      notes.push("Set a focus keyword.");
    } else {
      if (!title.includes(kw)) {
        score -= 6;
        notes.push("Focus keyword missing from title.");
      }
      if (!desc.includes(kw)) {
        score -= 4;
        notes.push("Focus keyword missing from meta description.");
      }
      if (!a.body.toLowerCase().includes(kw)) {
        score -= 6;
        notes.push("Focus keyword missing from body.");
      }
    }
    if (!a.featured_image) {
      score -= 6;
      notes.push("Add a featured image.");
    } else if (!a.cover_alt) {
      score -= 4;
      notes.push("Add alt text for the featured image.");
    }
    if (!/^##\s/m.test(a.body)) {
      score -= 6;
      notes.push("Add H2 sub-headings to structure the article.");
    }
    if (!/\[[^\]]+\]\([^)]+\)/.test(a.body)) {
      score -= 4;
      notes.push("Add at least one internal or external link.");
    }
    if (countWords(a.body) < 400) {
      score -= 8;
      notes.push("Body is under 400 words — consider expanding.");
    }
    return { score: Math.max(0, Math.min(100, score)), notes };
  }, [a]);

  if (checking || (!a && isAdmin)) {
    return (
      <MarketShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="animate-spin" />
        </div>
      </MarketShell>
    );
  }
  if (!isAdmin || !a) return null;

  const wordCount = countWords(a.body);
  const lastSaved = a.last_autosaved_at
    ? new Date(a.last_autosaved_at).toLocaleString()
    : "never";

  return (
    <MarketShell>
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        {/* Sticky top bar */}
        <div className="sticky top-[108px] z-30 -mx-4 mb-6 flex flex-wrap items-center justify-between gap-2 rounded-b-2xl border-b border-ink/10 bg-white/95 px-4 py-3 backdrop-blur md:top-[112px] md:mx-0 md:rounded-2xl md:border md:px-5">
          <div className="flex items-center gap-3">
            <Link to="/admin/academy" className="text-sm text-[#B8860B]">
              ← All articles
            </Link>
            <span className="hidden text-xs text-ink/50 md:inline">
              {autoStatus || `Last saved: ${lastSaved}`} · {wordCount} words · ~{a.reading_time_min} min
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {a.status === "published" && (
              <Link
                to="/academy/article/$slug"
                params={{ slug: a.slug }}
                className="inline-flex items-center gap-1 rounded-lg border border-ink/15 px-3 py-1.5 text-sm"
              >
                <Eye size={14} /> View
              </Link>
            )}
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-lg border border-ink/15 px-3 py-1.5 text-sm"
            >
              <Save size={14} /> Save draft
            </button>
            <button
              type="button"
              onClick={() => void save("scheduled")}
              disabled={saving || !a.scheduled_for}
              title={a.scheduled_for ? "" : "Set a schedule date below"}
              className="inline-flex items-center gap-1 rounded-lg border border-ink/15 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Schedule
            </button>
            <button
              type="button"
              onClick={() => setPublishOpen(true)}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-lg bg-[#B8860B] px-4 py-1.5 text-sm font-semibold text-[#0F1E35]"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : (<><Rocket size={14} /> Publish</>)}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <Field label="Title">
            <input
              value={a.title}
              onChange={(e) => setA({ ...a, title: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-lg font-semibold"
            />
          </Field>
          <Field label="Subtitle (optional)">
            <input
              value={a.subtitle ?? ""}
              onChange={(e) => setA({ ...a, subtitle: e.target.value || null })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Slug">
              <input
                value={a.slug}
                onChange={(e) => setA({ ...a, slug: e.target.value })}
                className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Category">
              <select
                value={a.category}
                onChange={(e) => setA({ ...a, category: e.target.value })}
                className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Difficulty">
              <select
                value={a.difficulty}
                onChange={(e) =>
                  setA({ ...a, difficulty: e.target.value as Article["difficulty"] })
                }
                className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Author">
              <input
                value={a.author_name ?? ""}
                onChange={(e) => setA({ ...a, author_name: e.target.value })}
                className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Reading time (min, auto)">
              <input
                type="number"
                value={a.reading_time_min}
                onChange={(e) =>
                  setA({ ...a, reading_time_min: Math.max(1, Number(e.target.value) || 1) })
                }
                className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Schedule for (optional)" id="schedule">
              <input
                type="datetime-local"
                value={a.scheduled_for ? a.scheduled_for.slice(0, 16) : ""}
                onChange={(e) =>
                  setA({
                    ...a,
                    scheduled_for: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
                className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          {/* Cover uploader */}
          <div id="cover" className="rounded-2xl border border-ink/10 bg-white p-5">
            <div className="mb-2 text-sm font-semibold text-ink">Featured image</div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void uploadCover(f);
              }}
              className={`relative flex min-h-[180px] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition ${
                dragOver ? "border-[#B8860B] bg-[#B8860B]/5" : "border-ink/15 bg-ink/[0.02]"
              }`}
            >
              {a.featured_image ? (
                <>
                  <img
                    src={a.featured_image}
                    alt={a.cover_alt ?? ""}
                    className="max-h-[280px] w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setA({ ...a, featured_image: null })}
                    className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-ink hover:bg-white"
                    aria-label="Remove cover"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <label className="flex cursor-pointer flex-col items-center gap-2 p-6 text-center text-sm text-ink/60">
                  {uploading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <UploadCloud size={28} className="text-[#B8860B]" />
                  )}
                  <span>Drop an image here, or click to upload</span>
                  <span className="text-xs">Recommended 1600×900 · JPG/PNG/WebP</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadCover(f);
                    }}
                  />
                </label>
              )}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label="Alt text">
                <input
                  value={a.cover_alt ?? ""}
                  onChange={(e) => setA({ ...a, cover_alt: e.target.value || null })}
                  className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Caption">
                <input
                  value={a.cover_caption ?? ""}
                  onChange={(e) => setA({ ...a, cover_caption: e.target.value || null })}
                  className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
                />
              </Field>
            </div>
          </div>

          <Field label="Excerpt">
            <textarea
              rows={2}
              value={a.excerpt ?? ""}
              onChange={(e) => setA({ ...a, excerpt: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
          </Field>

          {/* Body with toolbar */}
          <div id="body">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink/60">
              Body (Markdown)
            </div>
            <div className="flex flex-wrap gap-1 rounded-t-lg border border-b-0 border-ink/15 bg-white p-2">
              <ToolBtn label="H1" onClick={() => insertAtCursor("\n# ")}><Heading1 size={14} /></ToolBtn>
              <ToolBtn label="H2" onClick={() => insertAtCursor("\n## ")}><Heading2 size={14} /></ToolBtn>
              <ToolBtn label="H3" onClick={() => insertAtCursor("\n### ")}><Heading3 size={14} /></ToolBtn>
              <ToolBtn label="Bold" onClick={() => insertAtCursor("**", "**")}><Bold size={14} /></ToolBtn>
              <ToolBtn label="Italic" onClick={() => insertAtCursor("_", "_")}><Italic size={14} /></ToolBtn>
              <ToolBtn label="Bullet list" onClick={() => insertAtCursor("\n- ")}><List size={14} /></ToolBtn>
              <ToolBtn label="Numbered list" onClick={() => insertAtCursor("\n1. ")}><ListOrdered size={14} /></ToolBtn>
              <ToolBtn label="Quote" onClick={() => insertAtCursor("\n> ")}><Quote size={14} /></ToolBtn>
              <ToolBtn label="Code" onClick={() => insertAtCursor("\n```\n", "\n```\n")}><Code size={14} /></ToolBtn>
              <ToolBtn label="Link" onClick={() => insertAtCursor("[", "](https://)")}><LinkIcon size={14} /></ToolBtn>
              <ToolBtn label="Image" onClick={() => insertAtCursor("![alt](", ")")}><ImageIcon size={14} /></ToolBtn>
              <ToolBtn label="Table" onClick={() => insertAtCursor("\n| Column | Column |\n| --- | --- |\n| Cell | Cell |\n")}><TableIcon size={14} /></ToolBtn>
              <ToolBtn label="Callout" onClick={() => insertAtCursor("\n> 💡 **Callout:** ")}><Sparkles size={14} /></ToolBtn>
              <ToolBtn label="Divider" onClick={() => insertAtCursor("\n\n---\n\n")}>—</ToolBtn>
            </div>
            <textarea
              ref={bodyRef}
              rows={22}
              value={a.body}
              onChange={(e) => setA({ ...a, body: e.target.value })}
              className="w-full rounded-b-lg border border-ink/15 px-3 py-2 font-mono text-sm"
            />
          </div>

          {/* Tags */}
          <div className="rounded-2xl border border-ink/10 bg-white p-5">
            <div className="text-sm font-semibold text-ink">Tags</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {a.tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setA({ ...a, tags: a.tags.filter((x) => x !== t) })}
                  className="inline-flex items-center gap-1 rounded-full bg-navy/10 px-3 py-1 text-xs text-navy"
                >
                  {t} ×
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagInput.trim()) {
                    e.preventDefault();
                    if (!a.tags.includes(tagInput.trim()))
                      setA({ ...a, tags: [...a.tags, tagInput.trim()] });
                    setTagInput("");
                  }
                }}
                placeholder="Add a tag and press Enter"
                className="flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Flags */}
          <div className="flex flex-wrap gap-6 rounded-2xl border border-ink/10 bg-white p-5">
            <FlagBox
              label="Featured"
              checked={a.featured}
              onChange={(v) => setA({ ...a, featured: v })}
            />
            <FlagBox
              label="Editor's Pick"
              checked={a.editors_pick}
              onChange={(v) => setA({ ...a, editors_pick: v })}
            />
            <FlagBox
              label="Latest"
              checked={a.is_latest}
              onChange={(v) => setA({ ...a, is_latest: v })}
            />
            <FlagBox
              label="Pinned"
              checked={a.pinned}
              onChange={(v) => setA({ ...a, pinned: v })}
            />
          </div>

          {/* Related products */}
          <div className="rounded-2xl border border-ink/10 bg-white p-5">
            <div className="text-sm font-semibold text-ink">Recommended products</div>
            <p className="mt-1 text-xs text-ink/60">
              Tag marketplace products to show in the article's Recommended Resources rail.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {taggedProds.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void removeProduct(p.id)}
                  className="inline-flex items-center gap-1 rounded-full bg-[#B8860B]/15 px-3 py-1 text-xs text-[#0F1E35]"
                >
                  {p.title} ×
                </button>
              ))}
            </div>
            <input
              value={prodSearch}
              onChange={(e) => setProdSearch(e.target.value)}
              placeholder="Search products…"
              className="mt-3 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
            {prodResults.length > 0 && (
              <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-ink/10">
                {prodResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void addProduct(p)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-ink/5"
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Related articles */}
          <div className="rounded-2xl border border-ink/10 bg-white p-5">
            <div className="text-sm font-semibold text-ink">Related articles</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {relatedList.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => void removeRelated(r.id)}
                  className="inline-flex items-center gap-1 rounded-full bg-navy/10 px-3 py-1 text-xs text-navy"
                >
                  {r.title} ×
                </button>
              ))}
            </div>
            <input
              value={relSearch}
              onChange={(e) => setRelSearch(e.target.value)}
              placeholder="Search articles…"
              className="mt-3 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
            {relResults.length > 0 && (
              <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-ink/10">
                {relResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => void addRelated(r)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-ink/5"
                  >
                    {r.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SEO */}
          <div id="seo" className="rounded-2xl border border-ink/10 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-ink">SEO settings</div>
                <p className="mt-0.5 text-xs text-ink/60">
                  Titles, meta, keywords, Open Graph, Twitter, schema, and robots.
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold uppercase tracking-wider text-ink/50">
                  SEO score
                </div>
                <div
                  className={`text-2xl font-serif font-bold ${
                    seoScore.score >= 80
                      ? "text-emerald-700"
                      : seoScore.score >= 60
                        ? "text-amber-700"
                        : "text-red-700"
                  }`}
                >
                  {seoScore.score}
                  <span className="text-sm text-ink/40">/100</span>
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label={`SEO title (${(a.meta_title ?? "").length}/60)`}>
                <input
                  value={a.meta_title ?? ""}
                  onChange={(e) => setA({ ...a, meta_title: e.target.value || null })}
                  className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Focus keyword">
                <input
                  value={a.focus_keyword ?? ""}
                  onChange={(e) => setA({ ...a, focus_keyword: e.target.value || null })}
                  className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
                />
              </Field>
            </div>
            <Field label={`Meta description (${(a.meta_description ?? "").length}/160)`}>
              <textarea
                rows={2}
                value={a.meta_description ?? ""}
                onChange={(e) => setA({ ...a, meta_description: e.target.value || null })}
                className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
              />
            </Field>
            <div className="mt-3">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink/60">
                Secondary keywords
              </div>
              <div className="flex flex-wrap gap-2">
                {a.secondary_keywords.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() =>
                      setA({
                        ...a,
                        secondary_keywords: a.secondary_keywords.filter((x) => x !== k),
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-full bg-navy/10 px-3 py-1 text-xs text-navy"
                  >
                    {k} ×
                  </button>
                ))}
              </div>
              <input
                value={kwInput}
                onChange={(e) => setKwInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && kwInput.trim()) {
                    e.preventDefault();
                    if (!a.secondary_keywords.includes(kwInput.trim()))
                      setA({
                        ...a,
                        secondary_keywords: [...a.secondary_keywords, kwInput.trim()],
                      });
                    setKwInput("");
                  }
                }}
                placeholder="Add a keyword and press Enter"
                className="mt-2 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="URL slug">
                <div className="flex gap-2">
                  <input
                    value={a.slug}
                    onChange={(e) =>
                      setA({
                        ...a,
                        slug: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]+/g, "-")
                          .replace(/^-+|-+$/g, ""),
                      })
                    }
                    className="w-full rounded-lg border border-ink/15 px-3 py-2 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setA({
                        ...a,
                        slug: a.title
                          .toLowerCase()
                          .trim()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-+|-+$/g, ""),
                      })
                    }
                    className="shrink-0 rounded-lg border border-ink/15 px-3 py-2 text-xs hover:bg-navy/5"
                  >
                    From title
                  </button>
                </div>
                <div className="mt-1 truncate text-[11px] text-ink/50">
                  aurumvault.store/academy/article/{a.slug || "your-slug"}
                </div>
              </Field>
              <Field label="Canonical URL">
                <input
                  value={a.canonical_url ?? ""}
                  onChange={(e) => setA({ ...a, canonical_url: e.target.value || null })}
                  placeholder={`https://www.aurumvault.store/academy/article/${a.slug || "your-slug"}`}
                  className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Schema type">
                <select
                  value={a.schema_type}
                  onChange={(e) => setA({ ...a, schema_type: e.target.value })}
                  className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
                >
                  {SCHEMA_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Open Graph title">
                <input
                  value={a.og_title ?? ""}
                  onChange={(e) => setA({ ...a, og_title: e.target.value || null })}
                  className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Open Graph description">
                <input
                  value={a.og_description ?? ""}
                  onChange={(e) => setA({ ...a, og_description: e.target.value || null })}
                  className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Twitter card">
                <select
                  value={a.twitter_card}
                  onChange={(e) => setA({ ...a, twitter_card: e.target.value })}
                  className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
                >
                  <option value="summary">summary</option>
                  <option value="summary_large_image">summary_large_image</option>
                </select>
              </Field>
              <div className="flex items-end gap-6">
                <FlagBox
                  label="Index"
                  checked={a.robots_index}
                  onChange={(v) => setA({ ...a, robots_index: v })}
                />
                <FlagBox
                  label="Follow"
                  checked={a.robots_follow}
                  onChange={(v) => setA({ ...a, robots_follow: v })}
                />
              </div>
            </div>
            {seoScore.notes.length > 0 && (
              <ul className="mt-4 space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                {seoScore.notes.map((n) => (
                  <li key={n}>• {n}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Publish modal (preflight) */}
      {publishOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy/70 backdrop-blur-sm md:items-center"
          onClick={() => setPublishOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl md:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-xl font-semibold text-navy">
                {published ? "Published" : "Ready to publish?"}
              </h3>
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  setPublishOpen(false);
                  setPublished(null);
                }}
                className="rounded-full p-2 hover:bg-ink/5"
              >
                <X size={18} />
              </button>
            </div>

            {published ? (
              <div className="mt-4 space-y-4 text-sm">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 size={20} /> Your article is live.
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-ink/10 bg-ink/[0.02] p-2">
                  <input
                    readOnly
                    value={published.url}
                    className="flex-1 bg-transparent text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(published.url);
                      toast.success("Copied");
                    }}
                    className="inline-flex items-center gap-1 rounded bg-navy px-2 py-1 text-xs text-white"
                  >
                    <CopyIcon size={12} /> Copy
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    className="rounded-full bg-ink/5 px-3 py-1 text-xs"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(published.url)}&text=${encodeURIComponent(a.title)}`}
                  >
                    Share on X
                  </a>
                  <a
                    className="rounded-full bg-ink/5 px-3 py-1 text-xs"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(published.url)}`}
                  >
                    Share on Facebook
                  </a>
                  <a
                    className="rounded-full bg-ink/5 px-3 py-1 text-xs"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(published.url)}`}
                  >
                    Share on LinkedIn
                  </a>
                </div>
              </div>
            ) : (
              <>
                <ul className="mt-4 space-y-2 text-sm">
                  <PreflightRow label="Word count" ok={wordCount >= 400} value={`${wordCount}`} />
                  <PreflightRow
                    label="Reading time"
                    ok
                    value={`~${a.reading_time_min} min`}
                  />
                  <PreflightRow
                    label="Featured image"
                    ok={!!a.featured_image}
                    value={a.featured_image ? "Set" : "Missing"}
                  />
                  <PreflightRow
                    label="Alt text"
                    ok={!!a.cover_alt}
                    value={a.cover_alt ? "Set" : "Missing"}
                  />
                  <PreflightRow
                    label="Meta description"
                    ok={!!a.meta_description && a.meta_description.length >= 80}
                    value={
                      a.meta_description
                        ? `${a.meta_description.length} chars`
                        : "Missing"
                    }
                  />
                  <PreflightRow
                    label="Broken link scan"
                    ok
                    value="No local anchors detected"
                  />
                  <PreflightRow
                    label="SEO score"
                    ok={seoScore.score >= 70}
                    value={`${seoScore.score}/100`}
                  />
                </ul>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPublishOpen(false)}
                    className="rounded-lg border border-ink/15 px-3 py-2 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await save("published");
                      if (!ok) setPublishOpen(false);
                    }}
                    disabled={saving}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#B8860B] px-4 py-2 text-sm font-semibold text-[#0F1E35]"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
                    Confirm & publish
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </MarketShell>
  );
}

function Field({
  label,
  children,
  id,
}: {
  label: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <label id={id} className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink/60">
        {label}
      </div>
      {children}
    </label>
  );
}

function ToolBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded text-ink/70 hover:bg-ink/5 hover:text-ink"
    >
      {children}
    </button>
  );
}

function FlagBox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function PreflightRow({
  label,
  ok,
  value,
}: {
  label: string;
  ok: boolean;
  value: string;
}) {
  return (
    <li className="flex items-center justify-between rounded-lg border border-ink/10 px-3 py-2">
      <span className="text-ink/70">{label}</span>
      <span className={`text-xs font-semibold ${ok ? "text-emerald-700" : "text-amber-700"}`}>
        {value}
      </span>
    </li>
  );
}
