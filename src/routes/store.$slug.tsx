import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AVLogo } from "@/components/marketplace/AVLogo";
import {
  ArrowLeft,
  Globe,
  MapPin,
  BadgeCheck,
  Share2,
  Star,
  Instagram,
  Youtube,
  Twitter,
  Linkedin,
  Music2,
  Link as LinkIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase as supaBrowser } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StorefrontBadgeRow } from "@/components/marketplace/StorefrontBadgeRow";

// ---- Types ----
type Product = {
  id: string;
  slug: string | null;
  title: string;
  subtitle: string | null;
  cover_url: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  category: string;
  created_at: string;
};
type Review = {
  id: string;
  product_id: string;
  rating: number;
  title: string | null;
  body: string;
  reviewer_name: string;
  reviewer_avatar: string | null;
  verified_purchase: boolean;
  created_at: string;
};
type Bundle = {
  id: string;
  title: string;
  description: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  product_ids: string[];
};
type StorefrontData = {
  creatorUserId: string;
  brandName: string;
  brandSlug: string;
  pitch: string;
  country: string | null;
  website: string | null;
  categories: string[] | null;
  socialLinks: Record<string, string> | null;
  displayName: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  extendedBio: string | null;
  story: string | null;
  credentials: string[] | null;
  featuredMediaUrl: string | null;
  memberSince: string;
  products: Product[];
  reviews: Review[];
  bundles: Bundle[];
  followerCount: number;
  totalSales: number;
};

const getStorefront = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }): Promise<StorefrontData | null> => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { data: app } = await supabase
      .from("seller_applications")
      .select(
        "brand_name, brand_slug, pitch, country, website, categories, social_links, user_id, created_at, cover_url, extended_bio, story, credentials, featured_media_url" as string,
      )
      .eq("brand_slug", data.slug)
      .eq("status", "approved")
      .maybeSingle();

    if (!app) return null;
    const a = app as any;

    const [
      { data: profile },
      { data: products },
      { data: followerCountRpc },
      { data: bundles },
    ] = await Promise.all([
      supabase.from("profiles").select("display_name, avatar_url").eq("id", a.user_id).maybeSingle(),
      supabase
        .from("marketplace_products")
        .select("id, slug, title, subtitle, cover_url, price_cents, compare_at_price_cents, category, created_at")
        .eq("seller_id", a.user_id)
        .eq("status", "approved")
        .eq("published", true)
        .order("created_at", { ascending: false }),
      (supabase.rpc as any)("get_creator_follower_count", { _creator_user_id: a.user_id }),
      (supabase.from("creator_bundles" as any) as any)
        .select("id, title, description, price_cents, compare_at_price_cents, creator_bundle_items(product_id)")
        .eq("seller_id", a.user_id)
        .eq("published", true)
        .order("created_at", { ascending: false }),
    ]);
    const followerCount = typeof followerCountRpc === "number" ? followerCountRpc : 0;

    const productIds = (products ?? []).map((p) => p.id);
    const { data: reviews } = productIds.length
      ? await supabase
          .from("product_reviews")
          .select("id, product_id, rating, title, body, reviewer_name, reviewer_avatar, verified_purchase, created_at")
          .in("product_id", productIds)
          .order("created_at", { ascending: false })
          .limit(200)
      : { data: [] as Review[] };

    // total sales across seller
    const { count: salesCount } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .in("product_id", productIds.length ? productIds : ["00000000-0000-0000-0000-000000000000"]);

    return {
      creatorUserId: a.user_id,
      brandName: a.brand_name,
      brandSlug: a.brand_slug,
      pitch: a.pitch,
      country: a.country,
      website: a.website,
      categories: a.categories,
      socialLinks: (a.social_links as Record<string, string> | null) ?? null,
      displayName: profile?.display_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      coverUrl: a.cover_url ?? null,
      extendedBio: a.extended_bio ?? null,
      story: a.story ?? null,
      credentials: a.credentials ?? null,
      featuredMediaUrl: a.featured_media_url ?? null,
      memberSince: a.created_at,
      products: (products ?? []) as Product[],
      reviews: (reviews ?? []) as Review[],
      bundles: ((bundles ?? []) as any[]).map((b) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        price_cents: b.price_cents,
        compare_at_price_cents: b.compare_at_price_cents,
        product_ids: (b.creator_bundle_items ?? []).map((i: any) => i.product_id),
      })),
      followerCount: followerCount ?? 0,
      totalSales: salesCount ?? 0,
    };
  });

