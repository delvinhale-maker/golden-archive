import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AVLogo } from "@/components/marketplace/AVLogo";
import { ArrowLeft, Mail, Search, Trash2, ShieldCheck, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/messages")({
  component: AdminMessagesPage,
});

type Msg = {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  status: string;
  created_at: string;
  ip_hash: string | null;
  user_agent: string | null;
};

function AdminMessagesPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [rows, setRows] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const allowed = data?.role === "admin";
        setIsAdmin(allowed);
        setChecking(false);
        if (!allowed) navigate({ to: "/dashboard" });
      });
    return () => {
      active = false;
    };
  }, [loading, user, navigate]);

  async function refresh() {
    setBusy(true);
    const { data, error } = await supabase
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as Msg[]);
  }

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin]);

  const topics = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => s.add(r.topic || "other"));
    return ["all", ...Array.from(s).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (topic !== "all" && (r.topic || "other") !== topic) return false;
      if (!needle) return true;
      return (
        r.name.toLowerCase().includes(needle) ||
        r.email.toLowerCase().includes(needle) ||
        r.message.toLowerCase().includes(needle) ||
        r.topic.toLowerCase().includes(needle)
      );
    });
  }, [rows, q, topic]);

  async function remove(id: string) {
    if (!window.confirm("Delete this message? This cannot be undone.")) return;
    const { error } = await supabase.from("contact_messages").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((r) => r.filter((m) => m.id !== id));
    toast.success("Message deleted");
  }

  if (loading || checking) return null;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-4 flex items-center gap-4">
          <Link to="/"><AVLogo /></Link>
          <span className="inline-flex items-center gap-1.5 text-sm rounded-full bg-gold/15 text-gold px-3 py-1">
            <ShieldCheck size={14} /> Admin
          </span>
          <Link to="/admin" className="ml-auto text-sm text-white/70 hover:text-white inline-flex items-center gap-1">
            <ArrowLeft size={14} /> Admin home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 md:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="font-display text-3xl md:text-4xl text-navy inline-flex items-center gap-2">
            <Mail className="text-gold" /> Contact messages
          </h1>
          <button
            onClick={refresh}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-sm rounded-full border border-navy/20 text-navy px-3 py-1.5 hover:bg-navy/5 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, message…"
              className="w-full rounded-full border border-ink/15 bg-white pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="rounded-full border border-ink/15 bg-white px-3 py-2 text-sm focus:outline-none focus:border-gold"
          >
            {topics.map((t) => (
              <option key={t} value={t}>{t === "all" ? "All topics" : t}</option>
            ))}
          </select>
          <span className="text-xs text-mute">{filtered.length} of {rows.length}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/15 bg-white p-10 text-center text-mute">
            {rows.length === 0 ? "No messages yet." : "No matches for the current filters."}
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((m) => {
              const isOpen = !!expanded[m.id];
              return (
                <div key={m.id} className="bg-white border border-ink/10 rounded-2xl p-4">
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-lg text-navy">{m.name}</span>
                        <a href={`mailto:${m.email}`} className="text-sm text-gold hover:underline break-all">{m.email}</a>
                        <span className="text-[10px] uppercase tracking-wider rounded-full bg-navy/5 text-navy px-2 py-0.5">{m.topic || "other"}</span>
                      </div>
                      <p className="text-[11px] text-mute mt-0.5">
                        {new Date(m.created_at).toLocaleString()}
                      </p>
                      <p className={`text-sm text-ink/80 mt-2 whitespace-pre-wrap ${isOpen ? "" : "line-clamp-3"}`}>
                        {m.message}
                      </p>
                      {m.message.length > 200 && (
                        <button
                          onClick={() => setExpanded((s) => ({ ...s, [m.id]: !isOpen }))}
                          className="mt-1 text-xs text-navy hover:underline"
                        >
                          {isOpen ? "Show less" : "Show more"}
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => remove(m.id)}
                      className="inline-flex items-center gap-1 text-xs rounded-full bg-red-600 text-white px-3 py-1.5 hover:bg-red-700"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
