import { Crown } from "lucide-react";
import { formatFoundingNumber } from "@/lib/founding";

type Props = {
  foundingNumber?: number | null;
  /** Show the numbered mark (#007). Defaults to true when a number is provided. */
  showNumber?: boolean;
  size?: "sm" | "md";
  className?: string;
};

/**
 * Permanent Founding Creator mark. Only rendered when a server-assigned
 * founding number exists — never as a decorative or self-declared badge.
 */
export function FoundingCreatorBadge({
  foundingNumber,
  showNumber = true,
  size = "sm",
  className,
}: Props) {
  if (!foundingNumber) return null;
  const pad = size === "md" ? "px-3 py-1.5 text-[13px]" : "px-2.5 py-1 text-[11px]";
  return (
    <span
      title={`Founding Creator ${formatFoundingNumber(foundingNumber)} — one of the first 100 creators on AurumVault`}
      className={`inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-navy ${pad} font-semibold uppercase tracking-caps text-gold ${className ?? ""}`}
    >
      <Crown size={size === "md" ? 14 : 12} />
      Founding Creator
      {showNumber ? (
        <span className="font-mono normal-case tracking-normal text-gold/80">
          {formatFoundingNumber(foundingNumber)}
        </span>
      ) : null}
    </span>
  );
}