export const Route = createFileRoute("/store/$slug")({
  loader: async ({ params }) => {
    const data = await getStorefront({ data: { slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ params, loaderData }) => {
    const SITE_URL = "https://www.aurumvault.store";
    const url = `${SITE_URL}/store/${params.slug}`;
    if (!loaderData) {
      return { meta: [{ title: "Storefront · AurumVault" }] };
    }
    const d = loaderData;
    const desc = d.pitch.slice(0, 155);
    const image = d.coverUrl || d.avatarUrl || undefined;
    const meta: Array<Record<string, string>> = [
      { title: `${d.brandName} · AurumVault` },
      { name: "description", content: desc },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: `${d.brandName} · AurumVault` },
      { property: "og:description", content: desc },
      { property: "og:type", content: "profile" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: `${d.brandName} · AurumVault` },
      { name: "twitter:description", content: desc },
    ];
    if (image) {
      meta.push({ property: "og:image", content: image });
      meta.push({ name: "twitter:image", content: image });
    }
    const sameAs = d.socialLinks
      ? Object.values(d.socialLinks).filter((v): v is string => !!v && /^https?:\/\//.test(v))
      : [];
    if (d.website) sameAs.push(d.website);
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: d.displayName || d.brandName,
            alternateName: d.brandName,
            url,
            image: image || undefined,
            description: desc,
            sameAs: sameAs.length ? sameAs : undefined,
            worksFor: {
              "@type": "Organization",
              name: "AurumVault",
              url: SITE_URL,
            },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
              { "@type": "ListItem", position: 2, name: "Creators", item: `${SITE_URL}/creators` },
              { "@type": "ListItem", position: 3, name: d.brandName, item: url },
            ],
          }),
        },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center bg-paper text-center px-6">
      <div>
        <p className="font-display text-3xl text-navy">Storefront not found</p>
        <p className="text-mute mt-2">This creator's page doesn't exist or isn't live yet.</p>
        <Link to="/" className="inline-flex items-center gap-1 text-navy hover:text-gold mt-4">
          <ArrowLeft size={14} /> Back to home
        </Link>
      </div>
    </div>
  ),
  errorComponent: () => (
    <div className="min-h-screen grid place-items-center bg-paper text-center px-6">
      <p className="text-mute">Couldn't load storefront. Please try again.</p>
    </div>
  ),
  component: StorefrontPage,
});

const SOCIAL_ICONS: Record<string, any> = {
  instagram: Instagram,
  youtube: Youtube,
  twitter: Twitter,
  x: Twitter,
  linkedin: Linkedin,
  tiktok: Music2,
};

type Tab = "products" | "categories" | "about" | "reviews" | "bundles";

