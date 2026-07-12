import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Loader2, Upload } from "lucide-react";

const BUCKET = "vault-finds";
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp", "gif"] as const;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MIN_DIMENSION = 200; // px
const MAX_DIMENSION = 4000; // px

function formatBytes(n: number) {
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type ValidationError = { title: string; description: string };

function validateImageFile(file: File): ValidationError | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeOk = ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number]);
  const extOk = ALLOWED_EXT.includes(ext as (typeof ALLOWED_EXT)[number]);
  if (!mimeOk && !extOk) {
    return {
      title: "Unsupported file type",
      description: `Please upload a JPG, PNG, WEBP, or GIF image. The selected file does not match any of these formats.`,
    };
  }
  if (file.size === 0) {
    return {
      title: "File is empty",
      description: "The selected image has no content. Please choose a different file.",
    };
  }
  if (file.size > MAX_BYTES) {
    return {
      title: "File too large",
      description: `This image is ${formatBytes(file.size)}. Please compress or resize it to ${formatBytes(MAX_BYTES)} or smaller before uploading.`,
    };
  }
  return null;
}

function checkImageDimensions(file: File): Promise<ValidationError | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width < MIN_DIMENSION || img.height < MIN_DIMENSION) {
        resolve({
          title: "Image dimensions too small",
          description: `This image is ${img.width}×${img.height} px. Please use an image that is at least ${MIN_DIMENSION}×${MIN_DIMENSION} px on each side.`,
        });
      } else if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
        resolve({
          title: "Image dimensions too large",
          description: `This image is ${img.width}×${img.height} px. Please use an image that is no larger than ${MAX_DIMENSION}×${MAX_DIMENSION} px on each side.`,
        });
      } else {
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        title: "Could not read image",
        description: "The file may be corrupted or not a valid image. Please try a different file.",
      });
    };
    img.src = url;
  });
}

function showValidationToast(error: unknown) {
  if (error && typeof error === "object" && "title" in error && "description" in error) {
    toast.error(String(error.title), { description: String(error.description) });
  } else if (error instanceof Error) {
    toast.error(error.message);
  } else {
    toast.error("Upload failed");
  }
}

