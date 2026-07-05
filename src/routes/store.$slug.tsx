import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AVLogo } from "@/components/marketplace/AVLogo";
import { ArrowLeft, Globe, MapPin } from "lucide-react";

type StorefrontData = {
  brandName: string;
  brandSlug: string;
  pitch: string;
  country: string | null;
  website: string | null;
  categories: string[] | null;
  socialLinks: Record<string, string> | null;
  displayName: string | null;
  avatarUrl: string | null;
  products: Array<{
    id: string;
    slug: string | null;
    title: string;
    subtitle: string | null;
    cover_url: string | null;
    price_cents: number;
    compare_at_price_cents: number | null;
    category: string;
  }>;
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
      .select("brand_name, brand_slug, pitch, country, website, categories, social_links, user_id")
      .eq("brand_slug", data.slug)
      .eq("status", "approved")
      .maybeSingle();

    if (!app) return null;

    const [{ data: profile }, { data: products }] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", app.user_id)
        .maybeSingle(),
      supabase
        .from("marketplace_products")
        .select("id, slug, title, subtitle, cover_url, price_cents, compare_at_price_cents, category")
        .eq("seller_id", app.user_id)
        .eq("status", "approved")
        .eq("published", true)
        .order("created_at", { ascending: false }),
    ]);

    return {
      brandName: app.brand_name,
      brandSlug: app.brand_slug!,
      pitch: app.pitch,
      country: app.country,
      website: app.website,
      categories: app.categories,
      socialLinks: (app.social_links as Record<string, string> | null) ?? null,
      displayName: profile?.display_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      products: (products ?? []) as StorefrontData["products"],
    };
  });

export const Route = createFileRoute("/store/$slug")({
  loader: async ({ params }) => {
    const data = await getStorefront({ data: { slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.brandName} · AurumVault` },
          {
            name: "description",
            content: loaderData.pitch.slice(0, 155),
          },
          { property: "og:title", content: `${loaderData.brandName} · AurumVault` },
          { property: "og:description", content: loaderData.pitch.slice(0, 155) },
          { property: "og:type", content: "profile" },
          { name: "twitter:card", content: "summary_large_image" },
        ]
      : [{ title: "Storefront · AurumVault" }],
  }),
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

function StorefrontPage() {
  const data = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-4 flex items-center gap-4">
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

      {/* Hero */}
      <section className="bg-gradient-to-b from-navy to-[#1a2547] text-white">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-12 md:py-16">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {data.avatarUrl ? (
              <img
                src={data.avatarUrl}
                alt=""
                className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-gold/40"
              />
            ) : (
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-gold/30 to-gold/10 border-4 border-gold/40 grid place-items-center text-3xl font-display text-gold">
                {data.brandName.charAt(0)}
              </div>
            )}
            <div className="flex-1">
              <p className="text-[11px] uppercase tracking-[0.3em] text-gold">Creator storefront</p>
              <h1 className="font-display text-3xl md:text-5xl mt-1">{data.brandName}</h1>
              {data.displayName && (
                <p className="text-white/70 mt-1 text-sm">by {data.displayName}</p>
              )}
              <p className="text-white/85 mt-4 max-w-2xl leading-relaxed">{data.pitch}</p>
              <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-white/70">
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
                  Object.entries(data.socialLinks).map(([k, v]) =>
                    v ? (
                      <a
                        key={k}
                        href={v}
                        target="_blank"
                        rel="noreferrer"
                        className="capitalize hover:text-gold"
                      >
                        {k}
                      </a>
                    ) : null,
                  )}
              </div>
              {data.categories?.length ? (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {data.categories.map((c) => (
                    <span
                      key={c}
                      className="text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/10 text-white/80"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Products */}
      <main className="mx-auto max-w-6xl px-4 md:px-8 py-10">
        <h2 className="font-display text-2xl text-navy mb-5">
          Products {data.products.length > 0 && <span className="text-mute text-base">({data.products.length})</span>}
        </h2>

        {data.products.length === 0 ? (
          <div className="bg-white border border-ink/10 rounded-2xl p-10 text-center">
            <p className="text-navy font-medium">Nothing here yet</p>
            <p className="text-mute text-sm mt-1">
              {data.brandName} hasn't published any products yet — check back soon.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {data.products.map((p) => (
              <Link
                key={p.id}
                to="/p/$slug"
                params={{ slug: p.slug ?? p.id }}
                className="group bg-white border border-ink/10 rounded-2xl overflow-hidden hover:shadow-lg hover:border-gold/40 transition"
              >
                <div
                  className="aspect-[3/4] bg-gradient-to-br from-navy to-[#22335A] bg-cover bg-center"
                  style={p.cover_url ? { backgroundImage: `url(${p.cover_url})` } : {}}
                />
                <div className="p-3">
                  <p className="text-[10px] uppercase tracking-wider text-mute">{p.category}</p>
                  <p className="text-sm font-medium text-navy line-clamp-2 mt-0.5 group-hover:text-gold">
                    {p.title}
                  </p>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="text-gold font-medium">${(p.price_cents / 100).toFixed(2)}</span>
                    {p.compare_at_price_cents && p.compare_at_price_cents > p.price_cents ? (
                      <span className="text-[11px] text-mute line-through">
                        ${(p.compare_at_price_cents / 100).toFixed(2)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
