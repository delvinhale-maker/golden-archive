import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type DeviceKind = "phone" | "tablet" | "kindle";
type OutlineEntry = { title: string; pageIndex: number };

// Spec: 1=0.6×, 2=0.8×, 3=1.0×, 4=1.4×, 5=1.8×
const FONT_SCALES: Record<number, number> = { 1: 0.6, 2: 0.8, 3: 1.0, 4: 1.4, 5: 1.8 };

// Spec: Phone 340×600 black bezel | Tablet 520×700 thick bezel | Kindle 380×560 gray sepia
const DEVICES: Record<
  DeviceKind,
  { label: string; w: number; h: number; frame: string; page: string; bg: string; pad: number; homeButton?: boolean }
> = {
  phone: {
    label: "Phone",
    w: 340,
    h: 600,
    frame: "bg-black rounded-[44px] shadow-2xl",
    page: "rounded-[28px] bg-white",
    bg: "#ffffff",
    pad: 16,
    homeButton: true,
  },
  tablet: {
    label: "Tablet",
    w: 520,
    h: 700,
    frame: "bg-black rounded-[36px] shadow-2xl",
    page: "rounded-[14px] bg-white",
    bg: "#ffffff",
    pad: 28,
  },
  kindle: {
    label: "Kindle",
    w: 380,
    h: 560,
    frame: "bg-[#c9c8c3] rounded-[20px] shadow-2xl",
    page: "rounded-[4px] bg-[#f7f1e3]",
    bg: "#f7f1e3",
    pad: 24,
  },
};

export interface ManuscriptPreviewerProps {
  manuscriptPath: string;
  title: string;
  coverUrl: string | null;
  onClose: () => void;
}

