import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { getArticleBySlug } from "@/lib/academy.functions";
import { ArticleCard, difficultyFor } from "./academy.index";
import { ChevronRight, Clock, ArrowRight, Share2, BookmarkPlus, BookmarkCheck, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";


function articleQuery(slug: string) {
  return queryOptions({
    queryKey: ["academy", "article", slug],
    queryFn: () => getArticleBySlug({ data: { slug } }),
  });
}

export const Route = createFileRoute("/academy/article/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(articleQuery(params.slug));
    if (!data.article) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => {
    if (!loaderData?.article) {
      return {
        meta: [
          { title: "Article not found — AurumVault Academy" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const a = loaderData.article;
    const defaultUrl = `https://www.aurumvault.store/academy/article/${params.slug}`;
    const url = a.canonical_url ?? defaultUrl;
    const title = a.meta_title ?? `${a.title} — AurumVault Academy`;
    const desc = a.meta_description ?? a.excerpt ?? "Read on AurumVault Academy.";
    const ogTitle = a.og_title ?? title;
    const ogDesc = a.og_description ?? desc;
    const image = a.featured_image;
    const robots = `${a.robots_index ? "index" : "noindex"}, ${a.robots_follow ? "follow" : "nofollow"}`;
    const schema: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": a.schema_type || "Article",
      headline: a.title,
      description: desc,
      ...(image ? { image } : {}),
      ...(a.author_name ? { author: { "@type": "Person", name: a.author_name } } : {}),
      ...(a.published_at ? { datePublished: a.published_at } : {}),
      mainEntityOfPage: { "@type": "WebPage", "@id": defaultUrl },
    };
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "robots", content: robots },
        { property: "og:title", content: ogTitle },
        { property: "og:description", content: ogDesc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: defaultUrl },
        ...(image ? [{ property: "og:image", content: image }] : []),
        { name: "twitter:card", content: a.twitter_card || (image ? "summary_large_image" : "summary") },
        { name: "twitter:title", content: ogTitle },
        { name: "twitter:description", content: ogDesc },
        ...(image ? [{ name: "twitter:image", content: image }] : []),
        ...(a.published_at
          ? [{ property: "article:published_time", content: a.published_at }]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(schema) },
      ],
    };
  },
  notFoundComponent: () => (
    <MarketShell>
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-3xl font-serif font-semibold">Article not found</h1>
        <Link to="/academy" className="mt-6 inline-block text-[#B8860B]">
          ← Back to Academy
        </Link>
      </div>
    </MarketShell>
  ),
  errorComponent: () => (
    <MarketShell>
      <div className="mx-auto max-w-3xl px-4 py-24 text-center text-ink/70">
        Something went wrong loading this article.
      </div>
    </MarketShell>
  ),
  component: ArticleDetail,
});

