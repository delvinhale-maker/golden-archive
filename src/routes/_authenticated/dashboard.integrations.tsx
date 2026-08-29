import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import {
  Plug,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Copy,
  ExternalLink,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import {
  disconnectCanvaConnection,
  getCanvaConnectionStatus,
  startCanvaConnection,
} from "@/lib/canva.functions";
import {
  disconnectTikTokShopConnection,
  getTikTokShopConnectionStatus,
  startTikTokShopConnection,
} from "@/lib/tiktok-shop.functions";

type CanvaSearch = { canva?: string; reason?: string; tiktok_shop?: string };

export const Route = createFileRoute("/_authenticated/dashboard/integrations")({
  validateSearch: (search: Record<string, unknown>): CanvaSearch => ({
    canva: typeof search["canva"] === "string" ? search["canva"] : undefined,
    reason: typeof search["reason"] === "string" ? search["reason"] : undefined,
    tiktok_shop: typeof search["tiktok_shop"] === "string" ? search["tiktok_shop"] : undefined,
  }),
  component: IntegrationsPage,
});

const CALLBACK_MESSAGES: Record<string, string> = {
  connected: "Canva is connected.",
  denied: "Canva authorization was cancelled.",
  error: "Canva could not be connected.",
};

const TIKTOK_CALLBACK_MESSAGES: Record<string, string> = {
  connected: "TikTok Shop is connected.",
  denied: "TikTok Shop authorization was cancelled.",
  error: "TikTok Shop could not be connected.",
};

function IntegrationsPage() {
  const search = useSearch({ from: "/_authenticated/dashboard/integrations" });
  const queryClient = useQueryClient();

  const fetchStatus = useServerFn(getCanvaConnectionStatus);
  const beginConnect = useServerFn(startCanvaConnection);
  const disconnect = useServerFn(disconnectCanvaConnection);
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ["canva-connection"],
    queryFn: () => fetchStatus({ data: undefined }),
    retry: false,
  });

  const connectMutation = useMutation({
    mutationFn: () => beginConnect({ data: undefined }),
    onSuccess: (result) => {
      window.location.href = result.authorizeUrl;
    },
    onError: (err: Error) => toast.error(err.message || "Unable to start Canva authorization"),
  });

  const manualMutation = useMutation({
    mutationFn: () => beginConnect({ data: undefined }),
    onSuccess: (result) => setManualUrl(result.authorizeUrl),
    onError: (err: Error) => toast.error(err.message || "Unable to prepare a Canva link"),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => disconnect({ data: undefined }),
    onSuccess: () => {
      toast.success("Canva disconnected");
      void queryClient.invalidateQueries({ queryKey: ["canva-connection"] });
    },
    onError: (err: Error) => toast.error(err.message || "Unable to disconnect Canva"),
  });

  const callbackNote = search.canva ? CALLBACK_MESSAGES[search.canva] : undefined;
  const connected = status.data?.connected === true;

  const fetchTikTokStatus = useServerFn(getTikTokShopConnectionStatus);
  const beginTikTokConnect = useServerFn(startTikTokShopConnection);
  const disconnectTikTok = useServerFn(disconnectTikTokShopConnection);

  const tiktokStatus = useQuery({
    queryKey: ["tiktok-shop-connection"],
    queryFn: () => fetchTikTokStatus({ data: undefined }),
    retry: false,
  });

  const tiktokConnectMutation = useMutation({
    mutationFn: () => beginTikTokConnect({ data: undefined }),
    onSuccess: (result) => {
      window.location.href = result.authorizeUrl;
    },
    onError: (err: Error) =>
      toast.error(err.message || "Unable to start TikTok Shop authorization"),
  });

  const tiktokDisconnectMutation = useMutation({
    mutationFn: () => disconnectTikTok({ data: undefined }),
    onSuccess: () => {
      toast.success("TikTok Shop disconnected");
      void queryClient.invalidateQueries({ queryKey: ["tiktok-shop-connection"] });
    },
    onError: (err: Error) => toast.error(err.message || "Unable to disconnect TikTok Shop"),
  });

  const tiktokNote = search.tiktok_shop ? TIKTOK_CALLBACK_MESSAGES[search.tiktok_shop] : undefined;
  const tiktokConnected = tiktokStatus.data?.connected === true;

  return (
    <PublisherShell accent={ACCENTS.help}>
      <h1 className="font-display text-3xl md:text-4xl text-navy">Integrations</h1>
      <p className="mt-1 text-mute">
        Connect the design tools you already use. Credentials are encrypted and never shown in your
        browser.
      </p>

      {callbackNote && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4 text-sm text-navy">
          {callbackNote}
          {search.reason ? ` (${search.reason.replace(/_/g, " ")})` : ""}
        </div>
      )}

      <div className="mt-8 max-w-2xl rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-primary">
            <Plug size={20} />
          </span>
          <div className="flex-1">
            <h2 className="font-display text-xl text-navy">Canva</h2>
            <p className="mt-1 text-sm text-mute">
              Pull covers and brand assets from your Canva account into AurumVault listings.
            </p>

            <div className="mt-4 text-sm">
              {status.isLoading ? (
                <span className="inline-flex items-center gap-2 text-mute">
                  <Loader2 className="animate-spin" size={14} /> Checking connection…
                </span>
              ) : status.isError ? (
                <span className="inline-flex items-center gap-2 text-destructive">
                  <AlertTriangle size={14} /> Canva integration is not available yet.
                </span>
              ) : connected ? (
                <span className="inline-flex items-center gap-2 text-primary">
                  <ShieldCheck size={14} /> Connected
                  {status.data?.displayName ? ` as ${status.data.displayName}` : ""}
                </span>
              ) : (
                <span className="text-mute">Not connected</span>
              )}
            </div>

            {status.data?.lastError && (
              <p className="mt-2 text-xs text-destructive">
                Last error: {status.data.lastError.replace(/_/g, " ")}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {connected ? "Reconnect Canva" : "Connect Canva"}
              </button>
              {connected && (
                <button
                  type="button"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-navy disabled:opacity-60"
                >
                  Disconnect
                </button>
              )}
              <button
                type="button"
                onClick={() => manualMutation.mutate()}
                disabled={manualMutation.isPending}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-navy disabled:opacity-60"
              >
                {manualMutation.isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="animate-spin" size={14} /> Preparing link…
                  </span>
                ) : manualUrl ? (
                  "Get a fresh link"
                ) : (
                  "Connect manually"
                )}
              </button>
            </div>

            {manualUrl && (
              <div className="mt-5 rounded-xl border border-border bg-background p-4">
                <h3 className="font-display text-base text-navy">Finish in your browser</h3>
                <p className="mt-1 text-xs text-mute">
                  If Canva shows a “verify you’re human” challenge and the redirect stalls, complete
                  the consent step manually. The link is single-use and expires in 10 minutes.
                </p>
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-navy">
                  <li>Open the link below in a normal browser tab (not in-app or private mode).</li>
                  <li>Sign in to Canva and clear the human-verification challenge if shown.</li>
                  <li>Approve access for AurumVault — Canva returns you here automatically.</li>
                  <li>Come back to this page and press Refresh status.</li>
                </ol>

                <div className="mt-3 break-all rounded-lg border border-border bg-card p-3 font-mono text-[11px] text-mute">
                  {manualUrl}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={manualUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    <ExternalLink size={13} /> Open Canva consent
                  </a>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(manualUrl);
                        toast.success("Link copied");
                      } catch {
                        toast.error("Copy failed — long-press the link to copy it");
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-navy"
                  >
                    <Copy size={13} /> Copy link
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void queryClient.invalidateQueries({ queryKey: ["canva-connection"] });
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-navy"
                  >
                    <RefreshCw size={13} /> Refresh status
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualUrl(null)}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-mute"
                  >
                    Hide
                  </button>
                </div>
              </div>
            )}

            <p className="mt-4 text-xs text-mute">
              Requested access: read-only profile, design metadata, design content and assets.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-6 max-w-2xl rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-primary">
            <ShoppingBag size={20} />
          </span>
          <div className="flex-1">
            <h2 className="font-display text-xl text-navy">TikTok Shop</h2>
            <p className="mt-1 text-sm text-mute">
              Connect your TikTok Shop to prepare AurumVault for multi-channel product and commerce
              workflows.
            </p>

            {tiktokNote && (
              <div className="mt-4 rounded-xl border border-border bg-background p-3 text-sm text-navy">
                {tiktokNote}
                {search.reason ? ` (${search.reason.replace(/_/g, " ")})` : ""}
              </div>
            )}

            <div className="mt-4 text-sm" aria-live="polite">
              {tiktokStatus.isLoading ? (
                <span className="inline-flex items-center gap-2 text-mute">
                  <Loader2 className="animate-spin" size={14} /> Checking connection…
                </span>
              ) : tiktokStatus.isError ? (
                <span className="inline-flex items-center gap-2 text-destructive">
                  <AlertTriangle size={14} /> TikTok Shop integration is not available yet.
                </span>
              ) : tiktokConnected ? (
                <span className="inline-flex items-center gap-2 text-primary">
                  <ShieldCheck size={14} /> TikTok Shop Connected
                  {tiktokStatus.data?.displayName ? ` — ${tiktokStatus.data.displayName}` : ""}
                </span>
              ) : (
                <span className="text-mute">Not connected</span>
              )}
            </div>

            {tiktokStatus.data?.lastError && (
              <p className="mt-2 text-xs text-destructive">
                Last error: {tiktokStatus.data.lastError.replace(/_/g, " ")}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => tiktokConnectMutation.mutate()}
                disabled={tiktokConnectMutation.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {tiktokConnectMutation.isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="animate-spin" size={14} /> Redirecting…
                  </span>
                ) : tiktokConnected ? (
                  "Reconnect TikTok Shop"
                ) : (
                  "Connect TikTok Shop"
                )}
              </button>
              {tiktokConnected && (
                <button
                  type="button"
                  onClick={() => tiktokDisconnectMutation.mutate()}
                  disabled={tiktokDisconnectMutation.isPending}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-navy disabled:opacity-60"
                >
                  Disconnect
                </button>
              )}
            </div>

            <p className="mt-4 text-xs text-mute">
              Connection enables the foundation for TikTok Shop workflows. Product and order
              synchronization will be added in the next integration phase.
            </p>
          </div>
        </div>
      </div>
    </PublisherShell>
  );
}
