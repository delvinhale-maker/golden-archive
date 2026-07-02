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
  const { data } = useQuery(homeRowsQ);
  const [open, setOpen] = useState(true);
  if (!isAdmin || !data) return null;
  const d = data.diagnostics;
  return (
    <div className="mx-auto my-4 max-w-7xl px-6 lg:px-8">
      <div className="rounded-lg border border-yellow-400/30 bg-black/70 p-3 text-white shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 text-left"
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
