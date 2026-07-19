import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ExternalLink, ImageUp, Loader2 } from "lucide-react";
import { AffiliateImagePreview } from "./AffiliateImagePreview";

const BUCKET = "vault-finds";

type VaultFind = {
  id: string;
  headline: string;
  subtext: string;
  image_url: string | null;
  affiliate_link: string;
};

type CategoryDef = {
  title: string;
  eyebrow: string;
  tile: string;
  ink: string;
};

const CATEGORIES: CategoryDef[] = [
  { title: "Enjoy all the vault benefits", eyebrow: "Curated Affiliate Picks", tile: "#1E90FF", ink: "#0b1b3a" },
  { title: "Shop by category", eyebrow: "Editor's Selection", tile: "#A8DDE7", ink: "#0b1b3a" },
  { title: "Seasonal styles for every reader", eyebrow: "Trending Now", tile: "#F5D65A", ink: "#3a2a00" },
  { title: "Travel & lifestyle must-haves", eyebrow: "Fresh Arrivals", tile: "#F26A38", ink: "#2a0f00" },
];

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function VaultFindsCategorySections() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<VaultFind[] | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<number>(0);
  const rampRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("vault_finds_products")
      .select("id, headline, subtext, image_url, affiliate_link")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!active) return;
        setItems((data ?? []) as VaultFind[]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      setPreviews((p) => {
        Object.values(p).forEach((u) => URL.revokeObjectURL(u));
        return {};
      });
    };
  }, []);

  async function handleUpload(id: string, file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setPreviews((p) => {
      const prev = p[id];
      if (prev) URL.revokeObjectURL(prev);
      return { ...p, [id]: localUrl };
    });
    setUploadingId(id);
    setProgress(5);
    rampRef.current = window.setInterval(() => {
      setProgress((p) => (p < 90 ? p + Math.max(1, Math.round((92 - p) / 8)) : p));
    }, 180);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = pub.publicUrl;
      const { error: updErr } = await supabase
        .from("vault_finds_products")
        .update({ image_url: url })
        .eq("id", id);
      if (updErr) throw updErr;
      setProgress(100);
      setItems((prev) => (prev ? prev.map((it) => (it.id === id ? { ...it, image_url: url } : it)) : prev));
      toast.success("Image updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
      setPreviews((p) => {
        if (p[id]) URL.revokeObjectURL(p[id]);
        const { [id]: _drop, ...rest } = p;
        return rest;
      });
    } finally {
      if (rampRef.current) window.clearInterval(rampRef.current);
      rampRef.current = null;
      setUploadingId(null);
      window.setTimeout(() => setProgress(0), 400);
    }
  }

  if (!items || items.length === 0) return null;

  const groups = chunk(items, 4).slice(0, CATEGORIES.length);
  if (groups.length === 0) return null;

  return (
    <div className="bg-white">
      {groups.map((group, gi) => {
        const cat = CATEGORIES[gi];
        return (
          <section
            key={gi}
            className="bg-white py-10 md:py-14"
            aria-labelledby={`vf-cat-${gi}`}
          >
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <div className="mb-5 flex flex-wrap items-baseline gap-3">
                <h2
                  id={`vf-cat-${gi}`}
                  className="font-display text-2xl leading-tight text-navy md:text-3xl"
                >
                  {cat.title}
                </h2>
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-ink/70">
                  {cat.eyebrow}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 md:gap-6">
                {group.map((it) => {
                  const isUploading = uploadingId === it.id;
                  const preview = previews[it.id];
                  const displayUrl = preview || it.image_url;
                  return (
                    <article key={it.id} className="flex flex-col">
                      <div className="relative">
                        <a
                          href={it.affiliate_link}
                          target="_blank"
                          rel="noopener noreferrer sponsored"
                          aria-label={`Shop ${it.headline}`}
                          className="group relative block aspect-square w-full overflow-hidden rounded-xl p-1.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
                          style={{ backgroundColor: cat.tile }}
                        >
                          <span
                            className="absolute right-2 top-2 z-10 rounded-full bg-white/85 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-navy/70 backdrop-blur"
                          >
                            Affiliate
                          </span>
                          {displayUrl ? (
                            <img
                              src={displayUrl}
                              alt={it.headline}
                              loading="lazy"
                              className="h-full w-full object-contain transition-transform duration-300 ease-out will-change-transform group-hover:scale-[1.08] group-focus-visible:scale-[1.08] group-active:scale-[1.05]"
                              style={{ objectPosition: "center" }}
                            />
                          ) : (
                            <span
                              className="absolute inset-0 flex items-center justify-center font-display text-5xl"
                              style={{ color: cat.ink, opacity: 0.35 }}
                              aria-hidden
                            >
                              ✦
                            </span>
                          )}
                        </a>

                        {isAdmin && (
                          <>
                            {isUploading && (
                              <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-xl bg-black/50 backdrop-blur-[2px]">
                                <div className="inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold text-navy shadow-sm">
                                  <Loader2 size={12} className="animate-spin" /> Uploading… {progress}%
                                </div>
                              </div>
                            )}
                            <label
                              role="button"
                              tabIndex={0}
                              aria-label={
                                it.image_url || preview
                                  ? `Replace image for ${it.headline}. Press Enter to open file picker.`
                                  : `Upload image for ${it.headline}. Press Enter to open file picker.`
                              }
                              onKeyDown={(e: KeyboardEvent<HTMLLabelElement>) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  (e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement | null)?.click();
                                }
                              }}
                              className="absolute bottom-2 right-2 z-30 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur transition hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
                              title="Upload or replace image"
                            >
                              <ImageUp size={12} aria-hidden />
                              {it.image_url || preview ? "Replace image" : "Upload image"}
                              <input
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                aria-hidden="true"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleUpload(it.id, f);
                                  e.currentTarget.value = "";
                                }}
                              />
                            </label>
                          </>
                        )}
                      </div>

                      <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-navy md:text-base">
                        {it.headline}
                      </h3>
                      <a
                        href={it.affiliate_link}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        className="mt-1 inline-flex items-center gap-1 self-start rounded-sm text-xs font-semibold text-[#1a6fbf] transition-colors duration-200 hover:text-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a6fbf] focus-visible:ring-offset-2"
                      >
                        Shop now
                        <ExternalLink size={11} aria-hidden />
                      </a>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
