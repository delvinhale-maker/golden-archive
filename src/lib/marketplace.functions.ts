import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { slugToLabel, labelToSlug } from "@/lib/categories";

const API_BASE = "https://web-builder-pro-delvinhale.replit.app/api";

function serverSupabase() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

type DbProductRow = {
  id: string;
  title: string;
  category: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  cover_url: string | null;
  description: string | null;
  seller_id: string;
  created_at: string;
  ai_review_status: string | null;
  ai_review_score: number | null;
  is_preorder?: boolean | null;
  release_date?: string | null;
  released_at?: string | null;
  preorder_note?: string | null;
  admin_notes?: string | null;
  file_path?: string | null;
  preview_pages?: number[] | null;
};

export function parseWhatsIncluded(adminNotes?: string | null): string[] | undefined {
  if (!adminNotes) return undefined;
  try {
    const parsed = JSON.parse(adminNotes) as Record<string, unknown>;
    const raw = parsed.whatsIncluded;
    if (typeof raw !== "string" || !raw.trim()) return undefined;
    return raw
      .split(/\r?\n|•|-\s|\*\s/)
      .map((s) => s.replace(/^[•\-\*]\s*/, "").trim())
      .filter(Boolean);
  } catch {
    return undefined;
  }
}


function dbRowToProduct(r: DbProductRow, sellerName = "AurumVault"): Product {
  const catLabel = slugToLabel(r.category);
  const compareAt =
    r.compare_at_price_cents != null && r.compare_at_price_cents > r.price_cents
      ? r.compare_at_price_cents / 100
      : undefined;
  const isPreorder =
    !!r.is_preorder &&
    !r.released_at &&
    (!r.release_date || new Date(r.release_date).getTime() > Date.now());
  const isEbook = r.category.toLowerCase() === "ebooks";
  const included = isEbook ? undefined : parseWhatsIncluded(r.admin_notes);
  return {
    id: r.id,
    title: r.title,
    category: catLabel,
    price: r.price_cents / 100,
    compareAtPrice: compareAt,
    rating: 0,
    reviewCount: 0,
    image:
      r.cover_url && r.cover_url.trim().length > 0
        ? r.cover_url
        : `av:${catLabel}:0`,
    bestseller: false,
    creator: { id: r.seller_id, name: sellerName, verified: true },
    description: r.description ?? undefined,
    included,
    aiReviewStatus: (r.ai_review_status as Product["aiReviewStatus"]) ?? null,
    aiReviewScore: r.ai_review_score ?? null,
    isPreorder,
    releaseDate: r.release_date ?? null,
    preorderNote: r.preorder_note ?? null,
    previewPages: Array.isArray(r.preview_pages) ? r.preview_pages : [],
    fileExt: (r.file_path ?? "").split(".").pop()?.toLowerCase() ?? null,
  };
}


// Fetch real aggregate rating/review counts for a set of product IDs.
// product_reviews has a public SELECT policy, so the publishable-key client
// can read it server-side without exposing the service role.
async function fetchReviewAggregates(
  supa: ReturnType<typeof serverSupabase>,
  productIds: string[],
): Promise<Map<string, { rating: number; count: number }>> {
  const map = new Map<string, { rating: number; count: number }>();
  if (productIds.length === 0) return map;
  const { data, error } = await supa
    .from("product_reviews")
    .select("product_id,rating")
    .in("product_id", productIds);
  if (error || !data) return map;
  const buckets = new Map<string, { sum: number; n: number }>();
  for (const row of data as Array<{ product_id: string; rating: number }>) {
    const cur = buckets.get(row.product_id) ?? { sum: 0, n: 0 };
    cur.sum += row.rating;
    cur.n += 1;
    buckets.set(row.product_id, cur);
  }
  for (const [id, { sum, n }] of buckets.entries()) {
    map.set(id, { rating: n > 0 ? sum / n : 0, count: n });
  }
  return map;
}

function applyAggregates(
  products: Product[],
  agg: Map<string, { rating: number; count: number }>,
): Product[] {
  return products.map((p) => {
    const a = agg.get(p.id);
    if (!a) return p;
    return { ...p, rating: Math.round(a.rating * 10) / 10, reviewCount: a.count };
  });
}

