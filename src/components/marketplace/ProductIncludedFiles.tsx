import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileArchive } from "lucide-react";
import { getPublicDeliveryFiles } from "@/lib/product-delivery.functions";
import {
  type DeliveryFileSummary,
  displayName,
  formatBytes,
  sortDeliveryFiles,
} from "@/lib/product-delivery";

/**
 * Shopper-facing "Included with your purchase" file manifest. Shows labels,
 * formats and sizes only — the actual files stay private until purchase.
 */
export function ProductIncludedFiles({ productId }: { productId: string }) {
  const fetchFiles = useServerFn(getPublicDeliveryFiles);
  const q = useQuery({
    queryKey: ["delivery-files", productId],
    queryFn: async () => {
      const res = await fetchFiles({ data: { productId } });
      return sortDeliveryFiles(res.files as DeliveryFileSummary[]);
    },
    staleTime: 60_000,
  });

  const files = q.data ?? [];
  if (files.length === 0) return null;

  const totalBytes = files.reduce((sum, f) => sum + (f.file_size_bytes ?? 0), 0);
  const hasZip = files.some((f) => (f.format ?? "").toLowerCase() === "zip");

  return (
    <div className="mt-8 max-w-2xl rounded-2xl border border-ink/10 bg-white p-5">
      <div className="flex items-center gap-2">
        <FileArchive size={18} className="text-gold-ink" />
        <h3 className="font-display text-lg font-bold text-navy">Your download includes</h3>
      </div>
      <ul className="mt-3 divide-y divide-ink/10">
        {files.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-2 py-2.5">
            <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{displayName(f)}</span>
            <span className="rounded-full bg-navy px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
              {f.format?.toUpperCase() || "FILE"}
            </span>
            {formatBytes(f.file_size_bytes) && (
              <span className="text-xs text-mute">{formatBytes(f.file_size_bytes)}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-mute">
        {files.length} file{files.length === 1 ? "" : "s"}
        {formatBytes(totalBytes) ? ` · ${formatBytes(totalBytes)} total` : ""}
        {hasZip ? " · ZIP files unzip on phone, tablet and desktop" : ""} · instant access after
        checkout, lifetime re-downloads from your library.
      </p>
    </div>
  );
}
