import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useTransition } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listErrorLogs, errorLogStats, sendTestErrorAlert } from "@/lib/error-monitor.functions";
import { ArrowLeft, AlertTriangle, Bell, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/errors")({
  component: AdminErrorsPage,
});

type LogRow = {
  id: string;
  occurred_at: string;
  source: string;
  severity: string;
  message: string;
  route: string | null;
  url: string | null;
  fingerprint: string | null;
  alerted_at: string | null;
};

function AdminErrorsPage() {
  const list = useServerFn(listErrorLogs);
  const stats = useServerFn(errorLogStats);
  const sendTest = useServerFn(sendTestErrorAlert);

  const [rows, setRows] = useState<LogRow[]>([]);
  const [agg, setAgg] = useState<{ lastHour: number; lastDay: number; fatalDay: number } | null>(null);
  const [severity, setSeverity] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [sending, setSending] = useState(false);

  const load = () => {
    startTransition(async () => {
      try {
        const [r, s] = await Promise.all([
          list({ data: { limit: 200, severity: severity || undefined } }),
          stats({}),
        ]);
        setRows(r as LogRow[]);
        setAgg(s);
      } catch (e) {
        toast.error("Failed to load error logs");
      }
    });
  };

  useEffect(load, [severity]);

  const onTest = async () => {
    setSending(true);
    try {
      await sendTest({});
      toast.success("Test alert queued — check your inbox shortly.");
    } catch {
      toast.error("Failed to send test alert");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-page">
      <header className="border-b border-ink/10 bg-navy/95 text-white">
        <div className="mx-auto max-w-6xl px-4 md:px-8 h-16 flex items-center justify-between">
          <Link to="/admin" className="inline-flex items-center gap-2 text-sm opacity-90 hover:opacity-100">
            <ArrowLeft className="h-4 w-4" /> Back to admin
          </Link>
          <div className="font-display text-lg">Error monitoring</div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 md:px-8 py-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Last hour" value={agg?.lastHour ?? 0} />
          <StatCard label="Last 24 hours" value={agg?.lastDay ?? 0} />
          <StatCard label="Fatal (24h)" value={agg?.fatalDay ?? 0} tone="danger" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="rounded-md border border-ink/15 bg-page px-3 py-2 text-sm"
          >
            <option value="">All severities</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="fatal">Fatal</option>
          </select>
          <button
            onClick={load}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md border border-ink/15 px-3 py-2 text-sm hover:bg-ink/5 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
          <button
            onClick={onTest}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-sm font-medium text-navy hover:opacity-90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            Send test alert email
          </button>
        </div>

        <div className="rounded-lg border border-ink/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink/5 text-left">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Route</th>
                <th className="px-3 py-2">Message</th>
                <th className="px-3 py-2">Alerted</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !pending ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-mute">
                    No errors logged. 🎉
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-ink/10 align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-mute">
                      {new Date(r.occurred_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <SeverityBadge severity={r.severity} />
                    </td>
                    <td className="px-3 py-2 text-mute">{r.source}</td>
                    <td className="px-3 py-2 font-mono text-xs text-mute">{r.route ?? "—"}</td>
                    <td className="px-3 py-2 max-w-xl">
                      <div className="text-ink line-clamp-3">{r.message}</div>
                    </td>
                    <td className="px-3 py-2 text-mute whitespace-nowrap">
                      {r.alerted_at ? new Date(r.alerted_at).toLocaleTimeString() : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-mute">
          Fatal errors and React error-boundary crashes send a throttled email to all admins (max one per
          unique error every 15 minutes).
        </p>
      </main>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-page p-4">
      <div className="text-xs uppercase tracking-wide text-mute">{label}</div>
      <div className={`mt-1 text-3xl font-display ${tone === "danger" && value > 0 ? "text-red-500" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    warn: "bg-amber-100 text-amber-900",
    error: "bg-orange-100 text-orange-900",
    fatal: "bg-red-100 text-red-900",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${map[severity] ?? "bg-ink/10"}`}>
      {severity === "fatal" && <AlertTriangle className="h-3 w-3" />}
      {severity}
    </span>
  );
}