function StorefrontPage() {
  const data = Route.useLoaderData() as StorefrontData;
  const [tab, setTab] = useState<Tab>("products");
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(data.followerCount);
  const [userId, setUserId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    supaBrowser.auth.getUser().then(async ({ data: u }) => {
      if (!mounted) return;
      const uid = u.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: row } = await (supaBrowser.from("creator_followers" as any) as any)
          .select("id")
          .eq("follower_id", uid)
          .eq("creator_user_id", data.creatorUserId)
          .maybeSingle();
        if (mounted) setFollowing(!!row);
      }
    });
    return () => {
      mounted = false;
    };
  }, [data.creatorUserId]);

  const toggleFollow = async () => {
    if (busy) return;
    if (!userId) {
      toast.error("Sign in to follow creators", {
        action: { label: "Sign in", onClick: () => (window.location.href = "/auth") },
      });
      return;
    }
    setBusy(true);
    // Optimistic
    const wasFollowing = following;
    setFollowing(!wasFollowing);
    setFollowers((f) => Math.max(0, f + (wasFollowing ? -1 : 1)));
    try {
      if (wasFollowing) {
        const { error } = await (supaBrowser.from("creator_followers" as any) as any)
          .delete()
          .eq("follower_id", userId)
          .eq("creator_user_id", data.creatorUserId);
        if (error) throw error;
      } else {
        const { error } = await (supaBrowser.from("creator_followers" as any) as any).insert({
          follower_id: userId,
          creator_user_id: data.creatorUserId,
        });
        // Ignore duplicate-follow errors as a no-op success
        if (error && !/duplicate|unique/i.test(error.message)) throw error;
        toast.success(`Now following ${data.brandName}`);
      }
    } catch (e: any) {
      // Roll back optimistic update
      setFollowing(wasFollowing);
      setFollowers((f) => Math.max(0, f + (wasFollowing ? 1 : -1)));
      toast.error(e?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const storefrontUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    // Canonical storefront URL — strip query/hash so shared links stay clean.
    return `${window.location.origin}/store/${data.brandSlug}`;
  }, [data.brandSlug]);

  const share = async () => {
    if (!storefrontUrl) return;
    // Prefer the native share sheet on mobile; always fall back to clipboard.
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: `${data.brandName} · AurumVault`,
          text: data.pitch.slice(0, 140),
          url: storefrontUrl,
        });
        return;
      }
    } catch (e: any) {
      // User canceled the share sheet — don't fall through to clipboard.
      if (e?.name === "AbortError") return;
    }
    // Clipboard path
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(storefrontUrl);
      } else {
        // Legacy fallback for insecure contexts / old browsers
        const ta = document.createElement("textarea");
        ta.value = storefrontUrl;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast.success("Storefront link copied", { description: storefrontUrl });
    } catch {
      toast.error("Couldn't copy link", { description: storefrontUrl });
    }
  };


  const avgRating = useMemo(() => {
    if (!data.reviews.length) return 0;
    return data.reviews.reduce((s, r) => s + r.rating, 0) / data.reviews.length;
  }, [data.reviews]);

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy text-white sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-3 flex items-center gap-4">
          <Link to="/">
            <AVLogo />
          </Link>
          <Link
            to="/"
            className="ml-auto text-sm text-white/70 hover:text-white inline-flex items-center gap-1"
          >
            <ArrowLeft size={14} /> Marketplace
          </Link>
        </div>
      </header>

      {/* Hero cover */}
      <section className="relative">
        <div
          className="h-56 md:h-80 bg-gradient-to-br from-navy via-[#1a2547] to-[#22335A] bg-cover bg-center"
          style={data.coverUrl ? { backgroundImage: `url(${data.coverUrl})` } : undefined}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-navy/20 via-transparent to-paper" />
      </section>

      {/* Identity block */}
      <section className="mx-auto max-w-6xl px-4 md:px-8 -mt-16 md:-mt-20 relative">
        <div className="flex flex-col md:flex-row md:items-end gap-5">
          {data.avatarUrl ? (
            <img
              src={data.avatarUrl}
              alt=""
              className="w-28 h-28 md:w-32 md:h-32 rounded-full object-cover border-4 border-paper shadow-xl bg-white"
            />
          ) : (
            <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-paper shadow-xl bg-gradient-to-br from-gold/40 to-gold/10 grid place-items-center text-4xl font-display text-navy">
              {data.brandName.charAt(0)}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl md:text-4xl text-navy leading-tight">
                {data.brandName}
              </h1>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider px-2 py-1 rounded-full bg-gold/15 text-gold border border-gold/30">
                <BadgeCheck size={13} /> Verified Creator
              </span>
            </div>
            {data.displayName && (
              <p className="text-mute text-sm mt-0.5">by {data.displayName}</p>
            )}
            {data.categories?.length ? (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {data.categories.map((c) => (
                  <span
                    key={c}
                    className="text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-gold/10 text-gold border border-gold/20"
                  >
                    {c}
                  </span>
                ))}
              </div>
            ) : null}
            <StorefrontBadgeRow sellerId={data.creatorUserId} className="mt-3" />
          </div>

          <div className="flex gap-2">
            <button
              onClick={toggleFollow}
              disabled={busy}
              aria-pressed={following}
              className={`px-5 py-2.5 rounded-lg font-medium text-sm transition disabled:opacity-60 disabled:cursor-not-allowed ${
                following
                  ? "bg-white border border-gold/40 text-navy hover:bg-gold/5"
                  : "bg-gradient-to-r from-gold to-[#c99a3b] text-navy hover:brightness-105 shadow"
              }`}
            >
              {following ? "Following ✓" : "Follow"}
            </button>
            <button
              onClick={share}
              className="px-4 py-2.5 rounded-lg bg-white border border-ink/10 text-navy text-sm inline-flex items-center gap-1.5 hover:border-gold/40"
            >
              <Share2 size={14} /> Share
            </button>
          </div>
        </div>

        {/* Bio */}
        <p className="text-navy/80 mt-5 max-w-3xl leading-relaxed">{data.pitch}</p>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Products" value={data.products.length} />
          <Stat label="Sales" value={data.totalSales} />
          <Stat label="Followers" value={followers} />
          <Stat label="Reviews" value={data.reviews.length} />
          <Stat
            label="Member since"
            value={new Date(data.memberSince).toLocaleDateString(undefined, {
              month: "short",
              year: "numeric",
            })}
          />
        </div>

        {/* Socials + meta */}
        <div className="flex flex-wrap items-center gap-3 mt-4 text-sm text-mute">
          {data.country && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} /> {data.country}
            </span>
          )}
          {data.website && (
            <a
              href={data.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-gold"
            >
              <Globe size={13} /> Website
            </a>
          )}
          {data.socialLinks &&
            Object.entries(data.socialLinks).map(([k, v]) => {
              if (!v) return null;
              const Icon = SOCIAL_ICONS[k.toLowerCase()] ?? LinkIcon;
              return (
                <a
                  key={k}
                  href={v}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 capitalize hover:text-gold"
                >
                  <Icon size={13} /> {k}
                </a>
              );
            })}
        </div>

        {/* Social share row */}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink/5 pt-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-mute">
            Share this storefront
          </span>
          {storefrontUrl && (
            <>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${data.brandName} on AurumVault`)}&url=${encodeURIComponent(storefrontUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:border-gold"
              >
                <Twitter size={12} /> X
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(storefrontUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:border-gold"
              >
                Facebook
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(storefrontUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:border-gold"
              >
                <Linkedin size={12} /> LinkedIn
              </a>
            </>
          )}
        </div>
      </section>

      {/* Tabs */}
      <nav className="sticky top-[52px] md:top-[56px] bg-paper/95 backdrop-blur border-b border-ink/10 mt-10 z-20">
        <div className="mx-auto max-w-6xl px-4 md:px-8 flex gap-1 overflow-x-auto">
          {[
            ["products", `All Products (${data.products.length})`],
            ["categories", "Categories"],
            ["bundles", `Bundle Deals${data.bundles.length ? ` (${data.bundles.length})` : ""}`],
            ["about", "About"],
            ["reviews", `Reviews (${data.reviews.length})`],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id as Tab)}
              className={`px-4 py-3 text-sm whitespace-nowrap border-b-2 transition ${
                tab === id
                  ? "border-gold text-navy font-medium"
                  : "border-transparent text-mute hover:text-navy"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 md:px-8 py-8">
        {tab === "products" && <ProductsTab products={data.products} reviews={data.reviews} />}
        {tab === "categories" && <CategoriesTab products={data.products} />}
        {tab === "bundles" && <BundlesTab bundles={data.bundles} products={data.products} />}
        {tab === "about" && <AboutTab data={data} />}
        {tab === "reviews" && (
          <ReviewsTab reviews={data.reviews} products={data.products} avgRating={avgRating} />
        )}
      </main>

      {/* Powered-by attribution */}
      <footer className="border-t border-ink/10 bg-white/60 py-6">
        <div className="mx-auto max-w-6xl px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-mute">
          <Link to="/" className="inline-flex items-center gap-1.5 hover:text-navy">
            Powered by <span className="font-display text-navy">AurumVault</span>
          </Link>
          <span>© {new Date().getFullYear()} {data.brandName} · Verified creator on AurumVault</span>
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white border border-ink/10 rounded-xl px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-mute">{label}</p>
      <p className="font-display text-xl text-navy mt-0.5">{value}</p>
    </div>
  );
}

// ---- Products tab ----
function ProductsTab({ products, reviews }: { products: Product[]; reviews: Review[] }) {
  const [category, setCategory] = useState<string>("all");
  const [priceMax, setPriceMax] = useState<number>(0);
  const [minRating, setMinRating] = useState<number>(0);
  const [sort, setSort] = useState<string>("featured");

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort(),
    [products],
  );
  const maxPrice = useMemo(
    () => Math.max(0, ...products.map((p) => p.price_cents / 100)),
    [products],
  );

  const ratingByProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of reviews) {
      const arr = (m.get(r.product_id) as any) ?? { s: 0, n: 0 };
      arr.s = (arr.s ?? 0) + r.rating;
      arr.n = (arr.n ?? 0) + 1;
      m.set(r.product_id, arr as any);
    }
    const out = new Map<string, number>();
    m.forEach((v: any, k) => out.set(k, v.n ? v.s / v.n : 0));
    return out;
  }, [reviews]);

  const filtered = useMemo(() => {
    let list = products.slice();
    if (category !== "all") list = list.filter((p) => p.category === category);
    if (priceMax > 0) list = list.filter((p) => p.price_cents / 100 <= priceMax);
    if (minRating > 0)
      list = list.filter((p) => (ratingByProduct.get(p.id) ?? 0) >= minRating);
    switch (sort) {
      case "newest":
        list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
        break;
      case "price-asc":
        list.sort((a, b) => a.price_cents - b.price_cents);
        break;
      case "price-desc":
        list.sort((a, b) => b.price_cents - a.price_cents);
        break;
      case "top-rated":
        list.sort(
          (a, b) => (ratingByProduct.get(b.id) ?? 0) - (ratingByProduct.get(a.id) ?? 0),
        );
        break;
    }
    return list;
  }, [products, category, priceMax, minRating, sort, ratingByProduct]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="text-sm px-3 py-2 rounded-lg border border-ink/15 bg-white text-navy"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label className="text-sm text-mute inline-flex items-center gap-2">
          Max ${priceMax || Math.ceil(maxPrice)}
          <input
            type="range"
            min={0}
            max={Math.ceil(maxPrice) || 100}
            step={1}
            value={priceMax}
            onChange={(e) => setPriceMax(Number(e.target.value))}
          />
        </label>

        <select
          value={minRating}
          onChange={(e) => setMinRating(Number(e.target.value))}
          className="text-sm px-3 py-2 rounded-lg border border-ink/15 bg-white text-navy"
        >
          <option value={0}>Any rating</option>
          {[4, 3, 2].map((r) => (
            <option key={r} value={r}>
              {r}★ & up
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="ml-auto text-sm px-3 py-2 rounded-lg border border-ink/15 bg-white text-navy"
        >
          <option value="featured">Featured</option>
          <option value="newest">Newest</option>
          <option value="price-asc">Price: low → high</option>
          <option value="price-desc">Price: high → low</option>
          <option value="top-rated">Top rated</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-ink/10 rounded-2xl p-10 text-center">
          <p className="text-navy font-medium">No products match those filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {filtered.map((p) => (
            <ProductCard key={p.id} p={p} rating={ratingByProduct.get(p.id) ?? 0} />
          ))}
        </div>
      )}
    </>
  );
}

