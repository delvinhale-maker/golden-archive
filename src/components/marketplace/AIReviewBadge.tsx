import { Sparkles, ShieldCheck, Hourglass, AlertTriangle, XOctagon } from "lucide-react";

export type AIReviewStatus = "pass" | "warn" | "fail" | "pending" | null | undefined;

type Variant = "admin" | "seller" | "storefront";

type Props = {
  status: AIReviewStatus;
  score?: number | null;
  variant?: Variant;
  className?: string;
};

/**
 * Unified AI-review status indicator.
 * - storefront: only renders for `pass` ("AI verified" trust badge).
 * - seller/admin: renders all states (pending / approved / needs changes / failed).
 */
export function AIReviewBadge({ status, score, variant = "admin", className = "" }: Props) {
  const s: AIReviewStatus = status ?? "pending";

  if (variant === "storefront") {
    if (s !== "pass") return null;
    return (
      <span
        title="Reviewed by AurumVault AI"
        className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-caps ${className}`}
      >
        <ShieldCheck size={10} /> AI verified
      </span>
    );
  }

  const map = {
    pass: {
      label: variant === "seller" ? "AI approved" : "pass",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: <ShieldCheck size={10} />,
    },
    warn: {
      label: variant === "seller" ? "Needs changes" : "warn",
      cls: "bg-amber-50 text-amber-800 border-amber-200",
      icon: <AlertTriangle size={10} />,
    },
    fail: {
      label: variant === "seller" ? "Rejected by AI" : "fail",
      cls: "bg-red-50 text-red-700 border-red-200",
      icon: <XOctagon size={10} />,
    },
    pending: {
      label: variant === "seller" ? "AI review pending" : "pending",
      cls: "bg-ink/5 text-mute border-ink/10",
      icon: <Hourglass size={10} />,
    },
  } as const;

  const m = map[s as keyof typeof map] ?? map.pending;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${m.cls} ${className}`}
    >
      {variant === "admin" ? <Sparkles size={10} /> : m.icon}
      {variant === "admin" ? `AI: ${m.label}` : m.label}
      {variant === "admin" && score != null ? ` · ${score}` : ""}
    </span>
  );
}
