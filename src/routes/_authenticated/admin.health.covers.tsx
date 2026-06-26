import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  auditCovers,
  getCachedCoverAudit,
  type CoverAuditResult,
} from "@/lib/cover-audit.functions";
import { ArrowLeft, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

const CATEGORIES = ["ebooks", "courses", "templates", "audio", "leadership"] as const;
type Category = (typeof CATEGORIES)[number];

export const Route = createFileRoute("/_authenticated/admin/health/covers")({
  component: CoverAuditPage,
  validateSearch: (s: Record<string, unknown>) => ({
    category: (CATEGORIES.includes(s.category as Category) ? s.category : "ebooks") as Category,
    view: (s.view === "json" ? "json" : "report") as "json" | "report",
  }),
});

function CoverAuditPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { category, view } = Route.useSearch();
  const run = useServerFn(auditCovers);
  const loadCached = useServerFn(getCachedCoverAudit);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [result, setResult] = useState<CoverAuditResult | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [busy, setBusy] = useState(false);
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

  // Default: read the cached row written by the nightly cron job.
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    setBusy(true);
    setErr(null);
    setResult(null);
    loadCached({ data: { category } })
      .then((r) => {
        if (!active) return;
        setResult(r);
        setFromCache(!!r);
      })
      .catch((e) => active && setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => active && setBusy(false));
    return () => {
      active = false;
    };
  }, [isAdmin, category, loadCached]);

  const runNow = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await run({ data: { category } });
      setResult(r);
      setFromCache(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [run, category]);

  const failing = useMemo(() => result?.failing ?? [], [result]);
  const passing = useMemo(() => result?.results.filter((r) => r.ok) ?? [], [result]);

  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f7f7f5]">
        <Loader2 className="w-6 h-6 animate-spin text-[#0f1629]" />
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-[#0f1629]">
      <header className="max-w-[1100px] mx-auto px-6 pt-8 pb-4">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-[#0f1629]">
          <ArrowLeft className="w-4 h-4" /> Back to admin
        </Link>
        <div className="flex items-center justify-between mt-2 flex-wrap gap-3">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#c9a44a]" /> Cover Audit
          </h1>
          <div className="flex gap-2">
            <Link
              to="/admin/health/covers/alerts"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs"
            >
              Alerts
            </Link>
            <button
              onClick={runNow}
              disabled={busy}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#0f1629] text-white text-xs disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Run now
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {result
            ? `${fromCache ? "Cached" : "Live"} · checked ${new Date(result.checkedAt).toLocaleString()}`
            : "Admin-only · no cached run yet — runs nightly at 03:00 UTC"}
        </p>
      </header>

      <main className="max-w-[1100px] mx-auto px-6 pb-16">
        <div className="flex flex-wrap gap-2 mb-3">
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              to="/admin/health/covers"
              search={{ category: c, view }}
              className={`px-3 py-1.5 rounded-full text-xs border ${
                c === category ? "bg-[#0f1629] text-white border-[#0f1629]" : "bg-white border-slate-200"
              }`}
            >
              {c}
            </Link>
          ))}
          <div className="ml-auto flex gap-2">
            <Link
              to="/admin/health/covers"
              search={{ category, view: "report" }}
              className={`px-3 py-1.5 rounded-full text-xs border ${view === "report" ? "bg-[#0f1629] text-white border-[#0f1629]" : "bg-white border-slate-200"}`}
            >
              Report
            </Link>
            <Link
              to="/admin/health/covers"
              search={{ category, view: "json" }}
              className={`px-3 py-1.5 rounded-full text-xs border ${view === "json" ? "bg-[#0f1629] text-white border-[#0f1629]" : "bg-white border-slate-200"}`}
            >
              JSON
            </Link>
          </div>
        </div>

        {busy && (
          <div className="flex items-center gap-2 text-sm text-slate-600 py-8">
            <Loader2 className="w-4 h-4 animate-spin" /> Probing covers…
          </div>
        )}
        {err && <div className="p-3 rounded bg-red-100 text-red-800 text-sm">{err}</div>}

        {result && view === "json" && (
          <pre className="bg-white border border-slate-200 rounded-lg p-4 text-xs overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}

        {result && view === "report" && (
          <>
            <div
              className={`p-3 rounded-lg font-semibold mb-4 ${
                result.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}
            >
              {result.ok ? "All covers passing ✓" : `${failing.length} cover${failing.length === 1 ? "" : "s"} failing`}
            </div>
            <div className="flex gap-4 flex-wrap mb-6">
              <Stat label="Total" value={result.summary.total} />
              <Stat label="Passing" value={result.summary.passing} color="#15803d" />
              <Stat label="Failing" value={result.summary.failing} color="#b91c1c" />
            </div>

            {failing.length > 0 && (
              <>
                <h2 className="text-xs uppercase tracking-widest text-slate-500 mt-6 mb-3">Failing</h2>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
                  {failing.map((r) => (
                    <article key={r.id} className="bg-white border border-red-200 rounded-lg overflow-hidden">
                      <div className="aspect-[1/1.6] bg-slate-100 grid place-items-center overflow-hidden">
                        {r.cover_url && /^https?:\/\//.test(r.cover_url) ? (
                          <img
                            src={r.cover_url}
                            alt=""
                            loading="lazy"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const el = e.currentTarget;
                              const div = document.createElement("div");
                              div.className = "text-red-700 text-xs p-3 text-center";
                              div.textContent = "image failed to load";
                              el.replaceWith(div);
                            }}
                          />
                        ) : (
                          <div className="text-red-700 text-xs p-3 text-center">no url</div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="text-sm font-medium">{r.title}</h3>
                        <p className="text-[11px] uppercase tracking-wider text-slate-500 mt-0.5">{r.category}</p>
                        <p className="text-[11px] font-mono text-red-700 mt-2 break-all">{r.reason}</p>
                        <p className="text-[10px] font-mono text-slate-500 mt-1">{r.id}</p>
                        {r.cover_url && (
                          <a
                            href={r.cover_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-[#0f1629] underline mt-2 inline-block"
                          >
                            open url ↗
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}

            {passing.length > 0 && (
              <>
                <h2 className="text-xs uppercase tracking-widest text-slate-500 mt-8 mb-3">Passing</h2>
                <ul className="columns-1 sm:columns-2 gap-6">
                  {passing.map((r) => (
                    <li key={r.id} className="py-1.5 text-sm break-inside-avoid">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-700 mr-2 align-middle" />
                      {r.title} <span className="text-[11px] font-mono text-slate-500">· {r.id}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {!result.results.length && (
              <p className="text-sm text-slate-500">No approved products in this category.</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 min-w-[120px]">
      <div className="text-xl font-bold" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-widest text-slate-500">{label}</div>
    </div>
  );
}
