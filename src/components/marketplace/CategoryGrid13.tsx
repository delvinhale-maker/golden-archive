import { Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { CATEGORIES, accentFor } from "@/lib/categories";
import { CategoryLineIcon } from "./CategoryIcons";
import { getCategoryCounts } from "@/lib/creators.functions";

export const categoryCountsQ = queryOptions({
  queryKey: ["mp", "category-counts"],
  queryFn: () => getCategoryCounts(),
  staleTime: 5 * 60_000,
});

// One-line editorial descriptions per category slug.
const CATEGORY_BLURBS: Record<string, string> = {
  ebooks:
    "Battle-tested playbooks on wealth, leadership, and stewardship — written by operators who've shipped.",
  financial_planners:
    "Real-formula planners for budgeting, investing, and debt payoff — built to move numbers, not just track them.",
  ai_prompt_packs:
    "Automation, prompts, workflows, and future-ready tools for the AI-native builder.",
  business_templates:
    "Contracts, proposals, SOPs, and decks — copy-ready systems for founders shipping now.",
  budget_spreadsheets:
    "Real-formula workbooks for personal, household, ministry, and small-business finance.",
  printable_journals:
    "Print-and-go journals for reflection, gratitude, and habit-building — designed for daily use, not decoration.",
  childrens_educational:
    "Worksheets, unit studies, and activity packs for raising sharp, kind kids.",
  bible_studies:
    "Verse-by-verse guides, devotionals, and small-group curricula rooted in Scripture.",
  courses:
    "Cohort-grade video courses on marketing, finance, and calling — taught by shippers.",
  digital_toolkits:
    "All-in-one bundles of templates, checklists, and prompts grouped by role and outcome.",
  business_operating_systems:
    "Notion, ClickUp, and Airtable systems that run hiring, ops, delivery, and finance.",
  prompt_packs:
    "Battle-tested prompt libraries for ChatGPT, Claude, and Gemini — for marketing, writing, ops, and research.",
  templates:
    "Ready-to-ship templates for Figma, Notion, Docs, and Slides — designed by working operators.",
};

function GoldDiamond({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex items-center gap-3 ${className}`}
    >
      <span className="h-px w-16 bg-gradient-to-r from-transparent via-gold/60 to-gold" />
      <svg width="14" height="14" viewBox="0 0 14 14" className="text-gold">
        <path
          d="M7 0.75 L13.25 7 L7 13.25 L0.75 7 Z"
          fill="currentColor"
          opacity="0.9"
        />
        <path
          d="M7 3 L11 7 L7 11 L3 7 Z"
          fill="#08101D"
          opacity="0.55"
        />
      </svg>
      <span className="h-px w-16 bg-gradient-to-l from-transparent via-gold/60 to-gold" />
    </span>
  );
}

function BackgroundOrnaments() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* soft radial glows */}
      <div
        className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full opacity-[0.22]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(201,162,39,0.55), rgba(201,162,39,0.08) 55%, transparent 75%)",
        }}
      />
      <div
        className="absolute bottom-0 right-[-120px] h-[420px] w-[420px] rounded-full opacity-[0.16]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(46,91,138,0.6), transparent 70%)",
        }}
      />
      <div
        className="absolute -left-24 top-1/3 h-[360px] w-[360px] rounded-full opacity-[0.12]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(201,162,39,0.5), transparent 70%)",
        }}
      />
      {/* faint blueprint grid */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.045]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="av-blueprint" width="56" height="56" patternUnits="userSpaceOnUse">
            <path d="M56 0H0V56" fill="none" stroke="#c9a227" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#av-blueprint)" />
      </svg>
      {/* thin gold flourish lines */}
      <svg
        className="absolute left-0 top-24 hidden h-40 w-1/2 opacity-[0.18] md:block"
        viewBox="0 0 600 160"
        fill="none"
      >
        <path
          d="M0 140 C 120 60, 260 60, 380 110 S 560 140, 600 90"
          stroke="url(#av-flourish-a)"
          strokeWidth="1"
        />
        <defs>
          <linearGradient id="av-flourish-a" x1="0" x2="1">
            <stop offset="0" stopColor="#c9a227" stopOpacity="0" />
            <stop offset="0.5" stopColor="#c9a227" stopOpacity="0.8" />
            <stop offset="1" stopColor="#c9a227" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <svg
        className="absolute right-0 bottom-24 hidden h-40 w-1/2 opacity-[0.18] md:block"
        viewBox="0 0 600 160"
        fill="none"
      >
        <path
          d="M600 20 C 480 100, 340 100, 220 60 S 40 20, 0 70"
          stroke="url(#av-flourish-b)"
          strokeWidth="1"
        />
        <defs>
          <linearGradient id="av-flourish-b" x1="0" x2="1">
            <stop offset="0" stopColor="#c9a227" stopOpacity="0" />
            <stop offset="0.5" stopColor="#c9a227" stopOpacity="0.8" />
            <stop offset="1" stopColor="#c9a227" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export function CategoryGrid13() {
  const { data } = useSuspenseQuery(categoryCountsQ);
  const counts = (data ?? {}) as Record<string, number>;

  return (
    <section
      id="categories"
      className="relative overflow-hidden bg-[#08101D] py-24 md:py-32"
    >
      <BackgroundOrnaments />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Editorial header */}
        <div className="mx-auto flex max-w-[650px] flex-col items-center text-center">
          <div className="text-[11px] font-semibold tracking-[0.32em] text-gold">
            THE AURUMVAULT LIBRARY
          </div>
          <h2 className="mt-5 font-display text-[34px] leading-[1.08] text-white sm:text-5xl md:text-[56px]">
            Discover Your Next{" "}
            <span className="gold-gradient italic">Advantage.</span>
          </h2>
          <p className="mt-6 text-[15px] leading-[1.75] text-white/70 md:text-base">
            Explore professionally curated digital resources designed to help you
            build wealth, strengthen your faith, grow your business, master new
            skills, and create lasting impact. Every category is carefully
            selected for quality, practicality, and immediate value.
          </p>
          <GoldDiamond className="mt-10" />
        </div>

        {/* Category intro */}
        <div className="mx-auto mt-20 flex max-w-2xl flex-col items-center text-center md:mt-24">
          <div className="text-[10px] font-semibold tracking-[0.28em] text-gold/80">
            EXPLORE
          </div>
          <h3 className="mt-3 font-display text-2xl text-white md:text-3xl">
            Browse by Category
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-white/60 md:text-[15px]">
            Find the knowledge, systems, planners, templates, and educational
            resources that match your goals.
          </p>
        </div>

        {/* Premium category cards */}
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.filter(
            (c) =>
              ![
                "business_operating_systems",
                "bible_studies",
                "digital_toolkits",
                "budget_spreadsheets",
                "business_templates",
                "ai_prompt_packs",
                "prompt_packs",
              ].includes(c.slug) && (counts[c.slug] ?? 0) > 0,
          ).map((c) => {
            const count = counts[c.slug] ?? 0;
            const blurb = CATEGORY_BLURBS[c.slug] ?? "";
            const accent = accentFor(c.slug);
            return (
              <Link
                key={c.slug}
                to="/products"
                search={{ category: c.slug } as never}
                style={{
                  borderTopColor: accent,
                  ["--cat-accent" as string]: accent,
                } as Record<string, string>}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 border-t-[3px] bg-gradient-to-b from-white/[0.045] to-white/[0.015] p-6 transition-all duration-500 hover:-translate-y-1 hover:from-white/[0.08] hover:to-white/[0.03] hover:shadow-[0_0_0_1px_var(--cat-accent),0_18px_40px_-24px_var(--cat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#08101D]"
              >
                {/* corner filigree */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-4 top-4 h-6 w-6 opacity-30 transition-opacity duration-500 group-hover:opacity-70"
                >
                  <svg viewBox="0 0 24 24" className="text-gold">
                    <path
                      d="M2 2 H14 M2 2 V14"
                      stroke="currentColor"
                      strokeWidth="1"
                      fill="none"
                    />
                    <path
                      d="M22 22 H10 M22 22 V10"
                      stroke="currentColor"
                      strokeWidth="1"
                      fill="none"
                    />
                  </svg>
                </span>

                <div className="flex items-start gap-4">
                  <div
                    className="relative grid h-14 w-14 shrink-0 place-items-center rounded-xl ring-1 ring-white/10 transition-transform duration-500 group-hover:scale-105"
                    style={{ background: c.gradient }}
                  >
                    <CategoryLineIcon slug={c.slug} className="h-8 w-8" />
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-xl opacity-0 ring-1 ring-gold/50 transition-opacity duration-500 group-hover:opacity-100"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-lg leading-tight text-white">
                      {c.label}
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold/80">
                      {count} product{count === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>

                {blurb && (
                  <p className="mt-4 text-sm leading-relaxed text-white/65">
                    {blurb}
                  </p>
                )}

                <div className="mt-5 flex items-center gap-1.5 text-[12px] font-semibold text-white/70 transition-colors group-hover:text-gold">
                  Explore
                  <ArrowRight
                    size={13}
                    className="transition-transform duration-300 group-hover:translate-x-0.5"
                  />
                </div>

                {/* hairline gold underline on hover */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-6 bottom-0 h-px origin-left scale-x-0 bg-gradient-to-r from-transparent via-gold to-transparent transition-transform duration-500 group-hover:scale-x-100"
                />
              </Link>
            );
          })}
        </div>

        {/* Section CTA */}
        <div className="mx-auto mt-20 flex max-w-2xl flex-col items-center text-center md:mt-24">
          <GoldDiamond />
          <h3 className="mt-8 font-display text-2xl text-white md:text-[28px]">
            Not sure where to begin?
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-white/65 md:text-[15px]">
            Browse our most popular collections and discover the digital
            resources creators and professionals trust.
          </p>
          <Link
            to="/products"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-gold px-7 text-sm font-bold text-navy shadow-[0_10px_30px_-10px_rgba(201,162,39,0.65)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-gold-soft hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#08101D]"
          >
            Explore All Categories
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
