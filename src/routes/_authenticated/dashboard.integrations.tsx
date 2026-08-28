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
} from "lucide-react";
import { toast } from "sonner";
import {
  disconnectCanvaConnection,
  getCanvaConnectionStatus,
  startCanvaConnection,
} from "@/lib/canva.functions";

type CanvaSearch = { canva?: string; reason?: string };

export const Route = createFileRoute("/_authenticated/dashboard/integrations")({
  validateSearch: (search: Record<string, unknown>): CanvaSearch => ({
    canva: typeof search["canva"] === "string" ? search["canva"] : undefined,
    reason: typeof search["reason"] === "string" ? search["reason"] : undefined,
  }),
  component: IntegrationsPage,
});

const CALLBACK_MESSAGES: Record<string, string> = {
  connected: "Canva is connected.",
  denied: "Canva authorization was cancelled.",
  error: "Canva could not be connected.",
};

function IntegrationsPage() {
  const search = useSearch({ from: "/_authenticated/dashboard/integrations" });
  const queryClient = useQueryClient();

  const fetchStatus = useServerFn(getCanvaConnectionStatus);
  const beginConnect = useServerFn(startCanvaConnection);
  const disconnect = useServerFn(disconnectCanvaConnection);

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
            </div>

            <p className="mt-4 text-xs text-mute">
              Requested access: read-only profile, design metadata, design content and assets.
            </p>
          </div>
        </div>
      </div>
    </PublisherShell>
  );
}
