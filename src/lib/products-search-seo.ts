export type ProductsSearchSeoInput = {
  category?: string;
  sort?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  sub?: string;
  type?: string;
  page?: number;
  pageSize?: number;
};

const BASE = "https://www.aurumvault.store";

const CLEAN_CATEGORY_CANONICALS: Record<string, string> = {
  ebooks: "/ebooks",
  journals: "/journals",
  printable_journals: "/journals",
  planners: "/planners",
  financial_planners: "/planners",
  "financial planners": "/planners",
  "ai prompt packs": "/ai-prompt-packs",
  ai_prompt_packs: "/ai-prompt-packs",
  prompt_packs: "/ai-prompt-packs",
  "business systems": "/business-systems",
  business_operating_systems: "/business-systems",
  "creator business tools": "/creator-business-tools",
  creator_business_tools: "/creator-business-tools",
  "caption templates": "/caption-templates",
  caption_templates: "/caption-templates",
  "film, tv & creator production": "/collections/film-tv-creator-production",
  film_tv_creator_production: "/collections/film-tv-creator-production",
};

function normalized(value?: string): string {
  return (value ?? "").trim().toLowerCase();
}

export function productsSearchSeo(input: ProductsSearchSeoInput) {
  const hasMeaningfulState = Object.entries(input).some(([key, value]) => {
    if (value === undefined || value === null || value === "") return false;
    if (key === "page" && value === 1) return false;
    if (key === "pageSize" && value === 24) return false;
    return true;
  });

  if (!hasMeaningfulState) {
    return {
      robots: "index, follow",
      canonical: `${BASE}/products`,
    } as const;
  }

  return {
    robots: "noindex, follow",
    canonical:
      CLEAN_CATEGORY_CANONICALS[normalized(input.category)]
        ? `${BASE}${CLEAN_CATEGORY_CANONICALS[normalized(input.category)]}`
        : `${BASE}/products`,
  } as const;
}
