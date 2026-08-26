import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Mail, RefreshCw, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  getInsiderStats,
  listEditionsAdmin,
  saveEdition,
  deleteEdition,
  sendEdition,
  type InsiderEdition,
  type InsiderStats,
} from "@/lib/insider.functions";
import { AUDIENCE_LABEL, type AudienceType } from "@/lib/insider";

export const Route = createFileRoute("/_authenticated/admin/insider")({
  component: AdminInsiderPage,
  head: () => ({
    meta: [
      { title: "AurumVault Insider · Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-caps text-black/50">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-navy">{value}</div>
    </div>
  );
}

function AdminInsiderPage() {
  const fetchStats = useServerFn(getInsiderStats);
  const fetchEditions = useServerFn(listEditionsAdmin);
  const save = useServerFn(saveEdition);
  const remove = useServerFn(deleteEdition);
  const send = useServerFn(sendEdition);

  const [stats, setStats] = useState<InsiderStats | null>(null);
  const [editions, setEditions] = useState<InsiderEdition[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [audienceType, setAudienceType] = useState<AudienceType>("GENERAL");
  const [isPublic, setIsPublic] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");

  async function reload() {
    setLoading(true);
    try {
      const [s, e] = await Promise.all([fetchStats({}), fetchEditions({})]);
      setStats(s);
      setEditions(e.editions);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setSubject("");
    setPreviewText("");
    setBodyMd("");
    setAudienceType("GENERAL");
    setIsPublic(true);
  }

  async function onSave(status: "draft" | "published") {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setBusy(true);
    try {
      await save({
        data: {
          id: editingId,
          title,
          subject: subject || title,
          previewText: previewText || null,
          bodyMd,
          audienceType,
          isPublic,
          status,
        },
      });
      toast.success(status === "published" ? "Edition published" : "Draft saved");
      resetForm();
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSend(id: string, test: boolean) {
    if (test && !testEmail.trim()) {
      toast.error("Enter a test email address first");
      return;
    }
    if (!test && !confirm("Send this edition to all matching subscribers?")) return;
    setBusy(true);
    try {
      const res = await send({ data: { id, testEmail: test ? testEmail.trim() : null } });
      toast.success(`Queued ${res.sent} email${res.sent === 1 ? "" : "s"}${res.skipped ? ` · ${res.skipped} skipped` : ""}`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-mute hover:text-navy">
        <ArrowLeft className="h-4 w-4" /> Admin
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-navy">AurumVault Insider</h1>
        <button
          onClick={() => void reload()}
          className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <p className="mt-8 flex items-center gap-2 text-sm text-mute">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Active subscribers" value={stats?.totalActive ?? 0} />
            <Stat label="New · 7 days" value={stats?.new7 ?? 0} />
            <Stat label="New · 30 days" value={stats?.new30 ?? 0} />
            <Stat label="Unsubscribed" value={stats?.unsubscribed ?? 0} />
            <Stat label="General" value={stats?.byAudience.GENERAL ?? 0} />
            <Stat label="Creator" value={stats?.byAudience.CREATOR ?? 0} />
            <Stat label="Business tools" value={stats?.byAudience.BUSINESS_TOOL ?? 0} />
            <Stat label="Welcome emails sent" value={stats?.welcomeSent ?? 0} />
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <section className="rounded-xl border border-black/10 bg-white p-4">
              <h2 className="text-sm font-bold text-navy">Top signup sources</h2>
              <ul className="mt-3 space-y-1 text-sm text-mute">
                {(stats?.bySource ?? []).map((s) => (
                  <li key={s.source} className="flex justify-between">
                    <span>{s.source}</span>
                    <span className="font-semibold text-navy">{s.count}</span>
                  </li>
                ))}
                {(stats?.bySource ?? []).length === 0 ? <li>No signups yet.</li> : null}
              </ul>
            </section>

            <section className="rounded-xl border border-black/10 bg-white p-4">
              <h2 className="text-sm font-bold text-navy">Recent signups</h2>
              <p className="mt-1 text-xs text-mute">
                Email addresses are never exposed here.
              </p>
              <ul className="mt-3 space-y-1 text-sm text-mute">
                {(stats?.recent ?? []).map((r, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>{new Date(r.created_at).toLocaleDateString()}</span>
                    <span>{AUDIENCE_LABEL[r.audience_type as AudienceType] ?? r.audience_type}</span>
                    <span className="truncate">{r.source}</span>
                    <span className="font-semibold text-navy">{r.status}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="mt-8 rounded-xl border border-black/10 bg-white p-4">
            <h2 className="text-sm font-bold text-navy">
              {editingId ? "Edit edition" : "New edition"}
            </h2>
            <div className="mt-3 grid gap-3">
              <label className="text-sm">
                <span className="text-mute">Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="text-mute">Email subject</span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Defaults to the title"
                  className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="text-mute">Preview text</span>
                <input
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="text-mute">
                  Body — blank line between paragraphs, [label](https://…) for links
                </span>
                <textarea
                  value={bodyMd}
                  onChange={(e) => setBodyMd(e.target.value)}
                  rows={10}
                  className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 font-mono text-xs"
                />
              </label>
              <div className="flex flex-wrap items-center gap-4">
                <label className="text-sm">
                  <span className="text-mute">Audience</span>
                  <select
                    value={audienceType}
                    onChange={(e) => setAudienceType(e.target.value as AudienceType)}
                    className="ml-2 rounded-lg border border-black/10 px-3 py-2"
                  >
                    <option value="GENERAL">All subscribers</option>
                    <option value="CREATOR">Creators</option>
                    <option value="BUSINESS_TOOL">Business tools</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm text-mute">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                  />
                  Publish to the public /insider archive
                </label>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  disabled={busy}
                  onClick={() => void onSave("draft")}
                  className="rounded-full border border-black/10 px-4 py-2 text-sm disabled:opacity-60"
                >
                  Save draft
                </button>
                <button
                  disabled={busy}
                  onClick={() => void onSave("published")}
                  className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Publish
                </button>
                {editingId ? (
                  <button onClick={resetForm} className="text-sm text-mute underline">
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-sm font-bold text-navy">Editions</h2>
              <label className="text-sm">
                <span className="text-mute">Test address</span>
                <input
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  type="email"
                  placeholder="you@example.com"
                  className="ml-2 rounded-lg border border-black/10 px-3 py-2"
                />
              </label>
            </div>
            <ul className="mt-4 space-y-3">
              {editions.map((e) => (
                <li key={e.id} className="rounded-xl border border-black/10 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-navy">{e.title}</div>
                      <div className="text-xs text-mute">
                        {e.status} · {AUDIENCE_LABEL[e.audience_type as AudienceType] ?? e.audience_type} ·{" "}
                        {e.is_public ? "public" : "private"} · {e.recipients_count} sent
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setEditingId(e.id);
                          setTitle(e.title);
                          setSubject(e.subject);
                          setPreviewText(e.preview_text ?? "");
                          setBodyMd(e.body_md);
                          setAudienceType((e.audience_type as AudienceType) ?? "GENERAL");
                          setIsPublic(e.is_public);
                        }}
                        className="rounded-full border border-black/10 px-3 py-1.5 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void onSend(e.id, true)}
                        className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-xs disabled:opacity-60"
                      >
                        <Mail className="h-3 w-3" /> Test
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void onSend(e.id, false)}
                        className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-navy disabled:opacity-60"
                      >
                        <Send className="h-3 w-3" /> Send
                      </button>
                      <button
                        disabled={busy}
                        onClick={async () => {
                          if (!confirm("Delete this edition?")) return;
                          await remove({ data: { id: e.id } });
                          await reload();
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-xs text-red-600 disabled:opacity-60"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
              {editions.length === 0 ? (
                <li className="text-sm text-mute">No editions yet.</li>
              ) : null}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
