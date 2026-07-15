import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink } from "lucide-react";

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
  tile: string; // background color behind each product image
  ink: string; // text/heading color for tile if needed
};

// Amazon-style category palette (mirrors the reference screenshots):
// blue, cyan, yellow, orange. White page background is unchanged.
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
  const [items, setItems] = useState<VaultFind[] | null>(null);

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
                {group.map((it) => (
                  <article key={it.id} className="flex flex-col">
                    <a
                      href={it.affiliate_link}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      aria-label={`Shop ${it.headline}`}
                      className="group relative block aspect-square w-full overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-ink"
                      style={{ backgroundColor: cat.tile }}
                    >
                      <span
                        className="absolute right-2 top-2 z-10 rounded-full bg-white/85 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-navy/70 backdrop-blur"
                      >
                        Affiliate
                      </span>
                      {it.image_url ? (
                        <img
                          src={it.image_url}
                          alt={it.headline}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
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
                    <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-navy md:text-base">
                      {it.headline}
                    </h3>
                    <a
                      href={it.affiliate_link}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="mt-1 inline-flex items-center gap-1 self-start text-xs font-semibold text-[#1a6fbf] hover:underline"
                    >
                      Shop now
                      <ExternalLink size={11} aria-hidden />
                    </a>
                  </article>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
