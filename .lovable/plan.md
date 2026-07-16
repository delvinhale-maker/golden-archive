
# AurumVault Academy — Build Plan

Academy is a full content hub, not a blog. This is a large build; below is the phased delivery so we can ship incrementally and you can review after each phase.

## Phase 1 — Foundation (ship first)

**Database (new tables via migration)**
- `academy_articles` — id, slug (unique), title, excerpt, body (markdown/MDX), featured_image, category, author_id, reading_time_min, status (draft/scheduled/published), published_at, scheduled_for, featured, pinned, view_count, created_at, updated_at
- `academy_categories` — slug, name, emoji, description, sort_order (seeded: financial-freedom, ai-productivity, digital-publishing, kingdom-living, entrepreneurship)
- `academy_article_products` — join table, article_id ↔ marketplace_products.id (manual product tagging)
- `academy_bookmarks` — user_id, article_id
- RLS: public SELECT on published articles + categories; admin-only writes via `has_role`

**Routes**
```
src/routes/academy.tsx                    layout with <Outlet />
src/routes/academy.index.tsx              hub homepage (hero + categories + featured/latest)
src/routes/academy.$category.tsx          category listing with filters
src/routes/academy.article.$slug.tsx      article detail page
src/routes/_authenticated/admin.academy.tsx           admin list
src/routes/_authenticated/admin.academy.$id.tsx       admin editor
```

**Nav updates**
- Desktop header + mobile drawer/tabbar: add "Academy" between Browse and Library

**SEO**
- Per-route `head()` with title/description/OG/Twitter/canonical
- JSON-LD: Article schema on detail, BreadcrumbList, Organization
- `sitemap.xml.ts` extended to include published articles
- SEO-friendly slugs: `/academy/article/how-to-build-a-financial-freedom-plan`

**Article page includes**
- Semantic H1/H2/H3, reading time, author, publish date
- Featured image with lazy loading
- Recommended Resources rail (from `academy_article_products`, fallback to category match)
- Related Articles (same category, newest 3)

## Phase 2 — Discovery

- Search bar with autocomplete (server fn against title/excerpt)
- Category filter chips + sort (Newest / Most Popular / Featured)
- Trending articles (by view_count over 7 days)
- Author profile pages

## Phase 3 — Engagement

- Bookmarks (authed users)
- Reading history (localStorage → optional DB sync)
- Newsletter capture at article foot (uses existing `subscribers`)
- Comments (toggleable per-article)
- PDF download attachments
- Video embed support in article body

## Phase 4 — Admin polish

- Rich editor (MDX or Tiptap), draft/schedule, product tagging UI, feature/pin toggles, featured image upload to new `academy-images` public bucket

## Design system

Uses existing tokens (Deep Navy, Metallic Gold, Cream). Category cards: gold border, cream surface, emoji icon, hover elevation. Article cards: cover image (16:9), category chip, meta row, gold "Continue Reading →". Matches marketplace card spacing/typography exactly.

## What I'll ship in this first pass (please confirm)

**Phase 1 only**: DB schema, 4 public routes, nav integration, article/category/hub pages, product recommendations, full SEO + sitemap, admin list + basic editor (markdown textarea, not rich editor). Seeded with the 5 categories and 2–3 sample articles so you can see it live.

Phases 2–4 land in follow-up turns so we don't ship one giant untested change.

**Confirm to proceed with Phase 1**, or tell me to reorder / drop pieces.
