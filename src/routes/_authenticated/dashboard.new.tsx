import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AVLogo } from "@/components/marketplace/AVLogo";
import { ArrowLeft, ArrowRight, Check, Image as ImageIcon, FileText, Upload, X, CheckCircle2, AlertCircle, Maximize2, Music, Film, FileJson, FileType2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { reviewProduct } from "@/lib/ai-review.functions";

export const Route = createFileRoute("/_authenticated/dashboard/new")({
  validateSearch: (search: Record<string, unknown>) => {
    const t = typeof search.type === "string" ? search.type : undefined;
    const allowed = ["ebook", "manuscript", "prompt-pack", "template", "audio", "course", "bundle", "other"] as const;
    return { type: (allowed as readonly string[]).includes(t ?? "") ? (t as (typeof allowed)[number]) : undefined };
  },
  component: NewProduct,
});

// Map UI labels → DB enum values
const CATEGORIES: { label: string; value: "ebooks" | "finance" | "leadership" | "purpose" | "business" }[] = [
  { label: "eBooks", value: "ebooks" },
  { label: "Finance", value: "finance" },
  { label: "Leadership", value: "leadership" },
  { label: "Purpose", value: "purpose" },
  { label: "Business", value: "business" },
];

const LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Italian", "Other"];

type ProductType = "ebook" | "manuscript" | "prompt-pack" | "template" | "audio" | "course" | "bundle" | "other";

const PRODUCT_TYPES: {
  value: ProductType;
  label: string;
  description: string;
  accept: string;
  extensions: string[];
  mimeTypes: string[];
  enforceCoverRatio: boolean;
  maxMb: number;
};

const PRODUCT_TYPES: { value: ProductType; label: string; description: string; accept: string; extensions: string[]; mimeTypes: string[]; enforceCoverRatio: boolean; maxMb: number }[] = [
  { value: "ebook", label: "eBook", description: "PDF, EPUB, or DOCX", accept: ".pdf,.epub,.docx,application/pdf,application/epub+zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document", extensions: ["pdf", "epub", "docx"], mimeTypes: ["application/pdf", "application/epub+zip", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], enforceCoverRatio: true, maxMb: 100 },
  { value: "manuscript", label: "Manuscript", description: "PDF, EPUB, or DOCX", accept: ".pdf,.epub,.docx,application/pdf,application/epub+zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document", extensions: ["pdf", "epub", "docx"], mimeTypes: ["application/pdf", "application/epub+zip", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], enforceCoverRatio: true, maxMb: 100 },
  { value: "prompt-pack", label: "Prompt Pack", description: "PDF, TXT, or JSON", accept: ".pdf,.txt,.json,application/pdf,text/plain,application/json", extensions: ["pdf", "txt", "json"], mimeTypes: ["application/pdf", "text/plain", "application/json"], enforceCoverRatio: false, maxMb: 50 },
  { value: "template", label: "Template", description: "DOCX, XLSX, or PDF", accept: ".docx,.xlsx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extensions: ["docx", "xlsx", "pdf"], mimeTypes: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], enforceCoverRatio: false, maxMb: 50 },
  { value: "audio", label: "Audio", description: "MP3, WAV, or M4A", accept: ".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/x-m4a,audio/mp4", extensions: ["mp3", "wav", "m4a"], mimeTypes: ["audio/mpeg", "audio/wav", "audio/x-m4a", "audio/mp4"], enforceCoverRatio: false, maxMb: 500 },
  { value: "course", label: "Course / Video", description: "MP4 or MOV", accept: ".mp4,.mov,video/mp4,video/quicktime", extensions: ["mp4", "mov"], mimeTypes: ["video/mp4", "video/quicktime"], enforceCoverRatio: false, maxMb: 2000 },
  { value: "bundle", label: "Bundle", description: "ZIP (multi-file)", accept: ".zip,application/zip", extensions: ["zip"], mimeTypes: ["application/zip", "application/x-zip-compressed"], enforceCoverRatio: false, maxMb: 1000 },
  { value: "other", label: "Other", description: "ZIP archive", accept: ".zip,application/zip", extensions: ["zip"], mimeTypes: ["application/zip", "application/x-zip-compressed"], enforceCoverRatio: false, maxMb: 1000 },
];

const MAX_COVER_MB = 10;
const MIN_COVER_W = 1600;
const MIN_COVER_H = 2560;
const TARGET_RATIO = 1600 / 2560; // 0.625 (portrait, 1:1.6)
const RATIO_TOL = 0.03;

type Step = 0 | 1 | 2 | 3 | 4;

function NewProduct() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const runReview = useServerFn(reviewProduct);

  const { type: presetType } = Route.useSearch();
  const [step, setStep] = useState<Step>(presetType ? 1 : 0);
  const [productType, setProductType] = useState<ProductType>(presetType ?? "ebook");
  const typeMeta = PRODUCT_TYPES.find((t) => t.value === productType)!;
  const isEbookFlow = presetType === "ebook";
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [author, setAuthor] = useState("Illustrious Capital™");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("English");
  const [category, setCategory] = useState<typeof CATEGORIES[number]["value"]>("ebooks");
  const [price, setPrice] = useState("");

  // Step 2
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverDims, setCoverDims] = useState<{ w: number; h: number } | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [coverChecking, setCoverChecking] = useState(false);

  // Step 3
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [fileTextPreview, setFileTextPreview] = useState<string | null>(null);
  const [coverLightbox, setCoverLightbox] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  // Step 4
  const [submitting, setSubmitting] = useState(false);
  const [canSell, setCanSell] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("seller_applications").select("status").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setCanSell(data?.status === "approved"));
  }, [user]);

  useEffect(() => {
    if (!cover) { setCoverPreview(null); setCoverDims(null); setCoverChecking(false); return; }
    const url = URL.createObjectURL(cover);
    setCoverPreview(url);
    setCoverDims(null);
    setCoverChecking(true);
    const img = new Image();
    img.onload = () => {
      setCoverChecking(false);
      setCoverDims({ w: img.naturalWidth, h: img.naturalHeight });
      validateCover(img.naturalWidth, img.naturalHeight);
    };
    img.onerror = () => {
      setCoverChecking(false);
      setCoverDims(null);
      setCoverError("Could not read this image. Please try a different JPG or PNG file.");
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  // Generate inline preview for product file
  useEffect(() => {
    setFileTextPreview(null);
    if (!file) { setFilePreviewUrl(null); return; }
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    const blobTypes = ["pdf", "mp3", "wav", "m4a", "mp4", "mov", "jpg", "jpeg", "png"];
    if (blobTypes.includes(ext)) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setFilePreviewUrl(null);
    if (["txt", "json"].includes(ext) && file.size < 2 * 1024 * 1024) {
      file.slice(0, 2048).text().then((t) => setFileTextPreview(t)).catch(() => {});
    }
  }, [file]);

  function validateCover(w: number, h: number) {
    if (w < MIN_COVER_W || h < MIN_COVER_H) {
      setCoverError(`Image is ${w}×${h}px. Minimum ${MIN_COVER_W}×${MIN_COVER_H}px required.`);
      return false;
    }
    if (typeMeta.enforceCoverRatio) {
      const ratio = w / h;
      if (Math.abs(ratio - TARGET_RATIO) > RATIO_TOL) {
        setCoverError(`Aspect ratio must be 1:1.6 (portrait). Yours is ${ratio.toFixed(3)}.`);
        return false;
      }
    }
    setCoverError(null);
    return true;
  }

  function handleCoverChange(f: File | null) {
    setCoverError(null);
    if (!f) { setCover(null); return; }
    if (!["image/jpeg", "image/png"].includes(f.type)) {
      setCoverError("Cover must be a JPG or PNG file.");
      return;
    }
    if (f.size > MAX_COVER_MB * 1024 * 1024) {
      setCoverError(`Cover must be under ${MAX_COVER_MB} MB.`);
      return;
    }
    setCover(f);
  }

  function handleFileChange(f: File | null) {
    setFileError(null);
    if (!f) { setFile(null); return; }
    const ext = f.name.toLowerCase().split(".").pop() ?? "";
    if (!typeMeta.extensions.includes(ext)) {
      setFileError(`File must be one of: ${typeMeta.extensions.map((e) => "." + e).join(", ")}.`);
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`File must be under ${MAX_FILE_MB} MB.`);
      return;
    }
    setFile(f);
  }

  const step1Valid = title.trim().length > 0
    && author.trim().length > 0
    && description.trim().length >= 150
    && !!price && parseFloat(price) >= 1;
  const step2Valid = !!cover && !coverError && !!coverDims;
  const step3Valid = !!file && !fileError;

  function next() {
    if (step === 1 && !step1Valid) return toast.error("Fill all required fields (description ≥ 150 chars).");
    if (step === 2 && !step2Valid) return toast.error("Upload a valid cover image.");
    if (step === 3 && !step3Valid) return toast.error("Upload a valid product file.");
    setStep(((step + 1) as Step));
  }

  async function uploadAndSave(publish: boolean) {
    if (!user || !cover || !file) return;
    setSubmitting(true);
    setUploading(true);
    setUploadProgress(5);
    try {
      const ts = Date.now();
      const coverPath = `${user.id}/${ts}-${cover.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const filePath = `${user.id}/${ts}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

      const coverUp = await supabase.storage.from("product-covers").upload(coverPath, cover, { upsert: false });
      if (coverUp.error) throw coverUp.error;
      setUploadProgress(35);

      // Chunked-feel progress for the big file (Supabase JS doesn't expose progress events on upload)
      const progressTimer = setInterval(() => {
        setUploadProgress((p) => (p < 90 ? p + 3 : p));
      }, 400);
      const fileUp = await supabase.storage.from("product-files").upload(filePath, file, { upsert: false });
      clearInterval(progressTimer);
      if (fileUp.error) throw fileUp.error;
      setUploadProgress(95);

      const { data: signed } = await supabase.storage.from("product-covers")
        .createSignedUrl(coverPath, 60 * 60 * 24 * 365 * 5);

      const priceCents = Math.round(parseFloat(price) * 100);
      const status: "draft" | "pending" | "approved" = publish ? "approved" : "draft";

      const { data: inserted, error } = await supabase.from("marketplace_products").insert({
        seller_id: user.id,
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        description: description.trim(),
        creator_name: author.trim(),
        language,
        category,
        price_cents: priceCents,
        cover_url: signed?.signedUrl ?? null,
        file_path: filePath,
        file_size_bytes: file.size,
        status,
        published: publish,
      }).select("id").single();
      if (error) throw error;
      setUploadProgress(100);

      if (publish) toast.success("Published to the Vault.");
      else toast.success("Draft saved.");

      if (inserted?.id && publish) {
        runReview({ data: { productId: inserted.id } }).catch((err) => console.error("AI review failed", err));
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  }

  const catLabel = CATEGORIES.find((c) => c.value === category)?.label ?? "eBooks";

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy text-white">
        <div className="mx-auto max-w-3xl px-4 md:px-8 py-4 flex items-center gap-4">
          <Link to="/"><AVLogo /></Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 md:px-8 py-8">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-mute hover:text-navy">
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <h1 className="font-display text-3xl md:text-4xl text-navy mt-3">{isEbookFlow ? "Create eBook" : "Upload Product"}</h1>
        <p className="text-mute mt-1">{isEbookFlow ? "Publish a new eBook to the Vault. AurumVault keeps 9%; you keep 91%." : "Universal upload for any digital product. AurumVault keeps 9%; you keep 91%."}</p>

        {canSell === false && (
          <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
            You're not an approved seller yet. <Link to="/sell" className="underline font-medium">Apply to sell</Link> first.
          </div>
        )}

        <Stepper step={step} />

        <div className="mt-6 bg-white rounded-2xl p-6 border border-ink/10">
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl text-navy">What are you uploading?</h2>
              <p className="text-sm text-mute">Pick a product type — this controls which file formats the uploader will accept.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRODUCT_TYPES.map((t) => {
                  const active = productType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setProductType(t.value)}
                      className={`text-left rounded-xl border p-4 transition ${active ? "border-gold bg-gold/5 ring-2 ring-gold/30" : "border-ink/10 hover:border-navy/30 bg-white"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-lg text-navy">{t.label}</span>
                        {active && <Check size={16} className="text-gold" />}
                      </div>
                      <p className="text-xs text-mute mt-1">{t.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl text-navy">Book details</h2>
              <Field label="Title *">
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="inp" placeholder="e.g. The Stewardship Codex" />
              </Field>
              <Field label="Subtitle (optional)">
                <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="inp" placeholder="A field guide for purpose-driven leaders" />
              </Field>
              <Field label="Author / Publisher *">
                <input value={author} onChange={(e) => setAuthor(e.target.value)} className="inp" />
              </Field>
              <Field label={`Description * (${description.trim().length}/150 min)`}>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} className="inp" placeholder="What's in this book? Who is it for? Why does it matter?" />
                {description.length > 0 && description.trim().length < 150 && (
                  <p className="mt-1 text-xs text-amber-700">{150 - description.trim().length} more characters needed.</p>
                )}
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Field label="Language">
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} className="inp">
                    {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
                  </select>
                </Field>
                <Field label="Category">
                  <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="inp">
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </Field>
                <Field label="Price (USD) *">
                  <input type="number" min="1" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="inp" placeholder="9.99" />
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl text-navy">Cover upload</h2>
              <p className="text-sm text-mute">
                <strong>JPG or PNG</strong>, minimum <strong>1600×2560 px</strong>
                {typeMeta.enforceCoverRatio ? <>, aspect ratio <strong>1:1.6</strong> (portrait)</> : null}.
              </p>
              <CoverInput
                file={cover}
                preview={coverPreview}
                onFile={handleCoverChange}
                acceptedHint="JPG, PNG"
                onZoom={() => setCoverLightbox(true)}
              />
              {coverChecking && (
                <div className="text-xs text-mute">Checking image dimensions…</div>
              )}
              {coverDims && (
                <div className="text-xs text-mute">
                  Detected: {coverDims.w}×{coverDims.h}px · ratio {(coverDims.w / coverDims.h).toFixed(3)} · minimum {MIN_COVER_W}×{MIN_COVER_H}px
                </div>
              )}
              {coverError && (
                <div role="alert" aria-live="polite" className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span>{coverError}</span>
                </div>
              )}
              {cover && !coverError && !coverChecking && coverDims && (
                <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> <span>Cover meets the required specs.</span>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl text-navy">Product file upload</h2>
              <p className="text-sm text-mute">
                {typeMeta.label} accepts: <strong>{typeMeta.extensions.map((e) => "." + e.toUpperCase()).join(", ")}</strong>. Max size <strong>{MAX_FILE_MB} MB</strong>.
              </p>
              <FileInput file={file} onFile={handleFileChange} accept={typeMeta.accept} hint={`Drag & drop or tap to choose a ${typeMeta.label.toLowerCase()} file`} acceptedHint={typeMeta.extensions.map((e) => "." + e.toUpperCase()).join(", ")} />
              {fileError && (
                <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span>{fileError}</span>
                </div>
              )}
              {file && !fileError && (
                <FilePreview file={file} previewUrl={filePreviewUrl} textPreview={fileTextPreview} />
              )}
            </div>
          )}


          {step === 4 && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl text-navy">Preview & publish</h2>
              <div className="rounded-xl border border-ink/10 bg-paper p-4 flex flex-col sm:flex-row gap-5">
                {coverPreview ? (
                  <button type="button" onClick={() => setCoverLightbox(true)} className="shrink-0 group relative self-start">
                    <img src={coverPreview} alt="Cover preview" className="w-40 sm:w-48 h-auto aspect-[1/1.6] object-cover rounded-md border border-ink/10 shadow-md" />
                    <span className="absolute inset-0 rounded-md bg-navy/0 group-hover:bg-navy/30 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Maximize2 size={20} className="text-white" />
                    </span>
                  </button>
                ) : <div className="w-40 sm:w-48 aspect-[1/1.6] bg-ink/5 rounded-md shrink-0" />}
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-display text-xl text-navy leading-tight">{title || "Untitled"}</div>
                  {subtitle && <div className="text-mute italic mt-0.5">{subtitle}</div>}
                  <div className="text-ink mt-2">by <strong>{author}</strong></div>
                  <div className="text-mute text-xs mt-1">{catLabel} · {language} · {typeMeta.label}</div>
                  <div className="font-mono text-navy text-lg mt-2">${parseFloat(price || "0").toFixed(2)} USD</div>
                  {file && (
                    <div className="mt-3 rounded-lg border border-ink/10 bg-white p-2.5 text-xs text-ink/80 flex items-center gap-2">
                      <FileText size={14} className="text-navy shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-navy">{file.name}</div>
                        <div className="text-mute">{(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || file.name.split(".").pop()?.toUpperCase()}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {uploading && (
                <div>
                  <div className="flex justify-between text-xs text-mute mb-1">
                    <span>Uploading…</span><span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 bg-ink/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gold transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  disabled={submitting || canSell === false}
                  onClick={() => uploadAndSave(false)}
                  className="h-12 px-5 rounded-full bg-white border border-navy/20 text-navy font-semibold hover:bg-navy/5 disabled:opacity-60"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={submitting || canSell === false}
                  onClick={() => uploadAndSave(true)}
                  className="flex-1 h-12 rounded-full bg-navy text-white font-semibold hover:bg-navy/90 disabled:opacity-60"
                >
                  {submitting ? "Publishing…" : "Publish to Vault"}
                </button>
              </div>
            </div>
          )}

          {step < 4 && (
            <div className="flex justify-between mt-8 pt-5 border-t border-ink/10">
              <button
                type="button"
                onClick={() => setStep(((step - 1) as Step))}
                disabled={step === 0}
                className="h-11 px-5 rounded-full text-navy font-medium hover:bg-navy/5 disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button
                type="button"
                onClick={next}
                className="h-11 px-6 rounded-full bg-navy text-white font-semibold hover:bg-navy/90 inline-flex items-center gap-1.5"
              >
                Continue <ArrowRight size={16} />
              </button>
            </div>
          )}
          {step === 4 && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-sm text-mute hover:text-navy inline-flex items-center gap-1.5"
              >
                <ArrowLeft size={14} /> Back to product file
              </button>
            </div>
          )}
        </div>
      </main>
      {coverLightbox && coverPreview && (
        <CoverLightbox
          src={coverPreview}
          fileName={cover?.name}
          onClose={() => setCoverLightbox(false)}
        />
      )}
      <style>{`.inp{display:block;width:100%;min-height:44px;border-radius:12px;border:1px solid rgb(0 0 0 / 0.12);padding:10px 14px;font-size:14px;background:white;color:#0F1A33}.inp:focus{outline:none;border-color:#C9A24B;box-shadow:0 0 0 3px rgb(201 162 75 / 0.15)}`}</style>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps = ["Type", "Details", "Cover", "File", "Publish"];
  return (
    <ol className="mt-6 flex items-center gap-2">
      {steps.map((label, i) => {
        const n = i as Step;
        const active = n === step;
        const done = n < step;
        return (
          <li key={label} className="flex-1 flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
              ${done ? "bg-gold text-navy" : active ? "bg-navy text-white" : "bg-ink/10 text-mute"}`}>
              {done ? <Check size={14} /> : n + 1}
            </div>
            <span className={`text-xs sm:text-sm font-medium ${active ? "text-navy" : "text-mute"} truncate`}>{label}</span>
            {i < steps.length - 1 && <div className={`flex-1 h-px ${done ? "bg-gold" : "bg-ink/15"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-navy mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function useDropZone(onFile: (f: File | null) => void) {
  const [isOver, setIsOver] = useState(false);
  const counter = useRef(0);
  const handlers = {
    onDragEnter: (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      counter.current += 1;
      if (e.dataTransfer?.types?.includes("Files")) setIsOver(true);
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      counter.current -= 1;
      if (counter.current <= 0) { counter.current = 0; setIsOver(false); }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      counter.current = 0;
      setIsOver(false);
      const f = e.dataTransfer?.files?.[0] ?? null;
      if (f) onFile(f);
    },
  };
  return { isOver, handlers };
}

function CoverInput({ file, preview, onFile, acceptedHint, onZoom }: { file: File | null; preview: string | null; onFile: (f: File | null) => void; acceptedHint: string; onZoom?: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const { isOver, handlers } = useDropZone(onFile);
  return (
    <div className="space-y-2">
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      {preview ? (
        <div className="relative rounded-xl border border-ink/10 bg-paper overflow-hidden" {...handlers}>
          <div className="relative mx-auto bg-white group" style={{ aspectRatio: "1 / 1.6", maxWidth: "360px" }}>
            <img src={preview} alt="Cover preview" className="w-full h-full object-cover shadow-lg" />
            {onZoom && (
              <button
                type="button"
                onClick={onZoom}
                className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-navy/80 hover:bg-navy text-white text-xs font-medium px-2.5 py-1.5 backdrop-blur"
                aria-label="View full size"
              >
                <Maximize2 size={12} /> Full size
              </button>
            )}
          </div>
          {isOver && (
            <div className="absolute inset-0 bg-gold/20 border-2 border-dashed border-gold rounded-xl flex items-center justify-center pointer-events-none">
              <span className="text-sm font-semibold text-navy">Drop to replace</span>
            </div>
          )}
          <div className="flex items-center justify-between px-3 py-2 bg-white border-t border-ink/10">
            <span className="text-xs text-mute truncate">
              {file?.name} {file ? `· ${(file.size / 1024 / 1024).toFixed(2)} MB` : ""}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => ref.current?.click()} className="text-xs font-medium text-navy hover:underline">Replace</button>
              <button type="button" onClick={() => onFile(null)} className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"><X size={12} />Remove</button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          {...handlers}
          className={`w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${isOver ? "border-gold bg-gold/10" : "border-ink/20 bg-paper hover:border-gold"}`}
        >
          <ImageIcon size={28} className={isOver ? "text-gold" : "text-mute"} />
          <span className="text-sm font-medium text-ink/80">
            {isOver ? "Drop image here" : "Drag & drop a cover, or tap to browse"}
          </span>
          <span className="text-xs text-mute">Accepted: {acceptedHint}</span>
        </button>
      )}
    </div>
  );
}

function fileKind(name: string): { kind: "image" | "audio" | "video" | "pdf" | "text" | "json" | "archive" | "doc" | "sheet" | "other"; ext: string } {
  const ext = (name.toLowerCase().split(".").pop() ?? "");
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return { kind: "image", ext };
  if (["mp3", "wav", "m4a"].includes(ext)) return { kind: "audio", ext };
  if (["mp4", "mov", "webm"].includes(ext)) return { kind: "video", ext };
  if (ext === "pdf") return { kind: "pdf", ext };
  if (ext === "txt") return { kind: "text", ext };
  if (ext === "json") return { kind: "json", ext };
  if (["zip", "rar", "7z"].includes(ext)) return { kind: "archive", ext };
  if (["docx", "doc", "epub", "mobi"].includes(ext)) return { kind: "doc", ext };
  if (["xlsx", "csv"].includes(ext)) return { kind: "sheet", ext };
  return { kind: "other", ext };
}

function FilePreview({ file, previewUrl, textPreview }: { file: File; previewUrl: string | null; textPreview: string | null }) {
  const { kind, ext } = fileKind(file.name);
  const sizeMB = (file.size / 1024 / 1024).toFixed(2);
  const modified = new Date(file.lastModified).toLocaleString();
  const Icon = kind === "audio" ? Music : kind === "video" ? Film : kind === "json" ? FileJson : kind === "doc" || kind === "sheet" ? FileType2 : FileText;
  const headingId = `file-preview-${file.name.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const summary = `Selected file ${file.name}, type ${ext.toUpperCase()}, size ${sizeMB} megabytes, last modified ${modified}`;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-emerald-200 bg-emerald-50/40 overflow-hidden"
    >
      <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border-b border-emerald-200">
        <CheckCircle2 size={18} className="text-emerald-700 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="text-sm font-semibold text-navy truncate" title={file.name}>{file.name}</h3>
          <div className="text-xs text-mute">.{ext.toUpperCase()} · {sizeMB} MB · modified {modified}</div>
          <span className="sr-only">{summary}</span>
        </div>
        <Icon size={20} className="text-navy/70 shrink-0" aria-hidden="true" />
      </div>
      <div className="p-4 bg-white">
        {kind === "image" && previewUrl && (
          <img src={previewUrl} alt={`Preview of ${file.name}`} className="max-h-72 mx-auto rounded-md border border-ink/10" />
        )}
        {kind === "audio" && previewUrl && (
          <audio controls src={previewUrl} aria-label={`Audio preview of ${file.name}`} className="w-full" />
        )}
        {kind === "video" && previewUrl && (
          <video controls src={previewUrl} aria-label={`Video preview of ${file.name}`} className="w-full max-h-72 rounded-md bg-black" />
        )}
        {kind === "pdf" && previewUrl && (
          <iframe src={previewUrl} title={`PDF preview of ${file.name}`} className="w-full h-80 rounded-md border border-ink/10 bg-white" />
        )}
        {(kind === "text" || kind === "json") && textPreview != null && (
          <pre
            aria-label={`Text preview of ${file.name}, first 2 kilobytes`}
            tabIndex={0}
            className="text-xs text-ink/80 bg-paper rounded-md p-3 max-h-60 overflow-auto whitespace-pre-wrap break-words border border-ink/10 focus:outline-none focus:ring-2 focus:ring-gold"
          >{textPreview}{textPreview.length >= 2048 ? "\n…" : ""}</pre>
        )}
        {(kind === "archive" || kind === "doc" || kind === "sheet" || kind === "other") && (
          <p className="text-xs text-mute italic">
            No inline preview for .{ext.toUpperCase()} files — confirm the name and size above match your intended upload.
          </p>
        )}
      </div>
    </section>
  );
}

function CoverLightbox({ src, fileName, onClose }: { src: string; fileName?: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const titleId = "cover-lightbox-title";

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab") {
        // Trap focus among focusable descendants
        const root = dialogRef.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
    >
      <h2 id={titleId} className="sr-only">
        {fileName ? `Full size preview of ${fileName}` : "Cover full size preview"}
      </h2>
      <button
        ref={closeBtnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 min-w-11 min-h-11 rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold flex items-center justify-center"
        aria-label="Close full size preview (Esc)"
      >
        <X size={20} aria-hidden="true" />
      </button>
      <img
        src={src}
        alt={fileName ? `Full size cover: ${fileName}` : "Cover full size"}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[95vw] object-contain rounded-md shadow-2xl"
      />
    </div>
  );
}

function FileInput({ file, onFile, accept, hint, acceptedHint }: { file: File | null; onFile: (f: File | null) => void; accept: string; hint: string; acceptedHint: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const { isOver, handlers } = useDropZone(onFile);
  return (
    <div className="space-y-2">
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        {...handlers}
        className={`w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${isOver ? "border-gold bg-gold/10" : "border-ink/20 bg-paper hover:border-gold"}`}
      >
        {file ? <FileText size={28} className="text-navy" /> : <Upload size={28} className={isOver ? "text-gold" : "text-mute"} />}
        <span className="text-sm font-medium text-ink/80 truncate max-w-full">
          {isOver ? "Drop file here" : file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : hint}
        </span>
        <span className="text-xs text-mute">Accepted: {acceptedHint}</span>
      </button>
      {file && (
        <div className="flex gap-3 text-xs">
          <button type="button" onClick={() => ref.current?.click()} className="font-medium text-navy hover:underline">Replace</button>
          <button type="button" onClick={() => onFile(null)} className="text-red-600 hover:underline inline-flex items-center gap-1"><X size={12} />Remove</button>
        </div>
      )}
    </div>
  );
}
