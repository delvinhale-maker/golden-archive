import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Palette, Loader2 } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import {
  startCanvaConnection,
  getCanvaConnectionStatus,
  disconnectCanva,
  type CanvaConnectionStatus,
} from "@/lib/canva.functions";

export const Route = createFileRoute("/_authenticated/dashboard/integrations")({
  validateSearch: (search: Record<string, unknown>): { canva?: string; reason?: string } => ({
    canva: typeof search.canva === "string" ? search.canva : undefined,
    reason: typeof search.reason === "string" ? search.reason : undefined,
  }),
  component: IntegrationsPage,
});

const ERROR_COPY: Record<string, string> = {
  denied: "Canva connection was cancelled.",
  missing_params: "Canva didn't send back what we needed — please try again.",
  invalid_state: "That connection link already expired or was used. Please try again.",
  exchange_failed: "Canva couldn't finish connecting your account — please try again.",
  server_error: "Something went wrong on our end — please try again.",
};

function IntegrationsPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const startFn = useServerFn(startCanvaConnection);
  const statusFn = useServerFn(getCanvaConnectionStatus);
  const disconnectFn = useServerFn(disconnectCanva);

  const [status, setStatus] = useState<CanvaConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function refresh() {
    try {
      const s = await statusFn();
      setStatus(s);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (search.canva === "connected") {
      toast.success("Canva connected");
      navigate({ to: "/dashboard/integrations", replace: true });
    } else if (search.canva === "error") {
      toast.error(ERROR_COPY[search.reason ?? ""] ?? "Couldn't connect Canva — please try again.");
      navigate({ to: "/dashboard/integrations", replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.canva, search.reason]);

  async function handleConnect() {
    setConnecting(true);
    try {
      const { authorizeUrl } = await startFn();
      window.location.href = authorizeUrl;
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't start Canva connection");
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect Canva? You can reconnect anytime.")) return;
    setDisconnecting(true);
    try {
      await disconnectFn();
      toast.success("Canva disconnected");
      void refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't disconnect Canva");
    } finally {
      setDisconnecting(false);
    }
  }

  const connected = status?.connected ?? false;

  return (
    <PublisherShell accent={ACCENTS.help}>
      <h1 className="font-display text-3xl text-navy">Integrations</h1>
      <p className="text-sm text-mute mt-1">Connect other tools to your AurumVault account.</p>

      <div className="mt-6 max-w-xl rounded-2xl border border-ink/10 bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-paper">
              <Palette className="text-navy" size={20} />
            </div>
            <div>
              <p className="font-semibold text-navy">Canva</p>
              <p className="text-xs text-mute mt-0.5">
                {loading ? (
                  "Checking status…"
                ) : connected ? (
                  <span className="text-green-700">Connected</span>
                ) : (
                  "Not connected"
                )}
              </p>
            </div>
          </div>

          {loading ? (
            <Loader2 className="animate-spin text-mute" size={18} />
          ) : connected ? (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-semibold text-navy hover:bg-paper disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-navy disabled:opacity-50"
            >
              {connecting ? "Connecting…" : "Connect"}
            </button>
          )}
        </div>
      </div>
    </PublisherShell>
  );
}
