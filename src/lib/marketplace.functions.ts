import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const API_BASE = "https://web-builder-pro-delvinhale.replit.app/api";

// Map DB category codes ("ebooks") → display labels ("eBooks")
const CAT_LABEL: Record<string, string> = {
  ebooks: "eBooks",
  courses: "Courses",
  templates: "Templates",
  audio: "Audio",
  finance: "Finance",
  leadership: "Leadership",
  purpose: "Purpose",
  business: "Business",
};

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
  cover_url: string | null;
  description: string | null;
  seller_id: string;
  created_at: string;
  ai_review_status: string | null;
  ai_review_score: number | null;
};

function dbRowToProduct(r: DbProductRow, sellerName = "Illustrious Capital™"): Product {
  const catLabel = CAT_LABEL[r.category?.toLowerCase()] ?? r.category ?? "eBooks";
  return {
    id: r.id,
    title: r.title,
    category: catLabel,
    price: r.price_cents / 100,
    rating: 5,
    reviewCount: 0,
    image: r.cover_url ?? `av:${catLabel}:0`,
    bestseller: false,
    creator: { id: r.seller_id, name: sellerName, verified: true },
    description: r.description ?? undefined,
    included: ["Instant digital download", "Lifetime access"],
    aiReviewStatus: (r.ai_review_status as Product["aiReviewStatus"]) ?? null,
    aiReviewScore: r.ai_review_score ?? null,
  };
}


async function fetchDbProducts(opts: { category?: string; q?: string } = {}): Promise<Product[]> {
  try {
    const supa = serverSupabase();
    let query = supa
      .from("marketplace_products")
      .select("id,title,category,price_cents,cover_url,description,seller_id,created_at")
      .eq("status", "approved")
      .order("created_at", { ascending: false });
    if (opts.category && opts.category !== "All") {
      query = query.eq("category", opts.category.toLowerCase() as "ebooks" | "courses" | "templates" | "audio" | "leadership");
    }
    if (opts.q) query = query.ilike("title", `%${opts.q}%`);
    const { data, error } = await query;
    if (error || !data) return [];
    return (data as DbProductRow[]).map((r) => dbRowToProduct(r));
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
};


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
    if (!UUID_RE.test(data.id)) return null as unknown as Product;
    const supa = serverSupabase();
    const { data: row } = await supa
      .from("marketplace_products")
      .select("id,title,category,price_cents,cover_url,description,seller_id,created_at")
      .eq("id", data.id)
      .eq("status", "approved")
      .maybeSingle();
    if (!row) return null as unknown as Product;
    return dbRowToProduct(row as DbProductRow);
  });

export const getFeaturedCreators = createServerFn({ method: "GET" }).handler(async () => {
  const fallback = mockCreators(6);
  const data = await safeFetch<unknown>("/creators/featured", fallback as unknown);
  return (Array.isArray(data) && data.length ? (data as Creator[]) : fallback) as Creator[];
});
