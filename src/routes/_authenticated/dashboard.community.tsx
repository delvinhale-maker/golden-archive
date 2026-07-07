import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import {
  Megaphone,
  MessageSquare,
  Trophy,
  Award,
  BookOpen,
  Heart,
  MessageCircle,
  Sparkles,
  Star,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { useAuth } from "@/hooks/use-auth";
import {
  listAnnouncements,
  markAnnouncementRead,
  listForumPosts,
  createForumPost,
  toggleForumLike,
  listForumReplies,
  createForumReply,
  type ForumPost,
} from "@/lib/community.functions";
import {
  getCreatorLeaderboard,
  getCreatorBadges,
  type Badge,
} from "@/lib/leaderboard.functions";

export const Route = createFileRoute("/_authenticated/dashboard/community")({
  component: CommunityPage,
});

const COMMUNITY_ACCENT = { color: "#4B2D8F", tint: "rgba(75,45,143,0.08)" };

const TABS = [
  { id: "feed", label: "Feed", icon: Megaphone },
  { id: "forum", label: "Forum", icon: MessageSquare },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "badges", label: "Badges", icon: Award },
  { id: "resources", label: "Resources", icon: BookOpen },
] as const;
type TabId = (typeof TABS)[number]["id"];

function CommunityPage() {
  const [tab, setTab] = useState<TabId>("feed");

  return (
    <PublisherShell accent={COMMUNITY_ACCENT}>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl md:text-4xl text-navy">
          Creator Community
        </h1>
        <p className="text-mute">
          Announcements, forum, leaderboard, badges, and resources — all in one place.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="relative -mb-px inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors"
              style={{
                color: active ? COMMUNITY_ACCENT.color : "hsl(var(--muted-foreground))",
                background: active ? "white" : "transparent",
                borderBottom: active
                  ? `2px solid ${COMMUNITY_ACCENT.color}`
                  : "2px solid transparent",
              }}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {tab === "feed" && <FeedTab />}
        {tab === "forum" && <ForumTab />}
        {tab === "leaderboard" && <LeaderboardTab />}
        {tab === "badges" && <BadgesTab />}
        {tab === "resources" && <ResourcesTab />}
      </div>
    </PublisherShell>
  );
}

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------
function FeedTab() {
  const list = useServerFn(listAnnouncements);
  const mark = useServerFn(markAnnouncementRead);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["community", "announcements"],
    queryFn: () => list(),
  });
  const markMut = useMutation({
    mutationFn: (id: string) => mark({ data: { announcementId: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community", "announcements"] }),
  });

  if (query.isLoading) return <div className="text-mute">Loading…</div>;
  const items = query.data ?? [];
  if (items.length === 0)
    return (
      <EmptyState
        icon={<Megaphone size={20} />}
        title="No announcements yet"
        body="When AurumVault posts news for creators, it will show up here."
      />
    );
  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <li
          key={a.id}
          className="rounded-xl border border-line bg-white p-5 shadow-sm"
          onMouseEnter={() => {
            if (a.unread) markMut.mutate(a.id);
          }}
        >
          <div className="mb-1 flex items-center gap-2">
            {a.pinned && (
              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-caps text-navy">
                Pinned
              </span>
            )}
            {a.unread && (
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: COMMUNITY_ACCENT.color }}
              />
            )}
            <span className="text-xs text-mute">
              {new Date(a.createdAt).toLocaleDateString()}
            </span>
          </div>
          <h3 className="font-display text-lg font-bold text-ink">{a.title}</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink/85">{a.body}</p>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Forum
// ---------------------------------------------------------------------------
const CATEGORIES = [
  { id: "question", label: "Question" },
  { id: "win", label: "Win" },
  { id: "feedback", label: "Feedback" },
] as const;

function ForumTab() {
  const [category, setCategory] = useState<"question" | "win" | "feedback" | "all">("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const list = useServerFn(listForumPosts);
  const create = useServerFn(createForumPost);
  const like = useServerFn(toggleForumLike);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["community", "forum", category, mineOnly],
    queryFn: () =>
      list({
        data: {
          category: category === "all" ? undefined : category,
          mineOnly,
        },
      }),
  });

  const createMut = useMutation({
    mutationFn: create,
    onSuccess: () => {
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["community", "forum"] });
      toast.success("Posted — pending moderation.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const likeMut = useMutation({
    mutationFn: (v: { postId: string; like: boolean }) => like({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community", "forum"] }),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setCategory("all")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            category === "all"
              ? "bg-navy text-white"
              : "border border-line text-ink hover:bg-muted"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              category === c.id
                ? "bg-navy text-white"
                : "border border-line text-ink hover:bg-muted"
            }`}
          >
            {c.label}
          </button>
        ))}
        <label className="ml-2 flex items-center gap-1.5 text-xs text-mute">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
          />
          Mine only
        </label>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="ml-auto rounded-full bg-gold px-4 py-2 text-sm font-bold text-navy hover:brightness-95"
        >
          {showForm ? "Cancel" : "New Post"}
        </button>
      </div>

      {showForm && (
        <NewPostForm
          onSubmit={(v) => createMut.mutate({ data: v })}
          submitting={createMut.isPending}
        />
      )}

      {query.isLoading && <div className="text-mute">Loading…</div>}
      {!query.isLoading && (query.data ?? []).length === 0 && (
        <EmptyState
          icon={<MessageSquare size={20} />}
          title="No posts yet"
          body="Be the first to ask a question, share a win, or request feedback."
        />
      )}
      <ul className="space-y-3">
        {(query.data ?? []).map((p) => (
          <ForumPostCard
            key={p.id}
            post={p}
            onToggleLike={() =>
              likeMut.mutate({ postId: p.id, like: !p.likedByMe })
            }
          />
        ))}
      </ul>
    </div>
  );
}

function NewPostForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (v: { title: string; body: string; category: "question" | "win" | "feedback" }) => void;
  submitting: boolean;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<"question" | "win" | "feedback">("question");
  return (
    <form
      className="mb-4 rounded-xl border border-line bg-white p-4 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim() || !body.trim()) {
          toast.error("Title and body are required");
          return;
        }
        onSubmit({ title: title.trim(), body: body.trim(), category });
      }}
    >
      <div className="mb-3 flex gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              category === c.id
                ? "bg-navy text-white"
                : "border border-line text-ink"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        placeholder="Title"
        className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        maxLength={8000}
        placeholder="Share the details…"
        className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20"
      />
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-navy px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {submitting ? "Posting…" : "Post for review"}
        </button>
      </div>
    </form>
  );
}

function ForumPostCard({
  post,
  onToggleLike,
}: {
  post: ForumPost;
  onToggleLike: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const catColor: Record<ForumPost["category"], string> = {
    question: "#2E5B8A",
    win: "#1A6B3A",
    feedback: "#C47B00",
  };
  return (
    <li className="rounded-xl border border-line bg-white p-5 shadow-sm">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-caps text-white"
          style={{ background: catColor[post.category] }}
        >
          {post.category}
        </span>
        {post.status !== "approved" && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-caps text-amber-900">
            {post.status}
          </span>
        )}
        <span className="text-xs text-mute">
          {post.authorName} · {new Date(post.createdAt).toLocaleDateString()}
        </span>
      </div>
      <h3 className="font-display text-lg font-bold text-ink">{post.title}</h3>
      <p className="mt-1 whitespace-pre-wrap text-sm text-ink/85">{post.body}</p>
      <div className="mt-3 flex items-center gap-4 text-sm">
        <button
          onClick={onToggleLike}
          className="inline-flex items-center gap-1.5 text-mute hover:text-ink"
        >
          <Heart
            size={15}
            fill={post.likedByMe ? "currentColor" : "none"}
            className={post.likedByMe ? "text-rose-500" : ""}
          />
          {post.likesCount}
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1.5 text-mute hover:text-ink"
        >
          <MessageCircle size={15} /> {post.replyCount}
        </button>
      </div>
      {expanded && <ReplyThread postId={post.id} />}
    </li>
  );
}

function ReplyThread({ postId }: { postId: string }) {
  const list = useServerFn(listForumReplies);
  const create = useServerFn(createForumReply);
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const query = useQuery({
    queryKey: ["community", "replies", postId],
    queryFn: () => list({ data: { postId } }),
  });
  const createMut = useMutation({
    mutationFn: (b: string) => create({ data: { postId, body: b } }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["community", "replies", postId] });
      qc.invalidateQueries({ queryKey: ["community", "forum"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="mt-4 border-t border-line pt-3">
      {query.isLoading ? (
        <div className="text-xs text-mute">Loading replies…</div>
      ) : (
        <ul className="space-y-2">
          {(query.data ?? []).map((r) => (
            <li key={r.id} className="rounded-lg bg-muted/60 p-3 text-sm">
              <div className="text-[11px] font-semibold text-mute">
                {r.authorName} · {new Date(r.createdAt).toLocaleDateString()}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-ink/90">{r.body}</p>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return;
          createMut.mutate(body.trim());
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          placeholder="Write a reply…"
          className="flex-1 rounded-full border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20"
        />
        <button
          type="submit"
          disabled={createMut.isPending}
          className="rounded-full bg-navy px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          Reply
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------
function LeaderboardTab() {
  const list = useServerFn(getCreatorLeaderboard);
  const query = useQuery({
    queryKey: ["community", "leaderboard"],
    queryFn: () => list(),
  });
  if (query.isLoading) return <div className="text-mute">Loading…</div>;
  const rows = query.data ?? [];
  if (rows.length === 0)
    return (
      <EmptyState
        icon={<Trophy size={20} />}
        title="No sales this month yet"
        body="Once creators start selling this month, the top 10 will appear here."
      />
    );
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="border-b border-line bg-muted/40 text-left text-xs uppercase tracking-caps text-mute">
          <tr>
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">Creator</th>
            <th className="px-4 py-3">Sales</th>
            <th className="px-4 py-3">Gross</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.sellerId} className="border-b border-line last:border-0">
              <td className="px-4 py-3">
                <RankBadge rank={r.rank} />
              </td>
              <td className="px-4 py-3">
                {r.slug ? (
                  <Link
                    to="/a/$brandSlug"
                    params={{ brandSlug: r.slug }}
                    className="font-semibold text-ink hover:underline"
                  >
                    {r.name}
                  </Link>
                ) : (
                  <span className="font-semibold text-ink">{r.name}</span>
                )}
              </td>
              <td className="px-4 py-3 text-ink">{r.salesCount}</td>
              <td className="px-4 py-3 font-semibold text-ink">
                ${(r.grossCents / 100).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold text-ink">
      {rank}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------
function BadgesTab() {
  const { user } = useAuth();
  const list = useServerFn(getCreatorBadges);
  const query = useQuery({
    queryKey: ["community", "badges", user?.id],
    queryFn: () => list({ data: { sellerId: user!.id } }),
    enabled: !!user?.id,
  });
  const badges = query.data ?? [];
  const earnedCount = useMemo(() => badges.filter((b) => b.earned).length, [badges]);
  if (!user) return null;
  if (query.isLoading) return <div className="text-mute">Loading…</div>;
  return (
    <div>
      <p className="mb-4 text-sm text-mute">
        You've earned <span className="font-bold text-ink">{earnedCount}</span> of{" "}
        {badges.length} creator badges.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {badges.map((b) => (
          <BadgeCard key={b.key} badge={b} />
        ))}
      </div>
    </div>
  );
}

function BadgeCard({ badge }: { badge: Badge }) {
  return (
    <div
      className="rounded-xl border p-4 shadow-sm transition"
      style={{
        background: badge.earned ? COMMUNITY_ACCENT.color : "white",
        color: badge.earned ? "white" : undefined,
        borderColor: badge.earned ? COMMUNITY_ACCENT.color : "hsl(var(--border))",
        opacity: badge.earned ? 1 : 0.6,
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <Sparkles size={16} />
        <span className="text-xs font-bold uppercase tracking-caps">
          {badge.earned ? "Earned" : "Locked"}
        </span>
      </div>
      <div className="font-display text-lg font-bold">{badge.label}</div>
      <div className="mt-1 text-xs opacity-80">{badge.hint}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------
const RESOURCES = [
  {
    group: "Getting Started",
    items: [
      {
        title: "Your first product in 20 minutes",
        body: "A step-by-step walkthrough from application to publish.",
        to: "/dashboard/new",
      },
      {
        title: "AI Studio: create covers & descriptions",
        body: "Use the built-in AI tools to speed up production.",
        to: "/dashboard/ai-studio",
      },
    ],
  },
  {
    group: "Growing Sales",
    items: [
      {
        title: "Pricing strategy",
        body: "How to test PWYW, tiers, and compare-at pricing.",
        to: "/dashboard/help",
      },
      {
        title: "Order bumps that convert",
        body: "Attach complementary offers at checkout to lift AOV.",
        to: "/dashboard/help",
      },
      {
        title: "Reviews & social proof",
        body: "Requesting reviews and showcasing photo reviews.",
        to: "/dashboard/help",
      },
    ],
  },
  {
    group: "Payouts & Ops",
    items: [
      {
        title: "How and when you get paid",
        body: "The payout schedule and how to track your balance.",
        to: "/dashboard/earn",
      },
      {
        title: "Affiliate program",
        body: "Recruit affiliates and set commissions per product.",
        to: "/dashboard/affiliate",
      },
      {
        title: "Compliance & taxes",
        body: "What to keep on file and how invoicing works.",
        to: "/dashboard/help",
      },
    ],
  },
];

function ResourcesTab() {
  return (
    <div className="space-y-6">
      {RESOURCES.map((g) => (
        <section key={g.group}>
          <h2 className="mb-2 font-display text-lg font-bold text-ink">{g.group}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {g.items.map((it) => (
              <Link
                key={it.title}
                to={it.to as never}
                className="group rounded-xl border border-line bg-white p-4 shadow-sm transition hover:border-navy/40 hover:shadow-md"
              >
                <div className="mb-1 flex items-center gap-2">
                  <Star size={14} className="text-gold-ink" />
                  <span className="text-[10px] font-bold uppercase tracking-caps text-mute">
                    Guide
                  </span>
                </div>
                <div className="font-display text-base font-bold text-ink group-hover:underline">
                  {it.title}
                </div>
                <p className="mt-1 text-sm text-mute">{it.body}</p>
                <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-navy">
                  Open <ExternalLink size={12} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------
function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white/60 p-10 text-center">
      <div className="mb-2 text-mute">{icon}</div>
      <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-mute">{body}</p>
    </div>
  );
}
