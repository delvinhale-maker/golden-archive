import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensurePdfJsRuntimeCompat } from "@/lib/pdfjs-compat";

const MAX_PAGES = 5;

// Recommended preview mix, keyed by dashboard product-type. Used by the
// "Suggest a starter selection" affordance — creator still confirms actual
// page numbers manually since a book's ToC page number varies per file.
const RECOMMENDED_LABELS: Record<string, string[]> = {
  financial_planner: [
    "Table of Contents",
    "Kingdom Stewardship intro",
    "Monthly Budget worksheet (blank)",
    "Debt Payoff Tracker",
    "Quarterly Financial Review",
  ],
};

export interface PreviewPagePickerProps {
  /** Storage path in the `product-files` bucket, OR a direct http(s)/blob URL. */
  filePath: string | null;
  /** Original browser filename. Used when mobile storage paths lose the extension. */
  fileName?: string | null;
  /** Extension inferred from validated bytes/name during upload. */
  fileExt?: string | null;
  /** Original browser file size. Large PDFs stay in manual mode until requested. */
  fileSize?: number | null;
  /** Ordered 1-indexed page numbers the creator has selected. */
  value: number[];
  onChange: (next: number[]) => void;
  /** Product-type key from the FAB selection — drives the starter selection helper. */
  productTypeKey?: string;
  /** Set true for reflow formats (docx/epub) — the picker will render a disabled note. */
  isReflowFormat?: boolean;
}

/**
 * PDF thumbnail grid. Click a page to toggle it in the ordered preview
 * selection (max 5). Reads the manuscript through a short-lived signed URL
 * from the browser — the creator is already authenticated, so this is safe.
 */
