# Batch 9 — Creator Community

Adds a **Community** hub to the creator dashboard at `/dashboard/community` with six connected surfaces.

## 1. Creator feed (announcements)
- New table `creator_announcements` — title, body (markdown), pinned, published_at, author_id (admin).
- Public read for anyone with a `sellers` role; only admins can write. Managed from a new `admin.announcements.tsx`.
- Feed shows pinned first, then newest, with a "New" dot for anything the current creator hasn't opened yet (tracked in `creator_announcement_reads`).

## 2. Creator forum (moderated)
- New tables `creator_forum_posts` (title, body, category enum: question|win|feedback, status: pending|approved|hidden) and `creator_forum_replies`.
- All sellers can create posts (status defaults to `pending`), read approved posts, and reply on approved posts. Admin queue at `admin.forum.tsx` to approve/hide.
- Simple like counter on posts (`creator_forum_likes` table, one per user per post).

## 3. Creator leaderboard
- Server fn `getCreatorLeaderboard()` — aggregates `order_items` in current calendar month (America/New_York) by `seller_id`, sums `subtotal_cents - refund_cents`, returns top 10 with rank, display name, storefront slug, sales count, gross cents.
- Rank badges: 🥇🥈🥉 for 1–3, numeric chips for 4–10.
- Rendered on the community page and mirrored on the homepage "This month's top creators" strip.

## 4. Creator badges earned
- Deterministic — derived from existing data, no new table needed for state.
- `getCreatorBadges(sellerId)` computes: First Sale, 10 Sales, 100 Sales, $1K Earned, $10K Earned, Top Creator (rank 1–3 in current or any prior month via a lightweight cached view).
- Shown on the community page **and** on public storefronts (`store.$slug`) as small badge row.

## 5. Monthly creator spotlight
- New table `creator_spotlights` — seller_id, month (date, first-of-month), headline, interview_body (markdown), hero_image_url, published.
- Admins pick + write. Public read only for the currently-published row.
- Homepage adds a "Creator Spotlight" section pulling the most recent published spotlight; falls back to hidden when none.

## 6. Creator resources
- Static markdown-driven page at `/dashboard/community/resources` — categorized cards (Getting Started, Product Photography, Pricing, Marketing, Payouts) linking to in-app docs stored under `src/content/creator-resources/*.md`, rendered with the existing markdown component.
- No DB; ships with 8 seeded articles.

## Files (technical)

**Migrations (one call, all schema in one migration):**
- `creator_announcements`, `creator_announcement_reads`
- `creator_forum_posts`, `creator_forum_replies`, `creator_forum_likes` + `creator_forum_status` and `creator_forum_category` enums
- `creator_spotlights`
- All with owner + admin RLS, `service_role` grants, `authenticated` grants for creator-scoped tables, and narrow `anon` SELECT for the currently-published spotlight only.

**Server fns (`src/lib/*.functions.ts`):**
- `community.functions.ts`: `listAnnouncements`, `markAnnouncementRead`, `listForumPosts`, `createForumPost`, `listForumReplies`, `createForumReply`, `toggleForumLike`
- `leaderboard.functions.ts`: `getCreatorLeaderboard`, `getCreatorBadges`
- `spotlights.functions.ts`: `getCurrentSpotlight` (public), `adminUpsertSpotlight`
- Admin fns gated with `has_role(_, 'admin')`.

**Routes:**
- `_authenticated/dashboard.community.tsx` — tabs: Feed | Forum | Leaderboard | Badges | Resources
- `_authenticated/dashboard.community.resources.tsx`
- `_authenticated/admin.announcements.tsx`, `_authenticated/admin.forum.tsx`, `_authenticated/admin.spotlights.tsx`
- Homepage (`index.tsx`) gets a new `<CreatorSpotlight />` section + `<TopCreatorsStrip />`
- Storefront (`store.$slug.tsx`) gets a badge row under the header

**Components:**
- `CommunityShell`, `AnnouncementCard`, `ForumPostList`, `ForumPostForm`, `LeaderboardTable`, `BadgeGrid`, `SpotlightCard`, `ResourceCard`
- New icons via lucide-react; badge glyphs are inline SVG on top of accent tokens (no hardcoded colors).

**Nav:**
- New "Community" link in `PublisherShell` sidebar with a bell indicator when unread announcements exist.

## Not in this batch
- Direct messaging between creators
- Notifications outside the existing `notifications` table
- Rich WYSIWYG editor — posts and interviews are plain markdown

Reply "go" to build, or tell me what to cut/add.
