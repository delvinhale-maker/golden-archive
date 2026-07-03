import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { z } from "zod";
import { ManuscriptPreviewer } from "@/components/marketplace/ManuscriptPreviewer";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
type Kind = "docx" | "pdf" | "epub";

const EXT_KIND: Record<string, Kind> = {
  docx: "docx",
  pdf: "pdf",
  epub: "epub",
};

// Accepted MIME hints (browsers vary; extension + magic bytes are the source of truth).
const MIME_KIND: Record<string, Kind> = {
  "application/pdf": "pdf",
  "application/epub+zip": "epub",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

/**
 * Sniff file type from magic bytes.
 * - PDF:  "%PDF-" (25 50 44 46 2D)
 * - DOCX/EPUB: ZIP container "PK\x03\x04" (50 4B 03 04). We distinguish by
 *   scanning the first few KB for the marker file each format requires:
 *     EPUB → "mimetype" entry containing "application/epub+zip"
 *     DOCX → "word/" directory entry
 */
async function sniffKind(file: File): Promise<Kind | null> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) {
    return "pdf";
  }
  if (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) {
    // ZIP container — look inside the first 64KB for format markers.
    const probeBytes = await file.slice(0, Math.min(file.size, 64 * 1024)).arrayBuffer();
    const text = new TextDecoder("latin1").decode(probeBytes);
    if (text.includes("application/epub+zip")) return "epub";
    if (text.includes("word/")) return "docx";
    return null;
  }
  return null;
}


const search = z.object({
  url: z.string().url().optional(),
  title: z.string().optional(),
});

export const Route = createFileRoute("/preview-sample")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Manuscript Preview Sample — AurumVault" },
      {
        name: "description",
        content:
          "Public read-only Manuscript previewer for verifying image and text alignment across Phone, Tablet, and Kindle sizes.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PreviewSamplePage,
});

const SAMPLES: { kind: Kind; label: string; path: string }[] = [
  { kind: "docx", label: "DOCX", path: "/samples/sample-manuscript.docx" },
  { kind: "pdf", label: "PDF", path: "/samples/sample-manuscript.pdf" },
  { kind: "epub", label: "EPUB", path: "/samples/sample-manuscript.epub" },
];
const ACCEPTED = ".docx,.pdf,.epub";

