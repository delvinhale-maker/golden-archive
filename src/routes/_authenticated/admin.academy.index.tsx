import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { MarketShell } from "@/components/marketplace/MarketShell";
import {
  Loader2,
  Plus,
  Pencil,
  Star,
  Pin,
  Trash2,
  Copy,
  Archive,
  ArchiveRestore,
  Search,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/academy/")({
  component: AdminAcademyList,
});

type Row = {
  id: string;
  slug: string;
  title: string;
  category: string;
  status: string;
  published_at: string | null;
  featured: boolean;
  pinned: boolean;
  archived: boolean;
  view_count: number;
  updated_at: string;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const CATEGORIES = [
  { value: "financial-freedom", label: "Financial Freedom" },
  { value: "ai-productivity", label: "AI & Productivity" },
  { value: "digital-publishing", label: "Digital Publishing" },
  { value: "kingdom-living", label: "Kingdom Living" },
  { value: "entrepreneurship", label: "Entrepreneurship" },
];

function AdminAcademyList() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("financial-freedom");

  // filters
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showArchived, setShowArchived] = useState(false);
  const [sort, setSort] = useState<"newest" | "oldest" | "views" | "title">("newest");

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

  const load = async () => {
    setBusy(true);
    const { data } = await supabase
      .from("academy_articles")
      .select(
        "id,slug,title,category,status,published_at,featured,pinned,archived,view_count,updated_at",
      )
      .order("updated_at", { ascending: false });
    setRows((data as Row[]) ?? []);
    setBusy(false);
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    let list = rows.filter((r) => (showArchived ? true : !r.archived));
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter(
        (r) => r.title.toLowerCase().includes(needle) || r.slug.toLowerCase().includes(needle),
      );
    }
    if (catFilter) list = list.filter((r) => r.category === catFilter);
    if (statusFilter) list = list.filter((r) => r.status === statusFilter);
    const sorted = [...list];
    if (sort === "newest") sorted.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    else if (sort === "oldest") sorted.sort((a, b) => a.updated_at.localeCompare(b.updated_at));
    else if (sort === "views") sorted.sort((a, b) => b.view_count - a.view_count);
    else sorted.sort((a, b) => a.title.localeCompare(b.title));
    return sorted;
  }, [rows, q, catFilter, statusFilter, showArchived, sort]);

  const create = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    const slug = `${slugify(newTitle)}-${Date.now().toString(36).slice(-4)}`;
    const { data, error } = await supabase
      .from("academy_articles")
      .insert({
        slug,
        title: newTitle.trim(),
        category: newCategory,
        author_id: user?.id ?? null,
        author_name: "AurumVault Editorial",
        body: `# ${newTitle.trim()}\n\nStart writing...`,
        status: "draft",
      })
      .select("id")
      .maybeSingle();
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data?.id) navigate({ to: "/admin/academy/$id", params: { id: data.id } });
  };

  const remove = async (id: string) => {
    if (!confirm("Permanently delete this article? This cannot be undone.")) return;
    const { error } = await supabase.from("academy_articles").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      void load();
    }
  };

  const duplicate = async (id: string) => {
    const { data: src, error } = await supabase
      .from("academy_articles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !src) {
      toast.error(error?.message ?? "Not found");
      return;
    }
    const copy = { ...(src as Record<string, unknown>) };
    delete copy.id;
    delete copy.created_at;
    delete copy.updated_at;
    delete copy.published_at;
    delete copy.view_count;
    copy.slug = `${(src.slug as string).slice(0, 60)}-copy-${Date.now().toString(36).slice(-4)}`;
    copy.title = `${src.title as string} (copy)`;
    copy.status = "draft";
    copy.featured = false;
    copy.pinned = false;
    copy.archived = false;
    const { data: created, error: insErr } = await supabase
      .from("academy_articles")
      .insert(copy)
      .select("id")
      .maybeSingle();
    if (insErr || !created?.id) {
      toast.error(insErr?.message ?? "Duplicate failed");
      return;
    }
    toast.success("Duplicated");
    navigate({ to: "/admin/academy/$id", params: { id: created.id } });
  };

  const toggleArchived = async (id: string, next: boolean) => {
    const { error } = await supabase
      .from("academy_articles")
      .update({ archived: next })
      .eq("id", id);
    if (error) toast.error(error.message);
    else void load();
  };

  const toggle = async (id: string, field: "featured" | "pinned", value: boolean) => {
    const patch = field === "featured" ? { featured: value } : { pinned: value };
    const { error } = await supabase.from("academy_articles").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else void load();
  };

  if (checking) {
    return (
      <MarketShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="animate-spin" />
        </div>
      </MarketShell>
    );
  }
  if (!isAdmin) return null;

  return (
    <MarketShell>
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#B8860B]">
              Editorial Studio
            </div>
            <h1 className="text-3xl font-serif font-semibold text-ink">Academy Articles</h1>
            <p className="mt-1 text-sm text-ink/60">
              Search, filter, duplicate, archive, and manage every article.
            </p>
          </div>
          <Link to="/admin" className="text-sm text-[#B8860B]">
            ← Admin
          </Link>
        </div>

        {/* Create */}
        <div className="mt-8 rounded-2xl border border-ink/10 bg-white p-5">
          <div className="text-sm font-semibold text-ink">New article</div>
          <div className="mt-3 flex flex-col gap-3 md:flex-row">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Article title"
              className="flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="rounded-lg border border-ink/15 px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void create()}
              disabled={creating || !newTitle.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-[#B8860B] px-4 py-2 text-sm font-semibold text-[#0F1E35] disabled:opacity-50"
            >
              <Plus size={14} /> Create
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-ink/10 bg-white p-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title or slug…"
              className="w-full rounded-lg border border-ink/15 pl-8 pr-3 py-2 text-sm"
            />
          </div>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="rounded-lg border border-ink/15 px-2 py-2 text-sm"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-ink/15 px-2 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-lg border border-ink/15 px-2 py-2 text-sm"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="views">Most viewed</option>
            <option value="title">A → Z</option>
          </select>
          <label className="inline-flex items-center gap-1.5 text-xs text-ink/70">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-ink/10 bg-white">
          {busy ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-ink/60">No articles match.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-ink/[0.03] text-left text-xs uppercase tracking-wider text-ink/60">
                <tr>
                  <th className="p-3">Title</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Views</th>
                  <th className="p-3">Flags</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-t border-ink/5 ${r.archived ? "opacity-60" : ""}`}
                  >
                    <td className="p-3">
                      <div className="font-medium text-ink">{r.title}</div>
                      <div className="text-xs text-ink/50">/{r.slug}</div>
                    </td>
                    <td className="p-3 text-ink/70">{r.category}</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          r.status === "published"
                            ? "bg-emerald-100 text-emerald-800"
                            : r.status === "scheduled"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-ink/10 text-ink/70"
                        }`}
                      >
                        {r.archived ? "archived" : r.status}
                      </span>
                    </td>
                    <td className="p-3 text-ink/70">{r.view_count}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          title="Toggle featured"
                          onClick={() => toggle(r.id, "featured", !r.featured)}
                          className={`rounded p-1 ${r.featured ? "text-[#B8860B]" : "text-ink/30"}`}
                        >
                          <Star size={14} fill={r.featured ? "currentColor" : "none"} />
                        </button>
                        <button
                          type="button"
                          title="Toggle pinned"
                          onClick={() => toggle(r.id, "pinned", !r.pinned)}
                          className={`rounded p-1 ${r.pinned ? "text-[#B8860B]" : "text-ink/30"}`}
                        >
                          <Pin size={14} fill={r.pinned ? "currentColor" : "none"} />
                        </button>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Link
                          to="/admin/academy/$id"
                          params={{ id: r.id }}
                          className="rounded p-1.5 text-ink/60 hover:bg-ink/5 hover:text-ink"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => void duplicate(r.id)}
                          className="rounded p-1.5 text-ink/60 hover:bg-ink/5 hover:text-ink"
                          title="Duplicate"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleArchived(r.id, !r.archived)}
                          className="rounded p-1.5 text-ink/60 hover:bg-ink/5 hover:text-ink"
                          title={r.archived ? "Unarchive" : "Archive"}
                        >
                          {r.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(r.id)}
                          className="rounded p-1.5 text-red-600 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </MarketShell>
  );
}