async function fetchDbProducts(opts: { category?: string; q?: string } = {}): Promise<Product[]> {
  try {
    const supa = serverSupabase();
    let query = supa
      .from("marketplace_products")
      .select("id,title,category,price_cents,compare_at_price_cents,cover_url,description,seller_id,created_at,ai_review_status,ai_review_score")
      .eq("status", "approved")
      .eq("published", true)
      .order("created_at", { ascending: false });
    if (opts.category && opts.category !== "All") {
      const slug = labelToSlug(opts.category) ?? opts.category.toLowerCase();
      query = query.eq(
        "category",
        slug as Database["public"]["Enums"]["product_category"],
      );
    }
    if (opts.q) query = query.ilike("title", `%${opts.q}%`);
    const { data, error } = await query;
    if (error || !data) return [];
    const products = (data as DbProductRow[]).map((r) => dbRowToProduct(r));
    const agg = await fetchReviewAggregates(supa, products.map((p) => p.id));
    return applyAggregates(products, agg);
  } catch {
    return [];
  }
}

export type Creator = {
  id: string;
  name: string;
  tagline: string;
  avatar: string;
  verified: boolean;
  productsCount: number;
  salesCount: number;
  bio?: string;
};

export type Product = {
  id: string;
  title: string;
  category: string;
  price: number;
  compareAtPrice?: number;
  rating: number;
  reviewCount: number;
  image: string;
  images?: string[];
  bestseller?: boolean;
  creator: { id: string; name: string; verified: boolean; avatar?: string };
  description?: string;
  included?: string[];
  aiReviewStatus?: "pass" | "warn" | "fail" | "pending" | null;
  aiReviewScore?: number | null;
  isPreorder?: boolean;
  releaseDate?: string | null;
  preorderNote?: string | null;
  /** Ordered PDF page numbers (1-indexed) the creator exposed as a public preview. */
  previewPages?: number[];
  /** Lowercase file extension (`pdf` / `docx` / `epub`), or null when unknown. */
  fileExt?: string | null;
};

export type ProductDetailResult =
  | { kind: "published"; product: Product }
  | { kind: "unpublished"; title: string | null }
  | { kind: "notFound" };




const CATEGORIES = [
  "eBooks",
  "Courses",
  "Templates",
  "Audio",
  "Finance",
  "Leadership",
  "Purpose",
  "Business",
];

const CREATOR_NAMES = [
  ["AurumVault", "Curated by AurumVault"],
];

