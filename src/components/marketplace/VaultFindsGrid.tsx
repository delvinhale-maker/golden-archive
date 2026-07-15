import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ExternalLink, Settings, ImagePlus, Loader2, GripVertical } from "lucide-react";

const BUCKET = "vault-finds";

type VaultFind = {
  id: string;
  headline: string;
  subtext: string;
  image_url: string | null;
  affiliate_link: string;
};

export function VaultFindsGrid() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<VaultFind[] | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [reorderDragId, setReorderDragId] = useState<string | null>(null);
  const [reorderOverId, setReorderOverId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

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
      Object.values(previews).forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lock page scroll + prevent native touch gestures while a touch reorder is active.
  // Also blocks pull-to-refresh / rubber-band which otherwise fires elementFromPoint at stale coords.
  useEffect(() => {
    if (!reorderDragId) return;
    const { body, documentElement: html } = document;
    const prev = {
      bodyOverflow: body.style.overflow,
      bodyTouchAction: body.style.touchAction,
      bodyOverscroll: body.style.overscrollBehavior,
      htmlOverscroll: html.style.overscrollBehavior,
    };
    body.style.overflow = "hidden";
    body.style.touchAction = "none";
    body.style.overscrollBehavior = "none";
    html.style.overscrollBehavior = "none";
    const blockTouchMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    window.addEventListener("touchmove", blockTouchMove, { passive: false });
    return () => {
      body.style.overflow = prev.bodyOverflow;
      body.style.touchAction = prev.bodyTouchAction;
      body.style.overscrollBehavior = prev.bodyOverscroll;
      html.style.overscrollBehavior = prev.htmlOverscroll;
      window.removeEventListener("touchmove", blockTouchMove);
    };
  }, [reorderDragId]);

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

  async function persistOrder(next: VaultFind[]) {
    const prev = items;
    setItems(next);
    setSavingOrder(true);
    try {
      for (let i = 0; i < next.length; i++) {
        const { error } = await supabase
          .from("vault_finds_products")
          .update({ sort_order: (i + 1) * 10 })
          .eq("id", next[i].id);
        if (error) throw error;
      }
      toast.success("Order saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Reorder failed");
      setItems(prev);
    } finally {
      setSavingOrder(false);
    }
  }

  function onReorderDrop(targetId: string) {
    const sourceId = reorderDragId;
    setReorderDragId(null);
    setReorderOverId(null);
    if (!sourceId || !items || sourceId === targetId) return;
    const from = items.findIndex((x) => x.id === sourceId);
    const to = items.findIndex((x) => x.id === targetId);
    if (from < 0 || to < 0) return;
    const next = items.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void persistOrder(next);
  }

  if (!items || items.length === 0) return null;

  return (
    <section className="bg-white py-14 md:py-20" aria-labelledby="vault-finds-grid-title">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-baseline gap-3">
          <h2
            id="vault-finds-grid-title"
            className="font-display text-3xl leading-tight text-navy md:text-4xl"
          >
            More <span className="gold-gradient">Vault Finds</span>
          </h2>
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-ink/70">
            Curated Affiliate Picks
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

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {items.map((it) => (
            <article
              key={it.id}
              data-vf-id={it.id}
              onDragOver={
                isAdmin && reorderDragId
                  ? (e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (reorderOverId !== it.id) setReorderOverId(it.id);
                    }
                  : undefined
              }
              onDragLeave={
                isAdmin && reorderDragId
                  ? (e) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                      setReorderOverId((d) => (d === it.id ? null : d));
                    }
                  : undefined
              }
              onDrop={
                isAdmin && reorderDragId
                  ? (e) => {
                      e.preventDefault();
                      onReorderDrop(it.id);
                    }
                  : undefined
              }
              className={`relative flex flex-col rounded-2xl bg-white p-3 ring-1 ring-navy/10 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.25)] transition ${
                reorderDragId === it.id ? "opacity-40" : ""
              } ${reorderOverId === it.id && reorderDragId !== it.id ? "ring-2 ring-gold" : ""}`}
            >
              {isAdmin && (
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", it.id);
                    setReorderDragId(it.id);
                  }}
                  onDragEnd={() => {
                    setReorderDragId(null);
                    setReorderOverId(null);
                  }}
                  onPointerDown={(e) => {
                    if (e.pointerType === "mouse") return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setReorderDragId(it.id);
                    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                      try {
                        navigator.vibrate?.(15);
                      } catch {
                        /* noop */
                      }
                    }
                  }}
                  onPointerMove={(e) => {
                    if (e.pointerType === "mouse" || !reorderDragId) return;
                    e.preventDefault();
                    // Auto-scroll near viewport edges so long lists remain reachable.
                    const vh = window.innerHeight;
                    const edge = 72;
                    if (e.clientY < edge) window.scrollBy(0, -Math.ceil((edge - e.clientY) / 4));
                    else if (e.clientY > vh - edge)
                      window.scrollBy(0, Math.ceil((e.clientY - (vh - edge)) / 4));
                    // Accurate hit-test: elementsFromPoint walks the stack so a
                    // sibling overlay (upload label, badge) can't shadow the card.
                    const stack = document.elementsFromPoint(e.clientX, e.clientY) as HTMLElement[];
                    let overId: string | null = null;
                    for (const node of stack) {
                      const card = node.closest?.<HTMLElement>("[data-vf-id]");
                      const id = card?.getAttribute("data-vf-id");
                      if (id && id !== reorderDragId) {
                        overId = id;
                        break;
                      }
                    }
                    setReorderOverId(overId);
                  }}
                  onPointerUp={(e) => {
                    if (e.pointerType === "mouse") return;
                    try {
                      e.currentTarget.releasePointerCapture(e.pointerId);
                    } catch {
                      /* noop */
                    }
                    const target = reorderOverId;
                    if (target) onReorderDrop(target);
                    else {
                      setReorderDragId(null);
                      setReorderOverId(null);
                    }
                  }}
                  onPointerCancel={() => {
                    setReorderDragId(null);
                    setReorderOverId(null);
                  }}
                  disabled={savingOrder}
                  title="Drag to reorder"
                  aria-label="Drag to reorder"
                  style={{ touchAction: "none" }}
                  className="absolute left-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-navy/70 shadow ring-1 ring-navy/10 backdrop-blur cursor-grab active:cursor-grabbing disabled:opacity-40"
                >
                  <GripVertical size={14} />
                </button>
              )}
              <div className="relative">
                <span className="absolute right-2 top-2 z-10 rounded-full bg-white/85 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-navy/70 backdrop-blur">
                  Affiliate
                </span>
                <div
                  className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-[#F4F1E8] transition ${
                    isAdmin && dragOverId === it.id ? "ring-4 ring-gold ring-offset-2 ring-offset-white" : ""
                  }`}
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
                    <span className="font-display text-4xl text-navy/25" aria-hidden>
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
              </div>

              <h3 className="mt-3 line-clamp-2 font-display text-base leading-tight text-navy">
                {it.headline}
              </h3>
              <p className="mt-1 line-clamp-2 text-xs leading-snug text-navy/65">
                {it.subtext}
              </p>

              <a
                href={it.affiliate_link}
                target="_blank"
                rel="noopener noreferrer sponsored"
                aria-label={`Shop ${it.headline} on partner site (opens in a new tab)`}
                className="mt-3 inline-flex h-9 items-center justify-center gap-1.5 self-start rounded-full bg-navy px-4 text-[11px] font-bold tracking-wide text-white transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-ink"
              >
                Shop Now
                <ExternalLink size={12} aria-hidden />
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