function ProductCard({ p, rating }: { p: Product; rating: number }) {
  return (
    <Link
      to="/products/$id"
      params={{ id: p.id }}
      className="group bg-white border border-ink/10 rounded-2xl overflow-hidden hover:shadow-lg hover:border-gold/40 transition"
    >
      <div
        className="aspect-[3/4] bg-gradient-to-br from-navy to-[#22335A] bg-cover bg-center"
        style={p.cover_url ? { backgroundImage: `url(${p.cover_url})` } : undefined}
      />
      <div className="p-3">
        <p className="text-[10px] uppercase tracking-wider text-mute">{p.category}</p>
        <p className="text-sm font-medium text-navy line-clamp-2 mt-0.5 group-hover:text-gold">
          {p.title}
        </p>
        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-gold font-medium">${(p.price_cents / 100).toFixed(2)}</span>
            {p.compare_at_price_cents && p.compare_at_price_cents > p.price_cents ? (
              <span className="text-[11px] text-mute line-through">
                ${(p.compare_at_price_cents / 100).toFixed(2)}
              </span>
            ) : null}
          </div>
          {rating > 0 && (
            <span className="text-[11px] text-mute inline-flex items-center gap-0.5">
              <Star size={11} className="fill-gold text-gold" /> {rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ---- Categories tab ----
function CategoriesTab({ products }: { products: Product[] }) {
  const groups = useMemo(() => {
    const m = new Map<string, Product[]>();
    for (const p of products) {
      const arr = m.get(p.category) ?? [];
      arr.push(p);
      m.set(p.category, arr);
    }
    return Array.from(m.entries()).sort();
  }, [products]);

  if (!groups.length)
    return <p className="text-mute text-center py-10">No products yet.</p>;

  return (
    <div className="space-y-10">
      {groups.map(([cat, items]) => (
        <div key={cat}>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-display text-xl text-navy capitalize">{cat}</h3>
            <span className="text-xs text-mute">{items.length} products</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {items.map((p) => (
              <ProductCard key={p.id} p={p} rating={0} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Bundles tab ----
function BundlesTab({ bundles, products }: { bundles: Bundle[]; products: Product[] }) {
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  if (!bundles.length)
    return (
      <div className="bg-white border border-ink/10 rounded-2xl p-10 text-center">
        <p className="text-navy font-medium">No bundle deals yet</p>
        <p className="text-mute text-sm mt-1">Check back — the creator is preparing curated sets.</p>
      </div>
    );

  return (
    <div className="grid md:grid-cols-2 gap-5">
      {bundles.map((b) => {
        const items = b.product_ids.map((id) => productMap.get(id)).filter(Boolean) as Product[];
        const originalTotal = items.reduce((s, p) => s + p.price_cents, 0);
        const savings = Math.max(0, originalTotal - b.price_cents);
        const pct = originalTotal ? Math.round((savings / originalTotal) * 100) : 0;
        return (
          <div
            key={b.id}
            className="bg-white border border-ink/10 rounded-2xl p-5 hover:border-gold/40 transition"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-xl text-navy">{b.title}</h3>
                {b.description && <p className="text-sm text-mute mt-1">{b.description}</p>}
              </div>
              {pct > 0 && (
                <span className="px-2 py-1 rounded-full bg-gold/15 text-gold text-[11px] font-medium">
                  Save {pct}%
                </span>
              )}
            </div>

            <ul className="mt-4 divide-y divide-ink/5">
              {items.map((p) => (
                <li key={p.id} className="py-2 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded bg-navy/5 bg-cover bg-center flex-shrink-0"
                    style={p.cover_url ? { backgroundImage: `url(${p.cover_url})` } : undefined}
                  />
                  <span className="text-sm text-navy flex-1 line-clamp-1">{p.title}</span>
                  <span className="text-xs text-mute">${(p.price_cents / 100).toFixed(2)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center justify-between">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-2xl text-gold">
                    ${(b.price_cents / 100).toFixed(2)}
                  </span>
                  {savings > 0 && (
                    <span className="text-sm text-mute line-through">
                      ${(originalTotal / 100).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => toast.info("Bundle checkout coming soon")}
                className="px-4 py-2 rounded-lg bg-navy text-white text-sm hover:bg-navy/90"
              >
                Add Bundle to Cart
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- About tab ----
function AboutTab({ data }: { data: StorefrontData }) {
  const embed = ytEmbed(data.featuredMediaUrl);
  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
        {data.extendedBio && (
          <Section title="About">
            <p className="text-navy/85 leading-relaxed whitespace-pre-line">{data.extendedBio}</p>
          </Section>
        )}
        {data.story && (
          <Section title="Story & Mission">
            <p className="text-navy/85 leading-relaxed whitespace-pre-line">{data.story}</p>
          </Section>
        )}
        {!data.extendedBio && !data.story && (
          <Section title="About">
            <p className="text-navy/85 leading-relaxed">{data.pitch}</p>
          </Section>
        )}
        {data.credentials?.length ? (
          <Section title="Credentials & Experience">
            <ul className="space-y-2">
              {data.credentials.map((c, i) => (
                <li key={i} className="flex gap-2 text-navy/85">
                  <BadgeCheck size={16} className="text-gold flex-shrink-0 mt-0.5" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </div>
      <div className="space-y-6">
        {embed ? (
          <div className="aspect-video rounded-2xl overflow-hidden border border-ink/10 bg-black">
            <iframe
              src={embed}
              title="Featured video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        ) : data.featuredMediaUrl ? (
          <img
            src={data.featuredMediaUrl}
            alt="Featured"
            className="w-full rounded-2xl border border-ink/10"
          />
        ) : null}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-ink/10 rounded-2xl p-5">
      <h3 className="font-display text-lg text-navy mb-3">{title}</h3>
      {children}
    </div>
  );
}

function ytEmbed(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  return null;
}

// ---- Reviews tab ----
function ReviewsTab({
  reviews,
  products,
  avgRating,
}: {
  reviews: Review[];
  products: Product[];
  avgRating: number;
}) {
  const [productFilter, setProductFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<number>(0);
  const [sort, setSort] = useState<string>("newest");

  const filtered = useMemo(() => {
    let list = reviews.slice();
    if (productFilter !== "all") list = list.filter((r) => r.product_id === productFilter);
    if (ratingFilter > 0) list = list.filter((r) => r.rating === ratingFilter);
    if (sort === "oldest") list.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    else if (sort === "highest") list.sort((a, b) => b.rating - a.rating);
    else if (sort === "lowest") list.sort((a, b) => a.rating - b.rating);
    else list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return list;
  }, [reviews, productFilter, ratingFilter, sort]);

  const buckets = useMemo(() => {
    const b = [0, 0, 0, 0, 0]; // index 0=5★
    for (const r of reviews) b[5 - r.rating] += 1;
    return b;
  }, [reviews]);
  const productMap = new Map(products.map((p) => [p.id, p.title]));

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <aside className="bg-white border border-ink/10 rounded-2xl p-5 h-fit">
        <p className="font-display text-4xl text-navy">{avgRating.toFixed(1)}</p>
        <div className="flex text-gold mt-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              size={16}
              className={s <= Math.round(avgRating) ? "fill-gold" : "opacity-30"}
            />
          ))}
        </div>
        <p className="text-xs text-mute mt-1">{reviews.length} reviews across all products</p>
        <div className="mt-4 space-y-1.5">
          {buckets.map((n, i) => {
            const stars = 5 - i;
            const pct = reviews.length ? (n / reviews.length) * 100 : 0;
            return (
              <div key={stars} className="flex items-center gap-2 text-xs text-mute">
                <span className="w-6">{stars}★</span>
                <div className="flex-1 h-1.5 rounded-full bg-ink/10 overflow-hidden">
                  <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-6 text-right">{n}</span>
              </div>
            );
          })}
        </div>
      </aside>

      <div className="md:col-span-2 space-y-4">
        <div className="flex flex-wrap gap-2">
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg border border-ink/15 bg-white text-navy"
          >
            <option value="all">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(Number(e.target.value))}
            className="text-sm px-3 py-2 rounded-lg border border-ink/15 bg-white text-navy"
          >
            <option value={0}>All ratings</option>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {r} stars
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="ml-auto text-sm px-3 py-2 rounded-lg border border-ink/15 bg-white text-navy"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="highest">Highest rated</option>
            <option value="lowest">Lowest rated</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white border border-ink/10 rounded-2xl p-10 text-center text-mute">
            No reviews yet.
          </div>
        ) : (
          filtered.map((r) => (
            <article key={r.id} className="bg-white border border-ink/10 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                {r.reviewer_avatar ? (
                  <img src={r.reviewer_avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-navy/10 grid place-items-center text-xs text-navy font-medium">
                    {r.reviewer_name.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy">{r.reviewer_name}</p>
                  <p className="text-[11px] text-mute">
                    {productMap.get(r.product_id) ?? "Product"} ·{" "}
                    {new Date(r.created_at).toLocaleDateString()}
                    {r.verified_purchase && " · Verified purchase"}
                  </p>
                </div>
                <div className="flex text-gold">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} size={13} className={s <= r.rating ? "fill-gold" : "opacity-30"} />
                  ))}
                </div>
              </div>
              {r.title && <p className="mt-2 font-medium text-navy">{r.title}</p>}
              <p className="mt-1 text-sm text-navy/85 leading-relaxed">{r.body}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
