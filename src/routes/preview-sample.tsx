import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ManuscriptPreviewer } from "@/components/marketplace/ManuscriptPreviewer";

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

const SAMPLE_URL = "/samples/sample-manuscript.docx";
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

  const openFile = (file: File) => {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const blobUrl = URL.createObjectURL(file);
    blobUrlRef.current = blobUrl;
    // Preserve extension so ManuscriptPreviewer picks the right renderer.
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "docx";
    const pathWithExt = `${blobUrl}#.${ext}`;
    setManuscriptPath(pathWithExt);
    setManuscriptTitle(file.name.replace(/\.[^.]+$/, ""));
    setShowPicker(false);
  };

  const useBundledSample = () => {
    setManuscriptPath(
      typeof window !== "undefined"
        ? `${window.location.origin}${SAMPLE_URL}`
        : SAMPLE_URL,
    );
    setManuscriptTitle("Sample Manuscript");
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
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) openFile(f);
          }}
          onClick={() => inputRef.current?.click()}
          className="cursor-pointer rounded-xl border-2 border-dashed border-white/20 hover:border-white/40 hover:bg-white/[0.03] transition p-8 text-center"
        >
          <p className="text-sm text-white/80 mb-1">
            Drop a file here, or click to browse
          </p>
          <p className="text-xs text-white/50">DOCX, PDF, or EPUB</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) openFile(f);
              e.target.value = "";
            }}
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={useBundledSample}
            className="flex-1 h-11 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-medium transition"
          >
            Use bundled sample
          </button>
          <button
            onClick={() => navigate({ to: "/" })}
            className="h-11 px-4 rounded-lg text-sm text-white/70 hover:text-white transition"
          >
            Back home
          </button>
        </div>
      </div>
    </main>
  );
}
