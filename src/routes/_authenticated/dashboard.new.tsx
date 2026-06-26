import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AVLogo } from "@/components/marketplace/AVLogo";
import { ArrowLeft, Upload, Image as ImageIcon, FileText, X, Save } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { reviewProduct } from "@/lib/ai-review.functions";

export const Route = createFileRoute("/_authenticated/dashboard/new")({
  component: NewProduct,
});

const CATEGORIES = [
  { v: "ebooks", label: "eBook" },
  { v: "courses", label: "Course" },
  { v: "templates", label: "Template" },
  { v: "audio", label: "Audio" },
  { v: "leadership", label: "Leadership" },
];

const DRAFT_KEY = "av_new_product_draft_v1";
const MAX_COVER_MB = 10;
const MAX_FILE_MB = 500;

function NewProduct() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const runReview = useServerFn(reviewProduct);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("ebooks");
  const [price, setPrice] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [canSell, setCanSell] = useState<boolean | null>(null);

  // Restore draft (text fields only — files can't be persisted)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.title) setTitle(d.title);
        if (d.description) setDescription(d.description);
        if (d.category) setCategory(d.category);
        if (d.price) setPrice(d.price);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("seller_applications").select("status").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setCanSell(data?.status === "approved"));
  }, [user]);

  // Build/cleanup cover preview URL
  useEffect(() => {
    if (!cover) { setCoverPreview(null); return; }
    const url = URL.createObjectURL(cover);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  function handleCoverChange(f: File | null) {
    if (!f) { setCover(null); return; }
    if (!f.type.startsWith("image/")) {
      toast.error("Cover must be an image (JPG or PNG).");
      return;
    }
    if (f.size > MAX_COVER_MB * 1024 * 1024) {
      toast.error(`Cover must be under ${MAX_COVER_MB} MB.`);
      return;
    }
    setCover(f);
  }

  function handleFileChange(f: File | null) {
    if (!f) { setFile(null); return; }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`Product file must be under ${MAX_FILE_MB} MB.`);
      return;
    }
    setFile(f);
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, description, category, price }));
      toast.success("Draft saved on this device.");
    } catch {
      toast.error("Couldn't save draft.");
    }
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!cover || !file) {
      toast.error("Please upload both a cover image and a product file.");
      return;
    }
    const priceCents = Math.round(parseFloat(price) * 100);
    if (!priceCents || priceCents < 100) {
      toast.error("Price must be at least $1.");
      return;
    }

    setSubmitting(true);
    try {
      const ts = Date.now();
      const coverPath = `${user.id}/${ts}-${cover.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const filePath = `${user.id}/${ts}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

      const [coverUp, fileUp] = await Promise.all([
        supabase.storage.from("product-covers").upload(coverPath, cover, { upsert: false }),
        supabase.storage.from("product-files").upload(filePath, file, { upsert: false }),
      ]);
      if (coverUp.error) throw coverUp.error;
      if (fileUp.error) throw fileUp.error;

      const { data: signed } = await supabase.storage.from("product-covers").createSignedUrl(coverPath, 60 * 60 * 24 * 365 * 5);

      const { data: inserted, error } = await supabase.from("marketplace_products").insert({
        seller_id: user.id,
        title,
        description,
        category: category as "ebooks" | "courses" | "templates" | "audio" | "leadership",
        price_cents: priceCents,
        cover_url: signed?.signedUrl ?? null,
        file_path: filePath,
        file_size_bytes: file.size,
        status: "pending",
      }).select("id").single();
      if (error) throw error;

      toast.success("Product submitted — running AI review…");
      clearDraft();
      if (inserted?.id) {
        runReview({ data: { productId: inserted.id } }).catch((err) => {
          console.error("AI review failed", err);
        });
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

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
        <h1 className="font-display text-3xl md:text-4xl text-navy mt-3">New product</h1>
        <p className="text-mute mt-1">It will be reviewed by our team before going live. AurumVault keeps 9%; you keep 91%.</p>

        {canSell === false && (
          <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
            You're not an approved seller yet. <Link to="/sell" className="underline font-medium">Apply to sell</Link> first.
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-5 bg-white rounded-2xl p-6 border border-ink/10">
          <Field label="Product title">
            <input required value={title} onChange={(e) => setTitle(e.target.value)} className="inp" placeholder="e.g. The Stewardship Codex" />
          </Field>
          <Field label="Description">
            <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className="inp" placeholder="What's in this product? Who is it for?" />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="inp">
                {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Price (USD)">
              <input required type="number" min="1" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="inp" placeholder="29.00" />
            </Field>
          </div>

          <Field label="eBook cover (KDP spec · 1.6:1 ratio, ideally 2560×1600 px · JPG/PNG · max 10 MB)">
            <CoverInput file={cover} preview={coverPreview} onFile={handleCoverChange} />
          </Field>
          <p className="-mt-3 text-[11px] text-mute">Tip: match Kindle Direct Publishing — height:width = 1.6:1 (e.g. 2560×1600 or 1600×1000). Minimum 1000 px on the longest side, RGB, under 10 MB.</p>

          <Field label="Product file (PDF, ZIP, EPUB, audio · max 500 MB)">
            <FileInput accept=".pdf,.zip,.epub,.mp3,.wav,.m4a,.mp4" file={file} onFile={handleFileChange} />
          </Field>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={saveDraft}
              className="h-12 px-5 rounded-full bg-white border border-navy/20 text-navy font-semibold hover:bg-navy/5 inline-flex items-center justify-center gap-2"
            >
              <Save size={16} /> Save draft
            </button>
            <button
              type="submit" disabled={submitting || canSell === false}
              className="flex-1 h-12 rounded-full bg-navy text-white font-semibold hover:bg-navy/90 disabled:opacity-60"
            >
              {submitting ? "Uploading…" : "Submit for review"}
            </button>
          </div>
          <p className="text-[11px] text-mute text-center">Draft saves title, description, category, and price on this device. Files must be re-attached.</p>
        </form>
      </main>
      <style>{`.inp{display:block;width:100%;min-height:44px;border-radius:12px;border:1px solid rgb(0 0 0 / 0.12);padding:10px 14px;font-size:14px;background:white;color:#0F1A33}.inp:focus{outline:none;border-color:#C9A24B;box-shadow:0 0 0 3px rgb(201 162 75 / 0.15)}`}</style>
    </div>
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
        accept="image/png,image/jpeg,image/webp"
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
          className="w-full flex items-center gap-3 rounded-xl border border-dashed border-ink/20 bg-paper px-4 py-4 hover:border-gold text-left"
        >
          <ImageIcon size={20} className="text-mute shrink-0" />
          <span className="text-sm text-ink/80">Tap to choose a cover image</span>
        </button>
      )}
    </div>
  );
}

function FileInput({ accept, file, onFile }: { accept: string; file: File | null; onFile: (f: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
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
        className="w-full flex items-center gap-3 rounded-xl border border-dashed border-ink/20 bg-paper px-4 py-4 hover:border-gold text-left"
      >
        {file ? <FileText size={20} className="text-navy shrink-0" /> : <Upload size={20} className="text-mute shrink-0" />}
        <span className="text-sm text-ink/80 truncate">
          {file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : "Tap to choose a product file"}
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
