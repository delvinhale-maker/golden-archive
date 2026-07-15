import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, ExternalLink, Settings, ImagePlus, Loader2 } from "lucide-react";

const BUCKET = "vault-finds";


type VaultFind = {
  id: string;
  headline: string;
  subtext: string;
  image_url: string | null;
  affiliate_link: string;
  accent_color: "emerald" | "burgundy" | "amber" | "dusty" | "cream";
};

const ACCENTS: Record<
  VaultFind["accent_color"],
  { bg: string; text: string; btnBg: string; btnText: string; disclosure: string }
> = {
  emerald: { bg: "#1B7A5C", text: "#ffffff", btnBg: "#ffffff", btnText: "#0f1629", disclosure: "rgba(255,255,255,0.75)" },
  burgundy: { bg: "#7A2E3E", text: "#ffffff", btnBg: "#ffffff", btnText: "#0f1629", disclosure: "rgba(255,255,255,0.75)" },
  amber: { bg: "#C9832E", text: "#ffffff", btnBg: "#0f1629", btnText: "#ffffff", disclosure: "rgba(255,255,255,0.8)" },
  dusty: { bg: "#3E5C76", text: "#ffffff", btnBg: "#ffffff", btnText: "#0f1629", disclosure: "rgba(255,255,255,0.75)" },
  cream: { bg: "#F4F1E8", text: "#0f1629", btnBg: "#0f1629", btnText: "#ffffff", disclosure: "rgba(15,22,41,0.55)" },
};

function isoWeek(d = new Date()): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function rotate<T>(pool: T[], week: number, count: number): T[] {
  if (pool.length === 0) return [];
  const start = week % pool.length;
  const out: T[] = [];
  for (let i = 0; i < count; i++) {
    out.push(pool[(start + i) % pool.length]);
  }
  return out;
}

export function VaultFindsRow() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<VaultFind[] | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [dragOverId, setDragOverId] = useState<string | null>(null);

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
      setUploadingId(null);
    }
  }

  useEffect(() => {
    return () => {
      // revoke any lingering blob URLs on unmount
      setPreviews((p) => {
        Object.values(p).forEach((u) => URL.revokeObjectURL(u));
        return {};
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("vault_finds_products")
      .select("id, headline, subtext, image_url, affiliate_link, accent_color")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!active) return;
        const pool = (data ?? []) as VaultFind[];
        setItems(rotate(pool, isoWeek(), Math.min(6, Math.max(pool.length, 1))));
      });
    return () => {
      active = false;
    };
  }, []);

  const scrollByCard = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[role="listitem"]');
    const step = card ? card.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const onScrollerKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollByCard(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollByCard(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      el.scrollTo({ left: 0, behavior: "smooth" });
    } else if (e.key === "End") {
      e.preventDefault();
      el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
    }
  };


  if (!items || items.length === 0) return null;

  return (
    <section className="bg-white py-14 md:py-20" aria-labelledby="vault-finds-title">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2
              id="vault-finds-title"
              className="font-display text-3xl leading-tight text-navy md:text-4xl"
            >
              Vault <span className="gold-gradient">Finds</span>
            </h2>
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-ink/70">
              Updated Weekly
            </span>
            {isAdmin && (
              <Link
                to="/admin/vault-finds"
                className="inline-flex items-center gap-1 rounded-full border border-navy/15 px-2.5 py-1 text-[11px] font-semibold text-navy transition hover:bg-navy hover:text-white"
              >
                <Settings size={11} /> Manage
              </Link>
            )}
          </div>
          <div className="hidden gap-2 md:flex">
            <button
              type="button"
              onClick={() => scrollByCard(-1)}
              aria-label="Scroll Vault Finds left"
              aria-controls="vault-finds-scroller"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-navy/15 text-navy transition hover:bg-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-ink"
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => scrollByCard(1)}
              aria-label="Scroll Vault Finds right"
              aria-controls="vault-finds-scroller"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-navy/15 text-navy transition hover:bg-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-ink"
            >
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
        </div>

        <div
          id="vault-finds-scroller"
          ref={scrollerRef}
          tabIndex={0}
          role="list"
          aria-label="Vault Finds curated affiliate products. Use left and right arrow keys to browse."
          onKeyDown={onScrollerKeyDown}
          className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-6 pb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-ink lg:-mx-8 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >

          {items.map((it, idx) => {
            const a = ACCENTS[it.accent_color] ?? ACCENTS.emerald;
            return (
              <article
                key={`${it.id}-${idx}`}
                role="listitem"
                className="relative flex w-[280px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl p-5 shadow-[0_16px_40px_-20px_rgba(0,0,0,0.35)]"
                style={{ backgroundColor: a.bg, color: a.text }}
              >
                <span
                  className="absolute right-3 top-3 text-[9px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: a.disclosure }}
                >
                  Affiliate
                </span>

                <div
                  className={`relative mb-4 flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl transition ${
                    isAdmin && dragOverId === it.id ? "ring-4 ring-gold ring-offset-2 ring-offset-transparent" : ""
                  }`}
                  style={{ backgroundColor: "rgba(255,255,255,0.14)" }}
                  onDragOver={
                    isAdmin
                      ? (e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "copy";
                          if (dragOverId !== it.id) setDragOverId(it.id);
                        }
                      : undefined
                  }
                  onDragLeave={
                    isAdmin
                      ? (e) => {
                          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                          setDragOverId((d) => (d === it.id ? null : d));
                        }
                      : undefined
                  }
                  onDrop={
                    isAdmin
                      ? (e) => {
                          e.preventDefault();
                          setDragOverId(null);
                          const f = e.dataTransfer.files?.[0];
                          if (f) handleUpload(it.id, f);
                        }
                      : undefined
                  }
                >
                  {previews[it.id] || it.image_url ? (
                    <img
                      src={previews[it.id] ?? (it.image_url as string)}
                      alt={it.headline}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span
                      className="font-display text-4xl opacity-40"
                      style={{ color: a.text }}
                      aria-hidden
                    >
                      ✦
                    </span>
                  )}
                  {isAdmin && uploadingId === it.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold text-navy shadow">
                        <Loader2 size={12} className="animate-spin" /> Uploading…
                      </div>
                    </div>
                  )}
                  {isAdmin && dragOverId === it.id && uploadingId !== it.id && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-navy/50">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-navy shadow">
                        <ImagePlus size={12} /> Drop to replace
                      </div>
                    </div>
                  )}
                  {isAdmin && (
                    <label
                      className="absolute bottom-2 right-2 inline-flex cursor-pointer items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur transition hover:bg-black/85"
                      title="Upload or drop an image onto this card"
                    >
                      <ImagePlus size={11} />
                      {it.image_url || previews[it.id] ? "Replace" : "Upload"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingId === it.id}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.currentTarget.value = "";
                          if (f) handleUpload(it.id, f);
                        }}
                      />
                    </label>
                  )}
                </div>



                <h3 className="font-display text-lg leading-tight">{it.headline}</h3>
                <p
                  className="mt-2 line-clamp-2 text-sm leading-snug"
                  style={{ color: a.text, opacity: 0.85 }}
                >
                  {it.subtext}
                </p>

                <a
                  href={it.affiliate_link}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  aria-label={`Shop ${it.headline} on partner site (opens in a new tab)`}
                  className="mt-4 inline-flex h-10 items-center justify-center gap-1.5 self-start rounded-full px-5 text-xs font-bold tracking-wide transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-ink"
                  style={{ backgroundColor: a.btnBg, color: a.btnText }}
                >
                  Shop Now
                  <ExternalLink size={13} aria-hidden />
                </a>

              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
