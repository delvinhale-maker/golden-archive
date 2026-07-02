import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, XCircle, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { homeRowsQ } from "./HomeRows";
import type { RowSource } from "@/lib/homerows.functions";

const LABEL: Record<RowSource, { text: string; color: string; Icon: typeof CheckCircle2 }> = {
  specific: { text: "specific slice", color: "#22c55e", Icon: CheckCircle2 },
  fallback: { text: "5-product fallback", color: "#eab308", Icon: AlertCircle },
  empty: { text: "empty (no data)", color: "#ef4444", Icon: XCircle },
};

function Pill({ name, source, count }: { name: string; source: RowSource; count: number }) {
  const { text, color, Icon } = LABEL[source];
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs">
      <span className="font-semibold text-white/90">{name}</span>
      <span className="flex items-center gap-1.5" style={{ color }}>
        <Icon size={14} />
        <span>{text}</span>
        <span className="text-white/50">· {count}</span>
      </span>
    </div>
  );
}

export function HomeRowsDiagnostics() {
  const { isAdmin } = useAuth();
  const query = useQuery(homeRowsQ);
  const { data, error, dataUpdatedAt, errorUpdatedAt, status, fetchStatus } = query;
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  if (!isAdmin || !data) return null;
  const d = data.diagnostics;

  const handleCopy = async () => {
    const payload = {
      capturedAt: new Date().toISOString(),
      query: {
        status,
        fetchStatus,
        dataUpdatedAt: dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : null,
        errorUpdatedAt: errorUpdatedAt ? new Date(errorUpdatedAt).toISOString() : null,
      },
      counts: d.counts,
      sources: d.sources,
      totals: {
        totalApproved: d.totalApproved,
        featuredCount: d.featuredCount,
        purchaseHistoryCount: d.purchaseHistoryCount,
      },
      response: data,
      error: error ? { name: (error as Error).name, message: (error as Error).message, stack: (error as Error).stack } : null,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = JSON.stringify(payload, null, 2);
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="mx-auto my-4 max-w-7xl px-6 lg:px-8">
      <div className="rounded-lg border border-yellow-400/30 bg-black/70 p-3 text-white shadow-lg backdrop-blur">
        <div className="flex w-full items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex flex-1 items-center justify-between gap-2 text-left"
          >
            <span className="text-[11px] font-bold uppercase tracking-caps text-yellow-300">
              Admin · Home rows diagnostics
            </span>
            <span className="flex items-center gap-2 text-[11px] text-white/60">
              <span>
                {d.totalApproved} approved · {d.featuredCount} featured ·{" "}
                {d.purchaseHistoryCount} w/ sales
              </span>
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="ml-2 flex items-center gap-1 rounded border border-yellow-400/40 bg-yellow-400/10 px-2 py-1 text-[11px] font-semibold text-yellow-200 hover:bg-yellow-400/20"
            title="Copy diagnostics JSON to clipboard"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy diagnostics"}
          </button>
        </div>
        {open && (
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <Pill name="New Releases" source={d.sources.newReleases} count={d.counts.newReleases} />
            <Pill name="Promoted Picks" source={d.sources.sponsored} count={d.counts.sponsored} />
            <Pill
              name="You May Also Like"
              source={d.sources.recommended}
              count={d.counts.recommended}
            />
          </div>
        )}
      </div>
    </div>
  );
}

