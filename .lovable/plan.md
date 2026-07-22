
# AurumVault Academy Editorial Studio

This spec is large enough that shipping it in one pass would be reckless — a single "publish" bug could break the live Academy. I'll build it in three phases so each one is reviewable and publishable on its own. Every phase is admin-only (gated by the existing `has_role(auth.uid(), 'admin')` check plus the `_authenticated/admin.*` route layout).

## Phase 1 — Editorial Studio shell + core publishing (this turn)

The floating gold "+" on `/academy` becomes the Editorial Studio launcher. Non-admins never see the button; the component returns `null` unless `useAuth().isAdmin` is true.

Menu (expanding radial/stack, navy → cream → gold, blur backdrop, Framer Motion):
- New Article → creates a draft row via existing `academy_articles` insert, routes to editor
- Edit Article → `/admin/academy` (already exists — polish list: search, category filter, status filter, sort, duplicate, archive, delete)
- Preview → opens current article in a new tab at `/academy/article/$slug?preview=1`
- Publish / Save Draft / Schedule / SEO / Upload Featured Image → all deep-link into the editor with the correct panel open

Editor upgrades to `/admin/academy/$id` (extends existing file, no rewrite):
- Title + Subtitle + Excerpt + Author + Category + Difficulty (new column) + Reading time (auto from body word count, editable)
- Featured image: drag-and-drop upload to a new `academy-covers` public bucket with instant preview, alt text, caption
- Rich body editor (Tiptap: H1–H4, bold/italic/underline, lists, quotes, code, tables, image, video embed, link, divider, callout)
- Toggles: Featured, Editor's Pick, Latest, Pinned
- Status: Draft / Scheduled / Published with a scheduler (date + time + timezone)
- Autosave every 30s with "Last saved …" indicator
- Related products (already exists) + Related articles picker + Tags
- Sticky publish bar: Preview · Save draft · Schedule · Publish

Publish confirmation modal shows word count, reading time, missing alt/meta warnings, then success animation + copy URL + share links.

DB migration (single):
- `academy-covers` public storage bucket + admin-write RLS
- `academy_articles`: add `subtitle`, `difficulty` (enum), `tags text[]`, `editors_pick bool`, `is_latest bool`, `cover_alt`, `cover_caption`, `focus_keyword`, `secondary_keywords text[]`, `canonical_url`, `og_title`, `og_description`, `twitter_card`, `schema_type`, `robots_index bool`, `robots_follow bool`
- `academy_article_versions` (id, article_id, snapshot jsonb, saved_at, saved_by) for version history
- `academy_article_related` (article_id, related_id, sort_order)
- All with proper GRANTs + admin-only write policies; public read stays as-is

## Phase 2 — SEO dashboard + internal-linking assistant

- Dedicated SEO panel in the editor with score/100, live recommendations (keyword density, H2 presence, internal/external links, alt text, title/meta length)
- Schema JSON-LD emitted from article route `head()` based on `schema_type`
- Sitemap route (`sitemap.xml`) already includes articles; extend to include `lastmod` from new fields
- Internal linking suggestions: query `academy_articles` + `marketplace_products` by shared category/keyword while editing

## Phase 3 — Preview modes + media manager + auto footer

- Preview route with Desktop / Tablet / Mobile / Dark / Light frames
- Standalone Media Manager (upload, crop, resize, WebP conversion via `sharp`-free browser canvas, alt/caption library)
- Automatic article footer component (About AurumVault Editorial, related articles, recommended products, newsletter signup, share buttons, last updated, reading time) rendered on `/academy/article/$slug`

## Technical notes (for me)

- Tiptap (`@tiptap/react`, StarterKit, table, link, image, youtube) — add via `bun add`
- Autosave debounced with `useEffect` + `setInterval`; version snapshot on each successful save
- Storage bucket created via `supabase--storage_create_bucket`
- All migrations follow the CREATE → GRANT → RLS ENABLE → POLICY order
- Difficulty enum: `create type public.academy_difficulty as enum ('beginner','intermediate','advanced')`
- Publish is a normal Supabase update; the existing site auto-serves updated rows — no separate "publish pipeline" needed
- Non-admin visitors: the FAB, editor routes, and admin API paths all return `null` / redirect

## Out of scope until you confirm

- Substack-style newsletter delivery (needs a sender identity + list)
- AI writing assistant (would use Lovable AI Gateway — say the word and I'll add it in Phase 2)
- Multi-author permissions beyond "admin" (spec says admin-only, so I'm keeping it that way)

Approve and I'll ship Phase 1 in the next turn.
