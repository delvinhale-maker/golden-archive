import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PublisherShell, ACCENTS, type PublisherAccent } from "@/components/marketplace/PublisherShell";
import {
  ArrowLeft, ArrowRight, Check, Image as ImageIcon, FileText, X,
  CheckCircle2, AlertCircle, Maximize2, Plus, Sparkles, ShieldCheck, Globe,
  Save, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { reviewProduct } from "@/lib/ai-review.functions";

const DRAFT_KEY = "av:publish-draft:v2";
const DESC_MIN = 50;
const DESC_MAX = 1900;
const DESC_WARN = 1800;


export const Route = createFileRoute("/_authenticated/dashboard/new")({
  validateSearch: (s: Record<string, unknown>) => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  component: PublishFlow,
});

const CATEGORIES: { label: string; value: "ebooks" | "finance" | "leadership" | "purpose" | "business" }[] = [
  { label: "eBooks", value: "ebooks" },
  { label: "Finance", value: "finance" },
  { label: "Leadership", value: "leadership" },
  { label: "Purpose", value: "purpose" },
  { label: "Business", value: "business" },
];
const LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Italian", "Other"];
const AGE_RANGES = ["All ages", "Children (5-12)", "Teen (13-17)", "Adult (18+)", "Professional"];

const MAX_COVER_MB = 10;
const MAX_FILE_MB = 100;
const MIN_COVER_W = 1600;
const MIN_COVER_H = 2560;
const TARGET_RATIO = 1600 / 2560;
const RATIO_TOL = 0.03;
const FILE_EXT = ["pdf", "epub", "docx"];
const FILE_MIMES = [
  "application/pdf",
  "application/epub+zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const STEPS = [
  { n: 1 as const, title: "Book Details", accent: ACCENTS.publishStep1 },
  { n: 2 as const, title: "Content & Rights", accent: ACCENTS.publishStep2 },
  { n: 3 as const, title: "Pricing & Royalties", accent: ACCENTS.publishStep3 },
  { n: 4 as const, title: "Review & Publish", accent: ACCENTS.publishStep4 },
];
type StepNum = 1 | 2 | 3 | 4;

function PublishFlow() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const runReview = useServerFn(reviewProduct);
  const { id: editingId } = Route.useSearch();
  const isEditing = !!editingId;

  const [step, setStep] = useState<StepNum>(1);
  const accent: PublisherAccent = STEPS.find((s) => s.n === step)!.accent;
  const [loadingEdit, setLoadingEdit] = useState<boolean>(isEditing);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);
  const [existingFilePath, setExistingFilePath] = useState<string | null>(null);

  // Step 1
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [author, setAuthor] = useState("Illustrious Capital™");
  const [seriesName, setSeriesName] = useState("");
  const [edition, setEdition] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("English");
  const [category, setCategory] = useState<typeof CATEGORIES[number]["value"]>("ebooks");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState("");
  const [ageRange, setAgeRange] = useState("All ages");

  // Step 2
  const [ownsRights, setOwnsRights] = useState(true);
  const [drm, setDrm] = useState(false);
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverDims, setCoverDims] = useState<{ w: number; h: number } | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [coverChecking, setCoverChecking] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [coverLightbox, setCoverLightbox] = useState(false);

  // Step 3
  const [price, setPrice] = useState("");
  const [premium, setPremium] = useState(false);
  const [territory] = useState("Worldwide");

  // Step 4 — submission
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [canSell, setCanSell] = useState<boolean | null>(null);

  // Pre-publish preview modal
  const [showPreview, setShowPreview] = useState(false);

  // Draft banner (offer to resume previous unsaved draft)
  const [draftBanner, setDraftBanner] = useState<{ savedAt: number } | null>(null);
  const draftHydrated = useRef(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("seller_applications").select("status").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setCanSell(data?.status === "approved"));
  }, [user]);

  // Check for an existing local draft (not when editing an existing title)
  useEffect(() => {
    if (isEditing || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { savedAt: number };
      if (parsed?.savedAt) setDraftBanner({ savedAt: parsed.savedAt });
    } catch {
      // ignore
    }
  }, [isEditing]);

  function resumeDraft() {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Record<string, unknown>;
      if (typeof d.title === "string") setTitle(d.title);
      if (typeof d.subtitle === "string") setSubtitle(d.subtitle);
      if (typeof d.author === "string") setAuthor(d.author);
      if (typeof d.seriesName === "string") setSeriesName(d.seriesName);
      if (typeof d.edition === "string") setEdition(d.edition);
      if (typeof d.description === "string") setDescription(d.description);
      if (typeof d.language === "string") setLanguage(d.language);
      if (typeof d.category === "string") setCategory(d.category as typeof category);
      if (Array.isArray(d.keywords)) setKeywords(d.keywords.filter((k): k is string => typeof k === "string"));
      if (typeof d.ageRange === "string") setAgeRange(d.ageRange);
      if (typeof d.ownsRights === "boolean") setOwnsRights(d.ownsRights);
      if (typeof d.drm === "boolean") setDrm(d.drm);
      if (typeof d.premium === "boolean") setPremium(d.premium);
      if (typeof d.price === "string") setPrice(d.price);
      if (typeof d.step === "number" && [1, 2, 3, 4].includes(d.step)) setStep(d.step as StepNum);
      draftHydrated.current = true;
      setDraftBanner(null);
      toast.success("Draft restored.");
    } catch {
      toast.error("Could not restore draft.");
    }
  }

  function discardDraft() {
    try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    setDraftBanner(null);
  }

  // Debounced auto-save to localStorage on any field change
  useEffect(() => {
    if (isEditing || typeof window === "undefined") return;
    const t = setTimeout(() => {
      try {
        const draft = {
          savedAt: Date.now(),
          step, title, subtitle, author, seriesName, edition, description,
          language, category, keywords, ageRange, ownsRights, drm, premium, price,
        };
        // Don't write a useless empty draft
        if (!title.trim() && !description.trim() && !subtitle.trim()) return;
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch { /* ignore quota errors */ }
    }, 2000);
    return () => clearTimeout(t);
  }, [
    isEditing, step, title, subtitle, author, seriesName, edition, description,
    language, category, keywords, ageRange, ownsRights, drm, premium, price,
  ]);



  // Load product for editing
  useEffect(() => {
    if (!editingId || !user) return;
    (async () => {
      const { data, error } = await supabase
        .from("marketplace_products")
        .select("*")
        .eq("id", editingId)
        .maybeSingle();
      if (error || !data) {
        toast.error("Could not load this title.");
        setLoadingEdit(false);
        return;
      }
      if (data.seller_id !== user.id) {
        toast.error("You can only edit your own titles.");
        navigate({ to: "/dashboard" });
        return;
      }
      setTitle(data.title ?? "");
      setSubtitle(data.subtitle ?? "");
      setAuthor(data.creator_name ?? "Illustrious Capital™");
      setDescription(data.description ?? "");
      setLanguage(data.language ?? "English");
      setCategory((data.category as typeof CATEGORIES[number]["value"]) ?? "ebooks");
      setPrice(((data.price_cents ?? 0) / 100).toString());
      setExistingCoverUrl(data.cover_url ?? null);
      setExistingFilePath(data.file_path ?? null);
      try {
        const raw = data.admin_notes as unknown;
        const n = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (n && typeof n === "object") {
          const o = n as Record<string, unknown>;
          if (typeof o.seriesName === "string") setSeriesName(o.seriesName);
          if (typeof o.edition === "string") setEdition(o.edition);
          if (Array.isArray(o.keywords)) setKeywords(o.keywords.filter((k): k is string => typeof k === "string"));
          if (typeof o.ageRange === "string") setAgeRange(o.ageRange);
          if (typeof o.ownsRights === "boolean") setOwnsRights(o.ownsRights);
          if (typeof o.drm === "boolean") setDrm(o.drm);
          if (typeof o.premium === "boolean") setPremium(o.premium);
        }
      } catch {
        // ignore malformed admin_notes
      }
      setLoadingEdit(false);
    })();
  }, [editingId, user, navigate]);

  // Cover preview + dim validation
  useEffect(() => {
    if (!cover) {
      setCoverPreview(existingCoverUrl ?? null);
      setCoverDims(null);
      setCoverChecking(false);
      setCoverError(null);
      return;
    }
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
      setCoverError("Could not read this image. Try a different JPG or PNG.");
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [cover, existingCoverUrl]);

  function validateCover(w: number, h: number) {
    if (w < MIN_COVER_W || h < MIN_COVER_H) {
      setCoverError(`Image is ${w}×${h}px. Minimum ${MIN_COVER_W}×${MIN_COVER_H}px required.`);
      return false;
    }
    const ratio = w / h;
    if (Math.abs(ratio - TARGET_RATIO) > RATIO_TOL) {
      setCoverError(`Aspect ratio must be 1:1.6 (portrait). Yours is ${ratio.toFixed(3)}.`);
      return false;
    }
    setCoverError(null);
    return true;
  }

  function handleCoverChange(f: File | null) {
    setCoverError(null);
    if (!f) { setCover(null); return; }
    if (!["image/jpeg", "image/png"].includes(f.type)) return setCoverError("Cover must be JPG or PNG.");
    if (f.size > MAX_COVER_MB * 1024 * 1024) return setCoverError(`Cover must be under ${MAX_COVER_MB} MB.`);
    setCover(f);
  }

  function handleFileChange(f: File | null) {
    setFileError(null);
    if (!f) { setFile(null); return; }
    if (f.size === 0) return setFileError("File is empty.");
    const ext = f.name.toLowerCase().split(".").pop() ?? "";
    if (!FILE_EXT.includes(ext)) return setFileError(`Unsupported .${ext}. Accepted: PDF, EPUB, DOCX.`);
    if (f.type && !FILE_MIMES.includes(f.type)) return setFileError(`File content (${f.type}) doesn't match a manuscript.`);
    if (f.size > MAX_FILE_MB * 1024 * 1024) return setFileError(`File exceeds ${MAX_FILE_MB} MB limit.`);
    setFile(f);
  }

  function addKeyword() {
    const k = kwInput.trim();
    if (!k) return;
    if (keywords.length >= 7) return toast.error("Maximum 7 keywords.");
    if (keywords.includes(k)) return;
    setKeywords([...keywords, k]);
    setKwInput("");
  }

  const descLen = description.length;
  const descTrimLen = description.trim().length;
  const step1Valid =
    !!title.trim() &&
    !!author.trim() &&
    descTrimLen >= DESC_MIN &&
    descLen <= DESC_MAX;
  const hasCover = (!!cover && !coverError && !!coverDims) || (!cover && !!existingCoverUrl);
  const hasFile = (!!file && !fileError) || (!file && !!existingFilePath);
  const step2Valid = ownsRights && hasCover && hasFile;
  const step3Valid = !!price && parseFloat(price) > 0;

  const priceNum = parseFloat(price || "0");
  const royaltyPct = 0.7;
  const royalty = priceNum * royaltyPct;

  function next() {
    if (step === 1 && !step1Valid) {
      if (descTrimLen < DESC_MIN) return toast.error(`Description needs at least ${DESC_MIN} characters.`);
      if (descLen > DESC_MAX) return toast.error(`Description exceeds ${DESC_MAX} characters.`);
      return toast.error("Fill all required fields.");
    }
    if (step === 2 && !step2Valid) {
      if (!ownsRights) return toast.error("You must confirm you own the rights to this content.");
      return toast.error(isEditing ? "Cover or manuscript is invalid." : "Upload a valid cover and manuscript.");
    }
    if (step === 3 && !step3Valid) return toast.error("Enter a price greater than $0.00.");
    setStep((step + 1) as StepNum);
  }

  // Publish checklist (used by review modal)
  const checklist = useMemo(() => {
    const items = [
      {
        id: "cover",
        label: `Cover uploaded (min ${MIN_COVER_W}×${MIN_COVER_H}px)`,
        ok: hasCover && !coverError,
        gotoStep: 2 as StepNum,
      },
      {
        id: "manuscript",
        label: "Manuscript uploaded",
        ok: hasFile && !fileError,
        gotoStep: 2 as StepNum,
      },
      { id: "title", label: "Title not empty", ok: !!title.trim(), gotoStep: 1 as StepNum },
      {
        id: "description",
        label: `Description ≥ ${DESC_MIN} characters & ≤ ${DESC_MAX}`,
        ok: descTrimLen >= DESC_MIN && descLen <= DESC_MAX,
        gotoStep: 1 as StepNum,
      },
      {
        id: "price",
        label: "Price greater than $0.00",
        ok: !!price && parseFloat(price) > 0,
        gotoStep: 3 as StepNum,
      },
    ];
    return items;
  }, [hasCover, coverError, hasFile, fileError, title, descTrimLen, descLen, price]);
  const checklistPass = checklist.every((c) => c.ok);


  async function uploadAndSave(publish: boolean) {
    if (!user) return;
    // For publish we require everything. For drafts (publish=false) allow
    // partial data — the bookshelf can resume the title later.
    if (publish && !isEditing && (!cover || !file)) return;

    setSubmitting(true); setUploading(true); setUploadProgress(5);
    try {
      const ts = Date.now();
      let coverUrl: string | null = existingCoverUrl;
      let storedFilePath: string | null = existingFilePath;
      let fileSize: number | undefined;

      if (cover) {
        const coverPath = `${user.id}/${ts}-${cover.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
        const coverUp = await supabase.storage.from("product-covers").upload(coverPath, cover, { upsert: false });
        if (coverUp.error) throw coverUp.error;
        const { data: signed } = await supabase.storage.from("product-covers")
          .createSignedUrl(coverPath, 60 * 60 * 24 * 365 * 5);
        coverUrl = signed?.signedUrl ?? null;
      }
      setUploadProgress(40);

      if (file) {
        const newFilePath = `${user.id}/${ts}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
        const t = setInterval(() => setUploadProgress((p) => (p < 90 ? p + 3 : p)), 400);
        const fileUp = await supabase.storage.from("product-files").upload(newFilePath, file, { upsert: false });
        clearInterval(t);
        if (fileUp.error) throw fileUp.error;
        storedFilePath = newFilePath;
        fileSize = file.size;
      }
      setUploadProgress(95);

      const priceCents = Math.round(priceNum * 100);
      const status: "draft" | "approved" | "pending" = publish ? (isEditing ? "pending" : "approved") : "draft";
      const notes = JSON.stringify({
        seriesName: seriesName || null,
        edition: edition || null,
        keywords,
        ageRange,
        ownsRights, drm, premium, territory,
      });

      let savedId: string | null = editingId ?? null;
      if (isEditing && editingId) {
        const update = {
          title: title.trim(),
          subtitle: subtitle.trim() || null,
          description: description.trim(),
          creator_name: author.trim(),
          language,
          category,
          price_cents: priceCents,
          cover_url: coverUrl,
          file_path: storedFilePath,
          status,
          published: publish,
          admin_notes: notes,
          ...(fileSize !== undefined ? { file_size_bytes: fileSize } : {}),
        };
        const { error } = await supabase.from("marketplace_products").update(update).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from("marketplace_products").insert({
          seller_id: user.id,
          title: title.trim(),
          subtitle: subtitle.trim() || null,
          description: description.trim(),
          creator_name: author.trim(),
          language, category,
          price_cents: priceCents,
          cover_url: coverUrl,
          file_path: storedFilePath,
          file_size_bytes: fileSize,
          status,
          published: publish,
          admin_notes: notes,
        }).select("id").single();
        if (error) throw error;
        savedId = inserted?.id ?? null;
      }
      setUploadProgress(100);

      if (publish) {
        toast.success(isEditing ? "Title updated." : "Published to the Vault!");
        if (savedId) {
          runReview({ data: { productId: savedId } }).catch((err) => console.error("AI review failed", err));
        }
        try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        setPublishedId(savedId);
      } else {
        toast.success("Draft saved.");
        try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        navigate({ to: "/dashboard" });
      }

    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false); setUploading(false);
    }
  }

  if (publishedId) {
    return (
      <PublisherShell accent={accent}>
        <SuccessScreen productId={publishedId} title={title} accent={accent} />
      </PublisherShell>
    );
  }

  return (
    <PublisherShell accent={accent}>
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-mute hover:text-navy">
        <ArrowLeft size={14} /> Back to Bookshelf
      </Link>
      <h1 className="font-display text-3xl md:text-4xl text-navy mt-3">
        {isEditing ? "Edit title" : "Publish a new title"}
      </h1>
      <p className="text-mute mt-1">
        {isEditing
          ? "Update any field and re-publish. Republishing sends the title back through AI review."
          : "A KDP-style flow. AurumVault keeps 9%; you keep 91%."}
      </p>
      {loadingEdit && (
        <p className="mt-2 text-xs text-mute">Loading title…</p>
      )}

      {canSell === false && (
        <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
          You're not an approved seller yet. <Link to="/sell" className="underline font-medium">Apply to sell</Link> first.
        </div>
      )}

      <StepperBar step={step} />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div
          className="bg-white rounded-2xl p-6 md:p-8 border transition-colors duration-300"
          style={{ borderColor: `color-mix(in oklab, ${accent.color} 25%, transparent)` }}
        >
          {step === 1 && (
            <StepDetails
              title={title} setTitle={setTitle}
              subtitle={subtitle} setSubtitle={setSubtitle}
              author={author} setAuthor={setAuthor}
              seriesName={seriesName} setSeriesName={setSeriesName}
              edition={edition} setEdition={setEdition}
              description={description} setDescription={setDescription}
              language={language} setLanguage={setLanguage}
              category={category} setCategory={setCategory}
              keywords={keywords} setKeywords={setKeywords}
              kwInput={kwInput} setKwInput={setKwInput} addKeyword={addKeyword}
              ageRange={ageRange} setAgeRange={setAgeRange}
            />
          )}
          {step === 2 && (
            <StepContent
              ownsRights={ownsRights} setOwnsRights={setOwnsRights}
              drm={drm} setDrm={setDrm}
              cover={cover} coverPreview={coverPreview} coverDims={coverDims}
              coverError={coverError} coverChecking={coverChecking}
              handleCoverChange={handleCoverChange}
              file={file} fileError={fileError} handleFileChange={handleFileChange}
              uploadProgress={uploadProgress} uploading={uploading}
              onZoomCover={() => setCoverLightbox(true)}
              existingCoverUrl={existingCoverUrl}
              existingFilePath={existingFilePath}
            />
          )}
          {step === 3 && (
            <StepPricing
              price={price} setPrice={setPrice}
              royaltyPct={royaltyPct} royalty={royalty}
              premium={premium} setPremium={setPremium}
              territory={territory}
            />
          )}
          {step === 4 && (
            <StepReview
              accent={accent}
              cover={coverPreview} title={title} subtitle={subtitle} author={author}
              price={priceNum} royalty={royalty}
              format="eBook" territory={territory}
              uploading={uploading} uploadProgress={uploadProgress}
              submitting={submitting} disabled={canSell === false}
              onDraft={() => uploadAndSave(false)} onPublish={() => uploadAndSave(true)}
              onZoomCover={() => setCoverLightbox(true)}
            />
          )}

          {step < 4 ? (
            <div className="flex justify-between mt-8 pt-5 border-t border-ink/10">
              <button
                type="button" disabled={step === 1}
                onClick={() => setStep((step - 1) as StepNum)}
                className="h-11 px-5 rounded-full text-navy font-medium hover:bg-ink/5 disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button
                type="button" onClick={next}
                className="h-11 px-6 rounded-full text-white font-semibold inline-flex items-center gap-1.5 transition-colors duration-300"
                style={{ background: accent.color }}
              >
                Continue <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="mt-6">
              <button onClick={() => setStep(3)} className="text-sm text-mute hover:text-navy inline-flex items-center gap-1.5">
                <ArrowLeft size={14} /> Back to pricing
              </button>
            </div>
          )}
        </div>

        {/* Live preview panel */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 bg-white rounded-2xl border border-ink/10 p-5">
            <p className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: accent.color }}>
              Store preview
            </p>
            <div className="mt-3 mx-auto w-44 aspect-[1/1.6] rounded-md bg-gradient-to-br from-navy to-[#22335A] shadow-lg overflow-hidden">
              {coverPreview ? (
                <img src={coverPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/40 text-xs">No cover</div>
              )}
            </div>
            <div className="mt-4 text-center">
              <div className="font-display text-navy leading-tight">{title || "Your title here"}</div>
              {subtitle && <div className="text-xs text-mute italic mt-0.5">{subtitle}</div>}
              <div className="text-xs text-mute mt-1">by {author}</div>
              {priceNum > 0 && <div className="mt-2 font-mono text-navy">${priceNum.toFixed(2)}</div>}
            </div>
          </div>
        </aside>
      </div>
      {coverLightbox && coverPreview && (
        <CoverLightbox src={coverPreview} fileName={cover?.name} onClose={() => setCoverLightbox(false)} />
      )}
      <style>{`.inp{display:block;width:100%;min-height:44px;border-radius:12px;border:1px solid rgb(0 0 0 / 0.12);padding:10px 14px;font-size:14px;background:white;color:#0F1A33;transition:border-color .2s,box-shadow .2s}.inp:focus{outline:none;border-color:var(--page-accent);box-shadow:0 0 0 3px color-mix(in oklab,var(--page-accent) 20%,transparent)}`}</style>
    </PublisherShell>
  );
}

