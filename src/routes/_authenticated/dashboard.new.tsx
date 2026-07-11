import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PublisherShell, ACCENTS, type PublisherAccent } from "@/components/marketplace/PublisherShell";
import {
  ArrowLeft, ArrowRight, Check, Image as ImageIcon, FileText, X,
  CheckCircle2, AlertCircle, Maximize2, Plus, Sparkles, ShieldCheck, Globe,
  Save, Eye, Loader2, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { reviewProduct } from "@/lib/ai-review.functions";
import { isListPriceValid } from "@/lib/publish-validation";
import { PublishSuccessScreen as SuccessScreen } from "@/components/marketplace/PublishSuccessScreen";
import { ManuscriptPreviewer } from "@/components/marketplace/ManuscriptPreviewer";
import { PreviewPagePicker } from "@/components/marketplace/PreviewPagePicker";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { getProductType, getProductTypeKeyByCategory, categoryDisplay, isProductTypeKey, type ProductTypeKey } from "@/lib/product-types";

const PUBLISH_STEP_ACCENTS: Record<1 | 2 | 3 | 4, string> = {
  1: "#1A6B3A", // Emerald
  2: "#4B2D8F", // Purple
  3: "#C47B00", // Amber
  4: "#B8860B", // Gold
};

// (legacy localStorage draft key removed — drafts now live in the database)
const DESC_MIN = 50;
const DESC_MAX = 1900;
const DESC_WARN = 1800;


export const Route = createFileRoute("/_authenticated/dashboard/new")({
  validateSearch: (s: Record<string, unknown>) => {
    const rawType = typeof s.type === "string" ? s.type : undefined;
    const type = isProductTypeKey(rawType) ? rawType : undefined;
    return {
      id: typeof s.id === "string" ? s.id : undefined,
      type,
      // Signals that a `type` param was present but did not match a known
      // product type key. The component surfaces a toast so the user knows
      // we ignored it and fell back to the default selection.
      invalidType: rawType !== undefined && type === undefined ? rawType : undefined,
    };
  },
  component: PublishFlowRoute,
});

function PublishFlowRoute() {
  const { id, type, invalidType } = Route.useSearch();
  return <PublishFlow editingId={id} productTypeKey={type} invalidType={invalidType} />;
}

export function PublishFlow({ editingId: editingIdProp, productTypeKey, invalidType }: { editingId?: string; productTypeKey?: ProductTypeKey; invalidType?: string } = {}) {
  return <PublishFlowImpl editingId={editingIdProp} productTypeKey={productTypeKey} invalidType={invalidType} />;
}



const CATEGORIES: { label: string; value: import("@/lib/product-types").ProductCategoryEnum }[] = [
  { label: "eBooks", value: "ebooks" },
  { label: "Financial Planners", value: "financial_planners" },
  { label: "AI Prompt Packs", value: "ai_prompt_packs" },
  { label: "Digital Journals", value: "printable_journals" },
  { label: "Children's Educational", value: "childrens_educational" },
  { label: "Business Operating Systems", value: "business_operating_systems" },
  { label: "Business Templates", value: "business_templates" },
  { label: "Audio", value: "audio" },
  { label: "Templates", value: "templates" },
  { label: "Finance", value: "finance" },
  { label: "Leadership", value: "leadership" },
  { label: "Purpose", value: "purpose" },
  { label: "Business", value: "business" },
];
const LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Italian", "Other"];
const AGE_RANGES = ["All ages", "Children (5-12)", "Teen (13-17)", "Adult (18+)", "Professional"];

const MAX_COVER_MB = 10;
const MAX_FILE_MB = 650;
const MIN_COVER_W = 1600;
const MIN_COVER_H = 2560;
const TARGET_RATIO = 1600 / 2560;
const RATIO_TOL = 0.03;

const STEPS = [
  { n: 1 as const, title: "Book Details", accent: ACCENTS.publishStep1 },
  { n: 2 as const, title: "Content & Rights", accent: ACCENTS.publishStep2 },
  { n: 3 as const, title: "Pricing & Royalties", accent: ACCENTS.publishStep3 },
  { n: 4 as const, title: "Review & Publish", accent: ACCENTS.publishStep4 },
];
type StepNum = 1 | 2 | 3 | 4;

function PublishFlowImpl({ editingId: editingIdProp, productTypeKey, invalidType }: { editingId?: string; productTypeKey?: ProductTypeKey; invalidType?: string }) {
  const [editProductTypeKey, setEditProductTypeKey] = useState<ProductTypeKey | undefined>(undefined);
  const typeCfg = getProductType(productTypeKey ?? editProductTypeKey);
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();
  const runReview = useServerFn(reviewProduct);
  const editingId = editingIdProp;
  const isEditing = !!editingId;

  // Admin-only: bypass the "pending review" step on edits so changes go live
  // immediately. Persisted per-browser so it survives reloads while testing.
  const [adminInstantApprove, setAdminInstantApproveState] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const raw = window.localStorage.getItem("av:admin-instant-approve");
    return raw === null ? true : raw === "1";
  });
  function setAdminInstantApprove(next: boolean) {
    setAdminInstantApproveState(next);
    try { window.localStorage.setItem("av:admin-instant-approve", next ? "1" : "0"); } catch { /* ignore */ }
  }
  // Only actually bypass when the user is an admin AND the toggle is on.
  const bypassReview = isAdmin && adminInstantApprove;

  useEffect(() => {
    if (invalidType) {
      toast.warning(`Unknown product type "${invalidType}" — defaulting to ${typeCfg.label}. Choose a category below to continue.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidType]);

  const [step, setStep] = useState<StepNum>(1);
  const accent: PublisherAccent = STEPS.find((s) => s.n === step)!.accent;

  // Override the global route theme's accent per publish step
  const { activeTheme, setActiveTheme } = useTheme();
  useEffect(() => {
    setActiveTheme({ ...activeTheme, accentColor: PUBLISH_STEP_ACCENTS[step] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  const [loadingEdit, setLoadingEdit] = useState<boolean>(isEditing);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);
  const [existingFilePath, setExistingFilePath] = useState<string | null>(null);
  const [dbUpdatedAt, setDbUpdatedAt] = useState<string | null>(null);

  // Step 1
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [author, setAuthor] = useState("Delvin Hale");
  const [seriesName, setSeriesName] = useState("");
  const [edition, setEdition] = useState("");
  const [whatsIncluded, setWhatsIncluded] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("English");
  const [category, setCategory] = useState<import("@/lib/product-types").ProductCategoryEnum>(typeCfg.category);
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
  // Step 2 (bonus): preview page selection — 0..5 ordered 1-indexed page numbers
  const [previewPages, setPreviewPages] = useState<number[]>([]);

  // Step 3
  const [price, setPrice] = useState<string>(() => (productTypeKey && !editingIdProp ? (typeCfg.suggestedPriceCents / 100).toFixed(2) : ""));
  const [premium, setPremium] = useState(false);
  const [territory] = useState("Worldwide");

  // Step 4 — submission
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);
  const [uploadedCoverUrl, setUploadedCoverUrl] = useState<string | null>(null);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);
  const [uploadedFileMeta, setUploadedFileMeta] = useState<{ name: string; size: number } | null>(null);
  // Per-zone upload state — zones operate independently
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverProgress, setCoverProgress] = useState(0);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileProgress, setFileProgress] = useState(0);
  const [lastPublishAttempt, setLastPublishAttempt] = useState<boolean>(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [canSell, setCanSell] = useState<boolean | null>(null);
  // Draft row in DB — for auto-save after each upload + field changes
  const [draftProductId, setDraftProductId] = useState<string | null>(null);

  // Pre-publish preview modal
  const [showPreview, setShowPreview] = useState(false);

  // Draft banner (offer to resume previous unsaved draft from DB)
  const [draftBanner, setDraftBanner] = useState<{ savedAt: string; productId: string; title: string } | null>(null);
  


  useEffect(() => {
    if (!user) return;
    supabase.from("seller_applications").select("status").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setCanSell(data?.status === "approved"));
  }, [user]);

  // Check the DB for an existing draft owned by this user (not when editing)
  useEffect(() => {
    if (isEditing || !user) return;
    (async () => {
      const { data } = await supabase
        .from("marketplace_products")
        .select("id,title,updated_at")
        .eq("seller_id", user.id)
        .eq("published", false)
        .eq("status", "draft")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.id) {
        setDraftBanner({
          savedAt: (data.updated_at as string | null) ?? new Date().toISOString(),
          productId: data.id as string,
          title: (data.title as string | null) ?? "Untitled draft",
        });
      }
    })();
  }, [isEditing, user]);

  function resumeDraft() {
    if (!draftBanner) return;
    navigate({ to: "/dashboard/new", search: { id: draftBanner.productId } });
  }

  async function discardDraft() {
    if (!draftBanner || !user) { setDraftBanner(null); return; }
    await supabase
      .from("marketplace_products")
      .delete()
      .eq("id", draftBanner.productId)
      .eq("seller_id", user.id);
    setDraftBanner(null);
    toast.success("Draft discarded.");
  }

  // Auto-save the current form state to the DB as a draft.
  // Used after a successful upload and on a 2s debounce for field changes.
  const autosavingRef = useRef(false);
  const [autosaving, setAutosaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  type AutosaveKind = "cover" | "manuscript" | "metadata";
  const [autosaveErrors, setAutosaveErrors] = useState<Record<AutosaveKind, string | null>>({
    cover: null,
    manuscript: null,
    metadata: null,
  });
  const [autosavingKind, setAutosavingKind] = useState<AutosaveKind | null>(null);
  const lastAutosaveOptsRef = useRef<Record<AutosaveKind, {
    coverUrl?: string | null;
    filePath?: string | null;
    fileSize?: number | null;
  } | undefined>>({ cover: undefined, manuscript: undefined, metadata: undefined });

  function classifyKind(opts?: { coverUrl?: string | null; filePath?: string | null }): AutosaveKind {
    if (opts?.coverUrl !== undefined) return "cover";
    if (opts?.filePath !== undefined) return "manuscript";
    return "metadata";
  }

  async function autosaveDraftToDB(opts?: {
    coverUrl?: string | null;
    filePath?: string | null;
    fileSize?: number | null;
    silent?: boolean;
  }) {
    if (!user || autosavingRef.current) return;
    if (!title.trim()) return; // need at least a title
    const kind = classifyKind(opts);
    const { silent, ...persistedOpts } = opts ?? {};
    void silent;
    lastAutosaveOptsRef.current[kind] = persistedOpts;
    autosavingRef.current = true;
    setAutosaving(true);
    setAutosavingKind(kind);
    try {
      const priceCents = Math.round((parseFloat(price || "0") || 0) * 100);
      const notes = JSON.stringify({
        seriesName: seriesName || null, edition: edition || null,
        whatsIncluded: whatsIncluded || null,
        keywords, ageRange, ownsRights, drm, premium, territory: "Worldwide",
      });
      const payload = {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        description: description.trim(),
        creator_name: author.trim(),
        language, category,
        price_cents: priceCents,
        cover_url: opts?.coverUrl ?? uploadedCoverUrl ?? existingCoverUrl,
        file_path: opts?.filePath ?? uploadedFilePath ?? existingFilePath,
        ...(opts?.fileSize != null ? { file_size_bytes: opts.fileSize } : {}),
        status: "draft" as const,
        published: false,
        admin_notes: notes,
        preview_pages: previewPages,
      };
      const targetId = draftProductId ?? editingId;
      if (targetId) {
        const { error } = await supabase.from("marketplace_products").update(payload).eq("id", targetId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("marketplace_products")
          .insert({ ...payload, seller_id: user.id })
          .select("id")
          .single();
        if (error) throw error;
        if (data?.id) setDraftProductId(data.id as string);
      }
      setLastSavedAt(Date.now());
      setDbUpdatedAt(new Date().toISOString());
      setAutosaveErrors((prev) => (prev[kind] ? { ...prev, [kind]: null } : prev));
      if (!opts?.silent) {
        toast.success("Progress saved", { duration: 2000 });
      }
    } catch (e) {
      console.error(`Autosave failed (${kind})`, e);
      const msg =
        e instanceof Error && e.message
          ? e.message
          : typeof e === "object" && e && "message" in e && typeof (e as { message?: unknown }).message === "string"
            ? (e as { message: string }).message
            : "We couldn't save this change. Check your connection and retry.";
      setAutosaveErrors((prev) => ({ ...prev, [kind]: msg }));
      if (!opts?.silent) {
        const label = kind === "cover" ? "cover" : kind === "manuscript" ? "manuscript" : "draft";
        toast.error(`Couldn't save ${label}`, { description: msg, duration: 4000 });
      }
    } finally {
      autosavingRef.current = false;
      setAutosaving(false);
      setAutosavingKind(null);
    }
  }

  async function retryAutosaveKind(kind: AutosaveKind) {
    setAutosaveErrors((prev) => ({ ...prev, [kind]: null }));
    const opts = lastAutosaveOptsRef.current[kind];
    await autosaveDraftToDB({ ...(opts ?? {}), silent: false });
  }



  // Debounced auto-save on any field change (2s)
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => {
      // Only autosave if there's enough content to bother
      if (!title.trim()) return;
      autosaveDraftToDB({ silent: true });
    }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user, title, subtitle, author, seriesName, edition, whatsIncluded, description,
    language, category, keywords, ageRange, ownsRights, drm, premium, price, previewPages,
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
      setAuthor(data.creator_name ?? "Delvin Hale");
      setDescription(data.description ?? "");
      setLanguage(data.language ?? "English");
      setCategory((data.category as typeof CATEGORIES[number]["value"]) ?? "ebooks");
      setEditProductTypeKey(getProductTypeKeyByCategory(data.category as string));
      setPrice(((data.price_cents ?? 0) / 100).toString());

      setExistingCoverUrl(data.cover_url ?? null);
      setExistingFilePath(data.file_path ?? null);
      const rowPreview = (data as unknown as { preview_pages?: number[] | null }).preview_pages;
      if (Array.isArray(rowPreview)) setPreviewPages(rowPreview.filter((n) => typeof n === "number"));
      setDbUpdatedAt((data.updated_at as string | null) ?? null);
      // Hydrate "uploaded" state so the confirmation bars persist on refresh
      if (data.cover_url) setUploadedCoverUrl(data.cover_url as string);
      if (data.file_path) {
        const rawName = (data.file_path as string).split("/").pop() ?? "manuscript";
        const cleanName = rawName.replace(/^\d+-/, "");
        setUploadedFilePath(data.file_path as string);
        setUploadedFileMeta({ name: cleanName, size: (data.file_size_bytes as number | null) ?? 0 });
      }
      try {
        const raw = data.admin_notes as unknown;
        const n = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (n && typeof n === "object") {
          const o = n as Record<string, unknown>;
          if (typeof o.seriesName === "string") setSeriesName(o.seriesName);
          if (typeof o.edition === "string") setEdition(o.edition);
          if (typeof o.whatsIncluded === "string") setWhatsIncluded(o.whatsIncluded);
          if (Array.isArray(o.keywords)) setKeywords(o.keywords.filter((k): k is string => typeof k === "string"));
          if (typeof o.ageRange === "string") setAgeRange(o.ageRange);
          if (typeof o.ownsRights === "boolean") setOwnsRights(o.ownsRights);
          if (typeof o.drm === "boolean") setDrm(o.drm);
          if (typeof o.premium === "boolean") setPremium(o.premium);
        }
      } catch {
        // ignore malformed admin_notes
      }
      // Resuming an existing draft / editing — autosave should target this row.
      setDraftProductId(editingId);
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

  async function sniffPdfHeader(f: File): Promise<boolean> {
    try {
      const head = new Uint8Array(await f.slice(0, 5).arrayBuffer());
      return String.fromCharCode(
        head[0] ?? 0,
        head[1] ?? 0,
        head[2] ?? 0,
        head[3] ?? 0,
        head[4] ?? 0,
      ) === "%PDF-";
    } catch {
      return false;
    }
  }

  async function inferAllowedUploadExt(f: File): Promise<string> {
    const nameExt = f.name.toLowerCase().split(".").pop() ?? "";
    if (typeCfg.fileExts.includes(nameExt)) return nameExt;
    if (typeCfg.fileExts.includes("pdf")) {
      if (await sniffPdfHeader(f)) return "pdf";
    }
    return nameExt;
  }

  function safeStoredFileName(f: File, inferredExt?: string): string {
    const base = (f.name.trim() || "manuscript").replace(/[^a-zA-Z0-9.-]/g, "_");
    if (inferredExt && !base.toLowerCase().endsWith(`.${inferredExt}`)) {
      return `${base}.${inferredExt}`;
    }
    return base;
  }

  function handleCoverChange(f: File | null) {
    setCoverError(null);
    setCoverUploadError(null);
    setUploadedCoverUrl(null);
    setCoverProgress(0);
    if (!f) { setCover(null); return; }
    if (!["image/jpeg", "image/png"].includes(f.type)) return setCoverError("Cover must be JPG or PNG.");
    if (f.size > MAX_COVER_MB * 1024 * 1024) return setCoverError(`Cover must be under ${MAX_COVER_MB} MB.`);
    setCover(f);
  }

  async function handleFileChange(f: File | null) {
    setFileError(null);
    setFileUploadError(null);
    setUploadedFilePath(null);
    setUploadedFileMeta(null);
    setFileProgress(0);
    if (!f) { setFile(null); return; }
    if (f.size === 0) {
      const msg = "[EMPTY_FILE] File is empty (0 bytes). Pick the actual document, not a placeholder or shortcut.";
      toast.error("Upload rejected — empty file", { description: msg });
      return setFileError(msg);
    }
    const ext = await inferAllowedUploadExt(f);
    if (!typeCfg.fileExts.includes(ext)) {
      const nameExt = f.name.toLowerCase().split(".").pop() ?? "";
      const isPdfType = typeCfg.fileExts.includes("pdf");
      const looksMissingExt = isPdfType && (!nameExt || nameExt === f.name.toLowerCase() || !nameExt.match(/^[a-z0-9]{2,4}$/));
      const msg = looksMissingExt
        ? `[BAD_PDF_HEADER] We couldn't detect a valid %PDF- header in "${f.name}". The bytes don't look like a PDF — make sure you're picking the .pdf file itself (not a .zip, screenshot, or shortcut).`
        : `[UNSUPPORTED_TYPE] Detected ".${ext || "unknown"}" but this product accepts: ${typeCfg.acceptedHint}.`;
      toast.error(looksMissingExt ? "Upload rejected — invalid PDF bytes" : "Upload rejected — unsupported type", { description: msg, duration: 6000 });
      return setFileError(msg);
    }
    // NOTE: We intentionally do NOT enforce f.type against fileMimes here.
    // Mobile browsers (Android Chrome especially) frequently report .docx as
    // "application/octet-stream" or an empty string, which caused valid Word
    // documents to be rejected on the AI Prompt Pack upload. The extension
    // check above plus the structural validation below (for ebooks) is a
    // safer, more reliable signal than the browser-supplied MIME.
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      const msg = `[TOO_LARGE] File exceeds the ${MAX_FILE_MB} MB limit (yours is ${(f.size / 1024 / 1024).toFixed(1)} MB). Compress or split the file and try again.`;
      toast.error("Upload rejected — file too large", { description: msg, duration: 6000 });
      return setFileError(msg);
    }
    // Structural validation is only meaningful for ebook manuscripts (pdf/epub/docx).
    // For other product types, skip the deep validation to allow zip/mp3/mp4/etc.
    try {
      if (typeCfg.isEbook) {
        const { validateManuscriptFile } = await import("@/lib/manuscript-validate");
        const res = await validateManuscriptFile(f);
        if (!res.ok) {
          const isPdf = ext === "pdf";
          const code = /header/i.test(res.reason)
            ? "BAD_PDF_HEADER"
            : /EOF|truncat/i.test(res.reason)
              ? "PDF_TRUNCATED"
              : /signature/i.test(res.reason)
                ? "BAD_ZIP_SIGNATURE"
                : /corrupt/i.test(res.reason)
                  ? "ARCHIVE_CORRUPT"
                  : /missing/i.test(res.reason)
                    ? "MISSING_INTERNAL_PART"
                    : "STRUCT_INVALID";
          const title = isPdf ? "Upload rejected — invalid PDF bytes" : "Upload rejected — invalid manuscript structure";
          const description = `[${code}] ${res.reason} If the file opens correctly on your device, re-save or re-export it and try again.`;
          toast.error(title, { description, duration: 8000 });
          return setFileError(description);
        }
      }
    } catch (e) {
      const msg = `[READ_ERROR] Couldn't read the file bytes (${(e as Error).message}). The browser may have released the file — re-select it from the picker.`;
      toast.error("Upload rejected — couldn't read file", { description: msg, duration: 8000 });
      return setFileError(msg);
    }
    setFile(f);
    // Kick off the upload immediately so each zone operates independently.
    void uploadManuscript(f, ext);
  }

  // Upload helpers — independent per-zone uploads triggered on file select.
  // Automatic retry with exponential backoff (up to 3 attempts) before
  // surfacing the manual Retry banner.
  const MAX_AUTO_ATTEMPTS = 3;
  function friendlyUploadError(e: unknown, label: string): string {
    const raw = e instanceof Error ? e.message : String(e ?? "");
    // Attempt to surface an HTTP-ish status if the error object carries one.
    const status = (typeof e === "object" && e && "statusCode" in e ? (e as { statusCode?: unknown }).statusCode : undefined)
      ?? (typeof e === "object" && e && "status" in e ? (e as { status?: unknown }).status : undefined);
    const statusStr = status !== undefined ? ` (HTTP ${String(status)})` : "";
    if (/network|fetch|failed to fetch|load failed|networkerror/i.test(raw))
      return `[NETWORK] ${label} couldn't reach the server${statusStr}. Your connection dropped mid-upload — check signal/Wi-Fi and tap Retry.`;
    if (/timeout|timed out/i.test(raw))
      return `[TIMEOUT] ${label} timed out${statusStr}. The upload took too long — tap Retry, ideally on a stronger connection.`;
    if (/payload|too large|413/i.test(raw))
      return `[SERVER_413] ${label} was rejected by the server as too large${statusStr}. Try a smaller file.`;
    if (/unauthor|401|403|jwt|expired/i.test(raw))
      return `[AUTH_LOST] ${label} was rejected — your session expired or was invalidated${statusStr}. Sign out and back in, then retry.`;
    if (/duplicate|already exists|conflict|409/i.test(raw))
      return `[STORAGE_CONFLICT] ${label} storage path already exists${statusStr}. Tap Retry to generate a new path.`;
    if (/bucket|not found|404/i.test(raw))
      return `[STORAGE_ROUTE] ${label} storage bucket route failed${statusStr}. This usually means the server rejected the path — tap Retry.`;
    if (/5\d\d|server error/i.test(raw))
      return `[SERVER_5XX] ${label} server error${statusStr}. Tap Retry; if it keeps failing the storage service may be down.`;
    return `[UPLOAD_FAILED] ${raw || `${label} failed for an unknown reason`}${statusStr}. Tap Retry to try again.`;
  }
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function uploadCoverNow(f: File) {
    if (!user) return;
    setCoverUploading(true); setCoverProgress(8); setCoverUploadError(null);
    const tick = setInterval(() => setCoverProgress((p) => (p < 88 ? p + 6 : p)), 250);
    let lastErr: unknown = null;
    try {
      for (let attempt = 1; attempt <= MAX_AUTO_ATTEMPTS; attempt++) {
        try {
          const ts = Date.now();
          const coverPath = `${user.id}/${ts}-${f.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
          const up = await supabase.storage.from("product-covers").upload(coverPath, f, { upsert: false });
          if (up.error) throw up.error;
          const { data: signed } = await supabase.storage.from("product-covers")
            .createSignedUrl(coverPath, 60 * 60 * 24 * 365 * 5);
          const url = signed?.signedUrl ?? null;
          setUploadedCoverUrl(url);
          setCoverProgress(100);
          setCoverUploadError(null);
          await autosaveDraftToDB({ coverUrl: url, silent: true });
          toast.success("Cover saved to your draft ✓", { duration: 3000 });
          return;
        } catch (e) {
          lastErr = e;
          if (attempt < MAX_AUTO_ATTEMPTS) {
            setCoverUploadError(`${friendlyUploadError(e, "Cover")} Auto-retrying (${attempt}/${MAX_AUTO_ATTEMPTS - 1})…`);
            await sleep(600 * Math.pow(2, attempt - 1));
            setCoverProgress(8);
          }
        }
      }
      setCoverUploadError(friendlyUploadError(lastErr, "Cover"));
    } finally {
      clearInterval(tick);
      setCoverUploading(false);
    }
  }

  async function uploadManuscript(f: File, extHint?: string) {
    if (!user) return;
    setFileUploading(true); setFileProgress(8); setFileUploadError(null);
    const tick = setInterval(() => setFileProgress((p) => (p < 88 ? p + 4 : p)), 300);
    let lastErr: unknown = null;
    try {
      for (let attempt = 1; attempt <= MAX_AUTO_ATTEMPTS; attempt++) {
        try {
          const ts = Date.now();
          const ext = extHint ?? await inferAllowedUploadExt(f);
          const path = `${user.id}/${ts}-${safeStoredFileName(f, ext)}`;
          const up = await supabase.storage.from("product-files").upload(path, f, { upsert: false });
          if (up.error) throw up.error;
          setUploadedFilePath(path);
          setUploadedFileMeta({ name: f.name, size: f.size });
          setFileProgress(100);
          setFileUploadError(null);
          await autosaveDraftToDB({ filePath: path, fileSize: f.size, silent: true });
          toast.success("Manuscript saved to your draft ✓", { duration: 3000 });
          return;
        } catch (e) {
          lastErr = e;
          if (attempt < MAX_AUTO_ATTEMPTS) {
            setFileUploadError(`${friendlyUploadError(e, "Manuscript")} Auto-retrying (${attempt}/${MAX_AUTO_ATTEMPTS - 1})…`);
            await sleep(800 * Math.pow(2, attempt - 1));
            setFileProgress(8);
          }
        }
      }
      const finalMsg = friendlyUploadError(lastErr, "Manuscript");
      setFileUploadError(finalMsg);
      toast.error("Manuscript upload failed", { description: finalMsg, duration: 8000 });
    } finally {
      clearInterval(tick);
      setFileUploading(false);
    }
  }

  // Trigger cover upload once the image has been validated (dims OK, no error)
  useEffect(() => {
    if (!cover) return;
    if (coverError || coverChecking || !coverDims) return;
    if (uploadedCoverUrl || coverUploading) return;
    void uploadCoverNow(cover);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cover, coverError, coverChecking, coverDims]);


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
  const step3Valid = isListPriceValid(price);

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
    if (step === 3 && !step3Valid) {
      toast.error("Enter a price greater than $0.00.");
      const el = document.getElementById("list-price-input") as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
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


  /**
   * Post-publish verification: re-reads the row from the DB and, for brand-new
   * publishes that land as `approved`, confirms it also shows up in the
   * storefront list query. Retries briefly to smooth over read-after-write
   * lag on the Data API. Returns { ok: true } only when the row is actually
   * live/visible as expected.
   */
  async function verifyPublished(
    id: string,
    publish: boolean,
  ): Promise<{ ok: boolean; reason?: string }> {
    const expectedStatus: "approved" | "pending" = isEditing && !bypassReview ? "pending" : "approved";
    const attempts = 5;
    for (let i = 0; i < attempts; i++) {
      const { data: row, error } = await supabase
        .from("marketplace_products")
        .select("id, published, status")
        .eq("id", id)
        .maybeSingle();
      if (error) return { ok: false, reason: error.message };
      if (row && row.published === publish && row.status === expectedStatus) {
        // For brand-new approved titles, also confirm storefront visibility.
        if (publish && expectedStatus === "approved") {
          const { data: listed, error: listErr } = await supabase
            .from("marketplace_products")
            .select("id")
            .eq("id", id)
            .eq("published", true)
            .eq("status", "approved")
            .maybeSingle();
          if (listErr) return { ok: false, reason: listErr.message };
          if (!listed) {
            await new Promise((r) => setTimeout(r, 400));
            continue;
          }
        }
        return { ok: true };
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    return { ok: false, reason: "storefront did not reflect the change in time" };
  }

  async function uploadAndSave(publish: boolean) {

    if (!user) return;
    // For publish we require everything. For drafts (publish=false) allow
    // partial data — the bookshelf can resume the title later.
    if (publish && !isEditing && (!cover || !file)) return;

    setLastPublishAttempt(publish);
    // Only reset the per-asset error for assets we're actually about to
    // attempt — preserves the other asset's error/success state.
    const willUploadCover = !!cover && !uploadedCoverUrl;
    const willUploadFile = !!file && !uploadedFilePath;
    if (willUploadCover) setCoverUploadError(null);
    if (willUploadFile) setFileUploadError(null);
    setSubmitting(true); setUploading(true); setUploadProgress(5);
    try {
      const ts = Date.now();
      let coverUrl: string | null = uploadedCoverUrl ?? existingCoverUrl;
      let storedFilePath: string | null = uploadedFilePath ?? existingFilePath;
      let fileSize: number | undefined;

      if (willUploadCover && cover) {
        try {
          const coverPath = `${user.id}/${ts}-${cover.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
          const coverUp = await supabase.storage.from("product-covers").upload(coverPath, cover, { upsert: false });
          if (coverUp.error) throw coverUp.error;
          const { data: signed } = await supabase.storage.from("product-covers")
            .createSignedUrl(coverPath, 60 * 60 * 24 * 365 * 5);
          coverUrl = signed?.signedUrl ?? null;
          setUploadedCoverUrl(coverUrl);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Cover upload failed. Check your connection and try again.";
          setCoverUploadError(msg);
          throw e;
        }
      }
      setUploadProgress(40);

      if (willUploadFile && file) {
        const newFilePath = `${user.id}/${ts}-${safeStoredFileName(file, await inferAllowedUploadExt(file))}`;
        const t = setInterval(() => setUploadProgress((p) => (p < 90 ? p + 3 : p)), 400);
        try {
          const fileUp = await supabase.storage.from("product-files").upload(newFilePath, file, { upsert: false });
          if (fileUp.error) throw fileUp.error;
          storedFilePath = newFilePath;
          fileSize = file.size;
          setUploadedFilePath(newFilePath);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Manuscript upload failed. Check your connection and try again.";
          setFileUploadError(msg);
          throw e;
        } finally {
          clearInterval(t);
        }
      }
      setUploadProgress(95);

      // Server-side manuscript integrity gate. Defense-in-depth against
      // stale/bypassed client validation: re-open the stored file in the
      // Worker and confirm it's a well-formed .docx/.epub/.pdf before we
      // let the row go live. Draft saves skip the gate.
      if (publish && storedFilePath) {
        try {
          const { validateStoredManuscript } = await import("@/lib/manuscript-validate.functions");
          const check = await validateStoredManuscript({ data: { filePath: storedFilePath } });
          if (!check.ok) {
            setFileError(check.reason);
            setFileUploadError(check.reason);
            toast.error(`Manuscript rejected: ${check.reason}`);
            throw new Error(check.reason);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Manuscript validation failed.";
          setFileError(msg);
          throw e;
        }
      }

      const priceCents = Math.round(priceNum * 100);
      const status: "draft" | "approved" | "pending" = publish ? (isEditing && !bypassReview ? "pending" : "approved") : "draft";
      const notes = JSON.stringify({
        seriesName: seriesName || null,
        edition: edition || null,
        whatsIncluded: whatsIncluded || null,
        keywords,
        ageRange,
        ownsRights, drm, premium, territory,
      });

      const existingRowId = editingId ?? draftProductId;
      let savedId: string | null = existingRowId;
      if (existingRowId) {
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
          preview_pages: previewPages,
          ...(publish && status === "approved" ? { approved_at: new Date().toISOString() } : {}),
          ...(fileSize !== undefined ? { file_size_bytes: fileSize } : {}),
        };
        const { error } = await supabase.from("marketplace_products").update(update).eq("id", existingRowId);
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
          preview_pages: previewPages,
        }).select("id").single();
        if (error) throw error;
        savedId = inserted?.id ?? null;
      }

      setUploadProgress(100);

      if (publish) {
        if (savedId) {
          // Post-publish verification: re-fetch the row (and confirm it
          // appears in the storefront list query) before showing success.
          const verified = await verifyPublished(savedId, publish);
          if (!verified.ok) {
            toast.error(
              `Publish did not verify: ${verified.reason}. Please try again.`,
            );
            return;
          }
          runReview({ data: { productId: savedId } }).catch((err) =>
            console.error("AI review failed", err),
          );
        }
        toast.success(isEditing ? "Title updated." : "Published to the Vault!");
        setDraftProductId(null);
        setPublishedId(savedId);
        // Refresh storefront grid so the new upload appears immediately in the 2-column mobile layout
        void queryClient.invalidateQueries({ queryKey: ["mp", "products"] });
        void queryClient.invalidateQueries({ queryKey: ["mp"] });
      } else {
        toast.success("Draft saved.");

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
        <SuccessScreen productId={publishedId} title={title} accent={accent} cover={coverPreview ?? existingCoverUrl} price={priceNum} />
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
          : "A KDP-style flow. AurumVault keeps 30%; you keep 70%."}
      </p>

      {!isEditing && productTypeKey && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-ink/10 bg-paper px-3 py-1.5 text-sm text-navy">
          <span aria-hidden="true">{typeCfg.emoji}</span>
          <span className="font-semibold">{typeCfg.label}</span>
          <span className="text-mute text-xs hidden sm:inline">· {typeCfg.tagline}</span>
        </div>
      )}

      {loadingEdit && (
        <p className="mt-2 text-xs text-mute">Loading title…</p>
      )}

      {canSell === false && (
        <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
          You're not an approved seller yet. <Link to="/sell" className="underline font-medium">Apply to sell</Link> first.
        </div>
      )}

      {draftBanner && !isEditing && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Save size={16} className="shrink-0" />
          <span className="flex-1">
            You have an unsaved draft from{" "}
            <strong>{new Date(draftBanner.savedAt).toLocaleString()}</strong> — continue where you left off?
          </span>
          <button
            type="button" onClick={resumeDraft}
            className="rounded-full bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 text-xs font-semibold"
          >
            Resume
          </button>
          <button
            type="button" onClick={discardDraft}
            className="rounded-full border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 px-4 py-1.5 text-xs font-semibold"
          >
            Start Fresh
          </button>
        </div>
      )}



      {(autosaveErrors.cover || autosaveErrors.manuscript || autosaveErrors.metadata) && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-red-300 bg-red-50 p-3 sm:p-4 space-y-2"
        >
          <div className="flex items-start gap-2">
            <AlertCircle size={18} className="text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm font-semibold text-red-800">
              Some changes didn't save — your progress is still here
            </p>
          </div>
          <ul className="space-y-2 pl-6">
            {(["cover", "manuscript", "metadata"] as const).map((kind) => {
              const err = autosaveErrors[kind];
              if (!err) return null;
              const label =
                kind === "cover" ? "Cover link" :
                kind === "manuscript" ? "Manuscript link" :
                "Details (title, description, price)";
              const isRetrying = autosavingKind === kind;
              return (
                <li key={kind} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-red-800">{label}</p>
                    <p className="text-xs text-red-700/90 break-words">{err}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => retryAutosaveKind(kind)}
                      disabled={autosaving}
                      className="inline-flex items-center gap-1.5 rounded-full bg-red-700 text-white text-xs font-semibold px-3 py-1.5 hover:bg-red-800 disabled:opacity-60 disabled:cursor-not-allowed"
                      aria-busy={isRetrying}
                      aria-label={`Retry saving ${label}`}
                    >
                      {isRetrying ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      {isRetrying ? "Retrying…" : "Retry"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAutosaveErrors((prev) => ({ ...prev, [kind]: null }))
                      }
                      className="text-red-700 hover:text-red-900 rounded-full p-1"
                      aria-label={`Dismiss ${label} error`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <StepperBar step={step} step1Label={typeCfg.isEbook ? "Book Details" : `${typeCfg.label} Details`} />
        <div aria-live="polite" className="hidden sm:flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mute min-h-[20px]">
          {(["metadata", "cover", "manuscript"] as const).map((kind) => {
            const err = autosaveErrors[kind];
            const busy = autosavingKind === kind;
            const label = kind === "cover" ? "Cover" : kind === "manuscript" ? "Manuscript" : "Details";
            if (busy) {
              return (
                <span key={kind} className="inline-flex items-center gap-1">
                  <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                  <span>Saving {label.toLowerCase()}…</span>
                </span>
              );
            }
            if (err) {
              return (
                <span key={kind} className="inline-flex items-center gap-1 text-red-700">
                  <AlertCircle size={12} aria-hidden="true" />
                  <span>{label} not saved</span>
                </span>
              );
            }
            return null;
          })}
          {!autosaving &&
            !autosaveErrors.cover && !autosaveErrors.manuscript && !autosaveErrors.metadata &&
            lastSavedAt && (
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-600" aria-hidden="true" />
                <span>Draft saved</span>
              </span>
            )}
        </div>
      </div>




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
              whatsIncluded={whatsIncluded} setWhatsIncluded={setWhatsIncluded}
              isEbook={typeCfg.isEbook}
              productLabel={typeCfg.label}
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
              onZoomCover={() => setCoverLightbox(true)}
              existingCoverUrl={existingCoverUrl}
              existingFilePath={existingFilePath}
              coverUploadError={coverUploadError}
              fileUploadError={fileUploadError}
              onRetryCover={() => { if (cover) void uploadCoverNow(cover); }}
              onRetryFile={() => { if (file) void uploadManuscript(file); }}
              retryDisabled={coverUploading || fileUploading}
              coverUploading={coverUploading} coverProgress={coverProgress}
              fileUploading={fileUploading} fileProgress={fileProgress}
              uploadedCoverUrl={uploadedCoverUrl}
              uploadedFilePath={uploadedFilePath}
              uploadedFileMeta={uploadedFileMeta}
              title={title}
              typeCfg={typeCfg}
              productTypeKey={productTypeKey}
              previewPages={previewPages}
              setPreviewPages={setPreviewPages}
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
              format={typeCfg.categoryLabel} territory={territory}
              category={category}
              uploading={uploading} uploadProgress={uploadProgress}
              submitting={submitting} disabled={canSell === false}
              autosaving={autosaving}
              checklist={checklist} checklistPass={checklistPass}
              onGoToStep={(s: StepNum) => setStep(s)}
              onDraft={() => uploadAndSave(false)}
              onPublish={() => uploadAndSave(true)}
              onZoomCover={() => setCoverLightbox(true)}
              onOpenPreview={() => setShowPreview(true)}
              isEditing={isEditing}
              lastUpdatedAt={dbUpdatedAt}
              onCancel={() => navigate({ to: "/dashboard" })}
              isAdmin={isAdmin}
              adminInstantApprove={adminInstantApprove}
              onToggleAdminInstantApprove={setAdminInstantApprove}
            />
          )}


          {step < 4 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 mt-8 pt-5 border-t border-ink/10">
              <button
                type="button" disabled={step === 1}
                onClick={() => setStep((step - 1) as StepNum)}
                className="h-11 px-5 rounded-full text-navy font-medium hover:bg-ink/5 disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                <ArrowLeft size={16} /> Back
              </button>
              <div className="flex gap-2 ml-auto">
                <button
                  type="button" onClick={() => uploadAndSave(false)} disabled={submitting || autosaving || !title.trim()}
                  className="h-11 px-5 rounded-full border border-navy/20 text-navy font-semibold hover:bg-navy/5 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={autosaving ? "Saving in progress…" : "Save progress as a draft in your bookshelf"}
                  aria-busy={submitting || autosaving}
                >
                  {submitting || autosaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {submitting ? "Saving…" : autosaving ? "Saving…" : "Save Progress"}
                </button>
                <button
                  type="button" onClick={next}
                  disabled={submitting || autosaving}
                  className="h-11 px-6 rounded-full text-white font-semibold inline-flex items-center gap-1.5 transition-colors duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: accent.color }}
                  aria-busy={submitting || autosaving}
                >
                  {autosaving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <>Continue <ArrowRight size={16} /></>}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex items-center justify-between">
              <button onClick={() => setStep(3)} disabled={submitting} className="text-sm text-mute hover:text-navy inline-flex items-center gap-1.5 disabled:opacity-50">
                <ArrowLeft size={14} /> Back to pricing
              </button>
              <button
                type="button" onClick={() => uploadAndSave(false)} disabled={submitting || autosaving || !title.trim()}
                className="h-10 px-4 rounded-full border border-navy/20 text-navy text-sm font-semibold hover:bg-navy/5 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-busy={submitting || autosaving}
              >
                {submitting || autosaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {submitting ? "Saving…" : autosaving ? "Saving…" : "Save Progress"}
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
      {showPreview && (
        <PrePublishPreview
          accent={accent}
          onClose={() => setShowPreview(false)}
          onGoToStep={(s: StepNum) => { setShowPreview(false); setStep(s); }}
          onConfirm={() => { setShowPreview(false); uploadAndSave(true); }}
          checklist={checklist}
          checklistPass={checklistPass}
          submitting={submitting}
          cover={coverPreview}
          coverFullUrl={uploadedCoverUrl ?? existingCoverUrl ?? coverPreview}
          title={title} subtitle={subtitle} author={author} description={description}
          price={priceNum} royalty={royalty}
          fileName={uploadedFileMeta?.name ?? file?.name ?? (existingFilePath ? (existingFilePath.split("/").pop() ?? "Existing manuscript").replace(/^\d+-/, "") : null)}
          fileSize={uploadedFileMeta?.size ?? file?.size ?? null}
          manuscriptPath={uploadedFilePath ?? existingFilePath}
          category={category} territory={territory}
        />
      )}

      <style>{`.inp{display:block;width:100%;min-height:44px;border-radius:12px;border:1px solid rgb(0 0 0 / 0.12);padding:10px 14px;font-size:14px;background:white;color:#0F1A33;transition:border-color .2s,box-shadow .2s}.inp:focus{outline:none;border-color:var(--page-accent);box-shadow:0 0 0 3px color-mix(in oklab,var(--page-accent) 20%,transparent)}`}</style>
    </PublisherShell>
  );
}

/* ---------- Stepper ---------- */

function StepperBar({ step, step1Label = "Book Details" }: { step: StepNum; step1Label?: string }) {
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
              <span className={`text-xs font-medium ${active || done ? "text-navy" : "text-mute"}`}>{s.n === 1 ? step1Label : s.title}</span>
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
  whatsIncluded: string; setWhatsIncluded: (v: string) => void;
  isEbook: boolean;
  productLabel?: string;
  description: string; setDescription: (v: string) => void;
  language: string; setLanguage: (v: string) => void;
  category: typeof CATEGORIES[number]["value"]; setCategory: (v: typeof CATEGORIES[number]["value"]) => void;
  keywords: string[]; setKeywords: (v: string[]) => void;
  kwInput: string; setKwInput: (v: string) => void; addKeyword: () => void;
  ageRange: string; setAgeRange: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <h2 className="font-display text-2xl text-navy">{p.isEbook ? "Book details" : `${p.productLabel ?? "Product"} details`}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Title *"><input className="inp" value={p.title} onChange={(e) => p.setTitle(e.target.value)} placeholder="e.g. The Stewardship Codex" /></Field>
        <Field label="Subtitle"><input className="inp" value={p.subtitle} onChange={(e) => p.setSubtitle(e.target.value)} placeholder="A field guide" /></Field>
        <Field label="Author / Publisher *"><input className="inp" value={p.author} onChange={(e) => p.setAuthor(e.target.value)} /></Field>
        {p.isEbook && (
          <Field label="Series name"><input className="inp" value={p.seriesName} onChange={(e) => p.setSeriesName(e.target.value)} placeholder="Optional" /></Field>
        )}
        {p.isEbook && (
          <Field label="Edition"><input className="inp" value={p.edition} onChange={(e) => p.setEdition(e.target.value)} placeholder="e.g. Second Edition" /></Field>
        )}
        <Field label="Language">
          <select className="inp" value={p.language} onChange={(e) => p.setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Description *">
        <textarea
          rows={6}
          className="inp"
          value={p.description}
          maxLength={DESC_MAX}
          onChange={(e) => p.setDescription(e.target.value.slice(0, DESC_MAX))}
          placeholder={p.isEbook ? "What's in this book? Who is it for?" : `What's in this ${(p.productLabel ?? "product").toLowerCase()}? Who is it for?`}
        />
        <DescriptionCounter value={p.description} />
      </Field>

      {!p.isEbook && (
        <Field label="What's Included">
          <textarea
            rows={4}
            className="inp"
            value={p.whatsIncluded}
            onChange={(e) => p.setWhatsIncluded(e.target.value)}
            placeholder="List what files, pages, or sections this product contains. e.g. 12-month planner (PDF), habit tracker, monthly review pages"
          />
        </Field>
      )}


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
  onZoomCover: () => void;
  existingCoverUrl: string | null;
  existingFilePath: string | null;
  coverUploadError: string | null;
  fileUploadError: string | null;
  onRetryCover: () => void;
  onRetryFile: () => void;
  retryDisabled: boolean;
  coverUploading: boolean; coverProgress: number;
  fileUploading: boolean; fileProgress: number;
  uploadedCoverUrl: string | null;
  uploadedFilePath: string | null;
  uploadedFileMeta: { name: string; size: number } | null;
  title: string;
  typeCfg: import("@/lib/product-types").ProductTypeConfig;
  productTypeKey?: ProductTypeKey;
  previewPages: number[];
  setPreviewPages: (next: number[]) => void;
}) {
  const coverDone = !!p.uploadedCoverUrl && !p.coverUploading && !p.coverUploadError;
  const fileDone = !!p.uploadedFilePath && !p.fileUploading && !p.fileUploadError;
  const [previewOpen, setPreviewOpen] = useState(false);
  const manuscriptPath = p.uploadedFilePath ?? p.existingFilePath;
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
        <h3 className="font-display text-lg text-navy mb-2">{p.typeCfg.isEbook ? "Manuscript" : "Product file"}</h3>
        <p className="text-xs text-mute mb-3">Accepted: {p.typeCfg.acceptedHint}. Max {MAX_FILE_MB} MB.</p>
        {(p.fileUploading || (fileDone && (p.uploadedFileMeta || p.file))) ? (
          <div className="space-y-2">
            <UploadSuccess
              iconLabel="manuscript"
              name={p.uploadedFileMeta?.name ?? p.file?.name ?? "manuscript"}
              size={p.uploadedFileMeta?.size ?? p.file?.size ?? 0}
              onReplace={() => p.handleFileChange(null)}
              busy={p.fileUploading}
              progress={p.fileProgress}
            />

            {manuscriptPath && !p.fileUploading && (
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-navy/20 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy/5"
                aria-label="Preview manuscript"
              >
                <Eye size={14} /> Preview
              </button>
            )}
          </div>
        ) : (
          <FileInput
            file={p.file}
            onFile={p.handleFileChange}
            accept={p.typeCfg.acceptString}
            hint={p.typeCfg.isEbook ? "Drag & drop or tap to choose your manuscript" : `Drag & drop or tap to choose your ${p.typeCfg.label.toLowerCase()} file`}
            acceptedHint={p.typeCfg.acceptedHint}
          />
        )}
        {p.fileError && (
          <div className="mt-2 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{p.fileError}</span>
          </div>
        )}
        {p.fileUploadError && (
          <div role="alert" data-testid="manuscript-upload-error" className="mt-2 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Manuscript upload failed</p>
              <p className="text-xs mt-0.5 break-words">{p.fileUploadError}</p>
              <button
                type="button" onClick={p.onRetryFile} disabled={p.retryDisabled}
                data-testid="manuscript-retry-upload"
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5"
              >
                Retry upload
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview page picker — appears once a manuscript is present */}
      <div>
        <h3 className="font-display text-lg text-navy mb-1">Public preview pages</h3>
        <p className="text-xs text-mute mb-3">
          Pick up to 5 pages buyers can preview on your product page. Each
          preview page is watermarked ("AURUMVAULT PREVIEW — NOT FOR
          DISTRIBUTION") before it's shown, so screenshots can't replace the
          real file.
        </p>
        <PreviewPagePicker
          filePath={p.uploadedFilePath ?? p.existingFilePath}
          fileName={p.uploadedFileMeta?.name ?? p.file?.name ?? null}
          fileSize={p.uploadedFileMeta?.size ?? p.file?.size ?? null}
          value={p.previewPages}
          onChange={p.setPreviewPages}
          productTypeKey={p.productTypeKey}
          isReflowFormat={(() => {
            const path = p.uploadedFilePath ?? p.existingFilePath ?? "";
            const name = p.uploadedFileMeta?.name ?? p.file?.name ?? "";
            const extFrom = (source: string) => {
              const cleaned = source.split("#")[0].split("?")[0];
              return cleaned.includes(".") ? cleaned.split(".").pop()?.toLowerCase() : undefined;
            };
            const exts = [extFrom(name), extFrom(path)];
            return !exts.includes("pdf") && exts.some((e) => e === "docx" || e === "epub");
          })()}
        />
      </div>

      <div>
        <h3 className="font-display text-lg text-navy mb-2">Cover</h3>
        <p className="text-xs text-mute mb-3">JPG or PNG, minimum 1600×2560 px (1:1.6 portrait).</p>
        <CoverInput file={p.cover} preview={p.coverPreview} onFile={p.handleCoverChange} acceptedHint="JPG, PNG" onZoom={p.onZoomCover} uploaded={coverDone} />
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
        {(p.coverUploading || coverDone) && (
          <div className="mt-3">
            <UploadSuccess
              iconLabel="cover"
              name={p.cover?.name ?? "Cover image"}
              size={p.cover?.size ?? 0}
              onReplace={() => p.handleCoverChange(null)}
              busy={p.coverUploading}
              progress={p.coverProgress}
            />
          </div>
        )}
        {p.coverUploadError && (
          <div role="alert" data-testid="cover-upload-error" className="mt-2 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Cover upload failed</p>
              <p className="text-xs mt-0.5 break-words">{p.coverUploadError}</p>
              <button
                type="button" onClick={p.onRetryCover} disabled={p.retryDisabled}
                data-testid="cover-retry-upload"
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5"
              >
                Retry upload
              </button>
            </div>
          </div>
        )}
      </div>

      {previewOpen && manuscriptPath && (
        <ManuscriptPreviewer
          manuscriptPath={manuscriptPath}
          title={p.title}
          coverUrl={p.uploadedCoverUrl ?? p.existingCoverUrl ?? p.coverPreview}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

function UploadSuccess({ iconLabel, name, size, onReplace, busy = false, progress }: { iconLabel: string; name: string; size: number; onReplace: () => void; busy?: boolean; progress?: number }) {
  const sizeLabel = size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(2)} MB` : size > 0 ? `${Math.max(1, Math.round(size / 1024))} KB` : "—";
  const pct = Math.max(0, Math.min(100, Math.round(progress ?? 0)));
  return (
    <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50/60 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700" aria-hidden="true">
          <CheckCircle2 size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-navy truncate">
            ✅ {name} — {sizeLabel} uploaded successfully.
          </p>
          <p className="text-xs text-mute tabular-nums">
            {busy ? `Uploading ${iconLabel}… ${pct}%` : `Tap Replace to swap this ${iconLabel}.`}
          </p>
        </div>
        <button
          type="button" onClick={onReplace} disabled={busy} aria-disabled={busy}
          title={busy ? `Upload in progress — ${pct}%` : undefined}
          className="shrink-0 rounded-full border border-navy/20 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy/5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
        >
          {busy ? `${pct}%` : "Replace"}
        </button>
      </div>
      {busy && (
        <div className="mt-3 h-1.5 bg-ink/10 rounded-full overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="h-full transition-all" style={{ width: `${pct}%`, background: "var(--page-accent)" }} />
        </div>
      )}
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
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute font-medium"
            aria-hidden="true"
          >
            $
          </span>
          <input
            id="list-price-input"
            type="number" min="1" step="0.01" inputMode="decimal"
            value={price} onChange={(e) => setPrice(e.target.value)}
            className="inp" style={{ paddingLeft: 28 }} placeholder="9.99"
          />
        </div>
        {(!price || parseFloat(price) <= 0) && (
          <p className="mt-2 text-sm text-red-600">Enter a list price greater than $0.00 to continue.</p>
        )}
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

function StepReview({ accent, cover, title, subtitle, author, price, royalty, format, territory, category, uploading, uploadProgress, submitting, disabled, autosaving, checklist, checklistPass, onGoToStep, onDraft, onPublish, onZoomCover, onOpenPreview, isEditing, lastUpdatedAt, onCancel, isAdmin, adminInstantApprove, onToggleAdminInstantApprove }: {
  accent: PublisherAccent;
  cover: string | null; title: string; subtitle: string; author: string;
  price: number; royalty: number; format: string; territory: string;
  category: string;
  uploading: boolean; uploadProgress: number; submitting: boolean; disabled: boolean;
  autosaving: boolean;
  checklist: Array<{ id: string; label: string; ok: boolean; gotoStep: StepNum }>;
  checklistPass: boolean;
  onGoToStep: (s: StepNum) => void;
  onDraft: () => void; onPublish: () => void; onZoomCover: () => void;
  onOpenPreview: () => void;
  isEditing?: boolean;
  lastUpdatedAt?: string | null;
  onCancel?: () => void;
  isAdmin?: boolean;
  adminInstantApprove?: boolean;
  onToggleAdminInstantApprove?: (next: boolean) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl text-navy">{isEditing ? "Review & update" : "Review & publish"}</h2>
        {isEditing && lastUpdatedAt && (
          <span className="text-xs text-mute">Last updated {new Date(lastUpdatedAt).toLocaleString()}</span>
        )}
      </div>

      <button
        type="button" onClick={onOpenPreview}
        disabled={submitting || autosaving}
        className="w-full h-12 rounded-full font-semibold inline-flex items-center justify-center gap-2 text-white shadow-md hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: accent.color }}
        aria-busy={submitting || autosaving}
      >
        {autosaving ? <><Loader2 size={16} className="animate-spin" /> Saving draft…</> : <><Eye size={16} /> Preview Your Listing</>}
      </button>

      {/* KDP-style storefront preview card */}
      <div className="rounded-2xl border border-ink/10 bg-gradient-to-br from-paper to-white p-5">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-mute">
          Preview — This is how your product will appear in the Vault
        </p>
        <div className="mt-4 mx-auto max-w-[260px]">
          <div className="rounded-xl bg-white border border-ink/10 shadow-sm overflow-hidden">
            <button type="button" onClick={onZoomCover} className="block w-full aspect-[1/1.6] bg-gradient-to-br from-navy to-[#22335A] overflow-hidden">
              <CoverThumb
                src={cover}
                title={title}
                alt={`Cover for ${title || "untitled"}`}
                imgClassName="w-full h-full object-cover"
                fallbackClassName="w-full h-full flex items-center justify-center text-white/60 text-[11px] px-3 text-center"
              />
            </button>
            <div className="p-3">
              <span className="inline-block text-[10px] uppercase tracking-wider font-semibold rounded-full px-2 py-0.5"
                style={{ background: `${accent.color}22`, color: accent.color }}>
                {category}
              </span>
              <p className="mt-1.5 font-display text-base text-navy leading-tight line-clamp-2">{title || "Untitled"}</p>
              <p className="text-xs text-mute mt-0.5 truncate">by {author || "—"}</p>
              <div className="mt-1.5 flex items-center gap-0.5" aria-label="0 of 5 stars, no reviews yet">
                {[0,1,2,3,4].map((i) => (
                  <svg key={i} viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-ink/15"><path d="M12 17.3 5.8 21l1.6-7L2 9.3l7.1-.6L12 2l2.9 6.7 7.1.6-5.4 4.7 1.6 7z"/></svg>
                ))}
                <span className="ml-1 text-[10px] text-mute">(0)</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="font-mono text-navy font-semibold">${price.toFixed(2)}</span>
                <button type="button" disabled className="text-[11px] rounded-full bg-ink/10 text-mute px-3 py-1.5 cursor-not-allowed">Add to Cart</button>
              </div>
            </div>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-y-1.5 text-xs text-mute max-w-md mx-auto">
          <dt>Format</dt><dd className="text-navy text-right">{format}</dd>
          <dt>List price</dt><dd className="text-navy font-mono text-right">${price.toFixed(2)}</dd>
          <dt>Your royalty</dt><dd className="text-navy font-mono text-right">${royalty.toFixed(2)}</dd>
          <dt>Territory</dt><dd className="text-navy text-right">{territory}</dd>
        </dl>
      </div>

      {/* Pre-publish checklist */}
      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-mute">Pre-publish checklist</p>
        <ul className="mt-3 space-y-2">
          {checklist.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm">
              {c.ok ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" aria-hidden="true" />
              ) : (
                <AlertCircle size={16} className="text-red-600 shrink-0" aria-hidden="true" />
              )}
              <span className={c.ok ? "text-navy" : "text-red-700 font-medium"}>{c.label}</span>
              {!c.ok && (
                <button
                  type="button" onClick={() => onGoToStep(c.gotoStep)}
                  className="ml-auto text-xs text-red-700 underline hover:no-underline"
                >
                  Fix this →
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {uploading && (
        <div>
          <div className="flex justify-between text-xs text-mute mb-1"><span>Publishing…</span><span>{uploadProgress}%</span></div>
          <div className="h-2 bg-ink/10 rounded-full overflow-hidden">
            <div className="h-full transition-all" style={{ width: `${uploadProgress}%`, background: accent.color }} />
          </div>
        </div>
      )}

      {isAdmin && isEditing && onToggleAdminInstantApprove && (
        <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-amber-600"
            checked={!!adminInstantApprove}
            onChange={(e) => onToggleAdminInstantApprove(e.target.checked)}
          />
          <span className="text-sm">
            <span className="block font-semibold text-amber-900">
              Admin: skip review on update
            </span>
            <span className="block text-amber-800/80 text-xs mt-0.5">
              Publish this edit as <strong>approved</strong> immediately instead of sending it back to the 24-hour review queue. Only visible to admins.
            </span>
          </span>
        </label>
      )}


      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {isEditing && onCancel && (
          <button
            type="button" disabled={submitting} onClick={onCancel}
            className="h-12 px-5 rounded-full bg-white border border-navy/20 text-navy font-semibold hover:bg-navy/5 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            Cancel
          </button>
        )}
        <button
          type="button" disabled={submitting || autosaving || disabled} onClick={onDraft}
          className="h-12 px-5 rounded-full bg-white border border-navy/20 text-navy font-semibold hover:bg-navy/5 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          aria-busy={submitting || autosaving}
        >
          {(submitting || autosaving) && <Loader2 size={14} className="animate-spin" />}
          {autosaving ? "Saving…" : submitting ? "Saving…" : "Save as Draft"}
        </button>
        <button
          type="button" disabled={submitting || autosaving || disabled || !checklistPass} onClick={onPublish}
          className="flex-1 h-12 rounded-full text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition-colors duration-300"
          style={{ background: accent.color }}
          title={!checklistPass ? "Resolve checklist items above" : autosaving ? "Saving in progress…" : undefined}
          aria-busy={submitting}
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
          {submitting ? (isEditing ? "Updating…" : "Publishing…") : autosaving ? "Saving draft…" : (isEditing ? "Update Title" : "Publish to Vault")}
        </button>
      </div>
    </div>
  );
}


/* ---------- Success screen is imported from PublishSuccessScreen.tsx ---------- */


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

function CoverInput({ file, preview, onFile, acceptedHint, onZoom, uploaded }: { file: File | null; preview: string | null; onFile: (f: File | null) => void; acceptedHint: string; onZoom?: () => void; uploaded?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const { isOver, handlers } = useDropZone(onFile);
  const openReplace = () => {
    const el = ref.current;
    if (!el) return;
    el.value = "";
    el.click();
  };
  return (
    <div className="space-y-2">
      {preview ? (
        <>
          <input
            ref={ref}
            type="file"
            accept=".jpg,.jpeg,.png,image/png,image/jpeg"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              onFile(f);
            }}
          />
          <div className="relative rounded-xl border border-ink/10 bg-paper overflow-hidden" {...handlers}>
            <div className="relative mx-auto bg-white group" style={{ aspectRatio: "1 / 1.6", maxWidth: "300px" }}>
              <img src={preview} alt="Cover preview" className="w-full h-full object-cover shadow-lg" />
              {onZoom && (
                <button type="button" onClick={onZoom} className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-navy/80 hover:bg-navy text-white text-xs font-medium px-2.5 py-1.5 backdrop-blur" aria-label="View full size">
                  <Maximize2 size={12} /> Full size
                </button>
              )}
              {uploaded && (
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white text-[11px] font-semibold px-2 py-0.5 shadow">
                  <CheckCircle2 size={12} /> Uploaded
                </span>
              )}
            </div>

            {isOver && <div className="absolute inset-0 bg-gold/20 border-2 border-dashed border-gold rounded-xl flex items-center justify-center pointer-events-none"><span className="text-sm font-semibold text-navy">Drop to replace</span></div>}
            <div className="flex items-center justify-between px-3 py-2 bg-white border-t border-ink/10">
              <span className="text-xs text-mute truncate">{file?.name} {file ? `· ${(file.size / 1024 / 1024).toFixed(2)} MB` : ""}</span>
              <div className="flex gap-2">
                <button type="button" onClick={openReplace} className="text-xs font-medium text-navy hover:underline">Replace</button>
                <button type="button" onClick={() => onFile(null)} className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"><X size={12} />Remove</button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <label
          {...handlers}
          aria-label="Upload cover image"
          className={`relative block w-full min-h-[160px] cursor-pointer rounded-xl border-2 border-dashed px-4 py-8 text-center transition active:scale-[0.99] ${isOver ? "border-gold bg-gold/10" : "border-ink/20 bg-paper hover:border-navy/30"}`}
        >
          <div className="flex flex-col items-center justify-center gap-2">
            <ImageIcon size={28} className={isOver ? "text-gold-ink" : "text-mute"} />
            <span className="text-sm font-medium text-ink/80">{isOver ? "Drop image here" : "Tap to choose a cover"}</span>
            <span className="text-xs text-mute">Accepted: {acceptedHint}</span>
          </div>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,image/png,image/jpeg"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              onFile(f);
            }}
          />
        </label>
      )}
    </div>
  );
}

function FileInput({ file, onFile, accept, hint, acceptedHint }: { file: File | null; onFile: (f: File | null) => void; accept: string; hint: string; acceptedHint: string }) {
  const { isOver, handlers } = useDropZone(onFile);
  // Use a native <label> wrapping the <input> so tapping the drop-zone
  // opens the OS file picker from a real user gesture. Programmatic
  // input.click() is unreliable on Android Chrome Custom Tabs (opened from
  // another app / social browsers) — the picker may return but the tab
  // closes back to its parent, appearing as if upload silently failed.
  return (
    <div>
      <label
        {...handlers}
        aria-label="Upload manuscript file"
        className={`relative block w-full min-h-[160px] cursor-pointer rounded-xl border-2 border-dashed px-4 py-7 text-center transition active:scale-[0.99] ${isOver ? "border-gold bg-gold/10" : file ? "border-emerald-300 bg-emerald-50/40" : "border-ink/20 bg-paper hover:border-navy/30"}`}
      >
        <div className="flex flex-col items-center justify-center gap-2">
          {file ? <FileText size={26} className="text-emerald-700" /> : <Plus size={26} className={isOver ? "text-gold-ink" : "text-mute"} />}
          <span className="text-sm font-medium text-ink/80">{file ? file.name : isOver ? "Drop file here" : hint}</span>
          <span className="text-xs text-mute">Accepted: {acceptedHint}</span>
        </div>
        <input
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            // Reset so re-picking the same file re-fires onChange.
            e.target.value = "";
            onFile(f);
          }}
        />
      </label>
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

/* ---------- Description live counter ---------- */
function DescriptionCounter({ value }: { value: string }) {
  const len = value.length;
  const trimmed = value.trim().length;
  const tooShort = trimmed > 0 && trimmed < DESC_MIN;
  const warn = len >= DESC_WARN && len < DESC_MAX;
  const max = len >= DESC_MAX;
  const color = max ? "text-red-600" : warn ? "text-amber-700" : tooShort ? "text-amber-700" : "text-mute";
  return (
    <div className="mt-1 flex items-center justify-between text-xs">
      <span className={color}>
        {tooShort && <>{DESC_MIN - trimmed} more characters needed (min {DESC_MIN}).</>}
        {!tooShort && warn && <>Approaching limit.</>}
        {!tooShort && max && <>Maximum reached — please shorten before publishing.</>}
        {!tooShort && !warn && !max && <>Min {DESC_MIN} · Max {DESC_MAX} characters.</>}
      </span>
      <span className={`tabular-nums ${color}`}>{len} / {DESC_MAX}</span>
    </div>
  );
}

/* ---------- Resilient cover thumbnail with graceful fallback ---------- */
function CoverThumb({
  src,
  title,
  alt,
  fallbackClassName,
  imgClassName = "h-full w-full object-cover",
}: {
  src: string | null | undefined;
  title: string;
  alt: string;
  fallbackClassName?: string;
  imgClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  const showImg = !!src && !failed;
  if (showImg) {
    return (
      <img
        src={src as string}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={imgClassName}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={src ? "Cover image unavailable" : "No cover uploaded"}
      className={
        fallbackClassName ??
        "flex h-full w-full items-center justify-center px-4 text-white/70 text-xs"
      }
    >
      <span
        className="line-clamp-4 text-center text-base leading-tight"
        style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
      >
        {title || "Your cover will appear here"}
      </span>
    </div>
  );
}

/* ---------- Pre-publish preview modal ---------- */
function PrePublishPreview(props: {
  accent: PublisherAccent;
  onClose: () => void;
  onGoToStep: (s: StepNum) => void;
  onConfirm: () => void;
  checklist: Array<{ id: string; label: string; ok: boolean; gotoStep: StepNum }>;
  checklistPass: boolean;
  submitting: boolean;
  cover: string | null;
  coverFullUrl: string | null;
  title: string; subtitle: string; author: string; description: string;
  price: number; royalty: number;
  fileName: string | null; fileSize: number | null;
  manuscriptPath: string | null;
  category: string; territory: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const publishBtnRef = useRef<HTMLButtonElement>(null);
  const firstFixBtnRef = useRef<HTMLButtonElement>(null);
  const titleId = "prepublish-title";
  const descId = "prepublish-desc";
  const [openingManuscript, setOpeningManuscript] = useState(false);
  const [previewerOpen, setPreviewerOpen] = useState(false);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevActive = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const initial =
      (!props.checklistPass && firstFixBtnRef.current) ||
      (props.checklistPass && publishBtnRef.current) ||
      closeBtnRef.current;
    initial?.focus();

    const getFocusable = (): HTMLElement[] => {
      if (!dialogRef.current) return [];
      const nodes = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      return Array.from(nodes).filter((el) => el.offsetParent !== null);
    };

    const getFixButtons = (): HTMLButtonElement[] =>
      dialogRef.current
        ? Array.from(dialogRef.current.querySelectorAll<HTMLButtonElement>('[data-fix-btn]'))
        : [];

    const focusFixByOffset = (offset: 1 | -1) => {
      const fixes = getFixButtons();
      if (fixes.length === 0) return;
      const active = document.activeElement as HTMLElement | null;
      const idx = fixes.findIndex((b) => b === active);
      const next = idx === -1
        ? (offset === 1 ? 0 : fixes.length - 1)
        : (idx + offset + fixes.length) % fixes.length;
      fixes[next].focus();
    };

    const isTypingTarget = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        props.onClose();
        return;
      }
      if (e.key === "Tab") {
        const focusable = getFocusable();
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && props.checklistPass && !props.submitting) {
        e.preventDefault();
        props.onConfirm();
        return;
      }

      // Single-key shortcuts (skip when user is typing)
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) {
        // Alt+Arrow shortcuts still allowed below
      }
      if (!isTypingTarget(e.target)) {
        if ((e.altKey && e.key === "ArrowDown") || (!e.altKey && !e.metaKey && !e.ctrlKey && (e.key === "j" || e.key === "J"))) {
          e.preventDefault();
          focusFixByOffset(1);
          return;
        }
        if ((e.altKey && e.key === "ArrowUp") || (!e.altKey && !e.metaKey && !e.ctrlKey && (e.key === "k" || e.key === "K"))) {
          e.preventDefault();
          focusFixByOffset(-1);
          return;
        }
        if (!e.altKey && (e.key === "f" || e.key === "F")) {
          const fixes = getFixButtons();
          if (fixes.length) { e.preventDefault(); fixes[0].focus(); return; }
        }
        if (!e.altKey && (e.key === "p" || e.key === "P")) {
          if (props.checklistPass && !props.submitting && publishBtnRef.current) {
            e.preventDefault();
            publishBtnRef.current.focus();
            return;
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      prevActive?.focus?.();
    };
  }, [props]);

  const sizeLabel = props.fileSize != null
    ? props.fileSize > 1024 * 1024
      ? `${(props.fileSize / (1024 * 1024)).toFixed(2)} MB`
      : `${Math.max(1, Math.round(props.fileSize / 1024))} KB`
    : "—";

  const failingCount = props.checklist.filter((c) => !c.ok).length;
  let firstFixAssigned = false;

  return (
    <div
      role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId}
      className="fixed inset-0 z-50 bg-navy/80 flex items-start md:items-center justify-center p-4 overflow-y-auto"
      onClick={props.onClose}
    >
      <div
        ref={dialogRef}
        className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl my-6 focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeBtnRef}
          onClick={props.onClose}
          className="absolute top-3 right-3 h-9 w-9 rounded-full inline-flex items-center justify-center text-mute hover:bg-ink/5 focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none"
          aria-label="Close preview and return to editor"
        >
          <X size={18} aria-hidden="true" />
        </button>
        <div className="p-6 md:p-8 border-b border-ink/10">
          <p className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: props.accent.color }}>
            Final preview
          </p>
          <h2 id={titleId} className="font-display text-2xl text-navy mt-1">Review before publishing</h2>
          <p id={descId} className="text-sm text-mute mt-1">
            This is exactly how shoppers will see your title. Shortcuts: <kbd className="px-1 rounded bg-navy/5 text-navy text-[11px]">J</kbd>/<kbd className="px-1 rounded bg-navy/5 text-navy text-[11px]">K</kbd> or <kbd className="px-1 rounded bg-navy/5 text-navy text-[11px]">Alt</kbd>+<kbd className="px-1 rounded bg-navy/5 text-navy text-[11px]">↓</kbd>/<kbd className="px-1 rounded bg-navy/5 text-navy text-[11px]">↑</kbd> next/previous fix, <kbd className="px-1 rounded bg-navy/5 text-navy text-[11px]">F</kbd> first fix, <kbd className="px-1 rounded bg-navy/5 text-navy text-[11px]">P</kbd> publish button, <kbd className="px-1 rounded bg-navy/5 text-navy text-[11px]">Ctrl</kbd>/<kbd className="px-1 rounded bg-navy/5 text-navy text-[11px]">⌘</kbd>+<kbd className="px-1 rounded bg-navy/5 text-navy text-[11px]">Enter</kbd> to publish, <kbd className="px-1 rounded bg-navy/5 text-navy text-[11px]">Esc</kbd> to close.
          </p>
        </div>

        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* LEFT — Cover viewer */}
          <div className="min-w-0">
            <div className="relative mx-auto max-w-[280px]">
              <div className="relative w-full aspect-[1/1.6] rounded-md bg-gradient-to-br from-navy to-[#22335A] shadow-xl overflow-hidden">
                <CoverThumb
                  src={props.cover}
                  title={props.title}
                  alt={`Cover for ${props.title || "untitled product"}`}
                  imgClassName="w-full h-full object-cover"
                  fallbackClassName="w-full h-full flex items-center justify-center px-4 text-white/70"
                />
                {props.coverFullUrl && (
                  <a
                    href={props.coverFullUrl} target="_blank" rel="noopener noreferrer"
                    className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-navy/80 hover:bg-navy text-white text-xs font-medium px-2.5 py-1.5 backdrop-blur"
                    aria-label="Open cover at full resolution in a new tab"
                  >
                    Full size <ArrowRight size={12} />
                  </a>
                )}
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-ink/10 bg-paper/40 p-3 text-xs text-mute">
              <div className="flex items-center gap-2 text-navy font-medium">
                <FileText size={14} aria-hidden="true"/> Manuscript
                {props.fileName && (
                  <span className="ml-auto inline-flex items-center rounded-full bg-navy/10 text-navy text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                    {(props.fileName.split(".").pop() || "FILE").toUpperCase()}
                  </span>
                )}
              </div>
              <div className="mt-1 break-all">{props.fileName ?? "No file uploaded"} · {sizeLabel}</div>
              <button
                type="button"
                disabled={!props.manuscriptPath || props.submitting}
                onClick={() => { if (props.manuscriptPath) setPreviewerOpen(true); }}
                className="mt-3 w-full h-10 rounded-full text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: props.accent.color }}
              >
                <Eye size={14} /> Preview Manuscript
              </button>
            </div>
          </div>

          {/* RIGHT — Storefront listing card replica (matches PremiumProductCard on aurumvault.store) */}
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-mute mb-2">
              Storefront listing preview
            </p>
            <article
              aria-label="Storefront listing preview card"
              className="flex w-full max-w-[280px] min-w-0 flex-col overflow-hidden rounded-[12px] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
            >
              {/* Cover thumbnail — fixed 180px tall like the live card */}
              <div className="relative h-[180px] w-full overflow-hidden bg-gradient-to-br from-[#1B2A4A] to-[#4A1B6D]">
                <CoverThumb
                  src={props.cover}
                  title={props.title}
                  alt={`Cover for ${props.title || "untitled product"}`}
                  imgClassName="h-full w-full object-cover"
                  fallbackClassName="flex h-full w-full items-center justify-center px-6 text-white/90"
                />
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col p-4">
                {/* Category badge — color-coded per product type */}
                {(() => {
                  const d = categoryDisplay(props.category);
                  return (
                    <div
                      className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                      style={{ color: d.accent }}
                    >
                      {d.label}
                    </div>
                  );
                })()}

                {/* Title — navy, 2-line clamp */}
                <h3
                  className="mt-1.5 line-clamp-2 min-h-[2.6em] break-words text-[15px] font-bold leading-snug"
                  style={{ color: "#1B2A4A" }}
                >
                  {props.title || "Untitled"}
                </h3>

                {/* Author with verified checkmark */}
                <div className="mt-2 flex items-center gap-2">
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{ background: "#1B2A4A" }}
                    aria-hidden="true"
                  >
                    {(props.author || "—")
                      .split(" ")
                      .map((p) => p[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join("")
                      .toUpperCase() || "AV"}
                  </div>
                  <span className="truncate text-[12px] text-[#6b7280]">
                    {props.author || "Unknown creator"}
                  </span>
                  <ShieldCheck
                    size={14}
                    className="shrink-0 text-emerald-600"
                    aria-label="Verified creator"
                  />
                </div>

                {/* Price — gold, tabular */}
                <div
                  className="mt-3 whitespace-nowrap text-[18px] font-bold tabular-nums"
                  style={{ color: "#C9A84C" }}
                >
                  ${props.price.toFixed(2)}
                </div>

                {/* Disabled Add to Cart — outlined navy, preview-only */}
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="Preview only — publish to enable purchases"
                  className="mt-4 w-full cursor-not-allowed rounded-full border-2 py-2.5 text-[13px] font-bold opacity-60"
                  style={{
                    borderColor: "#1B2A4A",
                    color: "#1B2A4A",
                    background: "transparent",
                  }}
                >
                  Add to Cart
                </button>
              </div>
            </article>
            <p className="mt-3 text-xs italic text-mute">
              This is exactly how your product will appear in the Vault.
            </p>
          </div>

        </div>


        <div className="p-6 md:p-8 border-t border-ink/10 bg-paper/30 rounded-b-2xl">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-mute" id="checklist-heading">
            Pre-publish checklist {failingCount > 0 && <span className="text-red-700 normal-case tracking-normal">({failingCount} to fix)</span>}
          </p>
          <ul className="mt-3 space-y-2" aria-labelledby="checklist-heading">
            {props.checklist.map((c) => {
              const assignRef = !c.ok && !firstFixAssigned;
              if (assignRef) firstFixAssigned = true;
              return (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  {c.ok ? (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" aria-hidden="true" />
                  ) : (
                    <AlertCircle size={16} className="text-red-600 shrink-0" aria-hidden="true" />
                  )}
                  <span className={c.ok ? "text-navy" : "text-red-700 font-medium"}>
                    <span className="sr-only">{c.ok ? "Passed: " : "Needs fix: "}</span>{c.label}
                  </span>
                  {!c.ok && (
                    <button
                      ref={assignRef ? firstFixBtnRef : undefined}
                      data-fix-btn
                      type="button"
                      onClick={() => props.onGoToStep(c.gotoStep)}
                      className="ml-auto text-xs text-red-700 underline hover:no-underline focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:outline-none rounded px-1"
                      aria-label={`Fix ${c.label} — go to step ${c.gotoStep}`}
                    >
                      Fix this →
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button" onClick={props.onClose}
              disabled={props.submitting}
              className="h-11 px-5 rounded-full border border-navy/20 text-navy font-semibold hover:bg-navy/5 focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Keep editing
            </button>
            <button
              ref={publishBtnRef}
              type="button" onClick={() => { if (!props.submitting && props.checklistPass) props.onConfirm(); }}
              disabled={!props.checklistPass || props.submitting}
              className="h-11 px-6 rounded-full text-white font-semibold inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-navy focus-visible:outline-none"
              style={{ background: props.accent.color }}
              aria-describedby={!props.checklistPass ? "checklist-heading" : undefined}
              aria-label={props.checklistPass ? "Publish to Vault (Ctrl+Enter)" : "Publish to Vault — resolve checklist first"}
              aria-busy={props.submitting}
            >
              {props.submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}
              {props.submitting ? "Publishing…" : "Publish to Vault"}
            </button>
          </div>
        </div>
      </div>
      {previewerOpen && props.manuscriptPath && (
        <ManuscriptPreviewer
          manuscriptPath={props.manuscriptPath}
          title={props.title}
          coverUrl={props.coverFullUrl ?? props.cover}
          onClose={() => setPreviewerOpen(false)}
        />
      )}
    </div>
  );
}

