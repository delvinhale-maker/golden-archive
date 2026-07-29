import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/lib/categories";
import { subcategoriesQuery, type Subcategory } from "@/lib/subcategories";

export const Route = createFileRoute("/_authenticated/admin/subcategories")({
  head: () => ({
    meta: [
      { title: "Subcategories — Admin · AurumVault" },
      { name: "description", content: "Create, rename, and reorder product subcategories." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminSubcategoriesPage,
});

function AdminSubcategoriesPage() {
  const navigate = useNavigate();
  const { user, loading, isAdmin } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth" });
    else if (!isAdmin) navigate({ to: "/dashboard" });
  }, [loading, user, isAdmin, navigate]);

  if (loading || !user || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-page">
        <Loader2 className="animate-spin text-navy" />
      </div>
    );
  }
  return <Editor />;
}

function Editor() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(subcategoriesQuery);
  const [slug, setSlug] = useState("financial_planners");
  const [items, setItems] = useState<Subcategory[]>([]);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const fromDb = useMemo(
    () => (data ?? []).filter((s) => s.category_slug === slug),
    [data, slug],
  );

  useEffect(() => setItems(fromDb), [fromDb]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: subcategoriesQuery.queryKey });

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    setItems(next);
  };

  const saveOrder = async () => {
    setBusy(true);
    try {
      let pos = 10;
      for (const it of items) {
        const { error } = await supabase
          .from("product_subcategories")
          .update({ position: pos })
          .eq("id", it.id);
        if (error) throw error;
        pos += 10;
      }
      await refresh();
      toast.success("Order saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save order");
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("product_subcategories").insert({
        category_slug: slug,
        name,
        position: (items.at(-1)?.position ?? 0) + 10,
      });
      if (error) throw error;
      setNewName("");
      await refresh();
      toast.success(`Added “${name}”`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add subcategory");
    } finally {
      setBusy(false);
    }
  };

  const rename = async (item: Subcategory, nextName: string) => {
    const name = nextName.trim();
    if (!name || name === item.name) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_rename_subcategory", {
        _category_slug: item.category_slug,
        _old_name: item.name,
        _new_name: name,
      });
      if (error) throw error;
      await refresh();
      toast.success("Renamed — products updated too");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not rename");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: Subcategory) => {
    if (!confirm(`Delete “${item.name}”? Products keep their current tag until reassigned.`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("product_subcategories").delete().eq("id", item.id);
      if (error) throw error;
      await refresh();
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-page pb-24">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link to="/admin" className="mb-4 inline-flex items-center gap-2 text-sm text-mute hover:text-navy">
          <ArrowLeft size={15} /> Back to admin
        </Link>
        <h1 className="font-display text-2xl font-bold text-navy">Subcategories</h1>
        <p className="mt-1 text-sm text-mute">
          Create, rename, and reorder the subcategory filters shown on a category page and in the
          product upload form.
        </p>

        <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-4">
          <label className="block text-[11px] font-bold uppercase tracking-caps text-mute">
            Parent category
          </label>
          <select
            className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-navy"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>

          <div className="mt-5 space-y-2">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-navy" />
              </div>
            ) : items.length === 0 ? (
              <p className="py-6 text-center text-sm text-mute">
                No subcategories yet for this category.
              </p>
            ) : (
              items.map((item, idx) => (
                <SubRow
                  key={item.id}
                  item={item}
                  idx={idx}
                  total={items.length}
                  busy={busy}
                  onMove={move}
                  onRename={rename}
                  onDelete={remove}
                />
              ))
            )}
          </div>

          {items.length > 1 && (
            <button
              type="button"
              onClick={saveOrder}
              disabled={busy}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Save size={15} /> Save order
            </button>
          )}

          <div className="mt-6 border-t border-ink/10 pt-4">
            <label className="block text-[11px] font-bold uppercase tracking-caps text-mute">
              Add subcategory
            </label>
            <div className="mt-1 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-navy"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Wedding Planners"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void add();
                }}
              />
              <button
                type="button"
                onClick={() => void add()}
                disabled={busy || !newName.trim()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-navy disabled:opacity-50"
              >
                <Plus size={15} /> Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubRow({
  item,
  idx,
  total,
  busy,
  onMove,
  onRename,
  onDelete,
}: {
  item: Subcategory;
  idx: number;
  total: number;
  busy: boolean;
  onMove: (idx: number, dir: -1 | 1) => void;
  onRename: (item: Subcategory, name: string) => void | Promise<void>;
  onDelete: (item: Subcategory) => void | Promise<void>;
}) {
  const [value, setValue] = useState(item.name);
  useEffect(() => setValue(item.name), [item.name]);

  return (
    <div className="flex items-center gap-2 rounded-xl border border-ink/10 bg-paper px-3 py-2">
      <div className="flex flex-col">
        <button
          type="button"
          aria-label="Move up"
          disabled={idx === 0}
          onClick={() => onMove(idx, -1)}
          className="text-mute hover:text-navy disabled:opacity-25"
        >
          <ArrowUp size={14} />
        </button>
        <button
          type="button"
          aria-label="Move down"
          disabled={idx === total - 1}
          onClick={() => onMove(idx, 1)}
          className="text-mute hover:text-navy disabled:opacity-25"
        >
          <ArrowDown size={14} />
        </button>
      </div>
      <input
        className="min-w-0 flex-1 rounded-lg border border-ink/10 bg-white px-3 py-1.5 text-sm text-navy"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void onRename(item, value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      <button
        type="button"
        aria-label={`Delete ${item.name}`}
        disabled={busy}
        onClick={() => void onDelete(item)}
        className="text-mute hover:text-red-600 disabled:opacity-40"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