/* ---------- Stepper ---------- */

function StepperBar({ step }: { step: StepNum }) {
  return (
    <ol className="mt-6 grid grid-cols-4 gap-2">
      {STEPS.map((s) => {
        const active = s.n === step;
        const done = s.n < step;
        const bg = done || active ? s.accent.color : "#e5e7eb";
        return (
          <li key={s.n} className="space-y-1.5">
            <div
              className="h-1.5 rounded-full transition-colors duration-300"
              style={{ background: bg }}
            />
            <div className="flex items-center gap-1.5">
              <span
                className="text-[11px] font-bold w-5 h-5 rounded-full inline-flex items-center justify-center transition-colors duration-300"
                style={{
                  background: done || active ? s.accent.color : "#e5e7eb",
                  color: done || active ? "white" : "#6b7280",
                }}
              >
                {done ? <Check size={12} /> : s.n}
              </span>
              <span className={`text-xs font-medium ${active || done ? "text-navy" : "text-mute"}`}>{s.title}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- Step 1: Book Details ---------- */

function StepDetails(p: {
  title: string; setTitle: (v: string) => void;
  subtitle: string; setSubtitle: (v: string) => void;
  author: string; setAuthor: (v: string) => void;
  seriesName: string; setSeriesName: (v: string) => void;
  edition: string; setEdition: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  language: string; setLanguage: (v: string) => void;
  category: typeof CATEGORIES[number]["value"]; setCategory: (v: typeof CATEGORIES[number]["value"]) => void;
  keywords: string[]; setKeywords: (v: string[]) => void;
  kwInput: string; setKwInput: (v: string) => void; addKeyword: () => void;
  ageRange: string; setAgeRange: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <h2 className="font-display text-2xl text-navy">Book details</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Title *"><input className="inp" value={p.title} onChange={(e) => p.setTitle(e.target.value)} placeholder="e.g. The Stewardship Codex" /></Field>
        <Field label="Subtitle"><input className="inp" value={p.subtitle} onChange={(e) => p.setSubtitle(e.target.value)} placeholder="A field guide" /></Field>
        <Field label="Author / Publisher *"><input className="inp" value={p.author} onChange={(e) => p.setAuthor(e.target.value)} /></Field>
        <Field label="Series name"><input className="inp" value={p.seriesName} onChange={(e) => p.setSeriesName(e.target.value)} placeholder="Optional" /></Field>
        <Field label="Edition"><input className="inp" value={p.edition} onChange={(e) => p.setEdition(e.target.value)} placeholder="e.g. Second Edition" /></Field>
        <Field label="Language">
          <select className="inp" value={p.language} onChange={(e) => p.setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
          </select>
        </Field>
      </div>
      <Field label={`Description * (${p.description.trim().length}/150 min)`}>
        <textarea rows={6} className="inp" value={p.description} onChange={(e) => p.setDescription(e.target.value)} placeholder="What's in this book? Who is it for?" />
        {p.description.length > 0 && p.description.trim().length < 150 && (
          <p className="mt-1 text-xs text-amber-700">{150 - p.description.trim().length} more characters needed.</p>
        )}
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Category">
          <select className="inp" value={p.category} onChange={(e) => p.setCategory(e.target.value as typeof p.category)}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Age / Grade range">
          <select className="inp" value={p.ageRange} onChange={(e) => p.setAgeRange(e.target.value)}>
            {AGE_RANGES.map((a) => <option key={a}>{a}</option>)}
          </select>
        </Field>
      </div>
      <Field label={`Keywords (${p.keywords.length}/7)`}>
        <div className="flex flex-wrap gap-2 mb-2">
          {p.keywords.map((k) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-full bg-paper border border-ink/10 px-3 py-1 text-xs text-navy">
              {k}
              <button type="button" onClick={() => p.setKeywords(p.keywords.filter((x) => x !== k))} className="text-mute hover:text-red-600" aria-label={`Remove ${k}`}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="inp"
            value={p.kwInput}
            onChange={(e) => p.setKwInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); p.addKeyword(); } }}
            placeholder="Type a keyword and press Enter"
            disabled={p.keywords.length >= 7}
          />
          <button type="button" onClick={p.addKeyword} disabled={p.keywords.length >= 7} className="rounded-full bg-navy text-white px-4 text-sm disabled:opacity-40">
            Add
          </button>
        </div>
      </Field>
    </div>
  );
}

/* ---------- Step 2: Content & Rights ---------- */

function StepContent(p: {
  ownsRights: boolean; setOwnsRights: (v: boolean) => void;
  drm: boolean; setDrm: (v: boolean) => void;
  cover: File | null; coverPreview: string | null; coverDims: { w: number; h: number } | null;
  coverError: string | null; coverChecking: boolean;
  handleCoverChange: (f: File | null) => void;
  file: File | null; fileError: string | null; handleFileChange: (f: File | null) => void;
  uploadProgress: number; uploading: boolean;
  onZoomCover: () => void;
  existingCoverUrl: string | null;
  existingFilePath: string | null;
}) {
  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl text-navy">Content & rights</h2>

      <div className="rounded-xl border border-ink/10 p-4 bg-paper/50">
        <p className="text-sm font-medium text-navy">Do you own the rights to this content?</p>
        <div className="mt-2 flex gap-2">
          <RightsBtn active={p.ownsRights} onClick={() => p.setOwnsRights(true)}>Yes, I own the rights</RightsBtn>
          <RightsBtn active={!p.ownsRights} onClick={() => p.setOwnsRights(false)}>No</RightsBtn>
        </div>
      </div>

      <Toggle
        label="Enable Digital Rights Management (DRM)"
        description="Restrict copying and sharing of this title."
        checked={p.drm} onChange={p.setDrm}
      />

      <div>
        <h3 className="font-display text-lg text-navy mb-2">Manuscript</h3>
        <p className="text-xs text-mute mb-3">Accepted: PDF, EPUB, DOCX. Max {MAX_FILE_MB} MB.</p>
        <FileInput file={p.file} onFile={p.handleFileChange} accept=".pdf,.epub,.docx,application/pdf,application/epub+zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hint="Drag & drop or tap to choose your manuscript" acceptedHint=".PDF, .EPUB, .DOCX" />
        {p.fileError && (
          <div className="mt-2 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{p.fileError}</span>
          </div>
        )}
        {p.file && !p.fileError && (
          <div className="mt-2 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <CheckCircle2 size={16} className="shrink-0" />
            <span className="truncate">{p.file.name} — {(p.file.size / 1024 / 1024).toFixed(2)} MB</span>
          </div>
        )}
        {!p.file && !p.fileError && p.existingFilePath && (
          <div className="mt-2 flex items-center gap-2 text-sm text-navy bg-paper border border-ink/10 rounded-lg p-3">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            <span className="truncate">Current manuscript on file. Drop a new file to replace it.</span>
          </div>
        )}
        {p.uploading && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-mute mb-1"><span>Uploading…</span><span>{p.uploadProgress}%</span></div>
            <div className="h-2 bg-ink/10 rounded-full overflow-hidden">
              <div className="h-full transition-all" style={{ width: `${p.uploadProgress}%`, background: "var(--page-accent)" }} />
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="font-display text-lg text-navy mb-2">Cover</h3>
        <p className="text-xs text-mute mb-3">JPG or PNG, minimum 1600×2560 px (1:1.6 portrait).</p>
        <CoverInput file={p.cover} preview={p.coverPreview} onFile={p.handleCoverChange} acceptedHint="JPG, PNG" onZoom={p.onZoomCover} />
        {p.coverChecking && <div className="mt-2 text-xs text-mute">Checking image dimensions…</div>}
        {p.coverDims && (
          <div className="mt-2 text-xs text-mute">
            Detected: {p.coverDims.w}×{p.coverDims.h}px · ratio {(p.coverDims.w / p.coverDims.h).toFixed(3)} · minimum {MIN_COVER_W}×{MIN_COVER_H}px
          </div>
        )}
        {p.coverError && (
          <div role="alert" className="mt-2 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{p.coverError}</span>
          </div>
        )}
        {p.cover && !p.coverError && !p.coverChecking && p.coverDims && (
          <div className="mt-2 flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" /><span>Cover meets the required specs.</span>
          </div>
        )}
        {!p.cover && p.existingCoverUrl && (
          <div className="mt-2 flex items-center gap-2 text-sm text-navy bg-paper border border-ink/10 rounded-lg p-3">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            <span className="truncate">Current cover shown above. Drop a new image to replace it.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function RightsBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${active ? "text-white border-transparent" : "bg-white text-ink border-ink/15 hover:bg-paper"}`}
      style={active ? { background: "var(--page-accent)" } : undefined}
    >
      {children}
    </button>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <button
        type="button" role="switch" aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200"
        style={{ background: checked ? "var(--page-accent)" : "#d1d5db" }}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"} mt-0.5`} />
      </button>
      <span className="text-sm">
        <span className="block font-medium text-navy">{label}</span>
        {description && <span className="block text-mute mt-0.5">{description}</span>}
      </span>
    </label>
  );
}

/* ---------- Step 3: Pricing ---------- */

function StepPricing({ price, setPrice, royaltyPct, royalty, premium, setPremium, territory }: {
  price: string; setPrice: (v: string) => void; royaltyPct: number; royalty: number;
  premium: boolean; setPremium: (v: boolean) => void; territory: string;
}) {
  const pct = Math.round(royaltyPct * 100);
  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl text-navy">Pricing & royalties</h2>
      <Field label="List price (USD) *">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-mute">$</span>
          <input
            type="number" min="1" step="0.01"
            value={price} onChange={(e) => setPrice(e.target.value)}
            className="inp pl-8" placeholder="9.99"
          />
        </div>
      </Field>

      <div
        className="rounded-2xl p-5 text-white transition-colors duration-300"
        style={{ background: "var(--page-accent)" }}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={16} />
          <p className="text-sm font-semibold uppercase tracking-wider">Royalty estimate</p>
        </div>
        <p className="mt-2 text-white/90">
          You earn <strong>{pct}%</strong> = <span className="font-display text-2xl">${royalty.toFixed(2)}</span> per sale.
        </p>
        <p className="mt-1 text-xs text-white/70">Based on your current list price. AurumVault keeps the remaining {100 - pct}%.</p>
      </div>

      <Toggle
        label="Include in AurumVault Premium"
        description="Premium subscribers (like Kindle Unlimited) get access. You earn a share of pooled revenue per page-read."
        checked={premium} onChange={setPremium}
      />

      <Field label="Territory">
        <div className="inp inline-flex items-center gap-2 cursor-not-allowed bg-paper">
          <Globe size={14} className="text-mute" />
          <span>{territory}</span>
          <span className="ml-auto text-xs text-mute">Available everywhere AurumVault operates</span>
        </div>
      </Field>
    </div>
  );
}

/* ---------- Step 4: Review ---------- */

function StepReview({ accent, cover, title, subtitle, author, price, royalty, format, territory, uploading, uploadProgress, submitting, disabled, onDraft, onPublish, onZoomCover }: {
  accent: PublisherAccent;
  cover: string | null; title: string; subtitle: string; author: string;
  price: number; royalty: number; format: string; territory: string;
  uploading: boolean; uploadProgress: number; submitting: boolean; disabled: boolean;
  onDraft: () => void; onPublish: () => void; onZoomCover: () => void;
}) {
  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl text-navy">Review & publish</h2>

      <div
        className="rounded-2xl p-5 md:p-6 flex flex-col sm:flex-row gap-5"
        style={{ background: `linear-gradient(135deg, ${accent.tint} 0%, white 100%)`, border: `1px solid ${accent.color}30` }}
      >
        {cover ? (
          <button type="button" onClick={onZoomCover} className="group shrink-0 self-start relative">
            <img src={cover} alt="" className="w-40 h-auto aspect-[1/1.6] object-cover rounded-md shadow-lg border border-ink/10" />
            <span className="absolute inset-0 rounded-md bg-navy/0 group-hover:bg-navy/30 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
              <Maximize2 size={20} className="text-white" />
            </span>
          </button>
        ) : <div className="w-40 aspect-[1/1.6] bg-ink/5 rounded-md" />}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: accent.color }}>Final summary</p>
          <div className="mt-1 font-display text-2xl text-navy leading-tight">{title || "Untitled"}</div>
          {subtitle && <div className="text-mute italic">{subtitle}</div>}
          <div className="mt-2 text-sm text-ink">by <strong>{author}</strong></div>
          <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-mute">Format</dt><dd className="text-navy">{format}</dd>
            <dt className="text-mute">List price</dt><dd className="text-navy font-mono">${price.toFixed(2)}</dd>
            <dt className="text-mute">Your royalty</dt><dd className="text-navy font-mono">${royalty.toFixed(2)}</dd>
            <dt className="text-mute">Territory</dt><dd className="text-navy">{territory}</dd>
          </dl>
        </div>
      </div>

      {uploading && (
        <div>
          <div className="flex justify-between text-xs text-mute mb-1"><span>Uploading…</span><span>{uploadProgress}%</span></div>
          <div className="h-2 bg-ink/10 rounded-full overflow-hidden">
            <div className="h-full transition-all" style={{ width: `${uploadProgress}%`, background: accent.color }} />
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="button" disabled={submitting || disabled} onClick={onDraft}
          className="h-12 px-5 rounded-full bg-white border border-navy/20 text-navy font-semibold hover:bg-navy/5 disabled:opacity-60"
        >
          Save as Draft
        </button>
        <button
          type="button" disabled={submitting || disabled} onClick={onPublish}
          className="flex-1 h-12 rounded-full text-white font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2 transition-colors duration-300"
          style={{ background: accent.color }}
        >
          <ShieldCheck size={16} /> {submitting ? "Publishing…" : "Publish to Vault"}
        </button>
      </div>
    </div>
  );
}

/* ---------- Success ---------- */

function SuccessScreen({ productId, title, accent }: { productId: string; title: string; accent: PublisherAccent }) {
  return (
    <div className="max-w-2xl mx-auto mt-12 text-center">
      <div
        className="mx-auto inline-flex items-center justify-center h-20 w-20 rounded-full text-white shadow-xl"
        style={{ background: accent.color }}
      >
        <CheckCircle2 size={42} />
      </div>
      <h1 className="mt-6 font-display text-3xl md:text-4xl text-navy">Your title is live on AurumVault!</h1>
      <p className="mt-2 text-mute">"{title}" was successfully published and is now available in the storefront.</p>
      <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to="/products/$id" params={{ id: productId }}
          className="h-12 px-6 rounded-full font-semibold text-white inline-flex items-center justify-center gap-2"
          style={{ background: accent.color }}
        >
          View in Store <ArrowRight size={16} />
        </Link>
        <Link
          to="/dashboard"
          className="h-12 px-6 rounded-full font-semibold text-navy border border-navy/20 inline-flex items-center justify-center hover:bg-navy/5"
        >
          Back to Bookshelf
        </Link>
      </div>
    </div>
  );
}

/* ---------- Shared inputs ---------- */

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
    onDragEnter: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); counter.current += 1; if (e.dataTransfer?.types?.includes("Files")) setIsOver(true); },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; },
    onDragLeave: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); counter.current -= 1; if (counter.current <= 0) { counter.current = 0; setIsOver(false); } },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); counter.current = 0; setIsOver(false); const f = e.dataTransfer?.files?.[0] ?? null; if (f) onFile(f); },
  };
  return { isOver, handlers };
}

