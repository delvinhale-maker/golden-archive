import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { Loader2, Plus, Pencil, Star, Pin, Trash2 } from "lucide-react";
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
      .select("id,slug,title,category,status,published_at,featured,pinned,view_count,updated_at")
      .order("updated_at", { ascending: false });
    setRows((data as Row[]) ?? []);
    setBusy(false);
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const create = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    const slug = slugify(newTitle);
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
    if (!confirm("Delete this article?")) return;
    const { error } = await supabase.from("academy_articles").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      void load();
    }
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
            <h1 className="text-3xl font-serif font-semibold text-ink">Academy Articles</h1>
            <p className="mt-1 text-sm text-ink/60">Admin CMS for the Academy hub.</p>
          </div>
          <Link to="/admin" className="text-sm text-[#B8860B]">
            ← Admin
          </Link>
        </div>

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
              <option value="financial-freedom">Financial Freedom</option>
              <option value="ai-productivity">AI & Productivity</option>
              <option value="digital-publishing">Digital Publishing</option>
              <option value="kingdom-living">Kingdom Living</option>
              <option value="entrepreneurship">Entrepreneurship</option>
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

        <div className="mt-6 overflow-hidden rounded-2xl border border-ink/10 bg-white">
          {busy ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-ink/60">No articles yet.</div>
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
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-ink/5">
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
                        {r.status}
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
                        >
                          <Pencil size={14} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => void remove(r.id)}
                          className="rounded p-1.5 text-red-600 hover:bg-red-50"
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
