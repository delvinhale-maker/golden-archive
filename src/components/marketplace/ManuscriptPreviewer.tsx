import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type DeviceKind = "phone" | "tablet" | "kindle";
type OutlineEntry = { title: string; pageIndex: number };
type EpubTocEntry = { title: string; href: string; depth: number };

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
    h: 580,
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
    page: "rounded-[4px] bg-[#f4ecd8]",
    bg: "#f4ecd8",
    pad: 24,
  },

};

export interface ManuscriptPreviewerProps {
  manuscriptPath: string;
  title: string;
  coverUrl: string | null;
  onClose: () => void;
  readerMode?: boolean;
  /** Cap the number of content pages (excluding cover) that can be viewed. */
  maxPages?: number;
}

export function ManuscriptPreviewer({ manuscriptPath, title, coverUrl, onClose, readerMode, maxPages }: ManuscriptPreviewerProps) {
  const capContentPages = (n: number) =>
    typeof maxPages === "number" && maxPages > 0 ? Math.min(n, maxPages) : n;
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [pageCount, setPageCount] = useState(1); // includes cover as location 1
  const [location, setLocation] = useState(1);
  const [fontSize, setFontSize] = useState(readerMode ? 2 : 3);
  const [device, setDevice] = useState<DeviceKind>("tablet");
  const [outline, setOutline] = useState<OutlineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSlow, setLoadingSlow] = useState(false);
  const [error, setError] = useState<{ title: string; steps: string[] } | null>(null);
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const [locationInput, setLocationInput] = useState("1");
  const [notPdf, setNotPdf] = useState(false);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [docxPageCount, setDocxPageCount] = useState(1);
  // Y-offset (px) of the first block on each DOCX page. Length = page count.
  // Populated by measuring block-level children so pages break between blocks,
  // never mid-line or mid-image.
  const [docxPageOffsets, setDocxPageOffsets] = useState<number[]>([0]);
  const [epubReady, setEpubReady] = useState(false);
  const [epubToc, setEpubToc] = useState<EpubTocEntry[]>([]);
  const [epubCurrentToc, setEpubCurrentToc] = useState<number | null>(null);
  // EPUB rendition mount state — drives the overlay spinner / error message
  // that sits on top of the epub.js iframe while it's attaching a section.
  const [epubRendering, setEpubRendering] = useState(false);
  const [epubRenderError, setEpubRenderError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollFrameRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const touchStartX = useRef<number | null>(null);
  const docxInnerRef = useRef<HTMLDivElement>(null);
  const [epubContainerEl, setEpubContainerEl] = useState<HTMLDivElement | null>(null);
  const epubContainerRef = useCallback((el: HTMLDivElement | null) => {
    setEpubContainerEl(el);
  }, []);
  const epubBookRef = useRef<any>(null);
  const epubRenditionRef = useRef<any>(null);
  const epubTotalRef = useRef<number>(0);
  const epubSyncingRef = useRef<boolean>(false);
  const epubTocRef = useRef<EpubTocEntry[]>([]);


  // Robust extension detection:
  // - Blob URLs from the upload picker append a `#.docx|pdf|epub` marker; honor it first.
  // - Otherwise strip query string + hash before reading the extension so signed/remote
  //   URLs like `https://.../file.pdf?token=abc` still resolve to "pdf".
  const ext = (() => {
    const hashMarker = manuscriptPath.match(/#\.(docx|pdf|epub)(?:$|\?)/i);
    if (hashMarker) return hashMarker[1].toLowerCase();
    const cleaned = manuscriptPath.split("#")[0].split("?")[0];
    return cleaned.split(".").pop()?.toLowerCase() ?? "";
  })();
  const isPdf = ext === "pdf";
  const isDocx = ext === "docx";
  const isEpub = ext === "epub";

  // Detect RTL from the document / nearest [dir] ancestor at mount.
  const [isRTL, setIsRTL] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const dir =
      document.documentElement.getAttribute("dir") ||
      document.body.getAttribute("dir") ||
      getComputedStyle(document.documentElement).direction ||
      "ltr";
    setIsRTL(dir.toLowerCase() === "rtl");
  }, []);


  // Sign URL & load PDF
  useEffect(() => {
    let cancelled = false;
    setLoadingSlow(false);
    const slowTimer = window.setTimeout(() => {
      if (!cancelled) setLoadingSlow(true);
    }, 12000);
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
      setEpubReady(false);
      setEpubToc([]);
      setEpubCurrentToc(null);
      epubTocRef.current = [];
      try {
        let signed: string;
        if (/^(https?|blob):/i.test(manuscriptPath)) {
          // Direct URL (http(s) or blob:) — skip Supabase signing.
          signed = manuscriptPath;
        } else {
          const { data, error: signErr } = await supabase.storage
            .from("product-files")
            .createSignedUrl(manuscriptPath, 60 * 30);
          if (signErr || !data?.signedUrl) throw new Error(signErr?.message ?? "Could not load manuscript");
          signed = data.signedUrl;
        }
        if (cancelled) return;
        setSignedUrl(signed);
        const data = { signedUrl: signed };

        if (isDocx) {
          try {
            const ctrl = new AbortController();
            const timeoutId = window.setTimeout(() => ctrl.abort(), 30000);
            let buf: ArrayBuffer;
            try {
              const res = await fetch(data.signedUrl, { signal: ctrl.signal });
              if (!res.ok) throw new Error(`Download failed (${res.status})`);
              buf = await res.arrayBuffer();
            } finally {
              window.clearTimeout(timeoutId);
            }
            const mammoth: any = await import("mammoth/mammoth.browser");
            // Race conversion against a 30s ceiling so slow devices/large docs
            // surface a clear error instead of hanging indefinitely.
            const convertPromise = mammoth.convertToHtml({ arrayBuffer: buf });
            const timeoutPromise = new Promise((_, reject) =>
              window.setTimeout(() => reject(new Error("timeout")), 30000),
            );
            const result: any = await Promise.race([convertPromise, timeoutPromise]);
            if (cancelled) return;
            setDocxHtml(result.value || "<p>(Empty document)</p>");
            setLoading(false);
          } catch (docxErr: any) {
            console.error("[ManuscriptPreviewer] docx", docxErr);
            if (!cancelled) {
              const isTimeout =
                docxErr?.name === "AbortError" || docxErr?.message === "timeout";
              setError(
                isTimeout
                  ? {
                      title: "Word document is taking too long to convert.",
                      steps: [
                        "Tap Try again — the conversion may finish on a second attempt.",
                        "Switch to the Tablet preview size to give the renderer more room.",
                        "If it keeps timing out, open the original file to view it.",
                      ],
                    }
                  : {
                      title: "We couldn't preview this Word document.",
                      steps: [
                        "Re-export the document from Word as .docx and try again.",
                        "Remove unsupported features (tracked changes, embedded objects, macros).",
                        "If it still fails, open the original file to view it.",
                      ],
                    },
              );
              setLoading(false);
            }
          }
          return;
        }



        if (isEpub) {
          try {
            const res = await fetch(data.signedUrl);
            if (!res.ok) throw new Error(`Download failed (${res.status})`);
            const buf = await res.arrayBuffer();
            const ePubMod: any = await import("epubjs");
            const ePub = ePubMod.default ?? ePubMod;
            const book = ePub(buf);
            epubBookRef.current = book;
            await book.ready;
            if (cancelled) { try { book.destroy(); } catch { /* noop */ } return; }
            // Locations power page counting; 1024 chars/page is epubjs default sizing.
            await book.locations.generate(1024);
            const total = book.locations.length() || 1;
            epubTotalRef.current = total;
            setPageCount(capContentPages(total) + 1); // +1 for cover slot

            // Build TOC entries with hrefs. Prefer nav.toc; fall back to spine
            // items when the EPUB ships no navigation document.
            let entries: EpubTocEntry[] = [];
            try {
              const nav = await book.loaded.navigation;
              const walk = (items: any[], depth: number) => {
                for (const item of items) {
                  if (item?.href) {
                    entries.push({
                      title: item.label?.trim() || "Section",
                      href: item.href,
                      depth,
                    });
                  }
                  if (item?.subitems?.length) walk(item.subitems, depth + 1);
                }
              };
              if (nav?.toc?.length) walk(nav.toc, 0);
            } catch { /* nav missing */ }

            if (!entries.length) {
              try {
                await book.loaded.spine;
                const spineItems: any[] =
                  book.spine?.spineItems ?? book.spine?.items ?? [];
                const prettify = (href: string) => {
                  const base = (href.split("/").pop() || href)
                    .replace(/\.[^.]+$/, "")
                    .replace(/[-_]+/g, " ")
                    .trim();
                  if (!base) return "Section";
                  return base.charAt(0).toUpperCase() + base.slice(1);
                };
                entries = spineItems
                  .filter((s) => s && (s.href || s.url))
                  .map((s, i) => ({
                    title: `${i + 1}. ${prettify(s.href || s.url)}`,
                    href: s.href || s.url,
                    depth: 0,
                  }));
              } catch { /* spine unavailable */ }
            }

            if (!cancelled) {
              setEpubToc(entries);
              epubTocRef.current = entries;
            }



            setEpubReady(true);
            setLoading(false);
          } catch (epubErr: any) {
            console.error("[ManuscriptPreviewer] epub", epubErr);
            if (!cancelled) {
              setError({
                title: "We couldn't preview this EPUB.",
                steps: [
                  "Tap Try again — a network hiccup can prevent the file from loading.",
                  "Re-export the EPUB from your source tool (EPUB 3 is best supported).",
                  "Check for DRM — protected EPUBs can't be rendered in the browser.",
                  "If it still fails, open the original file to view it.",
                ],
              });
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
        setPageCount(capContentPages(doc.numPages) + 1); // +1 for cover as location 1

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
          const isPdfRenderer = isPdf;
          setError(
            isPdfRenderer
              ? {
                  title: "We couldn't render this PDF.",
                  steps: [
                    "Tap Try again — the PDF worker may not have loaded on the first try.",
                    "Check your internet connection and reload.",
                    "Re-save the PDF from the source app (avoid password protection).",
                    "If it still fails, open the original file to view it.",
                  ],
                }
              : {
                  title: "Unable to load manuscript.",
                  steps: [
                    "Tap Try again — a temporary network issue can cause this.",
                    "Check your internet connection.",
                    "If the problem persists, re-upload the file.",
                  ],
                },
          );
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(slowTimer);
      if (epubRenditionRef.current) {
        try { epubRenditionRef.current.destroy(); } catch { /* noop */ }
        epubRenditionRef.current = null;
      }
      if (epubBookRef.current) {
        try { epubBookRef.current.destroy(); } catch { /* noop */ }
        epubBookRef.current = null;
      }
    };
  }, [manuscriptPath, isPdf, isDocx, isEpub, attempt]);

  const dev = DEVICES[device];
  const pageAreaW = dev.w - dev.pad * 2;
  const pageAreaH = dev.h - dev.pad * 2;

  // DOCX vertical padding: 24px top + 24px bottom. Images must never exceed the
  // content box height minus this padding so they stay fully inside the page.
  const DOCX_PAD_V = 48;

  // Measure DOCX HTML pages from the hidden measurement node. Walks block-level
  // children and groups them into pages so a page break never lands in the
  // middle of a paragraph or image. A block taller than the page area gets its
  // own page (and is allowed to scroll within the frame).
  // Per-page visible clip heights. Length matches docxPageOffsets. For pages
  // whose next block starts before pageAreaH is exhausted (because that block
  // would otherwise overflow), we shorten the clip so the overflowing block
  // does not visually hang below the page. Falls back to pageAreaH.
  const [docxPageHeights, setDocxPageHeights] = useState<number[]>([0]);

  const measureDocxPages = useCallback(() => {
    const el = docxInnerRef.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    const containerTop = el.getBoundingClientRect().top;
    const offsets: number[] = [0];
    let pageStart = 0;
    let lastBottom = 0;
    for (const kid of kids) {
      const rect = kid.getBoundingClientRect();
      const top = rect.top - containerTop;
      const bottom = top + rect.height;
      // If adding this block would overflow the current page, start a new
      // page at this block's top — unless the page is empty (block is
      // taller than the frame; keep it on its own page).
      if (bottom - pageStart > pageAreaH && top > pageStart) {
        pageStart = top;
        offsets.push(pageStart);
      }
      lastBottom = Math.max(lastBottom, bottom);
    }
    if (offsets.length === 0) offsets.push(0);
    // Clip height per page = distance to next page start (so an overflowing
    // block that triggered the break doesn't visually spill into the previous
    // page). Cap at pageAreaH. The last page keeps pageAreaH.
    const heights: number[] = offsets.map((off, i) => {
      const next = i + 1 < offsets.length ? offsets[i + 1] : lastBottom;
      return Math.min(pageAreaH, Math.max(0, next - off));
    });
    setDocxPageOffsets(offsets);
    setDocxPageHeights(heights);
    setDocxPageCount(offsets.length);
    setPageCount(capContentPages(offsets.length) + 1);
  }, [pageAreaH]);


  // Layout guard: constrain every DOCX image so it fits inside the page content
  // height minus vertical padding. Runs against the measurement node (which
  // drives pagination) and the visible rendered node. A ResizeObserver catches
  // images that load asynchronously and re-applies the guard + re-measures pages.
  useLayoutEffect(() => {
    if (!isDocx || !docxHtml) return;
    const maxH = Math.max(0, pageAreaH - DOCX_PAD_V);
    let ro: ResizeObserver | undefined;
    let raf: number;

    const guardImages = () => {
      const roots = [
        docxInnerRef.current,
        document.querySelector('[data-testid="previewer-scroll"] .av-docx'),
      ].filter((el): el is HTMLElement => el instanceof HTMLElement);
      const images = roots.flatMap((root) => Array.from(root.querySelectorAll('img')));
      let changed = false;
      for (const img of images) {
        const rect = img.getBoundingClientRect();
        if (rect.height > maxH + 0.5) {
          img.style.maxHeight = `${maxH}px`;
          img.style.height = 'auto';
          img.style.objectFit = 'contain';
          changed = true;
        }
      }
      return changed;
    };

    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const changed = guardImages();
        measureDocxPages();
        // If an image was constrained, it may have changed the page layout, so
        // re-measure once more after the browser paints the constrained size.
        if (changed) {
          raf = requestAnimationFrame(() => measureDocxPages());
        }
      });
    };

    run();

    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver((entries) => {
        let needsGuard = false;
        for (const entry of entries) {
          if (entry.contentRect.height > maxH + 0.5) {
            needsGuard = true;
            break;
          }
        }
        if (needsGuard) run();
      });
      // Observe images in both roots so async loads are caught wherever they
      // appear.
      const refreshObserver = () => {
        ro?.disconnect();
        const roots = [
          docxInnerRef.current,
          document.querySelector('[data-testid="previewer-scroll"] .av-docx'),
        ].filter((el): el is HTMLElement => el instanceof HTMLElement);
        for (const root of roots) {
          for (const img of root.querySelectorAll('img')) {
            ro?.observe(img);
          }
        }
      };
      refreshObserver();
      return () => {
        cancelAnimationFrame(raf);
        ro?.disconnect();
      };
    }

    return () => cancelAnimationFrame(raf);
  }, [isDocx, docxHtml, fontSize, device, pageAreaH, pageAreaW, measureDocxPages, location]);



  // Mount / remount the EPUB rendition when it's ready or the frame size changes.
  useEffect(() => {
    if (!isEpub || !epubReady) return;
    const book = epubBookRef.current;
    const container = epubContainerEl;
    if (!book || !container) return;

    // Tear down any previous rendition.
    if (epubRenditionRef.current) {
      try { epubRenditionRef.current.destroy(); } catch { /* noop */ }
      epubRenditionRef.current = null;
    }
    container.innerHTML = "";

    const rendition = book.renderTo(container, {
      width: pageAreaW,
      height: pageAreaH,
      flow: "paginated",
      spread: "none",
    });
    epubRenditionRef.current = rendition;
    // Apply font-size only after the rendition has attached its first
    // section — calling themes.fontSize() before any contents exist throws
    // "Cannot read properties of undefined (reading 'replaceCss')" inside
    // epubjs and prevents pages from rendering.
    const applyFontSize = () => {
      try {
        rendition.themes.fontSize(
          `${100 * (FONT_SCALES[fontSize] ?? 1)}%`,
        );
      } catch {
        /* noop */
      }
    };
    rendition.on("rendered", applyFontSize);

    // Sync location + current chapter from rendition back to state.
    // Guarded so programmatic display() calls don't feed back into location.
    rendition.on("relocated", (loc: any) => {
      // Match current section to a TOC entry (independent of location guard).
      try {
        const currentHref: string | undefined = loc?.start?.href;
        if (currentHref) {
          const stripFrag = (h: string) => h.split("#")[0];
          const cur = stripFrag(currentHref);
          const toc = epubTocRef.current;
          let bestIdx = -1;
          for (let i = 0; i < toc.length; i++) {
            const tocHref = stripFrag(toc[i].href);
            if (cur.endsWith(tocHref) || tocHref.endsWith(cur)) bestIdx = i;
          }
          setEpubCurrentToc(bestIdx >= 0 ? bestIdx : null);
        }
      } catch { /* noop */ }

      if (epubSyncingRef.current) return;
      const total = epubTotalRef.current || 1;
      try {
        const pct = book.locations.percentageFromCfi(loc?.start?.cfi);
        if (typeof pct === "number" && !Number.isNaN(pct)) {
          const idx = Math.max(1, Math.min(total, Math.round(pct * total) + 1));
          setLocation(idx + 1); // +1 for cover offset
        }
      } catch { /* noop */ }
    });

    // Display initial page (or the current one if user has already navigated).
    const total = epubTotalRef.current || 1;
    const pageIdx = Math.max(1, Math.min(total, location - 1));
    try {
      const cfi = book.locations.cfiFromLocation(pageIdx - 1);
      rendition.display(cfi || undefined);
    } catch {
      rendition.display();
    }

    return () => {
      try { rendition.destroy(); } catch { /* noop */ }
      if (epubRenditionRef.current === rendition) epubRenditionRef.current = null;
    };
    // Intentionally exclude `location` — location sync is handled by a separate effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEpub, epubReady, device, pageAreaW, pageAreaH, epubContainerEl]);

  // Push location changes into the EPUB rendition.
  useEffect(() => {
    if (!isEpub || !epubReady) return;
    const rendition = epubRenditionRef.current;
    const book = epubBookRef.current;
    if (!rendition || !book) return;
    if (location < 2) return; // cover slot
    const total = epubTotalRef.current || 1;
    const pageIdx = Math.max(1, Math.min(total, location - 1));
    try {
      const cfi = book.locations.cfiFromLocation(pageIdx - 1);
      if (!cfi) return;
      epubSyncingRef.current = true;
      rendition.display(cfi).finally(() => {
        // Release the guard on next tick so relocated event doesn't feed back.
        setTimeout(() => { epubSyncingRef.current = false; }, 50);
      });
    } catch { /* noop */ }
  }, [isEpub, epubReady, location]);

  // Apply font-size zoom to the EPUB rendition.
  useEffect(() => {
    if (!isEpub || !epubReady) return;
    const rendition = epubRenditionRef.current;
    if (!rendition) return;
    try { rendition.themes.fontSize(`${100 * (FONT_SCALES[fontSize] ?? 1)}%`); } catch { /* noop */ }
  }, [isEpub, epubReady, fontSize]);



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
      // Aspect-aware fit: for portrait pages (text) letterbox to fit both
      // dims; for landscape/image-heavy pages fill width so no side bars —
      // vertical overflow scrolls inside the device frame.
      const aspect = base.width / base.height;
      const fitScale = aspect >= 1
        ? areaW / base.width
        : Math.min(areaW / base.width, areaH / base.height);

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
      // Kindle mode: fill the canvas with sepia BEFORE rendering so
      // transparent PDF backgrounds pick up the paper tint instead of
      // punching through as white.
      if (deviceKey === "kindle") {
        ctx.fillStyle = "#f4ecd8";
        ctx.fillRect(0, 0, viewport.width, viewport.height);
      }
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

  // Reset scroll to top on every page change so users start reading from
  // the beginning of the new page, not wherever they left off on the last.
  useEffect(() => {
    const el = scrollFrameRef.current;
    if (el) el.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location]);


  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
      if (typing) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); goTo(location + (isRTL ? 1 : -1)); }
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(location + (isRTL ? -1 : 1)); }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [goTo, location, onClose, isRTL]);

  const pinchStartRef = useRef<{ dist: number; startFont: number } | null>(null);
  const lastTapRef = useRef<number>(0);

  const nearestFontStep = useCallback((zoom: number) => {
    let best = 3;
    let diff = Infinity;
    for (const k of [1, 2, 3, 4, 5]) {
      const d = Math.abs(zoom - FONT_SCALES[k]);
      if (d < diff) { diff = d; best = k; }
    }
    return best;
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartRef.current = { dist: Math.hypot(dx, dy) || 1, startFont: fontSize };
      touchStartX.current = null;
      return;
    }
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setFontSize((f) => (f >= 5 ? 3 : 5));
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const ratio = newDist / pinchStartRef.current.dist;
      const startScale = FONT_SCALES[pinchStartRef.current.startFont] ?? 1;
      const target = Math.min(Math.max(startScale * ratio, 0.6), 2.5);
      const step = nearestFontStep(target);
      if (step !== fontSize) setFontSize(step);
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (pinchStartRef.current) {
      pinchStartRef.current = null;
      return;
    }
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      const forward = isRTL ? dx > 0 : dx < 0;
      goTo(location + (forward ? 1 : -1));
    }
    touchStartX.current = null;
  };

  // Scale the whole device frame down on narrow / short viewports so it always
  // fits AND stays centered on both axes. We measure the actual stage element
  // (not window) so header/footer chrome is accounted for on mobile.
  const stageRef = useRef<HTMLDivElement>(null);
  const [frameScale, setFrameScale] = useState(1);
  useEffect(() => {
    const compute = () => {
      const stage = stageRef.current;
      // Fallback to viewport if the stage hasn't mounted yet.
      const availW = (stage?.clientWidth ?? window.innerWidth) - 32;
      const availH = (stage?.clientHeight ?? window.innerHeight) - 32;
      const sW = availW > 0 ? availW / dev.w : 1;
      const sH = availH > 0 ? availH / dev.h : 1;
      const s = Math.min(1, sW, sH);
      setFrameScale(Math.max(0.4, s));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [dev.w, dev.h]);


  // Current chapter for header (PDF outline or EPUB toc).
  const currentChapter = useMemo(() => {
    if (isEpub && epubCurrentToc != null) return epubToc[epubCurrentToc]?.title ?? null;
    if (outline.length && location > 1) {
      let last: string | null = null;
      for (const o of outline) {
        if (o.pageIndex <= location) last = o.title;
        else break;
      }
      return last;
    }
    return null;
  }, [isEpub, epubCurrentToc, epubToc, outline, location]);

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
      aria-label={`${readerMode ? "Read" : "Preview"} ${title}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-2 min-h-14 border-b border-white/10 bg-[#0b0b0b]">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-semibold truncate leading-tight">{title || "Untitled"}</span>
          {currentChapter && (
            <span className="text-xs text-white/60 truncate leading-tight">{currentChapter}</span>
          )}
          <span className="text-[10px] text-white/40 leading-tight">
            Page {location} of {pageCount}
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close preview"
          data-testid="previewer-close"
          className="h-10 w-10 rounded-full inline-flex items-center justify-center hover:bg-white/10 shrink-0"
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
            data-testid="previewer-location-input"
          />
          <span className="text-white/60">of {pageCount}</span>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-white/70">Font size</span>
          <select
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
            aria-label="Font size"
            data-testid="previewer-font-size"
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
            value={
              isEpub && location === 1
                ? "cover"
                : isEpub && epubCurrentToc != null
                  ? `epub:${epubCurrentToc}`
                  : ""
            }
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              if (v.startsWith("epub:")) {
                const idx = parseInt(v.slice(5), 10);
                const entry = epubToc[idx];
                const rendition = epubRenditionRef.current;
                if (entry && rendition) {
                  try { rendition.display(entry.href); } catch { /* noop */ }
                }
                return;
              }
              if (v === "cover") { goTo(1); return; }
              const p = parseInt(v, 10);
              if (Number.isFinite(p)) goTo(p);
            }}
            className="h-9 rounded-md bg-black/40 border border-white/15 px-2 text-white max-w-[240px]"
            aria-label="Contents"
            data-testid="previewer-contents"
          >
            <option value="">
              {isEpub
                ? (epubToc.length ? "Jump to chapter…" : "No contents available")
                : (outline.length ? "Jump to chapter…" : "No contents available")}
            </option>
            {isEpub ? (
              <>
                {epubToc.length > 0 && <option value="cover">Cover</option>}
                {epubToc.map((o, i) => (
                  <option key={i} value={`epub:${i}`}>
                    {"\u00A0".repeat(o.depth * 2)}{o.title}
                  </option>
                ))}
              </>
            ) : (
              <>
                {outline.length > 0 && <option value="cover">Cover</option>}
                {outline.map((o, i) => (
                  <option key={i} value={o.pageIndex}>{o.title}</option>
                ))}
              </>
            )}
          </select>
        </label>


        <label className="flex items-center gap-2 ml-auto">
          <span className="text-white/70">Device</span>
          <select
            value={device}
            onChange={(e) => setDevice(e.target.value as DeviceKind)}
            aria-label="Device"
            data-testid="previewer-device"
            className="h-9 rounded-md bg-black/40 border border-white/15 px-2 text-white"
          >
            {Object.entries(DEVICES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Stage */}
      <div ref={stageRef} className="relative flex-1 overflow-hidden flex items-center justify-center p-6">
        {/* Previous-page arrow — visually on the leading edge (right in RTL, left otherwise) */}
        <button
          onClick={() => goTo(location - 1)}
          aria-label="Previous page"
          data-testid="previewer-prev"
          disabled={location <= 1}
          className={`absolute ${isRTL ? "right-2 md:right-6" : "left-2 md:left-6"} top-1/2 -translate-y-1/2 z-20 h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-25 disabled:cursor-not-allowed inline-flex items-center justify-center transition`}
        >
          {isRTL ? <ChevronRight size={30} /> : <ChevronLeft size={30} />}
        </button>


        {/* Device frame (scaled down on narrow viewports).
            Reserve the scaled bounding box so flex centering works on both
            axes — CSS transforms don't shrink layout size on their own. */}
        <div
          style={{
            width: dev.w * frameScale,
            height: dev.h * frameScale,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              transform: frameScale < 1 ? `scale(${frameScale})` : undefined,
              transformOrigin: "top left",
              width: dev.w,
              height: dev.h,
            }}
          >

          <div
            key={device}
            className={`transition-opacity duration-200 ${dev.frame} relative touch-pan-y select-none`}
            style={{ width: dev.w, height: dev.h, padding: dev.pad }}
            data-testid="previewer-touch" onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div
              ref={scrollFrameRef}
              data-testid="previewer-scroll"
              className={`relative ${dev.page} w-full h-full flex items-center justify-center device-frame-inner`}

              style={{
                background: location === 1 ? "transparent" : dev.bg,
                overflowY: "auto",
                overflowX: "hidden",
                WebkitOverflowScrolling: "touch",
                scrollBehavior: "smooth",
              }}
            >
              <div
                key={location}
                className={`w-full min-h-full flex items-center justify-center ${slideAnim}`}
              >


              {loading ? (
                <div className="flex flex-col items-center gap-3 text-black/60 px-6 text-center max-w-xs">
                  <Loader2 className="animate-spin" size={28} />
                  <span className="text-xs">
                    {loadingSlow
                      ? isDocx
                        ? "Converting Word document… this is taking longer than usual on this device."
                        : "Still loading… this is taking longer than usual."
                      : "Loading manuscript…"}
                  </span>
                  {loadingSlow && (
                    <button
                      type="button"
                      onClick={() => setAttempt((a) => a + 1)}
                      className="text-xs underline text-black/70 hover:text-black"
                    >
                      Cancel and retry
                    </button>
                  )}
                </div>
              ) : error ? (
                <div className="text-left px-6 max-w-sm w-full" role="alert">
                  <p className="text-red-600 text-sm font-semibold mb-2 text-center">
                    {error.title}
                  </p>
                  <p className="text-black/70 text-xs mb-2 text-center">
                    Try these steps:
                  </p>
                  <ol className="list-decimal pl-5 space-y-1 text-xs text-black/80 mb-4">
                    {error.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                  <div className="flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAttempt((a) => a + 1)}
                      className="inline-block rounded-md bg-black text-white text-sm px-4 py-2 hover:bg-black/80"
                    >
                      Try again
                    </button>
                    {signedUrl && (
                      <a
                        href={signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-xs underline text-black/60 hover:text-black"
                      >
                        Open original file in new tab
                      </a>
                    )}
                  </div>
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
                    style={{
                      width: pageAreaW,
                      height: docxPageHeights[Math.min(location - 2, docxPageHeights.length - 1)] ?? pageAreaH,
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <div
                      className="av-docx text-black"
                      style={{
                        width: pageAreaW,
                        padding: "24px 22px",
                        fontSize: `${16 * (FONT_SCALES[fontSize] ?? 1)}px`,
                        lineHeight: 1.5,
                        transform: `translateY(-${docxPageOffsets[Math.min(location - 2, docxPageOffsets.length - 1)] ?? 0}px)`,
                        transition: "transform 150ms ease",
                        boxSizing: "border-box",
                        wordWrap: "break-word",
                        ["--av-docx-img-max-h" as any]: `${Math.max(0, pageAreaH - DOCX_PAD_V)}px`,
                      }}
                      dangerouslySetInnerHTML={{ __html: docxHtml }}
                    />
                  </div>
                </div>


              ) : isEpub ? (

                <div
                  ref={epubContainerRef}
                  style={{ width: pageAreaW, height: pageAreaH, background: dev.bg }}
                  className="text-black"
                />
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
                <canvas ref={canvasRef} className="block max-w-full" />
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
          {fontSize !== 3 && (
            <button
              type="button"
              onClick={() => setFontSize(3)}
              className="mt-3 mx-auto block rounded-full border border-[#d4af37] text-[#d4af37] text-xs px-3 py-1 hover:bg-[#d4af37]/10 transition"
              aria-label="Reset zoom"
            >
              Reset ×
            </button>
          )}
        </div>
        </div>




        {/* Next-page arrow — visually on the trailing edge (left in RTL, right otherwise) */}
        <button
          onClick={() => goTo(location + 1)}
          aria-label="Next page"
          data-testid="previewer-next"
          disabled={location >= pageCount}
          className={`absolute ${isRTL ? "left-2 md:left-6" : "right-2 md:right-6"} top-1/2 -translate-y-1/2 z-20 h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-25 disabled:cursor-not-allowed inline-flex items-center justify-center transition`}
        >
          {isRTL ? <ChevronLeft size={30} /> : <ChevronRight size={30} />}
        </button>

      </div>

      {/* Hidden DOCX measurement node — mounted regardless of current location
          so page count is computed even while the cover is showing. */}
      {isDocx && docxHtml && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: -99999,
            top: 0,
            width: pageAreaW,
            visibility: "hidden",
            pointerEvents: "none",
          }}
        >
          <div
            ref={docxInnerRef}
            className="av-docx"
            style={{
              width: pageAreaW,
              padding: "24px 22px",
              fontSize: `${16 * (FONT_SCALES[fontSize] ?? 1)}px`,
              lineHeight: 1.5,
              boxSizing: "border-box",
              wordWrap: "break-word",
              ["--av-docx-img-max-h" as any]: `${Math.max(0, pageAreaH - DOCX_PAD_V)}px`,
            }}
            dangerouslySetInnerHTML={{ __html: docxHtml }}
          />
        </div>
      )}


      <style>{`
        @keyframes av-slide-left-kf { from { transform: translateX(24px); opacity: 0.35 } to { transform: translateX(0); opacity: 1 } }
        @keyframes av-slide-right-kf { from { transform: translateX(-24px); opacity: 0.35 } to { transform: translateX(0); opacity: 1 } }
        .av-slide-left { animation: av-slide-left-kf 150ms ease }
        .av-slide-right { animation: av-slide-right-kf 150ms ease }
        /* Layout guard: DOCX images must never exceed the page content height
           minus vertical padding (24px top + 24px bottom). This handles tall
           images and extreme aspect ratios even when Word-authored inline
           styles would otherwise override a simple max-height rule. */
        .av-docx img { display: block; max-width: 100%; height: auto; max-height: var(--av-docx-img-max-h, calc(100% - 48px)); object-fit: contain; margin: 12px auto; }
        .av-docx figure { margin: 12px 0; }
        .av-docx p, .av-docx h1, .av-docx h2, .av-docx h3, .av-docx h4, .av-docx ul, .av-docx ol, .av-docx blockquote { margin-left: 0; margin-right: 0; }
        .av-docx table { max-width: 100%; }
      `}</style>
    </div>
  );
}
