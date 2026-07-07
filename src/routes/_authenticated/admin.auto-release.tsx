import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AVLogo } from "@/components/marketplace/AVLogo";
import {
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/auto-release")({
  component: AdminAutoReleasePage,
});

type RunStatus = "success" | "failure" | "no_op";
type Run = {
  id: string;
  status: RunStatus;
  released_count: number;
  released_ids: string[];
  candidate_count: number;
  error_message: string | null;
  duration_ms: number | null;
  triggered_by: string;
  created_at: string;
};

const HOOK_PATH = "/api/public/hooks/auto-release-reviews";
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

function AdminAutoReleasePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [runs, setRuns] = useState<Run[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [filter, setFilter] = useState<"all" | RunStatus>("all");

  useEffect(() => {
    if (loading || !user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        const ok = data?.role === "admin";
        setIsAdmin(ok);
        setChecking(false);
        if (!ok) navigate({ to: "/dashboard" });
      });
  }, [loading, user, navigate]);

  async function refresh() {
    setRefreshing(true);
    const { data, error } = await supabase
      .from("auto_release_runs")
      .select("id,status,released_count,released_ids,candidate_count,error_message,duration_ms,triggered_by,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    setRefreshing(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRuns((data ?? []) as Run[]);
  }

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin]);

  async function triggerNow() {
    if (!PUBLISHABLE_KEY) {
      toast.error("Missing publishable key");
      return;
    }
    setTriggering(true);
    try {
      const res = await fetch(HOOK_PATH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: PUBLISHABLE_KEY,
          "x-triggered-by": "manual-admin",
        },
        body: "{}",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string })?.error ?? `HTTP ${res.status}`);
      const released = (body as { released?: number })?.released ?? 0;
      toast.success(released > 0 ? `Released ${released} product(s).` : "No stale products to release.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Trigger failed");
    } finally {
      setTriggering(false);
    }
  }

  const stats = useMemo(() => {
    const last24 = runs.filter((r) => Date.now() - new Date(r.created_at).getTime() < 24 * 60 * 60 * 1000);
    return {
      total: runs.length,
      success24: last24.filter((r) => r.status === "success").length,
      failure24: last24.filter((r) => r.status === "failure").length,
      released24: last24.reduce((sum, r) => sum + (r.released_count ?? 0), 0),
      lastFailure: runs.find((r) => r.status === "failure") ?? null,
      lastSuccess: runs.find((r) => r.status === "success") ?? null,
      lastRun: runs[0] ?? null,
    };
  }, [runs]);

  // "Retry status": a failure is considered retried-by-cron if a later run
  // (success or no_op) ran after it. The cron runs hourly, so anything that
  // failed > ~75 min ago without a follow-up is stuck.
  const failuresWithRetry = useMemo(() => {
    const sortedAsc = [...runs].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    return sortedAsc
      .filter((r) => r.status === "failure")
      .map((r) => {
        const next = sortedAsc.find((n) => new Date(n.created_at) > new Date(r.created_at));
        const ageMin = (Date.now() - new Date(r.created_at).getTime()) / 60_000;
        let retry: "recovered" | "pending" | "stuck";
        if (next && next.status !== "failure") retry = "recovered";
        else if (!next && ageMin < 75) retry = "pending";
        else retry = "stuck";
        return { run: r, next, retry };
      })
      .reverse();
  }, [runs]);

  const visible = useMemo(
    () => (filter === "all" ? runs : runs.filter((r) => r.status === filter)),
    [runs, filter],
  );

  if (loading || checking) return null;

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-4 flex items-center gap-4">
          <Link to="/"><AVLogo /></Link>
          <span className="inline-flex items-center gap-1.5 text-sm rounded-full bg-gold/15 text-gold-ink px-3 py-1">
            <ShieldCheck size={14} /> Admin · Auto-release
          </span>
          <Link to="/admin" className="ml-auto text-sm text-white/70 hover:text-white inline-flex items-center gap-1">
            <ArrowLeft size={14} /> Approval queue
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 md:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl md:text-4xl text-navy">Auto-release runs</h1>
            <p className="text-sm text-mute mt-1">
              Hourly job that approves & publishes any pending product older than 24 hours.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-ink/15 bg-white text-sm hover:bg-ink/5 disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
            </button>
            <button
              onClick={triggerNow}
              disabled={triggering}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-gold text-navy text-sm font-medium hover:bg-gold/90 disabled:opacity-50"
            >
              <PlayCircle size={14} /> {triggering ? "Running…" : "Run now"}
            </button>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Runs logged" value={stats.total} />
          <Stat label="Success (24h)" value={stats.success24} tone="success" />
          <Stat label="Failures (24h)" value={stats.failure24} tone={stats.failure24 > 0 ? "danger" : undefined} />
          <Stat label="Released (24h)" value={stats.released24} tone="gold" />
        </div>

        {/* Last-run banner */}
        {stats.lastRun ? (
          <div className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm flex flex-wrap items-center gap-3">
            <StatusPill status={stats.lastRun.status} />
            <span className="text-navy font-medium">Last run</span>
            <span className="text-mute">{formatWhen(stats.lastRun.created_at)}</span>
            <span className="text-mute">·</span>
            <span className="text-mute">released {stats.lastRun.released_count}</span>
            {stats.lastRun.duration_ms != null && (
              <>
                <span className="text-mute">·</span>
                <span className="text-mute">{stats.lastRun.duration_ms} ms</span>
              </>
            )}
            {stats.lastRun.error_message && (
              <span className="text-red-700 ml-auto truncate max-w-md" title={stats.lastRun.error_message}>
                {stats.lastRun.error_message}
              </span>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-ink/15 bg-white px-4 py-6 text-center text-mute text-sm">
            No runs logged yet. The cron job runs hourly; click <strong>Run now</strong> to test.
          </div>
        )}

        {/* Failures & retry status */}
        <section className="space-y-2">
          <h2 className="font-display text-xl text-navy flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600" /> Failures & retry status
          </h2>
          {failuresWithRetry.length === 0 ? (
            <p className="text-sm text-mute">No failures recorded.</p>
          ) : (
            <div className="rounded-xl border border-ink/10 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-ink/5 text-mute text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2">When</th>
                    <th className="text-left px-3 py-2">Error</th>
                    <th className="text-left px-3 py-2">Retry</th>
                    <th className="text-left px-3 py-2">Next run</th>
                  </tr>
                </thead>
                <tbody>
                  {failuresWithRetry.map(({ run, next, retry }) => (
                    <tr key={run.id} className="border-t border-ink/5 align-top">
                      <td className="px-3 py-2 text-navy whitespace-nowrap">{formatWhen(run.created_at)}</td>
                      <td className="px-3 py-2 text-red-700 max-w-md">
                        <span className="line-clamp-2">{run.error_message ?? "—"}</span>
                      </td>
                      <td className="px-3 py-2"><RetryPill retry={retry} /></td>
                      <td className="px-3 py-2 text-mute whitespace-nowrap">
                        {next ? `${next.status} · ${formatWhen(next.created_at)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Full history */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-navy">History</h2>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="h-8 rounded-md border border-ink/15 bg-white text-sm px-2"
            >
              <option value="all">All ({runs.length})</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
              <option value="no_op">No-op</option>
            </select>
          </div>
          {visible.length === 0 ? (
            <p className="text-sm text-mute">No runs match this filter.</p>
          ) : (
            <div className="rounded-xl border border-ink/10 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-ink/5 text-mute text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">When</th>
                    <th className="text-left px-3 py-2">Trigger</th>
                    <th className="text-right px-3 py-2">Candidates</th>
                    <th className="text-right px-3 py-2">Released</th>
                    <th className="text-right px-3 py-2">Duration</th>
                    <th className="text-left px-3 py-2">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id} className="border-t border-ink/5">
                      <td className="px-3 py-2"><StatusPill status={r.status} /></td>
                      <td className="px-3 py-2 text-navy whitespace-nowrap">{formatWhen(r.created_at)}</td>
                      <td className="px-3 py-2 text-mute">{r.triggered_by}</td>
                      <td className="px-3 py-2 text-right text-mute">{r.candidate_count}</td>
                      <td className="px-3 py-2 text-right text-navy font-medium">{r.released_count}</td>
                      <td className="px-3 py-2 text-right text-mute">{r.duration_ms != null ? `${r.duration_ms} ms` : "—"}</td>
                      <td className="px-3 py-2 text-mute max-w-xs">
                        {r.error_message ? (
                          <span className="text-red-700 line-clamp-1" title={r.error_message}>{r.error_message}</span>
                        ) : r.released_ids.length > 0 ? (
                          <span className="line-clamp-1" title={r.released_ids.join(", ")}>
                            {r.released_ids.length} id(s)
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" | "gold" }) {
  const toneMap: Record<string, string> = {
    success: "text-emerald-700",
    danger: "text-red-700",
    gold: "text-gold-ink",
  };
  return (
    <div className="rounded-xl border border-ink/10 bg-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-mute">{label}</p>
      <p className={`font-display text-2xl mt-1 ${tone ? toneMap[tone] : "text-navy"}`}>{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: RunStatus }) {
  const map: Record<RunStatus, { cls: string; label: string; Icon: typeof CheckCircle2 }> = {
    success: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "success", Icon: CheckCircle2 },
    failure: { cls: "bg-red-50 text-red-700 border-red-200", label: "failure", Icon: XCircle },
    no_op: { cls: "bg-ink/5 text-mute border-ink/10", label: "no-op", Icon: Clock },
  };
  const { cls, label, Icon } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${cls}`}>
      <Icon size={11} /> {label}
    </span>
  );
}

function RetryPill({ retry }: { retry: "recovered" | "pending" | "stuck" }) {
  const map = {
    recovered: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "recovered" },
    pending: { cls: "bg-amber-50 text-amber-800 border-amber-200", label: "retry pending" },
    stuck: { cls: "bg-red-50 text-red-700 border-red-200", label: "stuck — investigate" },
  } as const;
  const { cls, label } = map[retry];
  return <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return d.toLocaleString();
}