function renderMarkdown(md: string): string {
  // Minimal, safe markdown → HTML for headings, paragraphs, lists, bold, italic.
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };
  const inline = (t: string) =>
    esc(t)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      closeList();
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    const li = line.match(/^[-*]\s+(.*)$/);
    if (li) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(li[1])}</li>`);
      continue;
    }
    closeList();
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      out.push(`<p>${inline(line)}</p>`);
      continue;
    }
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join("\n");
}

function ArticleDetail() {
  const { article, category, related, products } = useSuspenseQuery(
    articleQuery(Route.useParams().slug),
  ).data;
  if (!article) return null;
  const published = article.published_at ? new Date(article.published_at) : null;
  const url = `https://www.aurumvault.store/academy/article/${article.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt ?? undefined,
    image: article.featured_image ?? undefined,
    datePublished: article.published_at ?? undefined,
    dateModified: article.published_at ?? undefined,
    author: { "@type": "Organization", name: article.author_name ?? "AurumVault" },
    publisher: {
      "@type": "Organization",
      name: "AurumVault",
      logo: {
        "@type": "ImageObject",
        url: "https://www.aurumvault.store/av-seal-512.png",
      },
    },
    mainEntityOfPage: url,
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Academy", item: "https://www.aurumvault.store/academy" },
      category && {
        "@type": "ListItem",
        position: 2,
        name: category.name,
        item: `https://www.aurumvault.store/academy/${category.slug}`,
      },
      { "@type": "ListItem", position: 3, name: article.title, item: url },
    ].filter(Boolean),
  };

  return (
    <MarketShell>
      <ReadingProgressBar />
      <article className="mx-auto max-w-3xl px-4 pb-24 md:px-6">

        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mt-6 flex items-center gap-2 text-sm text-ink/60">
          <Link to="/academy" className="hover:text-[#B8860B]">
            Academy
          </Link>
          <ChevronRight size={14} />
          {category && (
            <>
              <Link
                to="/academy/$category"
                params={{ category: category.slug }}
                className="hover:text-[#B8860B]"
              >
                {category.name}
              </Link>
              <ChevronRight size={14} />
            </>
          )}
          <span className="text-ink line-clamp-1">{article.title}</span>
        </nav>

        <header className="mt-6">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#B8860B]">
            {category?.name ?? article.category}
          </div>
          <h1 className="mt-3 text-3xl font-serif font-semibold leading-tight text-ink md:text-5xl">
            {article.title}
          </h1>
          {article.excerpt && (
            <p className="mt-4 text-lg leading-relaxed text-ink/70">{article.excerpt}</p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-ink/60">
            <span className="font-medium text-ink/80">{article.author_name ?? "AurumVault"}</span>
            {published && (
              <>
                <span>•</span>
                <time dateTime={article.published_at ?? undefined}>
                  {published.toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </time>
              </>
            )}
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <Clock size={13} /> {article.reading_time_min} min read
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#0F1E35]/5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-[#0F1E35]">
              {difficultyFor(article.reading_time_min)}
            </span>
          </div>
          <ArticleActions articleId={article.id} title={article.title} excerpt={article.excerpt} />
        </header>


        {article.featured_image && (
          <img
            src={article.featured_image}
            alt={article.title}
            loading="lazy"
            className="mt-8 aspect-[16/9] w-full rounded-2xl object-cover"
          />
        )}

        <div
          className="prose prose-lg mt-10 max-w-none prose-headings:font-serif prose-headings:text-ink prose-p:text-ink/80 prose-strong:text-ink prose-a:text-[#B8860B]"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body) }}
        />

        {/* Recommended Resources */}
        {products.length > 0 && (
          <section className="mt-16 rounded-2xl border border-[#B8860B]/30 bg-[#FDF9F0] p-6 md:p-8">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[#B8860B]">
              Recommended Resources
            </div>
            <h2 className="mt-2 text-xl font-serif font-semibold text-[#0F1E35]">
              Continue your journey
            </h2>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <Link
                  key={p.id}
                  to="/products/$id"
                  params={{ id: p.id }}
                  className="group flex gap-3 rounded-xl border border-ink/10 bg-white p-3 transition hover:border-[#B8860B]/60 hover:shadow-md"
                >
                  <div
                    className="aspect-square w-16 shrink-0 rounded-lg bg-gradient-to-br from-[#0F1E35] to-[#172A48]"
                    style={
                      p.cover_url
                        ? {
                            backgroundImage: `url(${p.cover_url})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : undefined
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-semibold text-ink group-hover:text-[#B8860B]">
                      {p.title}
                    </div>
                    <div className="mt-1 text-xs text-ink/60">
                      ${(p.price_cents / 100).toFixed(2)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Related Articles */}
        {related.length > 0 && (
          <section className="mt-16">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[#B8860B]">
              Related Articles
            </div>
            <h2 className="mt-2 text-xl font-serif font-semibold text-ink">Keep reading</h2>
            <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          </section>
        )}

        <div className="mt-16 flex items-center justify-between rounded-2xl border border-ink/10 bg-white p-6">
          <div>
            <div className="text-sm font-semibold text-ink">Explore more in the Academy</div>
            <div className="mt-1 text-sm text-ink/60">
              Browse every essay in {category?.name ?? "this category"}.
            </div>
          </div>
          {category && (
            <Link
              to="/academy/$category"
              params={{ category: category.slug }}
              className="inline-flex items-center gap-1 rounded-full bg-[#B8860B] px-4 py-2 text-sm font-semibold text-[#0F1E35] hover:brightness-110"
            >
              View all <ArrowRight size={14} />
            </Link>
          )}
        </div>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
        />
      </article>
    </MarketShell>
  );
}

function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollTop = doc.scrollTop || document.body.scrollTop;
      const height = doc.scrollHeight - doc.clientHeight;
      setProgress(height > 0 ? Math.min(100, Math.max(0, (scrollTop / height) * 100)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 h-0.5 bg-transparent">
      <div
        className="h-full bg-gradient-to-r from-[#B8860B] via-[#E9C46A] to-[#B8860B] transition-[width] duration-150"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function ArticleActions({
  articleId,
  title,
  excerpt,
}: {
  articleId: string;
  title: string;
  excerpt: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const bookmarkQuery = useQuery({
    queryKey: ["academy", "bookmark", articleId, user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academy_bookmarks")
        .select("article_id")
        .eq("article_id", articleId)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
  const isSaved = bookmarkQuery.data === true;

  const toggle = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("not-authenticated");
      if (isSaved) {
        const { error } = await supabase
          .from("academy_bookmarks")
          .delete()
          .eq("article_id", articleId)
          .eq("user_id", user.id);
        if (error) throw error;
        return false;
      }
      const { error } = await supabase
        .from("academy_bookmarks")
        .insert({ article_id: articleId, user_id: user.id });
      if (error) throw error;
      return true;
    },
    onSuccess: (saved) => {
      qc.setQueryData(["academy", "bookmark", articleId, user?.id ?? null], saved);
      qc.invalidateQueries({ queryKey: ["academy", "bookmarks"] });
      toast.success(saved ? "Saved to your library" : "Removed from saved");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg === "not-authenticated" ? "Sign in to save articles" : "Couldn't update save");
    },
  });

  // After returning from sign-in with a pending save intent for THIS article,
  // apply the bookmark automatically once the auth + bookmark queries settle.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (authLoading || !user) return;
    if (bookmarkQuery.isLoading || bookmarkQuery.data === undefined) return;
    const pending = sessionStorage.getItem("av_pending_bookmark");
    if (pending !== articleId) return;
    sessionStorage.removeItem("av_pending_bookmark");
    if (bookmarkQuery.data === true) {
      toast.success("Already in your library");
      return;
    }
    if (!toggle.isPending) toggle.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, bookmarkQuery.isLoading, bookmarkQuery.data, articleId]);

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text: excerpt ?? undefined, url });
        return;
      } catch {
        /* user cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const onSave = () => {
    if (!user) {
      const redirect = typeof window !== "undefined" ? window.location.pathname : "/academy";
      if (typeof window !== "undefined") {
        sessionStorage.setItem("av_pending_bookmark", articleId);
      }
      toast.message("Sign in to save this article");
      navigate({ to: "/auth", search: { redirect } as never });
      return;
    }
    toggle.mutate();
  };

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void share()}
        className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3.5 py-1.5 text-sm font-medium text-ink transition hover:border-[#B8860B] hover:text-[#B8860B]"
      >
        {copied ? <Check size={14} /> : <Share2 size={14} />}
        {copied ? "Link copied" : "Share"}
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={authLoading || toggle.isPending}
        aria-pressed={isSaved}
        aria-label={isSaved ? "Remove from saved" : "Save for later"}
        title={isSaved ? "Remove from saved" : "Save for later"}
        className={
          "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition disabled:opacity-60 " +
          (isSaved
            ? "border-[#B8860B] bg-[#FDF9F0] text-[#B8860B]"
            : "border-ink/15 bg-white text-ink hover:border-[#B8860B] hover:text-[#B8860B]")
        }
      >
        {isSaved ? <BookmarkCheck size={14} /> : <BookmarkPlus size={14} />}
        {isSaved ? "Saved" : "Save"}
      </button>
    </div>
  );
}