// Category-specific title pools — every category has ≥ 14 unique titles
const TITLES_BY_CAT: Record<string, string[]> = {
  eBooks: [
    "The Stewardship Codex",
    "Quiet Equity",
    "Letters to a Young Operator",
    "The Patient Capital Series",
    "Wealth With Reverence",
    "The Founder's Daily Office",
    "Sovereign Mornings",
    "The Inheritance Manual",
    "Boardroom Liturgy",
    "Built to Endure",
    "The Long Compounding",
    "Notes on a Quiet Empire",
    "The Discipline of Restraint",
    "Heir Mindset Field Guide",
    "The Architecture of Trust",
  ],
  Courses: [
    "Sovereign Leadership Playbook",
    "Quiet Equity: The 12-Week Course",
    "Brand Theology Intensive",
    "The Capital Architect Program",
    "Heir Mindset Workshop",
    "Operator's Bootcamp",
    "Purposeful Pricing Masterclass",
    "Boardroom Communication Lab",
    "Founder OS — Cohort 03",
    "The Stewardship Sprint",
    "Patient Capital Fundamentals",
    "Legacy Brand Studio",
    "Wealth Liturgy: 30 Days",
    "Operator-Investor Track",
  ],
  Templates: [
    "Operator's Calendar 2025",
    "Boardroom Deck Kit",
    "Founder Wiki — Notion Build",
    "Cap Table Atlas",
    "Investor Memo Library",
    "Quarterly Review Workbook",
    "Hiring Loop Templates",
    "Brand Theology Brief Pack",
    "Pricing Architecture Sheets",
    "Customer Discovery Canvas",
    "OKR Liturgy — Notion",
    "Series A Data Room Kit",
    "Executive 1:1 System",
    "Annual Letter Template",
  ],
  Audio: [
    "Boardroom Liturgy — Audio",
    "Morning Office for Founders",
    "Quiet Capital Meditations",
    "The Stewardship Recitations",
    "Operator's Examen",
    "Vespers for Builders",
    "Compline of the Long Game",
    "Lectio for Leaders",
    "The Sovereign Hour",
    "Daily Office: Equity Edition",
    "Vigils of the Operator",
    "Patient Capital — Lossless",
    "Heir Mindset Audio Course",
    "The Architect's Recordings",
  ],
  Finance: [
    "The Patient Capital Series",
    "Quiet Equity Playbook",
    "Cap Table Atlas",
    "Long Compounding Notebook",
    "Steward Portfolio Models",
    "Family Office Field Guide",
    "Endowment Discipline",
    "The Reverent Investor",
    "Private Markets Liturgy",
    "Treasury Architecture",
    "Allocator's Daily Office",
    "Diligence Sheets — Pro",
    "Capital Architecture 101",
    "The Sovereign Allocator",
  ],
  Leadership: [
    "Sovereign Leadership Playbook",
    "Boardroom Liturgy",
    "The Stewardship Codex",
    "Quiet Authority",
    "Letters to a Young Operator",
    "Heir Mindset Workshop",
    "The Long Conversation",
    "Founder's Examen",
    "Leadership With Reverence",
    "The Architect's Council",
    "Operator Theology",
    "The Patient Leader",
    "Sovereign Mornings",
    "Council of Three",
  ],
  Purpose: [
    "Built to Endure",
    "The Inheritance Manual",
    "Wealth With Reverence",
    "Notes on a Quiet Empire",
    "Brand Theology",
    "Purposeful Pricing",
    "The Long Game Manifesto",
    "Vocation of the Operator",
    "Capital as Liturgy",
    "Quiet Empire Field Guide",
    "The Sacred Spreadsheet",
    "Steward Manifesto",
    "Slow Growth Doctrine",
    "Reverent Ambition",
  ],
  Business: [
    "Operator's Calendar 2025",
    "Founder OS",
    "Quiet Equity Playbook",
    "Brand Theology: A Field Manual",
    "Purposeful Pricing",
    "Hiring Loop Manual",
    "Annual Letter Workshop",
    "Series A Survival Kit",
    "The Patient Operator",
    "Customer Discovery Liturgy",
    "Margin Architecture",
    "The Reverent Roadmap",
    "Quiet Distribution",
    "Operator-Investor Handbook",
  ],
};

function pickTitle(category: string, index: number): string {
  const pool = TITLES_BY_CAT[category] ?? TITLES_BY_CAT.Business;
  return pool[index % pool.length];
}

function mockCreator(i: number): Creator {
  const [name, tagline] = CREATOR_NAMES[i % CREATOR_NAMES.length];
  return {
    id: `c_${i}`,
    name,
    tagline,
    avatar: `https://i.pravatar.cc/160?img=${(i % 70) + 1}`,
    verified: true,
    productsCount: 6 + (i % 18),
    salesCount: 320 + i * 47,
    bio: "Building purpose-driven resources for operators, founders, and leaders who measure outcomes in legacy.",
  };
}

/**
 * Build a deterministic product. When `category` is provided we draw the title
 * from that category's title pool so every card in a filtered list is unique.
 */
function priceFor(cat: string, idx: number): number {
  // Realistic digital product price bands; never exceeds $97.
  const bands: Record<string, [number, number]> = {
    eBooks: [9, 29],
    Courses: [27, 97],
    Templates: [17, 47],
    Audio: [12, 37],
    Finance: [19, 67],
    Leadership: [19, 67],
    Purpose: [12, 47],
    Business: [17, 57],
  };
  const [lo, hi] = bands[cat] ?? [9, 67];
  const span = hi - lo + 1;
  return lo + ((idx * 7 + cat.length * 3) % span);
}

