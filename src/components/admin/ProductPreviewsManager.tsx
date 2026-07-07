import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowUp, ArrowDown, Trash2, Upload, ImageIcon, Save, GripVertical } from "lucide-react";
import { toast } from "sonner";

type PreviewRow = {
  id: string;
  product_id: string;
  page_order: number;
  image_url: string;
  alt_text: string | null;
};

const BUCKET = "product-previews";
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per image

export function ProductPreviewsManager({
  productId,
  sellerId,
}: {
  productId: string;
  sellerId: string;
}) {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [altDrafts, setAltDrafts] = useState<Record<string, string>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("product_previews")
      .select("id,product_id,page_order,image_url,alt_text")
      .eq("product_id", productId)
      .order("page_order", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data ?? []) as PreviewRow[]);
    setAltDrafts(Object.fromEntries((data ?? []).map((r) => [r.id, r.alt_text ?? ""])));
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    for (const f of files) {
      if (!f.type.startsWith("image/")) {
        toast.error(`${f.name}: must be an image`);
        return;
      }
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name}: must be under 8 MB`);
        return;
      }
    }

    setBusy(true);
    let nextOrder = (rows[rows.length - 1]?.page_order ?? 0) + 1;
    try {
      for (const f of files) {
        const safe = f.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const path = `${sellerId}/${productId}/${Date.now()}-${safe}`;
        const up = await supabase.storage.from(BUCKET).upload(path, f, {
          upsert: false,
          contentType: f.type,
        });
        if (up.error) throw up.error;
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        const { error: insErr } = await supabase.from("product_previews").insert({
          product_id: productId,
          page_order: nextOrder,
          image_url: pub.publicUrl,
          alt_text: null,
        });
        if (insErr) throw insErr;
        nextOrder += 1;
      }
      toast.success(`Added ${files.length} preview${files.length === 1 ? "" : "s"}`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function persistOrder(next: PreviewRow[]) {
    // Detect actual moves to skip no-op writes.
    const changed = next
      .map((r, i) => ({ id: r.id, from: r.page_order, to: i + 1 }))
      .filter((c) => c.from !== c.to);
    if (changed.length === 0) return;

    // Optimistic UI: reflect the new order immediately.
    setRows(next.map((r, i) => ({ ...r, page_order: i + 1 })));
    setBusy(true);
    try {
      // Two-phase to dodge the (product_id, page_order) unique constraint:
      // 1) move everything to a negative temporary slot,
      // 2) set the final 1..N ordering.
      for (let i = 0; i < next.length; i++) {
        const r = await supabase
          .from("product_previews")
          .update({ page_order: -(i + 1) })
          .eq("id", next[i].id);
        if (r.error) throw r.error;
      }
      for (let i = 0; i < next.length; i++) {
        const r = await supabase
          .from("product_previews")
          .update({ page_order: i + 1 })
          .eq("id", next[i].id);
        if (r.error) throw r.error;
      }
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reorder failed");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= rows.length) return;
    const next = rows.slice();
    [next[index], next[j]] = [next[j], next[index]];
    await persistOrder(next);
  }

  function onDragStart(id: string) {
    if (busy) return;
    setDragId(id);
  }
  function onDragOver(e: React.DragEvent, id: string) {
    if (!dragId || dragId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverId !== id) setDragOverId(id);
  }
  function onDragEnd() {
    setDragId(null);
    setDragOverId(null);
  }
  async function onDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    const sourceId = dragId;
    setDragId(null);
    setDragOverId(null);
    if (!sourceId || sourceId === targetId) return;
    const from = rows.findIndex((r) => r.id === sourceId);
    const to = rows.findIndex((r) => r.id === targetId);
    if (from < 0 || to < 0) return;
    const next = rows.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    await persistOrder(next);
  }

  async function remove(row: PreviewRow) {
    if (!window.confirm(`Delete preview page ${row.page_order}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      // Try to remove the storage object if the URL is a public URL from this bucket.
      const marker = `/storage/v1/object/public/${BUCKET}/`;
      const idx = row.image_url.indexOf(marker);
      if (idx !== -1) {
        const path = decodeURIComponent(row.image_url.slice(idx + marker.length));
        await supabase.storage.from(BUCKET).remove([path]);
      }
      const { error } = await supabase.from("product_previews").delete().eq("id", row.id);
      if (error) throw error;
      toast.success("Preview deleted");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveAlt(row: PreviewRow) {
    const next = (altDrafts[row.id] ?? "").trim();
    if ((row.alt_text ?? "") === next) return;
    setBusy(true);
    const { error } = await supabase
      .from("product_previews")
      .update({ alt_text: next.length ? next : null })
      .eq("id", row.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Alt text saved");
    refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-mute">
          {rows.length} preview page{rows.length === 1 ? "" : "s"}. Images shown to shoppers on the product page in the order below.
        </p>
        <label className="inline-flex items-center gap-2 text-sm rounded-md border border-ink/15 bg-white px-3 py-2 cursor-pointer hover:bg-ink/5">
          <Upload size={14} />
          {busy ? "Working…" : "Add preview images"}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleUpload}
            disabled={busy}
          />
        </label>
      </div>

      {loading ? (
        <div className="rounded-md border border-dashed border-ink/15 bg-white p-6 text-center text-sm text-mute">
          Loading previews…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-ink/15 bg-white p-6 text-center text-sm text-mute">
          <ImageIcon size={18} className="inline mb-1" />
          <div>No preview pages yet. Upload watermarked sample images above.</div>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, i) => (
            <li key={row.id} className="flex gap-3 items-start rounded-md border border-ink/10 bg-white p-2">
              <div className="w-16 h-20 shrink-0 rounded bg-ink/5 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={row.image_url} alt={row.alt_text ?? `Preview page ${row.page_order}`} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-mute">Page {row.page_order}</span>
                </div>
                <div className="flex gap-1.5">
                  <input
                    value={altDrafts[row.id] ?? ""}
                    onChange={(e) => setAltDrafts({ ...altDrafts, [row.id]: e.target.value })}
                    placeholder="Alt text (optional, for accessibility)"
                    className="flex-1 h-8 rounded border border-ink/15 px-2 text-xs"
                  />
                  <button
                    onClick={() => saveAlt(row)}
                    disabled={busy || (row.alt_text ?? "") === (altDrafts[row.id] ?? "").trim()}
                    className="inline-flex items-center gap-1 text-xs rounded border border-ink/15 bg-white px-2 hover:bg-ink/5 disabled:opacity-40"
                    title="Save alt text"
                  >
                    <Save size={12} />
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => move(i, -1)}
                  disabled={busy || i === 0}
                  className="p-1.5 rounded border border-ink/15 hover:bg-ink/5 disabled:opacity-30"
                  title="Move up"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={busy || i === rows.length - 1}
                  className="p-1.5 rounded border border-ink/15 hover:bg-ink/5 disabled:opacity-30"
                  title="Move down"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  onClick={() => remove(row)}
                  disabled={busy}
                  className="p-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