function PreviewSamplePage() {
  const { url, title } = Route.useSearch();
  const navigate = useNavigate();

  const [manuscriptPath, setManuscriptPath] = useState<string | null>(null);
  const [manuscriptTitle, setManuscriptTitle] = useState<string>(
    title ?? "Sample Manuscript",
  );
  const [showPicker, setShowPicker] = useState<boolean>(!url);
  const blobUrlRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // If a ?url= is provided, open the previewer straight away.
  useEffect(() => {
    if (url) {
      setManuscriptPath(url);
      setShowPicker(false);
    }
  }, [url]);

  // Revoke any blob URL we created when leaving the page.
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const [validating, setValidating] = useState(false);

  const openFile = async (file: File) => {
    // 1. Empty / oversized guard.
    if (file.size === 0) {
      toast.error("That file is empty", {
        description: "Choose a DOCX, PDF, or EPUB that has content.",
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      toast.error(`File is too large (${mb} MB)`, {
        description: `The preview supports files up to ${MAX_BYTES / (1024 * 1024)} MB. Try a smaller export.`,
      });
      return;
    }

    // 2. Extension + MIME check.
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const extKind = EXT_KIND[ext];
    const mimeKind = MIME_KIND[file.type];
    if (!extKind && !mimeKind) {
      toast.error("Unsupported file type", {
        description: `“${file.name || "file"}” isn’t a DOCX, PDF, or EPUB. Export or convert it and try again.`,
      });
      return;
    }

    // 3. Magic-byte sniff — protects against renamed / corrupted files that
    //    would otherwise fail deep inside the renderer with a cryptic error.
    setValidating(true);
    let sniffed: Kind | null = null;
    try {
      sniffed = await sniffKind(file);
    } catch (err) {
      console.error("[preview-sample] sniff failed", err);
    } finally {
      setValidating(false);
    }

    if (!sniffed) {
      toast.error("This file looks corrupted", {
        description:
          "We couldn’t recognise it as a valid DOCX, PDF, or EPUB. Try re-exporting the source document.",
      });
      return;
    }

    const declared = extKind ?? mimeKind;
    if (declared && declared !== sniffed) {
      toast.error("File contents don’t match the extension", {
        description: `The file is named .${ext || "?"} but appears to be a ${sniffed.toUpperCase()}. Rename it to .${sniffed} and try again.`,
      });
      return;
    }

    // All good — mount the previewer.
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const blobUrl = URL.createObjectURL(file);
    blobUrlRef.current = blobUrl;
    // Preserve extension so ManuscriptPreviewer picks the right renderer.
    const pathWithExt = `${blobUrl}#.${sniffed}`;
    setManuscriptPath(pathWithExt);
    setManuscriptTitle(file.name.replace(/\.[^.]+$/, "") || sniffed.toUpperCase());
    setShowPicker(false);
    toast.success(`Loaded ${sniffed.toUpperCase()} preview`);
  };


  const loadSample = (sample: (typeof SAMPLES)[number]) => {
    // Revoke any previous blob URL so switching from an upload → sample doesn't leak.
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    const base = typeof window !== "undefined" ? window.location.origin : "";
    setManuscriptPath(`${base}${sample.path}`);
    setManuscriptTitle(`Sample ${sample.label}`);
    setShowPicker(false);
  };

  const close = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setManuscriptPath(null);
    setShowPicker(true);
  };

  if (manuscriptPath && !showPicker) {
    return (
      <ManuscriptPreviewer
        manuscriptPath={manuscriptPath}
        title={manuscriptTitle}
        coverUrl={null}
        onClose={close}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-white flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141414] p-8 shadow-2xl">
        <h1 className="text-2xl font-semibold mb-2">Manuscript Preview</h1>
        <p className="text-sm text-white/60 mb-6">
          Verify text and image alignment across Phone, Tablet, and Kindle
          sizes. Upload your own DOCX, PDF, or EPUB — nothing is uploaded to
          a server, files stay in your browser.
        </p>

        <div
          onDragOver={(e) => {
            if (validating) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (validating) return;
            const f = e.dataTransfer.files?.[0];
            if (f) void openFile(f);
          }}
          onClick={() => !validating && inputRef.current?.click()}
          aria-busy={validating}
          className={`rounded-xl border-2 border-dashed p-8 text-center transition ${
            validating
              ? "border-white/10 bg-white/[0.02] cursor-wait"
              : "cursor-pointer border-white/20 hover:border-white/40 hover:bg-white/[0.03]"
          }`}
        >
          <p className="text-sm text-white/80 mb-1">
            {validating ? "Checking file…" : "Drop a file here, or click to browse"}
          </p>
          <p className="text-xs text-white/50">
            {validating ? "Verifying it's a valid document" : "DOCX, PDF, or EPUB · up to 50 MB"}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void openFile(f);
              e.target.value = "";
            }}
          />
        </div>


        <div className="mt-6">
          <p className="text-xs uppercase tracking-wide text-white/50 mb-2">
            Sample gallery
          </p>
          <div className="grid grid-cols-3 gap-2">
            {SAMPLES.map((s) => (
              <button
                key={s.kind}
                onClick={() => loadSample(s)}
                className="h-11 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-medium transition"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => navigate({ to: "/" })}
          className="mt-4 w-full h-11 rounded-lg text-sm text-white/70 hover:text-white transition"
        >
          Back home
        </button>
      </div>
      <Toaster theme="dark" position="top-center" richColors closeButton />
    </main>

  );
}