export function PreviewPagePicker({
  filePath,
  fileName,
  fileExt,
  fileSize,
  value,
  onChange,
  productTypeKey,
  isReflowFormat,
}: PreviewPagePickerProps) {
  const [thumbs, setThumbs] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [sniffedPdf, setSniffedPdf] = useState(false);
  const cancelledRef = useRef(false);

  const startsWithScheme = (p: string) => /^(https?|blob):/i.test(p);
  const extFrom = (source: string | null | undefined) => {
    const cleaned = (source ?? "").split("#")[0].split("?")[0];
    const ext = cleaned.includes(".") ? cleaned.split(".").pop()?.toLowerCase() : undefined;
    return ext === "pdf" || ext === "docx" || ext === "epub" ? ext : undefined;
  };
  const fileNameExt = extFrom(fileName);
  const filePathExt = extFrom(filePath);
  const validatedExt = (fileExt ?? "").toLowerCase();
  const declaredLooksLikePdf = validatedExt === "pdf" || fileNameExt === "pdf" || filePathExt === "pdf";
  const looksLikePdf = declaredLooksLikePdf || sniffedPdf;
  const isLargePdf = (fileSize ?? 0) > 25 * 1024 * 1024;
  const [pageInput, setPageInput] = useState("");

  useEffect(() => {
    let cancelled = false;
    setSniffedPdf(false);
    if (!filePath || isReflowFormat || declaredLooksLikePdf) return;
    (async () => {
      try {
        let signed = filePath;
        if (!startsWithScheme(filePath)) {
          const { data, error: e } = await supabase.storage
            .from("product-files")
            .createSignedUrl(filePath, 60 * 15);
          if (e || !data?.signedUrl) return;
          signed = data.signedUrl;
        }
        const res = await fetch(signed, { headers: { Range: "bytes=0-4" } });
        if (!res.ok) return;
        const bytes = new Uint8Array(await res.arrayBuffer());
        const header = String.fromCharCode(
          bytes[0] ?? 0,
          bytes[1] ?? 0,
          bytes[2] ?? 0,
          bytes[3] ?? 0,
          bytes[4] ?? 0,
        );
        if (!cancelled && header === "%PDF-") setSniffedPdf(true);
      } catch {
        // Keep the non-PDF explanatory state below.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filePath, isReflowFormat, declaredLooksLikePdf]);

  const load = useCallback(async () => {
    if (!filePath) return;
    if (isReflowFormat || !looksLikePdf) return;
    cancelledRef.current = false;
    setLoading(true);
    setError(null);
    setThumbs(null);
    try {
      let signed = filePath;
      if (!startsWithScheme(filePath)) {
        const { data, error: e } = await supabase.storage
          .from("product-files")
          .createSignedUrl(filePath, 60 * 15);
        if (e || !data?.signedUrl) throw new Error(e?.message ?? "Signing failed");
        signed = data.signedUrl;
      }

      ensurePdfJsRuntimeCompat();
      const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
      try {
        const workerUrl = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      } catch {
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
      }
      const doc = await pdfjs.getDocument({ url: signed }).promise;
      if (cancelledRef.current) return;
      setPageCount(doc.numPages);
      const rendered: string[] = new Array(doc.numPages).fill("");
      setThumbs(rendered.slice());
      // Cap the number of thumbnails rendered synchronously to keep the
      // creator flow snappy on large planners (100+ pages). Beyond the cap
      // we still track the count so the creator can type the page number.
      const cap = Math.min(doc.numPages, 60);
      for (let i = 1; i <= cap; i++) {
        if (cancelledRef.current) return;
        try {
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const targetW = 140;
          const scale = targetW / base.width;
          const vp = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(vp.width);
          canvas.height = Math.floor(vp.height);
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          rendered[i - 1] = canvas.toDataURL("image/jpeg", 0.7);
          setThumbs(rendered.slice());
        } catch {
          // Skip failed page silently — creator can still type the number.
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "Could not read the manuscript.");
    } finally {
      setLoading(false);
    }
  }, [filePath, isReflowFormat, looksLikePdf]);

  useEffect(() => {
    setThumbs(null);
    setLoading(false);
    setError(null);
    setPageCount(0);
    setPageInput("");
    if (filePath && looksLikePdf && !isReflowFormat && !isLargePdf) {
      void load();
    }
    return () => {
      cancelledRef.current = true;
    };
  }, [filePath, fileName, fileExt, isLargePdf, isReflowFormat, load, looksLikePdf]);

  function toggle(pageNum: number) {
    if (value.includes(pageNum)) {
      onChange(value.filter((p) => p !== pageNum));
      return;
    }
    if (value.length >= MAX_PAGES) return;
    onChange([...value, pageNum]);
  }

  function applyStarterSelection() {
    // We can't infer which page IS the Table of Contents from the file
    // alone — surface the recommended MIX and use plausible defaults so the
    // creator can adjust up/down rather than start from zero. Defaults:
    // pages 3, 6, 10, 24, 60 (approximate cadence for a 60+ page planner),
    // clamped to what exists.
    const heuristic = [3, 6, 10, 24, 60]
      .filter((p) => p >= 1 && p <= (pageCount || Infinity))
      .slice(0, MAX_PAGES);
    onChange(heuristic);
  }

  function addManualPage() {
    const pageNum = Number.parseInt(pageInput, 10);
    if (!Number.isFinite(pageNum) || pageNum < 1) return;
    if (pageCount > 0 && pageNum > pageCount) return;
    if (value.includes(pageNum) || value.length >= MAX_PAGES) return;
    onChange([...value, pageNum]);
    setPageInput("");
  }

  if (!filePath) {
    return (
      <p className="text-xs text-mute">
        Upload your manuscript first — the preview picker will appear here.
      </p>
    );
  }

  if (isReflowFormat || !looksLikePdf) {
    return (
      <div className="rounded-xl border border-ink/10 bg-paper/60 p-4 text-sm text-mute">
        Preview page selection is available for PDF manuscripts only. Word and
        EPUB files reflow to fit the reader, so a fixed 5-page selection
        wouldn't be reliable. Your existing full-manuscript preview still
        works for buyers who already own the file.
      </div>
    );
  }

  const recommended = productTypeKey ? RECOMMENDED_LABELS[productTypeKey] : undefined;
  const displayCount = thumbs?.length ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-navy">
          Selected <span className="font-bold">{value.length}</span> / {MAX_PAGES} preview page{value.length === 1 ? "" : "s"}
        </div>
        <div className="flex items-center gap-2">
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-semibold text-navy hover:bg-ink/5"
            >
              Clear
            </button>
          )}
          {recommended && (
            <button
              type="button"
              onClick={applyStarterSelection}
              className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3 py-1 text-xs font-semibold text-white hover:bg-navy/90"
            >
              <Sparkles size={12} /> Suggest a starter selection
            </button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-ink/10 bg-white p-3">
        <label htmlFor="preview-page-number" className="text-xs font-semibold text-navy">
          Add preview page by number
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="preview-page-number"
            type="number"
            inputMode="numeric"
            min={1}
            max={pageCount || undefined}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addManualPage();
              }
            }}
            className="inp min-w-0 flex-1"
            placeholder="Page #"
            disabled={value.length >= MAX_PAGES}
          />
          <button
            type="button"
            onClick={addManualPage}
            disabled={value.length >= MAX_PAGES || !pageInput.trim()}
            className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      {!thumbs && !loading && (
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-full border border-navy/20 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy/5"
        >
          {isLargePdf ? "Load thumbnails when needed" : "Load page thumbnails"}
        </button>
      )}

      {isLargePdf && !thumbs && (
        <p className="text-xs text-mute">
          Large PDF detected — use page numbers first, or load thumbnails only if needed.
        </p>
      )}

      {recommended && (
        <div className="rounded-lg border border-navy/10 bg-navy/[0.03] p-3 text-xs text-navy/80">
          <p className="font-semibold text-navy">Recommended mix for a Financial Planner</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4">
            {recommended.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ol>
          <p className="mt-1.5 text-navy/60">
            Pick the pages in your file that match these — actual page numbers vary per manuscript.
          </p>
        </div>
      )}

      {loading && !thumbs && (
        <div className="flex items-center gap-2 text-sm text-mute">
          <Loader2 size={14} className="animate-spin" /> Loading page thumbnails…
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Couldn't read the manuscript: {error}
        </div>
      )}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Selected pages in order">
          {value.map((p, i) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-navy"
            >
              {i + 1}. Page {p}
              <button
                type="button"
                onClick={() => toggle(p)}
                aria-label={`Remove page ${p} from preview`}
                className="ml-0.5 rounded-full bg-navy/10 px-1.5 leading-none hover:bg-navy/20"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {thumbs && displayCount > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {thumbs.map((src, idx) => {
            const pageNum = idx + 1;
            const selectedIndex = value.indexOf(pageNum);
            const isSelected = selectedIndex >= 0;
            const atCap = !isSelected && value.length >= MAX_PAGES;
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => toggle(pageNum)}
                disabled={atCap}
                aria-pressed={isSelected}
                className={`group relative aspect-[3/4] overflow-hidden rounded-lg border-2 bg-white transition ${
                  isSelected
                    ? "border-gold shadow-[0_0_0_3px_rgba(201,168,76,0.25)]"
                    : atCap
                    ? "border-ink/10 opacity-40"
                    : "border-ink/10 hover:border-navy/40"
                }`}
              >
                {src ? (
                  <img src={src} alt={`Page ${pageNum}`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-paper text-xs text-mute">
                    <Loader2 size={14} className="animate-spin" />
                  </div>
                )}
                <span
                  className={`absolute bottom-1 left-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isSelected ? "bg-gold text-navy" : "bg-black/70 text-white"
                  }`}
                >
                  {isSelected ? `${selectedIndex + 1} · p.${pageNum}` : `p.${pageNum}`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {thumbs && pageCount > displayCount && (
        <p className="text-xs text-mute">
          Showing the first {displayCount} pages of {pageCount}. Reach out to
          support if you need to preview a later page — this covers 99% of
          planner selections.
        </p>
      )}
    </div>
  );
}