function mockProduct(absoluteIndex: number, category?: string): Product {
  const cat = category ?? CATEGORIES[absoluteIndex % CATEGORIES.length];
  const titleIndex = category ? absoluteIndex : Math.floor(absoluteIndex / CATEGORIES.length);
  const title = pickTitle(cat, titleIndex);
  const id = category
    ? `p_${cat.toLowerCase()}_${absoluteIndex}`
    : `p_${absoluteIndex}`;
  const price = priceFor(cat, absoluteIndex);
  const compareRaw = absoluteIndex % 3 === 0 ? price + 20 : undefined;
  const compare = compareRaw && compareRaw <= 97 ? compareRaw : undefined;
  const creatorIdx = absoluteIndex % CREATOR_NAMES.length;
  return {
    id,
    title,
    category: cat,
    price,
    compareAtPrice: compare,
    rating: 4 + ((absoluteIndex * 3) % 10) / 10,
    reviewCount: 18 + ((absoluteIndex * 13) % 480),
    // image is now rendered via <ProductCover> using title + category; keep a
    // stable placeholder string so consumers that read product.image still work.
    image: `av:${cat}:${absoluteIndex}`,
    bestseller: absoluteIndex % 4 === 0,
    creator: {
      id: `c_${creatorIdx}`,
      name: CREATOR_NAMES[creatorIdx][0],
      verified: true,
      avatar: `https://i.pravatar.cc/80?img=${(creatorIdx * 7) + 1}`,
    },
    description:
      "A premium, purpose-driven resource curated for operators who want to build with intention. Includes worksheets, audio reflections, and a printable companion.",
    included: [
      "200-page main PDF (print-ready)",
      "Companion audio (3 hours, AAC)",
      "12 Notion & Figma templates",
      "Lifetime updates",
    ],
  };
}

function mockProductsAcross(n: number, offset = 0) {
  return Array.from({ length: n }, (_, i) => mockProduct(i + offset));
}

function mockProductsForCategory(cat: string, n: number, offset = 0) {
  return Array.from({ length: n }, (_, i) => mockProduct(i + offset, cat));
}

