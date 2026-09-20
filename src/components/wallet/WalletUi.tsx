import type { ReactNode } from "react";
import { STATUS_LABELS, type WalletStatus } from "@/lib/license-wallet";

/** Shared presentational bits for the Business Certificate & License Wallet™ screens. */
export const inputCls =
  "w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none";

export const STATUS_TONE: Record<WalletStatus, string> = {
  CURRENT: "bg-emerald-50 text-emerald-700 border-emerald-200",
  EXPIRING_SOON: "bg-amber-50 text-amber-800 border-amber-200",
  EXPIRED: "bg-red-50 text-red-700 border-red-200",
  NO_EXPIRATION: "bg-ink/5 text-mute border-ink/15",
};

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mute">{label}</span>
      {children}
    </label>
  );
}

export function StatusPill({ status }: { status: WalletStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${STATUS_TONE[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}