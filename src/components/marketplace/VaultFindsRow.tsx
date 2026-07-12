import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

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
  const [items, setItems] = useState<VaultFind[] | null>(null);
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
          <div className="flex items-baseline gap-3">
            <h2
              id="vault-finds-title"
              className="font-display text-3xl leading-tight text-navy md:text-4xl"
            >
              Vault <span className="gold-gradient">Finds</span>
            </h2>
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-ink/70">
              Updated Weekly
            </span>
          </div>
        </div>

        <div
          className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-6 pb-4 lg:-mx-8 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="list"
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
                  className="mb-4 flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl"
                  style={{ backgroundColor: "rgba(255,255,255,0.14)" }}
                >
                  {it.image_url ? (
                    <img
                      src={it.image_url}
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
                  className="mt-4 inline-flex h-10 items-center justify-center gap-1.5 self-start rounded-full px-5 text-xs font-bold tracking-wide transition-transform hover:scale-[1.02]"
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