async function uploadImage(file: File): Promise<string> {
  const typeError = validateImageFile(file);
  if (typeError) throw typeError;
  const dimError = await checkImageDimensions(file);
  if (dimError) throw dimError;
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export const Route = createFileRoute("/_authenticated/admin/vault-finds")({
  component: VaultFindsAdminPage,
});

type Row = {
  id: string;
  headline: string;
  subtext: string;
  image_url: string | null;
  affiliate_link: string;
  accent_color: string;
  active: boolean;
  sort_order: number;
  created_at: string;
};

const ACCENTS = ["emerald", "burgundy", "amber", "dusty", "cream"] as const;

function VaultFindsAdminPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  const [headline, setHeadline] = useState("");
  const [subtext, setSubtext] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [affiliateLink, setAffiliateLink] = useState("");
  const [accent, setAccent] = useState<(typeof ACCENTS)[number]>("emerald");
  const [active, setActive] = useState(true);
  const [uploadingNew, setUploadingNew] = useState(false);
  const [rowUploading, setRowUploading] = useState<string | null>(null);
  const [dragOverNew, setDragOverNew] = useState(false);
  const [dragOverRow, setDragOverRow] = useState<string | null>(null);

  const pickImageFromDrop = (e: React.DragEvent): File | null => {
    const items = e.dataTransfer?.files;
    if (!items || items.length === 0) return null;
    const file = items[0];
    const err = validateImageFile(file);
    if (err) {
      showValidationToast(err);
      return null;
    }
    return file;
  };

  const onPickNewImage = async (file: File | null) => {
    if (!file) return;
    setUploadingNew(true);
    try {
      const url = await uploadImage(file);
      setImageUrl(url);
      toast.success("Image uploaded");
    } catch (e: any) {
      showValidationToast(e);
    } finally {
      setUploadingNew(false);
    }
  };

  const onReplaceRowImage = async (row: Row, file: File | null) => {
    if (!file) return;
    setRowUploading(row.id);
    try {
      const url = await uploadImage(file);
      const { error } = await supabase
        .from("vault_finds_products")
        .update({ image_url: url })
        .eq("id", row.id);
      if (error) throw error;
      toast.success("Image updated");
      void load();
    } catch (e: any) {
      showValidationToast(e);
    } finally {
      setRowUploading(null);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    let alive = true;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        const ok = data?.role === "admin";
        setIsAdmin(ok);
        setCheckingAdmin(false);
        if (!ok) navigate({ to: "/dashboard" });
      });
    return () => {
      alive = false;
    };
  }, [user, loading, navigate]);

  const load = async () => {
    const { data, error } = await supabase
      .from("vault_finds_products")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as Row[]);
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headline.trim() || !subtext.trim() || !affiliateLink.trim()) {
      toast.error("Headline, subtext, and affiliate link are required.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("vault_finds_products").insert({
      headline: headline.trim(),
      subtext: subtext.trim(),
      image_url: imageUrl.trim() || null,
      affiliate_link: affiliateLink.trim(),
      accent_color: accent,
      active,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Vault Find added");
    setHeadline("");
    setSubtext("");
    setImageUrl("");
    setAffiliateLink("");
    setAccent("emerald");
    setActive(true);
    void load();
  };

  const toggle = async (row: Row) => {
    const { error } = await supabase
      .from("vault_finds_products")
      .update({ active: !row.active })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this Vault Find?")) return;
    const { error } = await supabase.from("vault_finds_products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    void load();
  };

  if (loading || checkingAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory">
        <Loader2 className="h-6 w-6 animate-spin text-navy" />
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-ivory">
      <div className="mx-auto max-w-4xl px-6 py-10 lg:px-8">
        <Link
          to="/admin"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-navy hover:text-gold-ink"
        >
          <ArrowLeft size={14} /> Back to Admin
        </Link>
        <h1 className="font-display text-3xl text-navy">Vault Finds</h1>
        <p className="mt-1 text-sm text-ink/70">
          Manage the affiliate product pool shown on the homepage. Cards rotate weekly.
        </p>

        <form
          onSubmit={submit}
          className="mt-8 space-y-4 rounded-2xl border border-line bg-white p-6 shadow-sm"
        >
          <h2 className="font-display text-lg text-navy">Add a product</h2>
          <div>
            <label className="text-xs font-semibold uppercase tracking-caps text-ink/70">
              Headline
            </label>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={80}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
              placeholder="See Everything. Miss Nothing."
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-caps text-ink/70">
              Subtext (one line)
            </label>
            <input
              value={subtext}
              onChange={(e) => setSubtext(e.target.value)}
              maxLength={160}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
              placeholder="AI-powered smart glasses with built-in camera…"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-caps text-ink/70">
              Product image
            </label>
            <div
              className={`mt-1 flex items-center gap-3 rounded-lg border-2 border-dashed p-3 transition-colors ${
                dragOverNew ? "border-navy bg-navy/5" : "border-transparent"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverNew(true);
              }}
              onDragLeave={() => setDragOverNew(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverNew(false);
                const file = pickImageFromDrop(e);
                if (file) void onPickNewImage(file);
              }}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt=""
                  className="h-16 w-16 rounded-lg border border-line object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-line text-ink/40">
                  <Upload size={16} />
                </div>
              )}
              <div className="flex flex-1 flex-col gap-1">
                <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full border border-line px-4 py-2 text-xs font-semibold hover:border-navy">
                  {uploadingNew ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Upload size={14} />
                  )}
                  {uploadingNew ? "Uploading…" : imageUrl ? "Replace image" : "Upload image"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingNew}
                    onChange={(e) => {
                      void onPickNewImage(e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                  />
                </label>
                <span className="text-[11px] text-ink/50">
                  Drag & drop or click to upload · must be JPG, PNG, WEBP, or GIF · under 5 MB · 200–4000 px per side
                </span>
              </div>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="text-xs text-ink/60 hover:text-red-600"
                >
                  Clear
                </button>
              )}
            </div>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              type="url"
              className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-xs text-ink/60"
              placeholder="Or paste an image URL"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-caps text-ink/70">
              Affiliate link
            </label>
            <input
              value={affiliateLink}
              onChange={(e) => setAffiliateLink(e.target.value)}
              type="url"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
              placeholder="https://amzn.to/…"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-caps text-ink/70">
                Accent color
              </label>
              <select
                value={accent}
                onChange={(e) => setAccent(e.target.value as (typeof ACCENTS)[number])}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
              >
                {ACCENTS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                Active
              </label>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 items-center rounded-full bg-navy px-6 text-sm font-bold text-white hover:bg-navy/90 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Add product"}
          </button>
        </form>

        <div className="mt-10">
          <h2 className="font-display text-lg text-navy">
            All products <span className="text-sm text-ink/60">({rows.length})</span>
          </h2>
          <ul className="mt-4 space-y-3">
            {rows.map((r) => (
              <li
                key={r.id}
                className={`flex items-start justify-between gap-4 rounded-xl border bg-white p-4 transition-colors ${
                  dragOverRow === r.id ? "border-navy bg-navy/5" : "border-line"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (rowUploading) return;
                  setDragOverRow(r.id);
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  setDragOverRow((cur) => (cur === r.id ? null : cur));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverRow(null);
                  const file = pickImageFromDrop(e);
                  if (file) void onReplaceRowImage(r, file);
                }}
              >
                {r.image_url ? (
                  <img
                    src={r.image_url}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-lg border border-line object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-line text-ink/40">
                    <Upload size={16} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{
                        backgroundColor: {
                          emerald: "#1B7A5C",
                          burgundy: "#7A2E3E",
                          amber: "#C9832E",
                          dusty: "#3E5C76",
                          cream: "#F4F1E8",
                        }[r.accent_color] ?? "#999",
                      }}
                    />
                    <div className="truncate font-semibold text-navy">{r.headline}</div>
                    {!r.active && (
                      <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-ink/60">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="mt-1 truncate text-xs text-ink/60">{r.subtext}</div>
                  <a
                    href={r.affiliate_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block truncate text-xs text-gold-ink hover:underline"
                  >
                    {r.affiliate_link}
                  </a>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-line px-3 py-1 text-xs font-semibold hover:border-navy">
                    {rowUploading === r.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Upload size={12} />
                    )}
                    {rowUploading === r.id ? "…" : r.image_url ? "Replace" : "Upload"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={rowUploading === r.id}
                      onChange={(e) => {
                        void onReplaceRowImage(r, e.target.files?.[0] ?? null);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggle(r)}
                      className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:border-navy"
                    >
                      {r.active ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => remove(r.id)}
                      className="rounded-full border border-line p-2 text-ink/60 hover:border-red-500 hover:text-red-600"
                      aria-label="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-ink/60">
                No products yet.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
