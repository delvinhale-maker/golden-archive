import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Loader2, BookOpen, FileText, Music2, Video, ImageOff, Lock } from "lucide-react";

export type FormatPreview =
  | {
      kind: "pdf";
      title: string;
      coverUrl: string | null;
      pageCount: number;
      /** Object URL created on the client from the returned base64 bytes. */
      blobUrl: string;
    }
  | {
      kind: "epub";
      title: string;
      coverUrl: string | null;
      chapterTitle: string | null;
      chapterHtml: string;
    }
  | {
      kind: "text";
      title: string;
      coverUrl: string | null;
      format: "docx";
      text: string;
    }
  | {
      kind: "audio";
      title: string;
      coverUrl: string | null;
      url: string;
      mime: string;
      capSeconds: number;
    }
  | {
      kind: "video";
      title: string;
      coverUrl: string | null;
      url: string;
      mime: string;
      capSeconds: number;
    }
  | {
      kind: "cover";
      title: string;
      coverUrl: string | null;
      description: string | null;
      reason?: string;
    };

/**
 * Full-format preview modal — dispatches on `preview.kind`. Each format is
 * rendered in a way that surfaces enough to help the buyer decide without
 * shipping the full product file:
 *  - pdf   → embedded viewer over a watermarked, page-limited PDF blob
 *  - epub  → sanitized first-chapter HTML inside a scoped article
 *  - docx  → extracted plain text, capped at ~1500 words
 *  - audio → HTML5 audio, hard-capped to `capSeconds` of playback
 *  - video → HTML5 video, hard-capped to `capSeconds` of playback
 *  - cover → cover art + description fallback for formats we can't preview
 */
export function FormatPreviewModal({
  preview,
  onClose,
}: {
  preview: FormatPreview;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${preview.title}`}
    >
      <div className="relative flex h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-paper shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-ink/10 bg-white/70 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <KindIcon kind={preview.kind} />
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-caps text-mute">
                Preview · {kindLabel(preview.kind)}
              </div>
              <h2 className="truncate text-sm font-bold text-navy" title={preview.title}>
                {preview.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-full bg-ink/5 p-2 text-navy hover:bg-ink/10"
          >
            <X size={16} />
          </button>
        </header>

        <div className="relative flex-1 overflow-hidden">
          {preview.kind === "pdf" && <PdfBody url={preview.blobUrl} />}
          {preview.kind === "epub" && (
            <EpubBody chapterTitle={preview.chapterTitle} chapterHtml={preview.chapterHtml} />
          )}
          {preview.kind === "text" && <TextBody text={preview.text} />}
          {preview.kind === "audio" && (
            <MediaBody
              kind="audio"
              url={preview.url}
              mime={preview.mime}
              capSeconds={preview.capSeconds}
              coverUrl={preview.coverUrl}
              title={preview.title}
            />
          )}
          {preview.kind === "video" && (
            <MediaBody
              kind="video"
              url={preview.url}
              mime={preview.mime}
              capSeconds={preview.capSeconds}
              coverUrl={preview.coverUrl}
              title={preview.title}
            />
          )}
          {preview.kind === "cover" && (
            <CoverBody
              title={preview.title}
              coverUrl={preview.coverUrl}
              description={preview.description}
              reason={preview.reason}
            />
          )}
        </div>

        <footer className="border-t border-ink/10 bg-white/70 px-4 py-2 text-[11px] font-semibold text-mute">
          <span className="inline-flex items-center gap-1.5">
            <Lock size={12} className="text-gold" />
            Watermarked preview — the full file is delivered after purchase.
          </span>
        </footer>
      </div>
    </motion.div>
  );
}

function KindIcon({ kind }: { kind: FormatPreview["kind"] }) {
  const cls = "flex h-8 w-8 items-center justify-center rounded-full bg-gold/15 text-navy";
  if (kind === "pdf" || kind === "epub") return <span className={cls}><BookOpen size={16} /></span>;
  if (kind === "text") return <span className={cls}><FileText size={16} /></span>;
  if (kind === "audio") return <span className={cls}><Music2 size={16} /></span>;
  if (kind === "video") return <span className={cls}><Video size={16} /></span>;
  return <span className={cls}><ImageOff size={16} /></span>;
}

function kindLabel(kind: FormatPreview["kind"]) {
  if (kind === "pdf") return "PDF sample pages";
  if (kind === "epub") return "First chapter";
  if (kind === "text") return "Text excerpt";
  if (kind === "audio") return "60-second listen";
  if (kind === "video") return "60-second clip";
  return "Cover & details";
}

// -------- Bodies ---------------------------------------------------------

function PdfBody({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    const canvases: HTMLCanvasElement[] = [];
    (async () => {
      try {
        // Polyfill Stage-3 Map/Set upsert helpers used by pdfjs-dist v6.
        // Chromium/Safari don't ship these yet, so pdf.js render() throws
        // "getOrInsertComputed is not a function" without them.
        const mp: any = Map.prototype;
        if (typeof mp.getOrInsertComputed !== "function") {
          mp.getOrInsertComputed = function (key: unknown, fn: (k: unknown) => unknown) {
            if (!this.has(key)) this.set(key, fn(key));
            return this.get(key);
          };
        }
        if (typeof mp.getOrInsert !== "function") {
          mp.getOrInsert = function (key: unknown, value: unknown) {
            if (!this.has(key)) this.set(key, value);
            return this.get(key);
          };
        }
        const sp: any = Set.prototype;
        if (typeof sp.getOrInsertComputed !== "function") {
          sp.getOrInsertComputed = function (key: unknown, fn: (k: unknown) => unknown) {
            if (!this.has(key)) this.add(fn(key));
            return key;
          };
        }
        const pdfjs: any = await import("pdfjs-dist");
        try {
          const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
          pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        } catch {
          pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        }
        const doc = await pdfjs.getDocument({ url }).promise;
        if (cancelled) return;
        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";
        const containerWidth = Math.min(container.clientWidth - 24, 900);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          if (cancelled) return;
          const viewport1 = page.getViewport({ scale: 1 });
          const scale = containerWidth / viewport1.width;
          const viewport = page.getViewport({ scale: scale * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${viewport.width / dpr}px`;
          canvas.style.height = `${viewport.height / dpr}px`;
          canvas.className = "mx-auto my-3 rounded shadow-lg bg-white max-w-full h-auto";
          container.appendChild(canvas);
          canvases.push(canvas);
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
        if (!cancelled) setStatus("ready");
      } catch (err) {
        console.error("[PdfBody]", err);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      canvases.forEach((c) => c.remove());
    };
  }, [url]);

  return (
    <div className="relative h-full w-full overflow-y-auto bg-ink/95">
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center text-white/80">
          <Loader2 size={24} className="animate-spin" />
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/80">
          We couldn't render this PDF preview. Please try again.
        </div>
      )}
      <div ref={containerRef} className="mx-auto max-w-3xl px-3 py-4" />
    </div>
  );
}

