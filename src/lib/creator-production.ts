// Merchandising layer for the Film, TV & Creator Production department.
//
// "Creator Production Systems" is a collection label — NOT a second category
// system. It reuses the existing product_category enum value
// `film_tv_creator_production` plus the admin-managed
// `product_subcategories` rows, so no parallel taxonomy or extra table exists.

export const FILM_TV_SLUG = "film_tv_creator_production" as const;
export const FILM_TV_LABEL = "Film, TV & Creator Production";
export const FILM_TV_SUBTITLE =
  "Professional systems for creators building stories, productions, audiences, and entertainment businesses.";

/** Collection / merchandising label used for the more substantial systems. */
export const CREATOR_SYSTEMS_COLLECTION = "Creator Production Systems";
/** Short per-card label. Kept small and restrained on purpose. */
export const CREATOR_SYSTEM_BADGE = "Creator Production System";

/**
 * True when a product belongs to the Creator Production Systems collection.
 * Category-driven so new products join the collection with no code change.
 */
export function isCreatorProductionSystem(
  category?: string | null,
): boolean {
  return (category ?? "").toLowerCase() === FILM_TV_SLUG;
}

export type FilmTvSubcategory = {
  name: string;
  blurb: string;
};

/** Discovery cards. Names match the managed subcategory rows exactly. */
export const FILM_TV_SUBCATEGORIES: FilmTvSubcategory[] = [
  {
    name: "Vertical Series & Microdrama",
    blurb: "Build serialized vertical entertainment.",
  },
  {
    name: "Film & Tubi-Style Production",
    blurb:
      "Tools for independent filmmakers and streaming-focused productions.",
  },
  {
    name: "Reality TV",
    blurb: "Develop concepts, casts, episodes, pitches, and production systems.",
  },
  {
    name: "YouTube & Social Video",
    blurb: "Professional systems for creator-led video businesses.",
  },
  {
    name: "Music & Entertainment",
    blurb:
      "Tools for artists, entertainers, managers, releases, content, and promotion.",
  },
  {
    name: "Pitching & Distribution",
    blurb:
      "Package projects and manage outreach, deliverables, and distribution opportunities.",
  },
  {
    name: "AI Creator Tools",
    blurb: "Structured workflows for AI-assisted entertainment production.",
  },
];

/**
 * Flagship listing spec. This is storefront copy only — it does not create a
 * product row or any downloadable file. When a real listing exists in the
 * category the landing page links to it; until then the spec renders as an
 * announced, not-yet-purchasable system.
 */
export const FLAGSHIP_SYSTEM = {
  title: "Vertical Microdrama Creator OS™",
  subtitle:
    "Interactive Series Development, Production, Pitch & Launch System",
  priceLabel: "$69",
  subcategory: "Vertical Series & Microdrama",
  collection: CREATOR_SYSTEMS_COLLECTION,
  body:
    "Build your vertical series like a real production. Develop the concept, architect the season, structure episodes, manage production, control the budget, prepare the pitch, organize distribution, launch the series, and analyze audience performance from one connected creator system.",
  highlights: [
    "30–100 Episode Planning",
    "Character & Continuity System",
    "Episode Engine",
    "Production Command Center",
    "AI + Live Action + Hybrid Workflows",
    "Budget & Break-Even Tools",
    "Pitch & Distribution System",
    "Launch & Analytics Center",
  ],
  tags: [
    "Vertical Microdrama",
    "Vertical Series",
    "Microdrama",
    "Filmmaking",
    "Independent Film",
    "Creator Production",
    "AI Filmmaking",
    "Content Production",
    "Series Development",
    "Production Planning",
    "Pitch Deck",
    "Distribution",
    "YouTube Creator",
    "Social Video",
    "Entertainment",
    "Creator OS",
  ],
} as const;
