import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowUp, ArrowDown, Loader2, Save } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  getHomepageLayout,
  saveHomepageLayout,
  type HomepageLayoutItem,
} from "@/lib/homepage-layout.functions";

const layoutQ = queryOptions({
  queryKey: ["admin", "homepage-layout"],
  queryFn: () => getHomepageLayout(),
  staleTime: 0,
});

export const Route = createFileRoute("/_authenticated/admin/homepage")({
  loader: ({ context }) => context.queryClient.ensureQueryData(layoutQ),
  head: () => ({
    meta: [
      { title: "Homepage Layout — Admin · AurumVault" },
      { name: "description", content: "Reorder homepage sections and Vault Finds affiliate bands." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminHomepagePage,
});

function AdminHomepagePage() {
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
  const { data } = useSuspenseQuery(layoutQ);
  const queryClient = useQueryClient();
  const save = useServerFn(saveHomepageLayout);

  const [sections, setSections] = useState<HomepageLayoutItem[]>(data.sections);
  const [affiliates, setAffiliates] = useState<HomepageLayoutItem[]>(data.affiliates);
  const [saving, setSaving] = useState<null | "section" | "affiliate">(null);

  const move = (
    list: HomepageLayoutItem[],
    setter: (l: HomepageLayoutItem[]) => void,
    idx: number,
    dir: -1 | 1,
  ) => {
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    const next = list.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    setter(next);
  };

  const persist = async (kind: "section" | "affiliate", list: HomepageLayoutItem[]) => {
    setSaving(kind);
    try {
      await save({ data: { kind, orderedKeys: list.map((i) => i.key) } });
      await queryClient.invalidateQueries({ queryKey: ["admin", "homepage-layout"] });
      await queryClient.invalidateQueries({ queryKey: ["homepage-layout"] });
      toast.success("Saved. Homepage will reflect the new order.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="min-h-screen bg-bg-page pb-24">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-ink/70 hover:text-ink">
            <ArrowLeft size={16} /> Back to admin
          </Link>
          <h1 className="font-display text-xl text-navy">Homepage Layout</h1>
          <div className="w-24" />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <p className="mb-6 text-sm text-ink/70">
          Reorder homepage sections and Vault Finds affiliate bands. Changes go live
          immediately after saving — no redeploy needed.
        </p>

        <div className="grid gap-8 md:grid-cols-2">
          <List
            title="Homepage Sections"
            hint="Order of the main content rows between the hero and the trust section."
            items={sections}
            onMove={(i, d) => move(sections, setSections, i, d)}
            onSave={() => persist("section", sections)}
            saving={saving === "section"}
          />
          <List
            title="Affiliate Bands (Vault Finds)"
            hint="Order of the affiliate rows shown inside the Vault Finds band."
            items={affiliates}
            onMove={(i, d) => move(affiliates, setAffiliates, i, d)}
            onSave={() => persist("affiliate", affiliates)}
            saving={saving === "affiliate"}
          />
        </div>
      </div>
    </div>
  );
}

function List({
  title,
  hint,
  items,
  onMove,
  onSave,
  saving,
}: {
  title: string;
  hint: string;
  items: HomepageLayoutItem[];
  onMove: (idx: number, dir: -1 | 1) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <h2 className="font-display text-lg text-navy">{title}</h2>
      <p className="mt-1 text-xs text-ink/60">{hint}</p>
      <ul className="mt-4 space-y-2">
        {items.length === 0 && (
          <li className="rounded border border-dashed border-line p-4 text-center text-sm text-ink/50">
            No items configured.
          </li>
        )}
        {items.map((it, idx) => (
          <li
            key={it.key}
            className="flex items-center justify-between gap-3 rounded-lg border border-line bg-bg-page px-3 py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-ink">{it.label}</div>
              <div className="truncate text-[11px] font-mono text-ink/50">{it.key}</div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={`Move ${it.label} up`}
                onClick={() => onMove(idx, -1)}
                disabled={idx === 0}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-white text-ink hover:border-gold disabled:opacity-30"
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                aria-label={`Move ${it.label} down`}
                onClick={() => onMove(idx, 1)}
                disabled={idx === items.length - 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-white text-ink hover:border-gold disabled:opacity-30"
              >
                <ArrowDown size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onSave}
        disabled={saving || items.length === 0}
        className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-navy px-5 text-sm font-bold text-white hover:bg-navy/90 disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {saving ? "Saving…" : "Save order"}
      </button>
    </section>
  );
}