function EpubBody({ chapterTitle, chapterHtml }: { chapterTitle: string | null; chapterHtml: string }) {
  // Render inside an iframe srcdoc so the chapter's CSS/tag styles can't
  // touch the parent app, and inject a fixed diagonal watermark overlay.
  const srcdoc = useMemo(() => buildEpubSrcdoc(chapterTitle, chapterHtml), [chapterTitle, chapterHtml]);
  return (
    <iframe
      title="EPUB chapter preview"
      srcDoc={srcdoc}
      sandbox="allow-same-origin"
      className="h-full w-full border-0 bg-white"
    />
  );
}

function buildEpubSrcdoc(chapterTitle: string | null, chapterHtml: string) {
  const heading = chapterTitle ? `<h1 class="av-chapter-title">${escapeHtml(chapterTitle)}</h1>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  :root { color-scheme: light; }
  html, body { margin: 0; padding: 0; background: #FBF7EE; color: #1B2340; font-family: Georgia, 'Times New Roman', serif; line-height: 1.7; }
  .av-page { max-width: 720px; margin: 0 auto; padding: 32px 24px 96px; position: relative; }
  .av-chapter-title { font-family: 'Georgia', serif; font-size: 24px; margin: 0 0 24px; color: #1B2340; }
  p, li { font-size: 17px; }
  a { color: #C9A84C; pointer-events: none; text-decoration: underline; }
  .epub-img-placeholder { display: inline-block; padding: 4px 10px; margin: 4px 0; background: rgba(27,35,64,0.08); border-radius: 6px; color: #1B2340; font-family: system-ui, sans-serif; font-size: 12px; }
  .av-wm-diag { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-28deg); font-family: system-ui, sans-serif; font-weight: 800; color: #C9A84C; opacity: 0.28; font-size: clamp(20px, 5vw, 44px); white-space: nowrap; pointer-events: none; letter-spacing: 0.06em; text-shadow: 0 0 4px rgba(0,0,0,0.05); }
  .av-wm-tile { position: fixed; inset: 0; pointer-events: none; background-image: repeating-linear-gradient(-28deg, transparent 0 60px, rgba(201,168,76,0.13) 60px 62px); mix-blend-mode: multiply; }
  .av-wm-badge { position: fixed; bottom: 12px; right: 12px; background: rgba(27,35,64,0.9); color: #FFF; font-family: system-ui, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; padding: 6px 10px; border-radius: 999px; }
  @media print { body { display: none; } }
</style></head>
<body>
  <div class="av-wm-tile" aria-hidden="true"></div>
  <div class="av-page">
    ${heading}
    ${chapterHtml}
  </div>
  <div class="av-wm-diag" aria-hidden="true">AURUMVAULT PREVIEW · NOT FOR DISTRIBUTION</div>
  <div class="av-wm-badge">AURUMVAULT PREVIEW</div>
</body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c),
  );
}

function TextBody({ text }: { text: string }) {
  return (
    <div className="relative h-full overflow-y-auto bg-paper">
      {/* Diagonal watermark overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 flex items-center justify-center"
      >
        <span
          className="select-none font-display text-4xl font-black tracking-widest text-gold/25 sm:text-6xl"
          style={{ transform: "rotate(-28deg)" }}
        >
          AURUMVAULT PREVIEW
        </span>
      </div>
      <article className="relative mx-auto max-w-2xl whitespace-pre-wrap px-6 py-8 font-serif text-base leading-relaxed text-navy">
        {text}
      </article>
    </div>
  );
}

function MediaBody({
  kind,
  url,
  mime,
  capSeconds,
  coverUrl,
  title,
}: {
  kind: "audio" | "video";
  url: string;
  mime: string;
  capSeconds: number;
  coverUrl: string | null;
  title: string;
}) {
  const ref = useRef<HTMLMediaElement | null>(null);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onTime = () => {
      if (el.currentTime >= capSeconds) {
        el.pause();
        // Snap to the cap so scrubbing forward can't sneak past.
        if (el.currentTime > capSeconds) el.currentTime = capSeconds;
        setEnded(true);
      }
    };
    const onSeek = () => {
      if (el.currentTime > capSeconds) {
        el.currentTime = capSeconds;
        el.pause();
        setEnded(true);
      }
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("seeking", onSeek);
    // Prevent context-menu save-as at least for the casual case.
    const onCtx = (e: MouseEvent) => e.preventDefault();
    el.addEventListener("contextmenu", onCtx);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("seeking", onSeek);
      el.removeEventListener("contextmenu", onCtx);
    };
  }, [capSeconds]);

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black">
      {kind === "video" ? (
        <video
          ref={ref as React.RefObject<HTMLVideoElement>}
          src={url}
          controls
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          className="h-full w-full max-w-full object-contain"
          preload="metadata"
        >
          <source src={url} type={mime} />
        </video>
      ) : (
        <div className="flex w-full max-w-md flex-col items-center gap-4 p-6 text-center">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={title}
              className="h-56 w-56 rounded-xl object-cover shadow-2xl ring-1 ring-white/10"
            />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center rounded-xl bg-white/10 text-white/60">
              <Music2 size={48} />
            </div>
          )}
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <audio
            ref={ref as React.RefObject<HTMLAudioElement>}
            src={url}
            controls
            controlsList="nodownload noplaybackrate"
            className="w-full"
            preload="metadata"
          >
            <source src={url} type={mime} />
          </audio>
        </div>
      )}

      {/* Watermark pill */}
      <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-navy/90 px-3 py-1 text-[10px] font-bold uppercase tracking-caps text-white">
        AURUMVAULT PREVIEW
      </div>
      <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white">
        {ended ? "Preview ended — purchase for the full file" : `First ${capSeconds}s only`}
      </div>
    </div>
  );
}

function CoverBody({
  title,
  coverUrl,
  description,
  reason,
}: {
  title: string;
  coverUrl: string | null;
  description: string | null;
  reason?: string;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto bg-paper p-8">
      {coverUrl ? (
        <img
          src={coverUrl}
          alt={title}
          className="max-h-[45vh] w-auto rounded-lg object-contain shadow-xl ring-1 ring-black/5"
        />
      ) : (
        <div className="flex h-48 w-40 items-center justify-center rounded-lg bg-ink/10 text-mute">
          <ImageOff size={32} />
        </div>
      )}
      <div className="max-w-xl text-center">
        <h3 className="font-display text-2xl font-bold text-navy">{title}</h3>
        {description ? (
          <p className="mt-3 text-sm leading-relaxed text-mute">{description.slice(0, 480)}</p>
        ) : (
          <p className="mt-3 text-sm text-mute">
            This format doesn't support inline previews yet. The full file is delivered after purchase.
          </p>
        )}
        {reason === "unsupportedFormat" && (
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-caps text-mute">
            Preview not available for this file type
          </p>
        )}
      </div>
    </div>
  );
}

/** Loading skeleton shown before the preview payload resolves. */
export function FormatPreviewLoading({
  title,
  coverUrl,
  onCancel,
}: {
  title: string;
  coverUrl: string | null;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Preparing preview"
    >
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel preview"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20"
      >
        <X size={18} />
      </button>
      <div className="w-full max-w-sm rounded-2xl bg-paper p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="relative h-24 w-[68px] flex-shrink-0 overflow-hidden rounded-md bg-ink/10">
            {coverUrl ? (
              <img src={coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full animate-pulse bg-ink/15" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-caps text-mute">
              Preparing preview
            </div>
            <h3 className="mt-0.5 truncate text-base font-bold text-navy" title={title}>
              {title}
            </h3>
            <p className="mt-1 text-xs text-mute inline-flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Watermarking your sample…
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="mt-5 flex h-11 w-full items-center justify-center rounded-full border border-ink/15 bg-white text-sm font-semibold text-navy hover:bg-ink/5"
        >
          Cancel preview
        </button>
      </div>
    </motion.div>
  );
}
