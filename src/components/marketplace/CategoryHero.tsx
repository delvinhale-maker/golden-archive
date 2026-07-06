import { getCategoryTheme } from "@/lib/category-theme";
import { getCategoryDef } from "@/lib/categories";
import { Sparkles } from "lucide-react";
import type { Product } from "@/lib/marketplace.functions";
import { useMemo } from "react";

type Creator = { id: string; name: string; count: number };

export function CategoryHero({
  category,
  resultCount,
  query,
  products,
  activeSub,
  onSubChange,
}: {
  category?: string | null;
  resultCount?: number;
  query?: string | null;
  products?: Product[];
  activeSub?: string | null;
  onSubChange?: (sub: string | null) => void;
}) {
  const theme = getCategoryTheme(category);
  const def = getCategoryDef(category);
  const title = query
    ? `Results for "${query}"`
    : (category ?? "Browse the Vault");

  const featured = useMemo(
    () => (products ?? []).slice(0, 3),
    [products],
  );

  const topCreators = useMemo<Creator[]>(() => {
    if (!products?.length) return [];
    const map = new Map<string, Creator>();
    for (const p of products) {
      const key = p.creator.id;
      const cur = map.get(key) ?? { id: key, name: p.creator.name, count: 0 };
      cur.count += 1;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [products]);

  return (
    <section
      className="border-b"
      style={{
        background: theme.bg,
        borderBottomColor: theme.border,
        color: theme.ink,
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-10 sm:px-6 md:py-14 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <span
            aria-hidden
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl md:h-16 md:w-16 md:text-4xl"
            style={{
              background: theme.pill,
              border: `1px solid ${theme.border}`,
            }}
          >
            {theme.icon}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-caps"
                style={{
                  background: theme.pill,
                  border: `1px solid ${theme.border}`,
                  color: theme.accent,
                }}
              >
                <Sparkles size={11} /> {category ?? "All Categories"}
              </span>
              {typeof resultCount === "number" && (
                <span className="text-[11px] font-semibold uppercase tracking-caps opacity-70">
                  {resultCount} {resultCount === 1 ? "product" : "products"}
                </span>
              )}
            </div>
            <h1
              className="mt-1 font-display text-3xl font-bold leading-tight md:text-4xl"
              style={{ color: theme.ink }}
            >
              {title}
            </h1>
          </div>
        </div>

        <p
          className="max-w-2xl text-sm md:text-[15px]"
          style={{ color: "rgba(255,255,255,0.78)" }}
        >
          {theme.blurb}
        </p>

        {def?.subs?.length ? (
          <div className="flex flex-wrap gap-2">
            {def.subs.map((s) => {
              const active = activeSub === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSubChange?.(active ? null : s)}
                  className="rounded-full px-3.5 py-1.5 text-xs font-semibold transition"
                  style={{
                    background: active ? theme.accent : theme.pill,
                    color: active ? "#0B0B0B" : theme.ink,
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
        ) : null}

        {(featured.length > 0 || topCreators.length > 0) && (
          <div className="mt-2 grid gap-4 md:grid-cols-2">
            {featured.length > 0 && (
              <div>
                <div
                  className="mb-2 text-[10px] font-bold uppercase tracking-caps"
                  style={{ color: theme.accent }}
                >
                  Featured in {category ?? "the Vault"}
                </div>
                <ul className="space-y-1.5">
                  {featured.map((p) => (
                    <li
                      key={p.id}
                      className="truncate text-sm"
                      style={{ color: "rgba(255,255,255,0.9)" }}
                    >
                      <span
                        className="mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
                        style={{ background: theme.accent }}
                      />
                      {p.title}
                      <span className="ml-2 text-xs opacity-60">
                        ${p.price.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {topCreators.length > 0 && (
              <div>
                <div
                  className="mb-2 text-[10px] font-bold uppercase tracking-caps"
                  style={{ color: theme.accent }}
                >
                  Top creators here
                </div>
                <div className="flex flex-wrap gap-2">
                  {topCreators.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                      style={{
                        background: theme.pill,
                        border: `1px solid ${theme.border}`,
                        color: theme.ink,
                      }}
                    >
                      {c.name}
                      <span
                        className="rounded-full px-1.5 text-[10px]"
                        style={{ background: theme.accent, color: "#0B0B0B" }}
                      >
                        {c.count}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
