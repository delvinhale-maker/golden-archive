import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, BellRing, Loader2, Save, Send, ShieldCheck } from "lucide-react";
import {
  getAlertConfig,
  saveAlertConfig,
  sendTestAlert,
  type AlertConfigDTO,
} from "@/lib/cover-audit-alert.functions";

export const Route = createFileRoute("/_authenticated/admin/health/covers/alerts")({
  component: AlertsPage,
});

function AlertsPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const load = useServerFn(getAlertConfig);
  const save = useServerFn(saveAlertConfig);
  const test = useServerFn(sendTestAlert);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [cfg, setCfg] = useState<AlertConfigDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
        setCheckingAdmin(false);
        if (!allowed) navigate({ to: "/dashboard" });
      });
    return () => {
      active = false;
    };
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    load({ data: undefined })
      .then((c) => active && setCfg(c))
      .catch((e) => active && setErr(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
  }, [isAdmin, load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!cfg) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const saved = await save({
        data: {
          enabled: cfg.enabled,
          threshold: cfg.threshold,
          cooldown_minutes: cfg.cooldown_minutes,
          recipient_email: cfg.recipient_email ?? null,
          webhook_url: cfg.webhook_url ?? null,
        },
      });
      setCfg(saved);
      setMsg("Saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const r = await test({ data: undefined });
      setMsg(
        r.triggered
          ? `Alert sent. Total failing: ${r.totalFailing}.${r.emailQueued === false ? " Email failed." : ""}${r.webhookOk === false ? " Webhook failed." : ""}`
          : `No alert sent (${r.skipped_reason ?? "unknown"}). Total failing: ${r.totalFailing}.`,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading || checkingAdmin || !cfg) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f7f7f5]">
        <Loader2 className="w-6 h-6 animate-spin text-[#0f1629]" />
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-[#0f1629]">
      <header className="max-w-[720px] mx-auto px-6 pt-8 pb-4">
        <Link
          to="/admin/health/covers"
          search={{ category: "ebooks", view: "report" }}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-[#0f1629]"
        >
          <ArrowLeft className="w-4 h-4" /> Back to cover audit
        </Link>
        <h1 className="text-2xl font-semibold flex items-center gap-2 mt-2">
          <BellRing className="w-5 h-5 text-[#c9a44a]" /> Cover Audit Alerts
        </h1>
        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" /> Admin only · evaluated after every scheduled audit
        </p>
      </header>

      <main className="max-w-[720px] mx-auto px-6 pb-16">
        <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
              className="w-4 h-4"
            />
            Send alerts when failures exceed threshold
          </label>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Failure threshold (count)">
              <input
                type="number"
                min={1}
                value={cfg.threshold}
                onChange={(e) => setCfg({ ...cfg, threshold: Number(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </Field>
            <Field label="Cooldown (minutes)">
              <input
                type="number"
                min={0}
                value={cfg.cooldown_minutes}
                onChange={(e) =>
                  setCfg({ ...cfg, cooldown_minutes: Number(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </Field>
          </div>

          <Field label="Email recipient (optional)">
            <input
              type="email"
              value={cfg.recipient_email ?? ""}
              onChange={(e) => setCfg({ ...cfg, recipient_email: e.target.value || null })}
              placeholder="alerts@yourdomain.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </Field>

          <Field label="Webhook URL (optional, POST JSON)">
            <input
              type="url"
              value={cfg.webhook_url ?? ""}
              onChange={(e) => setCfg({ ...cfg, webhook_url: e.target.value || null })}
              placeholder="https://hooks.example.com/cover-audit"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </Field>

          {cfg.last_alert_at && (
            <p className="text-xs text-slate-500">
              Last alert sent: {new Date(cfg.last_alert_at).toLocaleString()}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0f1629] text-white text-sm disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-slate-300 text-sm disabled:opacity-50"
            >
              <Send className="w-4 h-4" /> Send test alert
            </button>
          </div>

          {msg && <div className="p-3 rounded bg-emerald-50 text-emerald-800 text-sm">{msg}</div>}
          {err && <div className="p-3 rounded bg-red-100 text-red-800 text-sm">{err}</div>}
        </form>

        <p className="text-xs text-slate-500 mt-4">
          Alerts fire from the nightly cron once total failing covers (across all categories) is at or
          above the threshold. The cooldown prevents repeat alerts within the same window.
        </p>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="block text-xs uppercase tracking-widest text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
