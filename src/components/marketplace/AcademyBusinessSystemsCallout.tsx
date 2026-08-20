import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2 } from "lucide-react";
import { getProducts } from "@/lib/marketplace.functions";
import {
  BUSINESS_SYSTEMS_FLAGSHIP,
  BUSINESS_SYSTEMS_LABEL,
  BUSINESS_SYSTEMS_SLUG,
} from "@/lib/business-systems";

/**
 * Keywords that mark an Academy article as topically relevant to the Business
 * Systems department. Matched case-insensitively against category, title,
 * excerpt, tags, and body so cross-links only appear on related reading.
 */
const RELEVANT_KEYWORDS = [
  "business system",
  "business operating system",
  "operating system",
  "workflow",
  "standard operating procedure",
  "operations",
  "productivity system",
  "marketing system",
  "sales process",
  "sales pipeline",
  "client onboarding",
  "client management",
  "crm",
  "lead generation",
  "customer service",
  "dashboard",
  "prompt vault",
  "ai business",
  "small business",
  "entrepreneur",
  "solopreneur",
  "agency",
  "automation",
  "scaling",
  "hiring",
  "delegation",
];

const RELEVANT_CATEGORY_SLUGS = [
  "business",
  "business-growth",
  "ai",
  "ai-productivity",
  "ai-and-productivity",
  "productivity",
  "marketing",
  "creator-business",
  "leadership",
];

export type AcademyArticleLike = {
  category?: string | null;
  title?: string | null;
  excerpt?: string | null;
  focus_keyword?: string | null;
  tags?: string[] | null;
  body?: string | null;
};

/** True when the article is topically close enough to warrant the cross-link. */
export function isBusinessSystemsRelevant(article: AcademyArticleLike): boolean {
  const cat = (article.category ?? "").toLowerCase();
  if (RELEVANT_CATEGORY_SLUGS.includes(cat)) return true;
  const haystack = [
    article.title,
    article.excerpt,
    article.focus_keyword,
    ...(article.tags ?? []),
    (article.body ?? "").slice(0, 4000),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  // Word-boundary match so generic substrings (e.g. "lead" inside "leader")
  // never trigger an off-topic cross-link.
  return RELEVANT_KEYWORDS.some((k) =>
    new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(haystack),
  );
}

/**
 * Contextual cross-link block: sends relevant Academy readers to the Business
 * Systems landing page and, when it is live, straight to the featured system.
 */
export function AcademyBusinessSystemsCallout({
  article,
}: {
  article: AcademyArticleLike;
}) {
  const relevant = isBusinessSystemsRelevant(article);

  const { data } = useQuery({
    queryKey: ["academy-business-systems-flagship"],
    enabled: relevant,
    staleTime: 5 * 60_000,
    queryFn: () =>
      getProducts({
        data: { category: BUSINESS_SYSTEMS_SLUG, pageSize: 24, page: 1 },
      }),
  });

  if (!relevant) return null;

  const flagship = (data?.items ?? []).find((p) =>
    p.title.toLowerCase().includes(BUSINESS_SYSTEMS_FLAGSHIP.titleMatch),
  );

  return (
    <aside
      aria-labelledby="academy-business-systems-callout"
      className="mt-14 overflow-hidden rounded-2xl border border-[#B8860B]/40 bg-gradient-to-br from-[#0B1424] via-[#0F1E35] to-[#241E10] p-6 md:p-8"
    >
      <span className="inline-flex items-center gap-2 rounded-full border border-[#B8860B]/50 bg-[#B8860B]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#E9C46A]">
        <Building2 size={12} aria-hidden /> Put this into practice
      </span>
      <h2
        id="academy-business-systems-callout"
        className="mt-4 font-serif text-2xl font-semibold leading-snug text-white"
      >
        Turn this into a working system
      </h2>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/75">
        AurumVault{" "}
        <Link
          to="/business-systems"
          className="font-semibold text-[#E9C46A] underline decoration-[#B8860B]/50 underline-offset-2 hover:decoration-[#E9C46A]"
        >
          {BUSINESS_SYSTEMS_LABEL}
        </Link>{" "}
        bundle the workflows, prompts, dashboards, and implementation plans
        behind ideas like these — so marketing, sales, service, and operations
        run without guesswork.
      </p>

      {flagship && (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.05] p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#E9C46A]">
            Featured system
          </div>
          <Link
            to="/products/$id"
            params={{ id: flagship.id }}
            className="mt-1 block font-serif text-lg font-semibold leading-snug text-white hover:text-[#E9C46A]"
          >
            {flagship.title}
          </Link>
          <p className="mt-1 text-[13px] text-white/65">
            {BUSINESS_SYSTEMS_FLAGSHIP.subtitle}
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          to="/business-systems"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#B8860B] px-5 py-3 text-[12px] font-bold uppercase tracking-widest text-[#0F1E35] transition hover:brightness-110"
        >
          Explore Business Systems <ArrowRight size={14} aria-hidden />
        </Link>
        {flagship && (
          <Link
            to="/products/$id"
            params={{ id: flagship.id }}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 px-5 py-3 text-[12px] font-bold uppercase tracking-widest text-white transition hover:border-[#E9C46A] hover:text-[#E9C46A]"
          >
            View the featured system <ArrowRight size={14} aria-hidden />
          </Link>
        )}
      </div>
    </aside>
  );
}
