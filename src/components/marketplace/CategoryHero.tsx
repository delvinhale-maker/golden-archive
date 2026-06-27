import { getCategoryTheme } from "@/lib/category-theme";
import { Crown } from "lucide-react";

export function CategoryHero({
  category,
  resultCount,
  query,
}: {
  category?: string | null;
  resultCount?: number;
  query?: string | null;
}) {
  const theme = getCategoryTheme(category);
  const title = query
    ? `Results for "${query}"`
    : (category ?? "Browse the Vault");

  return (
    <section
      className="border-b"
      style={{
        background: theme.bg,
        borderBottomColor: theme.border,
        color: theme.ink,
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 sm:px-6 md:py-10 lg:px-8">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-caps"
            style={{
              background: theme.pill,
              border: `1px solid ${theme.border}`,
              color: theme.accent,
            }}
          >
            <Crown size={11} /> {category ?? "All Categories"}
          </span>
          {typeof resultCount === "number" && (
            <span className="text-[11px] font-semibold uppercase tracking-caps opacity-70">
              {resultCount} {resultCount === 1 ? "title" : "titles"}
            </span>
          )}
        </div>
        <h1
          className="font-display text-3xl font-bold leading-tight md:text-4xl"
          style={{ color: theme.ink }}
        >
          {title}
        </h1>
        <p
          className="max-w-2xl text-sm md:text-[15px]"
          style={{ color: "rgba(255,255,255,0.75)" }}
        >
          {theme.blurb}
        </p>
      </div>
    </section>
  );
}
