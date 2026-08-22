import type { StorefrontAccent } from "@/lib/storefront";

export type StorefrontSettings = {
  headline: string | null;
  logoUrl: string | null;
  accent: StorefrontAccent;
  featuredProductIds: string[];
  featuredBundleId: string | null;
};

export type CreatorPublicCard = {
  sellerId: string;
  brandName: string;
  brandSlug: string | null;
  headline: string | null;
  accent: StorefrontAccent;
  pitch: string | null;
  website: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  foundingNumber: number | null;
  productCount: number;
};

export type MoreFromCreatorProduct = {
  id: string;
  slug: string | null;
  title: string;
  cover_url: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  category: string;
};

export type StorefrontTopProduct = {
  productId: string;
  title: string;
  units: number;
  grossCents: number;
  creatorEarningsCents: number;
};

export type StorefrontAnalytics = {
  rangeDays: number;
  storefrontViews: number;
  productClicks: number;
  shares: number;
  orders: number;
  units: number;
  grossCents: number;
  creatorEarningsCents: number;
  platformFeeCents: number;
  topProducts: StorefrontTopProduct[];
  trafficSources: { source: string; views: number }[];
};
