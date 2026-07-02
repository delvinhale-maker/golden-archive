import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type DeviceKind = "tablet" | "phone" | "kindle";
type OutlineEntry = { title: string; pageIndex: number };

const FONT_SCALES: Record<number, number> = { 1: 0.8, 2: 0.9, 3: 1, 4: 1.35, 5: 1.7 };

const DEVICES: Record<DeviceKind, { label: string; w: number; h: number; frame: string; page: string; bg: string; homeButton?: boolean }> = {
  tablet: {
    label: "Tablet",
    w: 600, h: 800,
    frame: "bg-black rounded-[36px] p-5 shadow-2xl",
    page: "rounded-[14px] bg-white",
    bg: "#ffffff",
  },
  phone: {
    label: "Phone",
    w: 320, h: 580,
    frame: "bg-black rounded-[44px] p-4 shadow-2xl",
    page: "rounded-[28px] bg-white",
    bg: "#ffffff",
    homeButton: true,
  },
  kindle: {
    label: "Kindle",
    w: 400, h: 600,
    frame: "bg-[#c9c8c3] rounded-[20px] p-6 shadow-2xl",
    page: "rounded-[4px] bg-[#f7f5ef]",
    bg: "#f7f5ef",
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
  const [pageCount, setPageCount] = useState(1); // +1 for cover
  const [location, setLocation] = useState(1); // 1-indexed; 1 = cover
  const [fontSize, setFontSize] = useState(3);
  const [device, setDevice] = useState<DeviceKind>("tablet");
  const [outline, setOutline] = useState<OutlineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const [locationInput, setLocationInput] = useState("1");
  const [notPdf, setNotPdf] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const touchStartX = useRef<number | null>(null);

  const ext = manuscriptPath.split(".").pop()?.toLowerCase() ?? "";
  const isPdf = ext === "pdf";

  // Sign URL & load PDF
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.storage
          .from("product-files")
          .createSignedUrl(manuscriptPath, 60 * 30);
        if (error || !data?.signedUrl) throw new Error(error?.message ?? "Could not load manuscript");
        if (cancelled) return;
        setSignedUrl(data.signedUrl);
        if (!isPdf) {
          setNotPdf(true);
          setPageCount(1);
          setLoading(false);
          return;
        }
        const pdfjs: any = await import("pdfjs-dist");
        const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const loadingTask = pdfjs.getDocument({ url: data.signedUrl });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        setPdf(doc);
        setPageCount(doc.numPages + 1); // +1 for cover

        // Parse outline
        try {
          const raw = await doc.getOutline();
          if (raw && raw.length) {
            const entries: OutlineEntry[] = [];
            for (const item of raw) {
              try {
                const dest = typeof item.dest === "string" ? await doc.getDestination(item.dest) : item.dest;
                if (!dest) continue;
                const ref = dest[0];
                const pageIndex = await doc.getPageIndex(ref);
                entries.push({ title: item.title, pageIndex: pageIndex + 2 }); // +2 (cover offset + 1-index)
              } catch { /* skip */ }
            }
            if (!cancelled) setOutline(entries);
          }
        } catch { /* no outline */ }
        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Failed to load manuscript");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [manuscriptPath, isPdf]);

  // Render current page
  const dev = DEVICES[device];
  const pageAreaW = dev.w - (device === "phone" ? 32 : device === "kindle" ? 48 : 40);
  const pageAreaH = dev.h - (device === "phone" ? 32 : device === "kindle" ? 48 : 40);

  useEffect(() => {
    if (!pdf || location === 1) return;
    let cancelled = false;
    (async () => {
      try {
        if (renderTaskRef.current) { try { renderTaskRef.current.cancel(); } catch {} }
        const page = await pdf.getPage(location - 1); // cover offset
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = Math.min(pageAreaW / baseViewport.width, pageAreaH / baseViewport.height);
        const zoom = FONT_SCALES[fontSize] ?? 1;
        const scale = fitScale * zoom;
        const viewport = page.getViewport({ scale });
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const task = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          // ignore
        }
      }
    })();
    return () => { cancelled = true; };
  }, [pdf, location, fontSize, pageAreaW, pageAreaH]);

  const goTo = useCallback((next: number) => {
    setLocation((prev) => {
      const target = Math.max(1, Math.min(pageCount, next));
      if (target === prev) return prev;
      setSlideDir(target > prev ? "left" : "right");
      setLocationInput(String(target));
      setTimeout(() => setSlideDir(null), 220);
      return target;
    });
  }, [pageCount]);

  useEffect(() => { setLocationInput(String(location)); }, [location]);

  // Keyboard
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

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#111] text-white" role="dialog" aria-modal="true" aria-label={`Preview ${title}`}>
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
            onBlur={() => { const n = parseInt(locationInput, 10); if (Number.isFinite(n)) goTo(n); else setLocationInput(String(location)); }}
            onKeyDown={(e) => { if (e.key === "Enter") { const n = parseInt(locationInput, 10); if (Number.isFinite(n)) goTo(n); } }}
            className="w-16 h-9 rounded-md bg-black/40 border border-white/15 px-2 text-center text-white"
            aria-label="Current page"
          />
          <span className="text-white/60">of {pageCount}</span>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-white/70">Font size</span>
          <select value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
            className="h-9 rounded-md bg-black/40 border border-white/15 px-2 text-white">
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-white/70">Contents</span>
          <select
            disabled={outline.length === 0}
            value=""
            onChange={(e) => { const p = parseInt(e.target.value, 10); if (Number.isFinite(p)) goTo(p); }}
            className="h-9 rounded-md bg-black/40 border border-white/15 px-2 text-white max-w-[240px] disabled:opacity-60"
          >
            <option value="">{outline.length ? "Jump to chapter…" : "No table of contents available"}</option>
            {outline.map((o, i) => (
              <option key={i} value={o.pageIndex}>{o.title}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 ml-auto">
          <span className="text-white/70">Device</span>
          <select value={device} onChange={(e) => setDevice(e.target.value as DeviceKind)}
            className="h-9 rounded-md bg-black/40 border border-white/15 px-2 text-white">
            {Object.entries(DEVICES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
      </div>

      {/* Stage */}
      <div className="relative flex-1 overflow-auto flex items-center justify-center p-6" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* Left arrow */}
        <button
          onClick={() => goTo(location - 1)}
          aria-label="Previous page"
          disabled={location <= 1}
          className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 inline-flex items-center justify-center"
        >
          <ChevronLeft size={28} />
        </button>

        {/* Device frame */}
        <div
          key={device}
          className={`transition-opacity duration-200 ${dev.frame} relative`}
          style={{ width: dev.w, height: dev.h, maxWidth: "100%" }}
        >
          <div
            className={`relative overflow-hidden ${dev.page} w-full h-full flex items-center justify-center`}
            style={{ background: location === 1 ? "transparent" : dev.bg }}
          >
            <div key={location} className={`w-full h-full flex items-center justify-center ${slideAnim}`}>
              {loading ? (
                <div className="flex flex-col items-center gap-2 text-black/60">
                  <Loader2 className="animate-spin" size={28} />
                  <span className="text-xs">Loading manuscript…</span>
                </div>
              ) : error ? (
                <div className="text-red-600 text-sm text-center px-6">{error}</div>
              ) : location === 1 ? (
                coverUrl ? (
                  <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-navy to-[#22335A] text-white/70 text-sm">
                    No cover uploaded
                  </div>
                )
              ) : notPdf ? (
                <div className="text-center px-6 text-black/70 text-sm">
                  <p className="font-semibold mb-2">Live preview not available for {ext.toUpperCase()} files.</p>
                  <a href={signedUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="underline">Open file in new tab</a>
                </div>
              ) : (
                <canvas ref={canvasRef} className="block max-w-full max-h-full" />
              )}
            </div>
          </div>
          {dev.homeButton && (
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-16 rounded-full bg-white/30" aria-hidden="true" />
          )}
        </div>

        {/* Right arrow */}
        <button
          onClick={() => goTo(location + 1)}
          aria-label="Next page"
          disabled={location >= pageCount}
          className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 inline-flex items-center justify-center"
        >
          <ChevronRight size={28} />
        </button>
      </div>

      <style>{`
        @keyframes av-slide-left-kf { from { transform: translateX(30px); opacity: 0.4 } to { transform: translateX(0); opacity: 1 } }
        @keyframes av-slide-right-kf { from { transform: translateX(-30px); opacity: 0.4 } to { transform: translateX(0); opacity: 1 } }
        .av-slide-left { animation: av-slide-left-kf 200ms ease }
        .av-slide-right { animation: av-slide-right-kf 200ms ease }
      `}</style>
    </div>
  );
}