export function ManuscriptPreviewer({ manuscriptPath, title, coverUrl, onClose }: ManuscriptPreviewerProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [pageCount, setPageCount] = useState(1); // includes cover as location 1
  const [location, setLocation] = useState(1);
  const [fontSize, setFontSize] = useState(3);
  const [device, setDevice] = useState<DeviceKind>("tablet");
  const [outline, setOutline] = useState<OutlineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const [locationInput, setLocationInput] = useState("1");
  const [notPdf, setNotPdf] = useState(false);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [docxPageCount, setDocxPageCount] = useState(1);
  const [epubReady, setEpubReady] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const touchStartX = useRef<number | null>(null);
  const docxInnerRef = useRef<HTMLDivElement>(null);
  const epubContainerRef = useRef<HTMLDivElement>(null);
  const epubBookRef = useRef<any>(null);
  const epubRenditionRef = useRef<any>(null);
  const epubTotalRef = useRef<number>(0);
  const epubSyncingRef = useRef<boolean>(false);

  const ext = manuscriptPath.split(".").pop()?.toLowerCase() ?? "";
  const isPdf = ext === "pdf";
  const isDocx = ext === "docx";
  const isEpub = ext === "epub";

  // Sign URL & load PDF
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setPdf(null);
      setPageCount(1);
      setLocation(1);
      setOutline([]);
      setNotPdf(false);
      setDocxHtml(null);
      setDocxPageCount(1);
      try {
        const { data, error: signErr } = await supabase.storage
          .from("product-files")
          .createSignedUrl(manuscriptPath, 60 * 30);
        if (signErr || !data?.signedUrl) throw new Error(signErr?.message ?? "Could not load manuscript");
        if (cancelled) return;
        setSignedUrl(data.signedUrl);

        if (isDocx) {
          try {
            const res = await fetch(data.signedUrl);
            if (!res.ok) throw new Error(`Download failed (${res.status})`);
            const buf = await res.arrayBuffer();
            const mammoth: any = await import("mammoth/mammoth.browser");
            const result = await mammoth.convertToHtml({ arrayBuffer: buf });
            if (cancelled) return;
            setDocxHtml(result.value || "<p>(Empty document)</p>");
            setLoading(false);
          } catch (docxErr: any) {
            console.error("[ManuscriptPreviewer] docx", docxErr);
            if (!cancelled) {
              setError(
                "We couldn't preview this Word document. It may be corrupted or use unsupported features. You can still open the original file in a new tab.",
              );
              setLoading(false);
            }
          }
          return;
        }


        if (!isPdf) {
          setNotPdf(true);
          setPageCount(1);
          setLoading(false);
          return;
        }

        const pdfjs: any = await import("pdfjs-dist");
        // Use the bundled worker URL — Vite emits it as a static asset and the
        // browser fetches it as a classic script, which works reliably across
        // dev and production without needing a module Worker.
        try {
          const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
          pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        } catch {
          pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        }

        const loadingTask = pdfjs.getDocument({
          url: data.signedUrl,
          cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
          cMapPacked: true,
        });
        const doc = await loadingTask.promise;
        if (cancelled) return;

        setPdf(doc);
        setPageCount(doc.numPages + 1); // +1 for cover as location 1

        // Parse outline (best effort)
        try {
          const raw = await doc.getOutline();
          if (raw && raw.length) {
            const entries: OutlineEntry[] = [];
            const walk = async (items: any[]) => {
              for (const item of items) {
                try {
                  const dest =
                    typeof item.dest === "string" ? await doc.getDestination(item.dest) : item.dest;
                  if (dest) {
                    const ref = dest[0];
                    const pageIndex = await doc.getPageIndex(ref);
                    entries.push({ title: item.title, pageIndex: pageIndex + 2 });
                  }
                } catch { /* skip */ }
                if (item.items?.length) await walk(item.items);
              }
            };
            await walk(raw);
            if (!cancelled) setOutline(entries);
          }
        } catch { /* no outline */ }

        setLoading(false);
      } catch (err: any) {
        console.error("[ManuscriptPreviewer]", err);
        if (!cancelled) {
          setError("Unable to load manuscript. Please try again.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [manuscriptPath, isPdf, isDocx]);

  const dev = DEVICES[device];
  const pageAreaW = dev.w - dev.pad * 2;
  const pageAreaH = dev.h - dev.pad * 2;

  // Measure DOCX HTML pages whenever html, font size, or device area changes.
  useLayoutEffect(() => {
    if (!isDocx || !docxHtml) return;
    const el = docxInnerRef.current;
    if (!el) return;
    // Give layout a tick to apply.
    requestAnimationFrame(() => {
      const h = el.scrollHeight;
      const pages = Math.max(1, Math.ceil(h / pageAreaH));
      setDocxPageCount(pages);
      setPageCount(pages + 1);
    });
  }, [isDocx, docxHtml, fontSize, device, pageAreaH]);


  // Rendered-page cache: key = `${pageNum}|${fontSize}|${device}` -> offscreen canvas.
  // Cache survives navigation, so revisiting a page is instant. A miss (new page,
  // new zoom, or new device frame) is the only path that re-runs pdf.render.
  // Bounded LRU: Map insertion order tracks recency; touching an entry re-inserts
  // it, and inserts past MAX_CACHE_ENTRIES evict the oldest key. This caps memory
  // during long reading sessions (each canvas can be several MB at high-DPR).
  const MAX_CACHE_ENTRIES = 24;
  const cacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map());

  const cacheGet = useCallback((key: string): HTMLCanvasElement | undefined => {
    const map = cacheRef.current;
    const hit = map.get(key);
    if (!hit) return undefined;
    // Refresh recency: delete + set moves the entry to the newest position.
    map.delete(key);
    map.set(key, hit);
    return hit;
  }, []);

  const cacheSet = useCallback((key: string, value: HTMLCanvasElement) => {
    const map = cacheRef.current;
    if (map.has(key)) map.delete(key);
    map.set(key, value);
    while (map.size > MAX_CACHE_ENTRIES) {
      const oldest = map.keys().next().value;
      if (oldest === undefined) break;
      map.delete(oldest);
    }
  }, []);

  // Invalidate the cache when the source doc changes.
  useEffect(() => {
    cacheRef.current.clear();
  }, [pdf]);

  const renderToOffscreen = useCallback(
    async (
      pageNum: number,
      zoomStep: number,
      deviceKey: DeviceKind,
    ): Promise<HTMLCanvasElement | null> => {
      if (!pdf) return null;
      const key = `${pageNum}|${zoomStep}|${deviceKey}`;
      const cached = cacheGet(key);
      if (cached) return cached;

      const page = await pdf.getPage(pageNum);
      const base = page.getViewport({ scale: 1 });
      const areaW = DEVICES[deviceKey].w - DEVICES[deviceKey].pad * 2;
      const areaH = DEVICES[deviceKey].h - DEVICES[deviceKey].pad * 2;
      const fitScale = Math.min(areaW / base.width, areaH / base.height);
      const zoom = FONT_SCALES[zoomStep] ?? 1;
      const viewport = page.getViewport({ scale: fitScale * zoom });
      const dpr = window.devicePixelRatio || 1;

      const off = document.createElement("canvas");
      off.width = Math.floor(viewport.width * dpr);
      off.height = Math.floor(viewport.height * dpr);
      const cssW = Math.floor(viewport.width);
      const cssH = Math.floor(viewport.height);
      off.dataset.cssW = String(cssW);
      off.dataset.cssH = String(cssH);
      const ctx = off.getContext("2d");
      if (!ctx) return null;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      await page.render({ canvasContext: ctx, viewport }).promise;
      cacheSet(key, off);
      return off;
    },
    [pdf, cacheGet, cacheSet],
  );


  const blit = useCallback((source: HTMLCanvasElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cssW = Number(source.dataset.cssW || source.width);
    const cssH = Number(source.dataset.cssH || source.height);
    canvas.width = source.width;
    canvas.height = source.height;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0);
  }, []);

  // Render current PDF page (locations >= 2). Cache-first, then prefetch neighbors.
  useEffect(() => {
    if (!pdf || location === 1) return;
    let cancelled = false;
    (async () => {
      try {
        if (renderTaskRef.current) {
          try { renderTaskRef.current.cancel(); } catch { /* noop */ }
        }
        const pageNum = location - 1;
        if (pageNum < 1 || pageNum > pdf.numPages) return;

        const key = `${pageNum}|${fontSize}|${device}`;
        const cached = cacheGet(key);
        if (cached) {
          blit(cached);
        } else {
          const off = await renderToOffscreen(pageNum, fontSize, device);
          if (cancelled || !off) return;
          blit(off);
        }

        // Prefetch neighbors so the next arrow tap is also instant.
        const neighbors = [pageNum + 1, pageNum - 1].filter(
          (n) => n >= 1 && n <= pdf.numPages,
        );
        for (const n of neighbors) {
          if (cancelled) break;
          const k = `${n}|${fontSize}|${device}`;
          if (!cacheRef.current.has(k)) {
            renderToOffscreen(n, fontSize, device).catch(() => { /* ignore */ });
          }
        }

      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("[ManuscriptPreviewer] render", err);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [pdf, location, fontSize, device, blit, renderToOffscreen, cacheGet]);

  const goTo = useCallback(
    (next: number) => {
      setLocation((prev) => {
        const target = Math.max(1, Math.min(pageCount, next));
        if (target === prev) return prev;
        setSlideDir(target > prev ? "left" : "right");
        setLocationInput(String(target));
        window.setTimeout(() => setSlideDir(null), 160);
        return target;
      });
    },
    [pageCount],
  );

  useEffect(() => { setLocationInput(String(location)); }, [location]);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
      if (typing) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); goTo(location - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(location + 1); }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [goTo, location, onClose]);

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) goTo(location + (dx < 0 ? 1 : -1));
    touchStartX.current = null;
  };

  const slideAnim = useMemo(() => {
    if (!slideDir) return "";
    return slideDir === "left" ? "av-slide-left" : "av-slide-right";
  }, [slideDir]);

  const commitLocation = () => {
    const n = parseInt(locationInput, 10);
    if (Number.isFinite(n)) goTo(n);
    else setLocationInput(String(location));
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-[#111] text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${title}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 md:px-6 h-14 border-b border-white/10 bg-[#0b0b0b]">
        <span className="font-semibold truncate">{title || "Untitled"}</span>
        <button
          onClick={onClose}
          aria-label="Close preview"
          className="ml-auto h-10 w-10 rounded-full inline-flex items-center justify-center hover:bg-white/10"
        >
          <X size={22} />
        </button>
      </div>

      {/* Top controls */}
      <div className="flex flex-wrap items-center gap-3 px-4 md:px-6 py-3 border-b border-white/10 bg-[#161616] text-sm">
        <label className="flex items-center gap-2">
          <span className="text-white/70">Location</span>
          <input
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value.replace(/[^0-9]/g, ""))}
            onBlur={commitLocation}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitLocation(); } }}
            className="w-16 h-9 rounded-md bg-black/40 border border-white/15 px-2 text-center text-white"
            aria-label="Current location"
          />
          <span className="text-white/60">of {pageCount}</span>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-white/70">Font size</span>
          <select
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
            className="h-9 rounded-md bg-black/40 border border-white/15 px-2 text-white"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-white/70">Contents</span>
          <select
            value=""
            onChange={(e) => { const p = parseInt(e.target.value, 10); if (Number.isFinite(p)) goTo(p); }}
            className="h-9 rounded-md bg-black/40 border border-white/15 px-2 text-white max-w-[240px]"
          >
            <option value="">
              {outline.length ? "Jump to chapter…" : "No contents available"}
            </option>
            {outline.length > 0 && <option value="1">Cover</option>}
            {outline.map((o, i) => (
              <option key={i} value={o.pageIndex}>{o.title}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 ml-auto">
          <span className="text-white/70">Device</span>
          <select
            value={device}
            onChange={(e) => setDevice(e.target.value as DeviceKind)}
            className="h-9 rounded-md bg-black/40 border border-white/15 px-2 text-white"
          >
            {Object.entries(DEVICES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Stage */}
      <div className="relative flex-1 overflow-auto flex items-center justify-center p-6">
        {/* Left arrow — 56×56 tap target */}
        <button
          onClick={() => goTo(location - 1)}
          aria-label="Previous page"
          disabled={location <= 1}
          className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-25 disabled:cursor-not-allowed inline-flex items-center justify-center transition"
        >
          <ChevronLeft size={30} />
        </button>

        {/* Device frame */}
        <div
          key={device}
          className={`transition-opacity duration-200 ${dev.frame} relative touch-pan-y select-none`}
          style={{ width: dev.w, height: dev.h, maxWidth: "100%", padding: dev.pad }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            className={`relative overflow-hidden ${dev.page} w-full h-full flex items-center justify-center`}
            style={{ background: location === 1 ? "transparent" : dev.bg }}
          >
            <div
              key={location}
              className={`w-full h-full flex items-center justify-center ${slideAnim}`}
            >
              {loading ? (
                <div className="flex flex-col items-center gap-2 text-black/60">
                  <Loader2 className="animate-spin" size={28} />
                  <span className="text-xs">Loading manuscript…</span>
                </div>
              ) : error ? (
                <div className="text-center px-6 max-w-sm">
                  <p className="text-red-600 text-sm mb-3">{error}</p>
                  {signedUrl && (
                    <a
                      href={signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-sm underline text-black/70 hover:text-black"
                    >
                      Open original file in new tab
                    </a>
                  )}
                </div>
              ) : location === 1 ? (
                coverUrl ? (
                  <img
                    src={coverUrl}
                    alt="Cover"
                    className="w-full h-full object-contain"
                    style={{
                      objectPosition: "top",
                      transform: `scale(${FONT_SCALES[fontSize] ?? 1})`,
                      transformOrigin: "top center",
                      transition: "transform 150ms ease",
                    }}
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center bg-gradient-to-br from-navy to-[#22335A] text-white/70 text-sm"
                    style={{
                      transform: `scale(${FONT_SCALES[fontSize] ?? 1})`,
                      transformOrigin: "center center",
                      transition: "transform 150ms ease",
                    }}
                  >
                    No cover uploaded
                  </div>
                )
              ) : isDocx && docxHtml ? (
                <div
                  style={{ width: pageAreaW, height: pageAreaH, overflow: "hidden", position: "relative" }}
                >
                  <div
                    ref={docxInnerRef}
                    className="text-black"
                    style={{
                      width: pageAreaW,
                      padding: "8px 12px",
                      fontSize: `${16 * (FONT_SCALES[fontSize] ?? 1)}px`,
                      lineHeight: 1.5,
                      transform: `translateY(-${(location - 2) * pageAreaH}px)`,
                      transition: "transform 150ms ease",
                      boxSizing: "border-box",
                      wordWrap: "break-word",
                    }}
                    dangerouslySetInnerHTML={{ __html: docxHtml }}
                  />
                </div>
              ) : notPdf ? (
                <div className="text-center px-6 text-black/70 text-sm">
                  <p className="font-semibold mb-2">
                    Live preview not available for {ext.toUpperCase()} files.
                  </p>
                  <a
                    href={signedUrl ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Open file in new tab
                  </a>
                </div>
              ) : (
                <canvas ref={canvasRef} className="block max-w-full max-h-full" />
              )}
            </div>
          </div>
          {dev.homeButton && (
            <div
              className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-16 rounded-full bg-white/30"
              aria-hidden="true"
            />
          )}
        </div>

        {/* Right arrow — 56×56 tap target */}
        <button
          onClick={() => goTo(location + 1)}
          aria-label="Next page"
          disabled={location >= pageCount}
          className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-25 disabled:cursor-not-allowed inline-flex items-center justify-center transition"
        >
          <ChevronRight size={30} />
        </button>
      </div>

      <style>{`
        @keyframes av-slide-left-kf { from { transform: translateX(24px); opacity: 0.35 } to { transform: translateX(0); opacity: 1 } }
        @keyframes av-slide-right-kf { from { transform: translateX(-24px); opacity: 0.35 } to { transform: translateX(0); opacity: 1 } }
        .av-slide-left { animation: av-slide-left-kf 150ms ease }
        .av-slide-right { animation: av-slide-right-kf 150ms ease }
      `}</style>
    </div>
  );
}
