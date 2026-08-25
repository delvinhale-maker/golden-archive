import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FileArchive, Loader2, Star, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DELIVERY_ACCEPT,
  MAX_DELIVERY_BYTES,
  type DeliveryFile,
  displayName,
  extOf,
  formatBytes,
  formatLabel,
  isAllowedDeliveryFile,
  isAllowedDeliveryMime,
  sortDeliveryFiles,
} from "@/lib/product-delivery";

/**
 * Creator/admin manager for a product's digital delivery files. Any mix of
 * formats is allowed (ZIP bundle + the individual files inside it, worksheets,
 * audio, ...). ZIP here is purely a delivery format.
 */
export function ProductDeliveryFilesManager({
  productId,
  sellerId,
}: {
  productId: string;
  sellerId: string;
}) {
  const [files, setFiles] = useState<DeliveryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("product_download_files" as any)
      .select("id,product_id,seller_id,label,file_path,file_size_bytes,format,is_primary,sort_order")
      .eq("product_id", productId);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setFiles(sortDeliveryFiles((data ?? []) as unknown as DeliveryFile[]));
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function uploadFiles(list: File[]) {
    if (list.length === 0) return;
    setUploading(true);
    let added = 0;
    for (const f of list) {
      if (!isAllowedDeliveryFile(f.name)) {
        toast.error(`${f.name}: unsupported format`);
        continue;
      }
      if (!isAllowedDeliveryMime(f.name, f.type)) {
        toast.error(`${f.name}: file contents don't match its .${extOf(f.name)} extension`);
        continue;
      }
      if (f.size <= 0) {
        toast.error(`${f.name}: file is empty`);
        continue;
      }
      if (f.size > MAX_DELIVERY_BYTES) {
        toast.error(`${f.name}: must be under 500 MB`);
        continue;
      }
      try {
        const safe = f.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const path = `${sellerId}/delivery/${Date.now()}-${safe}`;
        const up = await supabase.storage.from("product-files").upload(path, f, { upsert: false });
        if (up.error) throw up.error;
        const { error } = await supabase.from("product_download_files" as any).insert({
          product_id: productId,
          seller_id: sellerId,
          label: f.name.replace(/\.[^.]+$/, ""),
          file_path: path,
          file_size_bytes: f.size,
          format: extOf(f.name),
          is_primary: false,
          sort_order: files.length + added,
        });
        if (error) throw error;
        added += 1;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `Upload failed: ${f.name}`);
      }
    }
    setUploading(false);
    if (added > 0) toast.success(`Added ${added} file${added === 1 ? "" : "s"} to this product`);
    void refresh();
  }

  async function remove(f: DeliveryFile) {
    if (!window.confirm(`Remove "${displayName(f)}" from this product?`)) return;
    const { error } = await supabase.from("product_download_files" as any).delete().eq("id", f.id);
    if (error) return toast.error(error.message);
    await supabase.storage.from("product-files").remove([f.file_path]);
    toast.success("File removed");
    void refresh();
  }

  async function makePrimary(f: DeliveryFile) {
    const { error } = await supabase
      .from("product_download_files" as any)
      .update({ is_primary: false })
      .eq("product_id", productId);
    if (error) return toast.error(error.message);
    const { error: e2 } = await supabase
      .from("product_download_files" as any)
      .update({ is_primary: true })
      .eq("id", f.id);
    if (e2) return toast.error(e2.message);
    toast.success(`"${displayName(f)}" is now the main download`);
    void refresh();
  }

  async function rename(f: DeliveryFile, label: string) {
    const next = label.trim();
    if (!next || next === f.label) return;
    const { error } = await supabase
      .from("product_download_files" as any)
      .update({ label: next })
      .eq("id", f.id);
    if (error) return toast.error(error.message);
    void refresh();
  }

  return (
    <div className="space-y-3">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void uploadFiles(Array.from(e.dataTransfer.files ?? []));
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          dragOver ? "border-gold bg-gold/10" : "border-ink/15 bg-paper/40 hover:bg-ink/5"
        }`}
      >
        {uploading ? (
          <Loader2 size={22} className="animate-spin text-gold-ink" />
        ) : (
          <Upload size={22} className="text-gold-ink" />
        )}
        <span className="text-sm font-semibold text-navy">
          {uploading ? "Uploading…" : "Upload the main customer bundle"}
        </span>
        <span className="text-xs text-mute">
          Drop files here or tap to upload · Supported: ZIP, PDF, XLSX, DOCX, CSV (also PPTX,
          EPUB, TXT, images, MP3) · up to 500 MB each
        </span>
        <input
          type="file"
          multiple
          accept={DELIVERY_ACCEPT}
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            e.target.value = "";
            void uploadFiles(picked);
          }}
        />
      </label>

      {loading ? (
        <p className="text-xs text-mute">Loading delivery files…</p>
      ) : files.length === 0 ? (
        <p className="text-xs text-mute">
          No extra delivery files yet. The main manuscript above is still delivered as usual.
        </p>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              data-testid="delivery-file-row"
              className="w-full min-w-0 space-y-2 overflow-hidden rounded-lg border border-ink/10 bg-white px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileArchive size={16} className="shrink-0 text-gold-ink" />
                <input
                  defaultValue={displayName(f)}
                  onBlur={(e) => void rename(f, e.target.value)}
                  className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-1 text-sm text-ink hover:border-ink/15 focus:border-gold focus:outline-none"
                  aria-label="File label"
                />
              </div>
              <p className="truncate text-[11px] text-mute" title={f.file_path.split("/").pop() ?? ""}>
                {(f.file_path.split("/").pop() ?? "").replace(/^\d+-/, "")}
              </p>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="rounded-full bg-navy px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
                  {f.format?.toUpperCase() || formatLabel(f.file_path)}
                </span>
                {formatBytes(f.file_size_bytes) && (
                  <span className="text-[11px] text-mute">{formatBytes(f.file_size_bytes)}</span>
                )}
                <button
                  type="button"
                  onClick={() => void makePrimary(f)}
                  title="Mark as the primary customer bundle"
                  className={`inline-flex min-h-9 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                    f.is_primary ? "bg-gold text-navy" : "border border-ink/15 text-mute hover:bg-ink/5"
                  }`}
                >
                  <Star size={12} />
                  <span className="whitespace-nowrap">
                    {f.is_primary ? "Primary bundle" : "Set as primary"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void remove(f)}
                  className="inline-flex min-h-9 items-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                >
                  <Trash2 size={12} /> Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