const mockCreators = (n: number) => Array.from({ length: n }, (_, i) => mockCreator(i));

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`${API_BASE}${path}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return fallback;
    const data = (await res.json()) as T;
    return data ?? fallback;
  } catch {
    return fallback;
  }
}

export const getFeaturedProducts = createServerFn({ method: "GET" }).handler(async () => {
  const dbItems = await fetchDbProducts();
  return dbItems.slice(0, 12);
});

export const getProducts = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        category: z.string().optional(),
        sort: z.string().optional(),
        page: z.number().int().min(1).default(1),
        q: z.string().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const dbItems = await fetchDbProducts({ category: data.category, q: data.q });
    return { items: dbItems, page: data.page, hasMore: false };
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getProduct = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data }) => {
    if (!UUID_RE.test(data.id)) return { kind: "notFound" } as ProductDetailResult;
    // Use service-role client so we can distinguish "does not exist" from
    // "exists but is not yet published/approved" despite RLS policies.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("marketplace_products")
      .select(
        "id,title,category,price_cents,compare_at_price_cents,cover_url,description,seller_id,created_at,ai_review_status,ai_review_score,status,published,is_preorder,release_date,released_at,preorder_note,admin_notes",
      )
      .eq("id", data.id)
      .maybeSingle();

    if (!row) return { kind: "notFound" } as ProductDetailResult;
    if (row.status !== "approved" || !row.published) {
      return { kind: "unpublished", title: row.title } as ProductDetailResult;
    }
    const product = dbRowToProduct(row as DbProductRow);
    const agg = await fetchReviewAggregates(supabaseAdmin, [product.id]);
    return { kind: "published", product: applyAggregates([product], agg)[0] } as ProductDetailResult;
  });



export const getFeaturedCreators = createServerFn({ method: "GET" }).handler(async () => {
  const fallback = mockCreators(6);
  const data = await safeFetch<unknown>("/creators/featured", fallback as unknown);
  return (Array.isArray(data) && data.length ? (data as Creator[]) : fallback) as Creator[];
});

export type HomeHighlights = {
  heroProduct: Product | null;
  illustriousProductCount: number;
};

export const getHomeHighlights = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomeHighlights> => {
    try {
      const supa = serverSupabase();
      const [heroRes, countRes] = await Promise.all([
        supa
          .from("marketplace_products")
          .select(
            "id,title,category,price_cents,cover_url,description,seller_id,created_at,ai_review_status,ai_review_score",
          )
          .eq("status", "approved")
          .eq("published", true)
          .ilike("title", "Kingdom Mind")
          .maybeSingle(),
        supa
          .from("marketplace_products")
          .select("id", { count: "exact", head: true })
          .eq("status", "approved")
          .eq("published", true)
          .eq("seller_id", "02579d2f-e0c1-4f53-b0e8-abedf18e4d4f"),
      ]);
      let heroProduct = heroRes.data
        ? dbRowToProduct(heroRes.data as DbProductRow)
        : null;
      if (heroProduct) {
        const agg = await fetchReviewAggregates(supa, [heroProduct.id]);
        heroProduct = applyAggregates([heroProduct], agg)[0];
      }
      return {
        heroProduct,
        illustriousProductCount: countRes.count ?? 0,
      };
    } catch {
      return { heroProduct: null, illustriousProductCount: 0 };
    }
  },
);

// ============================================================================
// Homepage row server functions — cloned from getFeaturedProducts pattern.
// Each row uses the same working shape as FeaturedProducts to guarantee data
// reaches the client the same way.
// ============================================================================

// Clone 1: New Releases — newest approved+published, ordered desc, top 8.
export const getNewReleasesRowFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Product[]> => {
    // fetchDbProducts already orders by created_at desc
    const items = await fetchDbProducts();
    return items.slice(0, 8);
  },
);

// Clone 2: Promoted Picks — featured=true, fallback to all products if empty.
export const getPromotedPicksRowFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Product[]> => {
    try {
      const supa = serverSupabase();
      const { data } = await supa
        .from("marketplace_products")
        .select(
          "id,title,category,price_cents,compare_at_price_cents,cover_url,description,seller_id,created_at,ai_review_status,ai_review_score",
        )
        .eq("status", "approved")
        .eq("published", true)
        .eq("featured", true)
        .order("created_at", { ascending: false });
      if (data && data.length > 0) {
        const products = (data as DbProductRow[]).map((r) => dbRowToProduct(r));
        const agg = await fetchReviewAggregates(supa, products.map((p) => p.id));
        return applyAggregates(products, agg).slice(0, 8);
      }
    } catch {
      // fall through to fallback
    }
    // Fallback: all approved products
    const fallback = await fetchDbProducts();
    return fallback.slice(0, 8);
  },
);

// Clone 3: Recommended — same query, no filter, top 8.
export const getRecommendedRowFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Product[]> => {
    const items = await fetchDbProducts();
    return items.slice(0, 8);
  },
);

// Clone 4: Kingdom Picks — affiliate_products, active=true.
export type AffiliatePick = {
  id: string;
  title: string;
  price: number | null;
  source: string | null;
  affiliateUrl: string;
  imageUrl: string | null;
  badge: string | null;
};

export const getKingdomPicksRowFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AffiliatePick[]> => {
    try {
      const supa = serverSupabase();
      const { data, error } = await supa
        .from("affiliate_products")
        .select("id,title,price,source,affiliate_url,image_url,badge,featured,created_at")
        .eq("active", true)
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(8);
      if (error || !data) return [];
      return data.map((r) => ({
        id: r.id as string,
        title: r.title as string,
        price: r.price != null ? Number(r.price) : null,
        source: (r.source as string | null) ?? null,
        affiliateUrl: r.affiliate_url as string,
        imageUrl: (r.image_url as string | null) ?? null,
        badge: (r.badge as string | null) ?? null,
      }));
    } catch {
      return [];
    }
  },
);

