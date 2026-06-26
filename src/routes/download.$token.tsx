import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, AlertTriangle, Loader2 } from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { getDownloadInfo } from "@/lib/payments.functions";

export const Route = createFileRoute("/download/$token")({
  head: () => ({ meta: [{ title: "Your download · AurumVault" }] }),
  component: DownloadPage,
});

function DownloadPage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; url: string; title: string; remaining: number }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    getDownloadInfo({ data: { token } })
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) {
          setState({ kind: "error", message: res.error });
        } else {
          setState({ kind: "ready", url: res.url, title: res.title, remaining: res.remaining });
          // auto-trigger
          window.location.href = res.url;
        }
      })
      .catch((e) => {
        if (!cancelled) setState({ kind: "error", message: e?.message ?? "Something went wrong" });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <MarketShell>
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        {state.kind === "loading" && (
          <>
            <Loader2 size={32} className="mx-auto animate-spin text-gold" />
            <p className="mt-4 text-sm text-mute">Preparing your download…</p>
          </>
        )}
        {state.kind === "ready" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)]">
              <Download size={32} className="text-gold" />
            </div>
            <h1 className="mt-6 font-display text-3xl font-bold text-ink">
              Downloading {state.title}
            </h1>
            <p className="mt-3 text-sm text-mute">
              Your file should start automatically. If not, use the button below.
            </p>
            <a
              href={state.url}
              className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gold px-8 text-sm font-bold text-navy"
            >
              <Download size={16} /> Download now
            </a>
            <p className="mt-6 text-xs text-mute">
              {state.remaining} download{state.remaining === 1 ? "" : "s"} remaining on this link.
            </p>
          </>
        )}
        {state.kind === "error" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle size={32} className="text-red-600" />
            </div>
            <h1 className="mt-6 font-display text-2xl font-bold text-ink">
              We couldn't open this link
            </h1>
            <p className="mt-3 text-sm text-mute">{state.message}</p>
            <p className="mt-6 text-xs text-mute">
              Reply to your order email and we'll re-send your download.
            </p>
          </>
        )}
      </div>
    </MarketShell>
  );
}
