import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getCanvaConnectionStatus, startCanvaConnection } from "@/lib/canva.functions";
import { CanvaDesignPicker } from "./CanvaDesignPicker";

/**
 * Premium Canva capability banner for the Creator Dashboard.
 * Pure UI layer over the canonical Canva OAuth server functions —
 * no new OAuth service, status model, or storage.
 */
export function CanvaConnectBanner() {
  const fetchStatus = useServerFn(getCanvaConnectionStatus);
  const beginConnect = useServerFn(startCanvaConnection);
  const [importOpen, setImportOpen] = useState(false);

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

  if (status.isError) return null;

  const connected = status.data?.connected === true;
  const connecting = connectMutation.isPending || connectMutation.isSuccess;

  return (
    <section
      aria-labelledby="canva-banner-heading"
      className="relative mt-8 overflow-hidden rounded-3xl border border-gold/30 bg-[linear-gradient(100deg,var(--paper,#FBF7EF)_0%,#FFFDF8_55%,#FFF9EC_100%)] p-6 shadow-[0_18px_44px_-28px_rgba(28,32,56,0.35)] sm:p-8"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border border-gold/25"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 right-16 h-56 w-56 rounded-full border border-gold/15"
      />

      <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <FlowMark />
            {connected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/30 bg-emerald-50 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-800">
                <Check size={13} aria-hidden="true" /> Connected
              </span>
            ) : status.isLoading ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold tracking-wide text-mute">
                <Loader2 className="animate-spin" size={13} aria-hidden="true" /> Checking status
              </span>
            ) : (
              <span className="rounded-full border border-gold/40 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-navy">
                Creator studio
              </span>
            )}
          </div>

          <h2
            id="canva-banner-heading"
            className="mt-4 font-display text-2xl leading-tight text-navy sm:text-3xl md:text-4xl"
          >
            {connected ? "Canva Connected" : "Design in Canva. Sell on AurumVault."}
          </h2>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-mute sm:text-base">
            {connected
              ? "Your Canva workspace is connected to AurumVault. You're ready to bring your creative work into your product workflow."
              : "Connect your Canva account to bring your designs and creative assets into AurumVault and turn them into products ready to sell."}
          </p>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-3 lg:w-auto lg:items-end">
          {connected ? (
            <>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-7 py-3.5 text-base font-semibold text-navy shadow-sm transition hover:bg-gold/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 lg:w-auto"
              >
                <Sparkles size={18} aria-hidden="true" /> Import from Canva
              </button>
              <Link
                to="/dashboard/integrations"
                className="inline-flex w-full items-center justify-center rounded-full border border-ink/15 bg-white px-6 py-3 text-sm font-semibold text-navy transition hover:border-gold/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 lg:w-auto"
              >
                Manage Connection
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => connectMutation.mutate()}
                disabled={connecting}
                aria-busy={connecting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-8 py-4 text-base font-semibold text-navy shadow-sm transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 lg:w-auto"
              >
                {connecting ? (
                  <>
                    <Loader2 className="animate-spin" size={18} aria-hidden="true" /> Opening Canva…
                  </>
                ) : (
                  "Connect Canva"
                )}
              </button>
              <p className="text-center text-sm text-mute lg:text-right">
                Takes less than a minute
              </p>
            </>
          )}
        </div>
      </div>

      {importOpen && <CanvaDesignPicker onClose={() => setImportOpen(false)} />}
    </section>
  );
}

function FlowMark() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-3 py-1 text-[11px] font-semibold tracking-wide text-navy"
    >
      <span className="text-[#00C4CC]">Canva</span>
      <span className="h-px w-4 bg-gold" />
      <span>AurumVault</span>
      <span className="h-px w-4 bg-gold" />
      <span className="text-gold">Sell</span>
    </span>
  );
}
