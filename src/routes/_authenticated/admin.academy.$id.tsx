import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { Loader2, Save, Eye } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/academy/$id")({
  component: AdminAcademyEditor,
});

type Article = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  featured_image: string | null;
  category: string;
  author_name: string | null;
  reading_time_min: number;
  status: string;
  published_at: string | null;
  scheduled_for: string | null;
  featured: boolean;
  pinned: boolean;
  meta_title: string | null;
  meta_description: string | null;
};

type Prod = { id: string; title: string };

function AdminAcademyEditor() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [a, setA] = useState<Article | null>(null);
  const [saving, setSaving] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [prodSearch, setProdSearch] = useState("");
  const [prodResults, setProdResults] = useState<Prod[]>([]);
  const [taggedProds, setTaggedProds] = useState<Prod[]>([]);

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
      const { data: tags } = await supabase
        .from("academy_article_products")
        .select("product_id")
        .eq("article_id", id);
      const ids = ((tags as Array<{ product_id: string }>) ?? []).map((t) => t.product_id);
      setTagIds(ids);
      if (ids.length) {
        const { data: prods } = await supabase
          .from("marketplace_products")
          .select("id,title")
          .in("id", ids);
        setTaggedProds((prods as Prod[]) ?? []);
      }
    })();
  }, [isAdmin, id]);

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

  const save = async (nextStatus?: string) => {
    if (!a) return;
    setSaving(true);
    const patch: Partial<Article> = {
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      body: a.body,
      featured_image: a.featured_image,
      category: a.category,
      author_name: a.author_name,
      reading_time_min: a.reading_time_min,
      status: nextStatus ?? a.status,
      published_at:
        (nextStatus ?? a.status) === "published" && !a.published_at
          ? new Date().toISOString()
          : a.published_at,
      scheduled_for: a.scheduled_for,
      featured: a.featured,
      pinned: a.pinned,
      meta_title: a.meta_title,
      meta_description: a.meta_description,
    };
    const { error } = await supabase.from("academy_articles").update(patch).eq("id", a.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saved");
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

  return (
    <MarketShell>
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        <div className="flex items-center justify-between">
          <Link to="/admin/academy" className="text-sm text-[#B8860B]">
            ← All articles
          </Link>
          <div className="flex gap-2">
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
              onClick={() => save()}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-lg border border-ink/15 px-3 py-1.5 text-sm"
            >
              <Save size={14} /> Save draft
            </button>
            <button
              type="button"
              onClick={() => save("published")}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-lg bg-[#B8860B] px-4 py-1.5 text-sm font-semibold text-[#0F1E35]"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : "Publish"}
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          <Field label="Title">
            <input
              value={a.title}
              onChange={(e) => setA({ ...a, title: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-lg font-semibold"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
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
                <option value="financial-freedom">Financial Freedom</option>
                <option value="ai-productivity">AI & Productivity</option>
                <option value="digital-publishing">Digital Publishing</option>
                <option value="kingdom-living">Kingdom Living</option>
                <option value="entrepreneurship">Entrepreneurship</option>
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
            <Field label="Reading time (min)">
              <input
                type="number"
                value={a.reading_time_min}
                onChange={(e) =>
                  setA({ ...a, reading_time_min: Math.max(1, Number(e.target.value) || 1) })
                }
                className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Schedule for (optional)">
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
          <Field label="Featured image URL">
            <input
              value={a.featured_image ?? ""}
              onChange={(e) => setA({ ...a, featured_image: e.target.value || null })}
              placeholder="https://…"
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Excerpt">
            <textarea
              rows={2}
              value={a.excerpt ?? ""}
              onChange={(e) => setA({ ...a, excerpt: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Body (Markdown)">
            <textarea
              rows={20}
              value={a.body}
              onChange={(e) => setA({ ...a, body: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 font-mono text-sm"
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Meta title (SEO)">
              <input
                value={a.meta_title ?? ""}
                onChange={(e) => setA({ ...a, meta_title: e.target.value || null })}
                className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Meta description (SEO)">
              <input
                value={a.meta_description ?? ""}
                onChange={(e) => setA({ ...a, meta_description: e.target.value || null })}
                className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <div className="flex gap-6">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={a.featured}
                onChange={(e) => setA({ ...a, featured: e.target.checked })}
              />
              Featured
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={a.pinned}
                onChange={(e) => setA({ ...a, pinned: e.target.checked })}
              />
              Pinned
            </label>
          </div>

          {/* Product tagging */}
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
        </div>
      </div>
    </MarketShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink/60">
        {label}
      </div>
      {children}
    </label>
  );
}
