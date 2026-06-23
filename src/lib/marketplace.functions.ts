import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const API_BASE = "https://web-builder-pro-delvinhale.replit.app/api";

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
};

const STOCK = [
  "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80",
  "https://images.unsplash.com/photo-1532153975070-2e9ab71f1b14?w=800&q=80",
  "https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=800&q=80",
  "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=80",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80",
  "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&q=80",
  "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80",
  "https://images.unsplash.com/photo-1542744095-291d1f67b221?w=800&q=80",
];

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
  ["Selah Marchand", "Strategist · Author"],
  ["Ezra Whitlock", "Capital Architect"],
  ["Maya Okonkwo", "Brand Theologian"],
  ["Daniel Reyes", "Operator & Investor"],
  ["Imani Caldwell", "Leadership Coach"],
  ["August Lin", "Product Mentor"],
];

const TITLES = [
  "The Stewardship Codex",
  "Sovereign Leadership Playbook",
  "The Capital Architect's Notebook",
  "Brand Theology: A Field Manual",
  "Purposeful Pricing",
  "Quiet Equity: The 12-Week Course",
  "Boardroom Liturgy",
  "Operator's Calendar 2025",
  "The Patient Capital Series",
  "Heir Mindset Workshop",
  "Founder's Daily Office",
  "Wealth With Reverence",
];

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

function mockProduct(i: number): Product {
  const cat = CATEGORIES[i % CATEGORIES.length];
  const price = 19 + ((i * 7) % 180);
  const compare = i % 3 === 0 ? price + 20 : undefined;
  return {
    id: `p_${i}`,
    title: TITLES[i % TITLES.length],
    category: cat,
    price,
    compareAtPrice: compare,
    rating: 4 + ((i * 3) % 10) / 10,
    reviewCount: 18 + ((i * 13) % 480),
    image: STOCK[i % STOCK.length],
    images: [STOCK[i % STOCK.length], STOCK[(i + 1) % STOCK.length], STOCK[(i + 2) % STOCK.length]],
    bestseller: i % 4 === 0,
    creator: {
      id: `c_${i % CREATOR_NAMES.length}`,
      name: CREATOR_NAMES[i % CREATOR_NAMES.length][0],
      verified: true,
      avatar: `https://i.pravatar.cc/80?img=${(i % 70) + 1}`,
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

const mockProducts = (n: number, offset = 0) =>
  Array.from({ length: n }, (_, i) => mockProduct(i + offset));

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
  const fallback = mockProducts(8);
  const data = await safeFetch<unknown>("/marketplace/featured", fallback as unknown);
  return (Array.isArray(data) && data.length ? (data as Product[]) : fallback) as Product[];
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
    const fallback = mockProducts(12, (data.page - 1) * 12);
    const params = new URLSearchParams();
    if (data.category) params.set("category", data.category);
    if (data.sort) params.set("sort", data.sort);
    if (data.q) params.set("q", data.q);
    params.set("page", String(data.page));
    const result = await safeFetch<unknown>(`/products?${params.toString()}`, fallback as unknown);
    let list = (Array.isArray(result) ? (result as Product[]) : fallback) as Product[];
    if (data.category && data.category !== "All") {
      list = list.filter((p) => p.category?.toLowerCase() === data.category!.toLowerCase());
      if (list.length === 0) list = fallback.map((p) => ({ ...p, category: data.category! }));
    }
    if (data.q) {
      const q = data.q.toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q));
    }
    return { items: list, page: data.page, hasMore: data.page < 4 };
  });

export const getProduct = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const seed = Number(data.id.replace(/\D/g, "")) || 1;
    const fallback = mockProduct(seed);
    const result = await safeFetch<Product | null>(`/products/${data.id}`, fallback);
    return (result && typeof result === "object" ? (result as Product) : fallback) as Product;
  });

export const getFeaturedCreators = createServerFn({ method: "GET" }).handler(async () => {
  const fallback = mockCreators(6);
  const data = await safeFetch<unknown>("/creators/featured", fallback as unknown);
  return (Array.isArray(data) && data.length ? (data as Creator[]) : fallback) as Creator[];
});
