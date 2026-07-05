import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Download, AlertTriangle, Loader2 } from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { ManuscriptPreviewer } from "@/components/marketplace/ManuscriptPreviewer";
import { getDownloadInfo, getReadInfo } from "@/lib/payments.functions";
import { useAuth } from "@/hooks/use-auth";

const PREVIEW_MAX_PAGES = 10;

export const Route = createFileRoute("/download/$token")({
  validateSearch: z.object({ preview: z.coerce.number().int().optional() }),
  head: () => ({ meta: [{ title: "Your download · AurumVault" }] }),
  component: DownloadPage,
});

function DownloadPage() {
  const { token } = Route.useParams();
  const { preview } = Route.useSearch();
  const isPreview = preview === 1;
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; url: string; title: string; coverUrl: string | null; remaining: number }
    | { kind: "error"; message: string; needsAuth?: boolean }
  >({ kind: "loading" });
  const [downloading, setDownloading] = useState(false);
  const downloadFrameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({
        kind: "error",
        message: "Sign in with the email you used at checkout to access this download.",
        needsAuth: true,
      });
      return;
    }
    let cancelled = false;
    getReadInfo({ data: { token } })
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) {
          setState({ kind: "error", message: res.error ?? "Download unavailable" });
        } else {
          setState({ kind: "ready", url: res.url, title: res.title, coverUrl: res.coverUrl, remaining: res.remaining });
        }
      })
      .catch((e) => {
        if (!cancelled) setState({ kind: "error", message: e?.message ?? "Something went wrong" });
      });
    return () => {
      cancelled = true;
    };
  }, [token, user, authLoading]);

  // Preserve the original download-page behavior: the file is still saved to
  // the buyer's device while the reader is shown on screen.
  useEffect(() => {
    if (state.kind !== "ready" || isPreview) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getDownloadInfo({ data: { token } });
        if (!cancelled && "ok" in res && res.url && downloadFrameRef.current) {
          downloadFrameRef.current.src = res.url;
        }
      } catch (e) {
        console.error("Auto-download failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.kind, token]);

  async function handleDownload() {
    if (state.kind !== "ready") return;
    setDownloading(true);
    try {
      const res = await getDownloadInfo({ data: { token } });
      if ("error" in res) {
        setState({ kind: "error", message: res.error ?? "Download unavailable" });
      } else {
        // Trigger the file download without leaving the reader view. The signed
        // URL is cross-origin, so the iframe handles the Content-Disposition.
        if (res.url && downloadFrameRef.current) {
          downloadFrameRef.current.src = res.url;
        }
        setState((prev) =>
          prev.kind === "ready" ? { ...prev, remaining: res.remaining } : prev
        );
      }
    } catch (e: any) {
      setState({ kind: "error", message: e?.message ?? "Something went wrong" });
    } finally {
      setDownloading(false);
    }
  }

  if (state.kind === "error") {
    return (
      <MarketShell>
        <div className="mx-auto max-w-xl px-6 py-20 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle size={32} className="text-red-600" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-bold text-ink">
            We couldn't open this link
          </h1>
          <p className="mt-3 text-sm text-mute">{state.message}</p>
          {state.needsAuth ? (
            <Link
              to="/auth"
              className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-gold px-8 text-sm font-bold text-navy"
            >
              Sign in
            </Link>
          ) : (
            <p className="mt-6 text-xs text-mute">
              Reply to your order email and we'll re-send your download.
            </p>
          )}
        </div>
      </MarketShell>
    );
  }

  if (state.kind === "loading") {
    return (
      <MarketShell>
        <div className="mx-auto max-w-xl px-6 py-20 text-center">
          <Loader2 size={32} className="mx-auto animate-spin text-gold" />
          <p className="mt-4 text-sm text-mute">Preparing your download…</p>
        </div>
      </MarketShell>
    );
  }

  return (
    <>
      <ManuscriptPreviewer
        manuscriptPath={state.url}
        title={state.title}
        coverUrl={state.coverUrl}
        readerMode
        onClose={() => navigate({ to: "/account" })}
      />
      {/* Download trigger helper */}
      <iframe ref={downloadFrameRef} className="hidden" title="download" />
      {/* Floating download button */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="fixed bottom-6 right-6 z-[70] inline-flex h-12 items-center gap-2 rounded-full bg-gold px-5 text-sm font-bold text-navy shadow-lg hover:brightness-105 disabled:opacity-60"
        aria-label="Download file"
      >
        {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        Download{downloading ? "ing" : ""}
      </button>
      <p className="fixed bottom-6 left-6 z-[70] text-xs text-white/60">
        {state.remaining} download{state.remaining === 1 ? "" : "s"} remaining
      </p>
    </>
  );
}
