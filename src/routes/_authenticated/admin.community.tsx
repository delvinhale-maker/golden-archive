import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import {
  listAnnouncements,
  adminCreateAnnouncement,
  adminDeleteAnnouncement,
  adminListPendingPosts,
  adminSetPostStatus,
} from "@/lib/community.functions";
import {
  adminListSpotlights,
  adminUpsertSpotlight,
} from "@/lib/spotlights.functions";
import { Trash2, CheckCircle2, EyeOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/community")({
  component: AdminCommunityPage,
});

const TABS = [
  { id: "announce", label: "Announcements" },
  { id: "moderate", label: "Forum queue" },
  { id: "spotlight", label: "Spotlights" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function AdminCommunityPage() {
  const [tab, setTab] = useState<TabId>("announce");
  return (
    <PublisherShell accent={ACCENTS.help}>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="font-display text-3xl text-navy">Admin — Community</h1>
        <Link to="/dashboard/community" className="text-sm text-navy underline">
          Open creator view
        </Link>
      </div>

      <div className="mb-6 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px px-4 py-2 text-sm font-semibold ${
              tab === t.id
                ? "border-b-2 border-navy text-navy"
                : "text-mute hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "announce" && <Announce />}
      {tab === "moderate" && <ModerateQueue />}
      {tab === "spotlight" && <Spotlights />}
    </PublisherShell>
  );
}

function Announce() {
  const list = useServerFn(listAnnouncements);
  const create = useServerFn(adminCreateAnnouncement);
  const del = useServerFn(adminDeleteAnnouncement);
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);

  const query = useQuery({
    queryKey: ["admin", "announcements"],
    queryFn: () => list(),
  });
  const createMut = useMutation({
    mutationFn: create,
    onSuccess: () => {
      setTitle("");
      setBody("");
      setPinned(false);
      qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
      qc.invalidateQueries({ queryKey: ["community", "announcements"] });
      toast.success("Announcement published");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
      qc.invalidateQueries({ queryKey: ["community", "announcements"] });
    },
  });

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim() || !body.trim()) {
            toast.error("Title and body required");
            return;
          }
          createMut.mutate({ data: { title: title.trim(), body: body.trim(), pinned } });
        }}
        className="rounded-xl border border-line bg-white p-4 shadow-sm"
      >
        <h2 className="mb-3 font-display text-lg font-bold">New announcement</h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Title"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          maxLength={10000}
          placeholder="Body (plain text or basic markdown)"
          className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
        <label className="mt-3 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
          />
          Pin to top
        </label>
        <button
          type="submit"
          disabled={createMut.isPending}
          className="mt-3 rounded-full bg-navy px-5 py-2 text-sm font-bold text-white"
        >
          {createMut.isPending ? "Publishing…" : "Publish"}
        </button>
      </form>

      <div>
        <h2 className="mb-3 font-display text-lg font-bold">Live announcements</h2>
        <ul className="space-y-2">
          {(query.data ?? []).map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-line bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-mute">
                    {new Date(a.createdAt).toLocaleString()}
                    {a.pinned && " · Pinned"}
                  </div>
                  <div className="font-semibold text-ink">{a.title}</div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-mute">{a.body}</p>
                </div>
                <button
                  onClick={() => delMut.mutate(a.id)}
                  className="rounded-lg p-2 text-mute hover:bg-muted"
                  aria-label="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
          {(query.data ?? []).length === 0 && (
            <li className="text-sm text-mute">No announcements yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function ModerateQueue() {
  const list = useServerFn(adminListPendingPosts);
  const setStatus = useServerFn(adminSetPostStatus);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["admin", "forum-queue"],
    queryFn: () => list(),
  });
  const mut = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "hidden" }) =>
      setStatus({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "forum-queue"] });
      qc.invalidateQueries({ queryKey: ["community", "forum"] });
    },
  });
  const rows = query.data ?? [];
  if (query.isLoading) return <div className="text-mute">Loading…</div>;
  if (rows.length === 0)
    return <div className="text-sm text-mute">Nothing awaits review 🎉</div>;
  return (
    <ul className="space-y-3">
      {rows.map((p) => (
        <li
          key={p.id}
          className="rounded-xl border border-line bg-white p-4 shadow-sm"
        >
          <div className="mb-1 flex items-center gap-2 text-xs text-mute">
            <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">
              {p.category}
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
              {p.status}
            </span>
            <span>{p.authorName}</span>
            <span>·</span>
            <span>{new Date(p.createdAt).toLocaleString()}</span>
          </div>
          <div className="font-display text-base font-bold text-ink">{p.title}</div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink/85">{p.body}</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => mut.mutate({ id: p.id, status: "approved" })}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
            >
              <CheckCircle2 size={13} /> Approve
            </button>
            <button
              onClick={() => mut.mutate({ id: p.id, status: "hidden" })}
              className="inline-flex items-center gap-1 rounded-full bg-slate-700 px-3 py-1.5 text-xs font-bold text-white"
            >
              <EyeOff size={13} /> Hide
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Spotlights() {
  const list = useServerFn(adminListSpotlights);
  const upsert = useServerFn(adminUpsertSpotlight);
  const qc = useQueryClient();
  const [sellerId, setSellerId] = useState("");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  });
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [hero, setHero] = useState("");
  const [published, setPublished] = useState(true);

  const query = useQuery({
    queryKey: ["admin", "spotlights"],
    queryFn: () => list(),
  });
  const mut = useMutation({
    mutationFn: upsert,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "spotlights"] });
      qc.invalidateQueries({ queryKey: ["home", "spotlight"] });
      toast.success("Spotlight saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate({
            data: {
              sellerId,
              month,
              headline,
              body,
              heroImageUrl: hero || null,
              published,
            },
          });
        }}
        className="rounded-xl border border-line bg-white p-4 shadow-sm"
      >
        <h2 className="mb-3 font-display text-lg font-bold">New / update spotlight</h2>
        <label className="text-xs font-bold uppercase tracking-caps text-mute">
          Seller UUID
        </label>
        <input
          value={sellerId}
          onChange={(e) => setSellerId(e.target.value)}
          className="mb-2 w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
        <label className="text-xs font-bold uppercase tracking-caps text-mute">
          Month (YYYY-MM-01)
        </label>
        <input
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="mb-2 w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
        <label className="text-xs font-bold uppercase tracking-caps text-mute">
          Headline
        </label>
        <input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          maxLength={200}
          className="mb-2 w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
        <label className="text-xs font-bold uppercase tracking-caps text-mute">
          Hero image URL (optional)
        </label>
        <input
          value={hero}
          onChange={(e) => setHero(e.target.value)}
          className="mb-2 w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
        <label className="text-xs font-bold uppercase tracking-caps text-mute">
          Interview body (markdown)
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          className="mb-2 w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          Published
        </label>
        <button
          type="submit"
          disabled={mut.isPending}
          className="mt-3 rounded-full bg-navy px-5 py-2 text-sm font-bold text-white"
        >
          {mut.isPending ? "Saving…" : "Save spotlight"}
        </button>
      </form>

      <div>
        <h2 className="mb-3 font-display text-lg font-bold">Recent spotlights</h2>
        <ul className="space-y-2">
          {(query.data ?? []).map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-line bg-white p-3 shadow-sm"
            >
              <div className="text-xs text-mute">
                {s.month} · {s.published ? "Published" : "Draft"}
              </div>
              <div className="font-semibold text-ink">{s.headline}</div>
            </li>
          ))}
          {(query.data ?? []).length === 0 && (
            <li className="text-sm text-mute">No spotlights yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
