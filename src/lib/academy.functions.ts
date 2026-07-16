import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

function serverSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type AcademyCategory = {
  slug: string;
  name: string;
  emoji: string | null;
  description: string | null;
  sort_order: number;
};

export type AcademyArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  featured_image: string | null;
  category: string;
  author_name: string | null;
  reading_time_min: number;
  published_at: string | null;
  featured: boolean;
  pinned: boolean;
  view_count: number;
  meta_title: string | null;
  meta_description: string | null;
};

const ARTICLE_COLS =
  "id,slug,title,excerpt,body,featured_image,category,author_name,reading_time_min,published_at,featured,pinned,view_count,meta_title,meta_description";

export const listAcademyCategories = createServerFn({ method: "GET" }).handler(
  async (): Promise<AcademyCategory[]> => {
    const supa = serverSupabase();
    const { data } = await supa
      .from("academy_categories")
      .select("slug,name,emoji,description,sort_order")
      .order("sort_order", { ascending: true });
    return (data as AcademyCategory[]) ?? [];
  },
);

export const getAcademyHub = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    categories: AcademyCategory[];
    featured: AcademyArticle[];
    latest: AcademyArticle[];
  }> => {
    const supa = serverSupabase();
    const [catsRes, featRes, latestRes] = await Promise.all([
      supa
        .from("academy_categories")
        .select("slug,name,emoji,description,sort_order")
        .order("sort_order"),
      supa
        .from("academy_articles")
        .select(ARTICLE_COLS)
        .eq("status", "published")
        .eq("featured", true)
        .order("published_at", { ascending: false })
        .limit(3),
      supa
        .from("academy_articles")
        .select(ARTICLE_COLS)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(9),
    ]);
    return {
      categories: (catsRes.data as AcademyCategory[]) ?? [],
      featured: (featRes.data as AcademyArticle[]) ?? [],
      latest: (latestRes.data as AcademyArticle[]) ?? [],
    };
  },
);

export const listArticlesByCategory = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        category: z.string(),
        sort: z.enum(["newest", "popular", "featured"]).default("newest"),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<AcademyArticle[]> => {
    const supa = serverSupabase();
    let q = supa
      .from("academy_articles")
      .select(ARTICLE_COLS)
      .eq("status", "published")
      .eq("category", data.category);
    if (data.sort === "popular") q = q.order("view_count", { ascending: false });
    else if (data.sort === "featured")
      q = q.order("featured", { ascending: false }).order("published_at", { ascending: false });
    else q = q.order("published_at", { ascending: false });
    const { data: rows } = await q.limit(60);
    return (rows as AcademyArticle[]) ?? [];
  });

export const getArticleBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string() }).parse(input))
  .handler(
    async ({
      data,
    }): Promise<{
      article: AcademyArticle | null;
      category: AcademyCategory | null;
      related: AcademyArticle[];
      products: Array<{
        id: string;
        title: string;
        cover_url: string | null;
        price_cents: number;
        category: string;
      }>;
    }> => {
      const supa = serverSupabase();
      const { data: article } = await supa
        .from("academy_articles")
        .select(ARTICLE_COLS)
        .eq("slug", data.slug)
        .eq("status", "published")
        .maybeSingle();
      if (!article) return { article: null, category: null, related: [], products: [] };
      const [catRes, relatedRes, tagsRes] = await Promise.all([
        supa
          .from("academy_categories")
          .select("slug,name,emoji,description,sort_order")
          .eq("slug", article.category)
          .maybeSingle(),
        supa
          .from("academy_articles")
          .select(ARTICLE_COLS)
          .eq("status", "published")
          .eq("category", article.category)
          .neq("id", article.id)
          .order("published_at", { ascending: false })
          .limit(3),
        supa
          .from("academy_article_products")
          .select("product_id,sort_order")
          .eq("article_id", article.id)
          .order("sort_order"),
      ]);
      let productIds = (tagsRes.data as Array<{ product_id: string }> | null)?.map(
        (r) => r.product_id,
      ) ?? [];
      let products: Array<{
        id: string;
        title: string;
        cover_url: string | null;
        price_cents: number;
        category: string;
      }> = [];
      if (productIds.length > 0) {
        const { data: prods } = await supa
          .from("marketplace_products")
          .select("id,title,cover_url,price_cents,category")
          .in("id", productIds)
          .eq("status", "approved")
          .eq("published", true);
        products = (prods as typeof products) ?? [];
      }
      // Fallback: pull 3 approved products in vaguely-related marketplace categories
      if (products.length === 0) {
        const { data: prods } = await supa
          .from("marketplace_products")
          .select("id,title,cover_url,price_cents,category")
          .eq("status", "approved")
          .eq("published", true)
          .order("created_at", { ascending: false })
          .limit(3);
        products = (prods as typeof products) ?? [];
      }
      // Best-effort view count bump (ignore failure)
      supa
        .from("academy_articles")
        .update({ view_count: (article.view_count ?? 0) + 1 })
        .eq("id", article.id)
        .then(() => {});
      return {
        article: article as AcademyArticle,
        category: (catRes.data as AcademyCategory) ?? null,
        related: (relatedRes.data as AcademyArticle[]) ?? [],
        products,
      };
    },
  );

export const listAllPublishedArticlesForSitemap = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<{ slug: string; updated_at: string | null }>> => {
    const supa = serverSupabase();
    const { data } = await supa
      .from("academy_articles")
      .select("slug,updated_at:published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(2000);
    return (data as Array<{ slug: string; updated_at: string | null }>) ?? [];
  },
);