function CoverInput({ file, preview, onFile, acceptedHint, onZoom }: { file: File | null; preview: string | null; onFile: (f: File | null) => void; acceptedHint: string; onZoom?: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const { isOver, handlers } = useDropZone(onFile);
  return (
    <div className="space-y-2">
      <input ref={ref} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      {preview ? (
        <div className="relative rounded-xl border border-ink/10 bg-paper overflow-hidden" {...handlers}>
          <div className="relative mx-auto bg-white group" style={{ aspectRatio: "1 / 1.6", maxWidth: "300px" }}>
            <img src={preview} alt="Cover preview" className="w-full h-full object-cover shadow-lg" />
            {onZoom && (
              <button type="button" onClick={onZoom} className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-navy/80 hover:bg-navy text-white text-xs font-medium px-2.5 py-1.5 backdrop-blur" aria-label="View full size">
                <Maximize2 size={12} /> Full size
              </button>
            )}
          </div>
          {isOver && <div className="absolute inset-0 bg-gold/20 border-2 border-dashed border-gold rounded-xl flex items-center justify-center pointer-events-none"><span className="text-sm font-semibold text-navy">Drop to replace</span></div>}
          <div className="flex items-center justify-between px-3 py-2 bg-white border-t border-ink/10">
            <span className="text-xs text-mute truncate">{file?.name} {file ? `· ${(file.size / 1024 / 1024).toFixed(2)} MB` : ""}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => ref.current?.click()} className="text-xs font-medium text-navy hover:underline">Replace</button>
              <button type="button" onClick={() => onFile(null)} className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"><X size={12} />Remove</button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} {...handlers}
          className={`w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${isOver ? "border-gold bg-gold/10" : "border-ink/20 bg-paper hover:border-navy/30"}`}>
          <ImageIcon size={28} className={isOver ? "text-gold" : "text-mute"} />
          <span className="text-sm font-medium text-ink/80">{isOver ? "Drop image here" : "Drag & drop a cover, or tap to browse"}</span>
          <span className="text-xs text-mute">Accepted: {acceptedHint}</span>
        </button>
      )}
    </div>
  );
}

