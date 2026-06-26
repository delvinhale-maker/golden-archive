import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AVLogo } from "@/components/marketplace/AVLogo";
import { ArrowLeft, ArrowRight, Check, Image as ImageIcon, FileText, Upload, X, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { reviewProduct } from "@/lib/ai-review.functions";

export const Route = createFileRoute("/_authenticated/dashboard/new")({
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
  enforceCoverRatio: boolean;
}[] = [
  { value: "ebook", label: "eBook", description: "PDF, EPUB, or MOBI", accept: ".pdf,.epub,.mobi,application/pdf,application/epub+zip", extensions: ["pdf", "epub", "mobi"], enforceCoverRatio: true },
  { value: "manuscript", label: "Manuscript", description: "DOCX or PDF", accept: ".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document", extensions: ["docx", "pdf"], enforceCoverRatio: true },
  { value: "prompt-pack", label: "Prompt Pack", description: "PDF, TXT, or JSON", accept: ".pdf,.txt,.json,application/pdf,text/plain,application/json", extensions: ["pdf", "txt", "json"], enforceCoverRatio: false },
  { value: "template", label: "Template", description: "DOCX, XLSX, or PDF", accept: ".docx,.xlsx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extensions: ["docx", "xlsx", "pdf"], enforceCoverRatio: false },
  { value: "audio", label: "Audio", description: "MP3, WAV, or M4A", accept: ".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/x-m4a,audio/mp4", extensions: ["mp3", "wav", "m4a"], enforceCoverRatio: false },
  { value: "course", label: "Course / Video", description: "MP4 or MOV", accept: ".mp4,.mov,video/mp4,video/quicktime", extensions: ["mp4", "mov"], enforceCoverRatio: false },
  { value: "bundle", label: "Bundle", description: "ZIP (multi-file)", accept: ".zip,application/zip", extensions: ["zip"], enforceCoverRatio: false },
  { value: "other", label: "Other", description: "ZIP archive", accept: ".zip,application/zip", extensions: ["zip"], enforceCoverRatio: false },
];

const MAX_COVER_MB = 10;
const MAX_FILE_MB = 650;
const MIN_COVER_W = 1600;
const MIN_COVER_H = 2560;
const TARGET_RATIO = 1600 / 2560; // 0.625 (portrait, 1:1.6)
const RATIO_TOL = 0.03;

type Step = 0 | 1 | 2 | 3 | 4;

function NewProduct() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const runReview = useServerFn(reviewProduct);

  const [step, setStep] = useState<Step>(0);
  const [productType, setProductType] = useState<ProductType>("ebook");
  const typeMeta = PRODUCT_TYPES.find((t) => t.value === productType)!;
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

  // Step 3
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
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
    if (!cover) { setCoverPreview(null); setCoverDims(null); return; }
    const url = URL.createObjectURL(cover);
    setCoverPreview(url);
    const img = new Image();
    img.onload = () => {
      setCoverDims({ w: img.naturalWidth, h: img.naturalHeight });
      validateCover(img.naturalWidth, img.naturalHeight);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [cover]);

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
        <h1 className="font-display text-3xl md:text-4xl text-navy mt-3">New eBook</h1>
        <p className="text-mute mt-1">KDP-style upload flow. AurumVault keeps 9%; you keep 91%.</p>

        {canSell === false && (
          <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
            You're not an approved seller yet. <Link to="/sell" className="underline font-medium">Apply to sell</Link> first.
          </div>
        )}

        <Stepper step={step} />

        <div className="mt-6 bg-white rounded-2xl p-6 border border-ink/10">
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
                KDP standard: <strong>JPG or PNG</strong>, minimum <strong>1600×2560 px</strong>, aspect ratio <strong>1:1.6</strong> (portrait).
              </p>
              <CoverInput file={cover} preview={coverPreview} onFile={handleCoverChange} />
              {coverDims && (
                <div className="text-xs text-mute">
                  Detected: {coverDims.w}×{coverDims.h}px · ratio {(coverDims.w / coverDims.h).toFixed(3)}
                </div>
              )}
              {coverError && (
                <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span>{coverError}</span>
                </div>
              )}
              {cover && !coverError && (
                <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> <span>Cover passes KDP specs.</span>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl text-navy">Manuscript upload</h2>
              <p className="text-sm text-mute">
                Accepted: <strong>PDF or EPUB</strong>. Max size <strong>650 MB</strong> (KDP limit).
              </p>
              <FileInput file={file} onFile={handleFileChange} />
              {fileError && (
                <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span>{fileError}</span>
                </div>
              )}
              {file && !fileError && (
                <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <span><strong>{file.name}</strong> · {(file.size / 1024 / 1024).toFixed(2)} MB — ready to upload.</span>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl text-navy">Preview & publish</h2>
              <div className="rounded-xl border border-ink/10 bg-paper p-4 flex gap-4">
                {coverPreview ? (
                  <img src={coverPreview} alt="" className="w-24 h-[154px] object-cover rounded-md border border-ink/10 shrink-0" />
                ) : <div className="w-24 h-[154px] bg-ink/5 rounded-md shrink-0" />}
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-display text-xl text-navy leading-tight">{title || "Untitled"}</div>
                  {subtitle && <div className="text-mute italic mt-0.5">{subtitle}</div>}
                  <div className="text-ink mt-2">by <strong>{author}</strong></div>
                  <div className="text-mute text-xs mt-1">{catLabel} · {language}</div>
                  <div className="font-mono text-navy mt-2">${parseFloat(price || "0").toFixed(2)} USD</div>
                  {file && (
                    <div className="text-xs text-mute mt-2 flex items-center gap-1.5">
                      <FileText size={12} /> {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
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
                disabled={step === 1}
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
                <ArrowLeft size={14} /> Back to manuscript
              </button>
            </div>
          )}
        </div>
      </main>
      <style>{`.inp{display:block;width:100%;min-height:44px;border-radius:12px;border:1px solid rgb(0 0 0 / 0.12);padding:10px 14px;font-size:14px;background:white;color:#0F1A33}.inp:focus{outline:none;border-color:#C9A24B;box-shadow:0 0 0 3px rgb(201 162 75 / 0.15)}`}</style>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps = ["Details", "Cover", "Manuscript", "Publish"];
  return (
    <ol className="mt-6 flex items-center gap-2">
      {steps.map((label, i) => {
        const n = (i + 1) as Step;
        const active = n === step;
        const done = n < step;
        return (
          <li key={label} className="flex-1 flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
              ${done ? "bg-gold text-navy" : active ? "bg-navy text-white" : "bg-ink/10 text-mute"}`}>
              {done ? <Check size={14} /> : n}
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

function CoverInput({ file, preview, onFile }: { file: File | null; preview: string | null; onFile: (f: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
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
        <div className="relative rounded-xl border border-ink/10 bg-paper overflow-hidden">
          <div className="mx-auto bg-white" style={{ aspectRatio: "1 / 1.6", maxWidth: "240px" }}>
            <img src={preview} alt="Cover preview" className="w-full h-full object-cover" />
          </div>
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
          className="w-full flex items-center gap-3 rounded-xl border border-dashed border-ink/20 bg-paper px-4 py-6 hover:border-gold text-left"
        >
          <ImageIcon size={20} className="text-mute shrink-0" />
          <span className="text-sm text-ink/80">Tap to choose a cover image (JPG or PNG)</span>
        </button>
      )}
    </div>
  );
}

function FileInput({ file, onFile }: { file: File | null; onFile: (f: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <input
        ref={ref}
        type="file"
        accept=".pdf,.epub,application/pdf,application/epub+zip"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="w-full flex items-center gap-3 rounded-xl border border-dashed border-ink/20 bg-paper px-4 py-6 hover:border-gold text-left"
      >
        {file ? <FileText size={20} className="text-navy shrink-0" /> : <Upload size={20} className="text-mute shrink-0" />}
        <span className="text-sm text-ink/80 truncate">
          {file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : "Tap to choose a manuscript (PDF or EPUB)"}
        </span>
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