function FileInput({ file, onFile, accept, hint, acceptedHint }: { file: File | null; onFile: (f: File | null) => void; accept: string; hint: string; acceptedHint: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const { isOver, handlers } = useDropZone(onFile);
  return (
    <div>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      <button type="button" onClick={() => ref.current?.click()} {...handlers}
        className={`w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 text-center transition ${isOver ? "border-gold bg-gold/10" : file ? "border-emerald-300 bg-emerald-50/40" : "border-ink/20 bg-paper hover:border-navy/30"}`}>
        {file ? <FileText size={26} className="text-emerald-700" /> : <Plus size={26} className={isOver ? "text-gold" : "text-mute"} />}
        <span className="text-sm font-medium text-ink/80">{file ? file.name : isOver ? "Drop file here" : hint}</span>
        <span className="text-xs text-mute">Accepted: {acceptedHint}</span>
      </button>
    </div>
  );
}

function CoverLightbox({ src, fileName, onClose }: { src: string; fileName?: string; onClose: () => void }) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Cover full size" className="fixed inset-0 z-50 bg-navy/90 flex items-center justify-center p-6" onClick={onClose}>
      <button ref={closeBtnRef} onClick={onClose} className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 rounded-full h-10 w-10 inline-flex items-center justify-center" aria-label="Close"><X size={20} /></button>
      <img src={src} alt={fileName ?? "Cover"} className="max-h-[90vh] max-w-full object-contain shadow-2xl rounded-md" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
