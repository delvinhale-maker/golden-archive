import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";

type Props = {
  className?: string;
};

export function AffiliateDisclosureLine({ className = "" }: Props) {
  return (
    <p
      className={`inline-flex items-start gap-1.5 text-[11px] font-medium leading-snug text-navy/60 ${className}`}
    >
      <Info size={12} className="mt-0.5 shrink-0" aria-hidden />
      As an Amazon Associate and affiliate partner, AurumVault earns from
      qualifying purchases.{" "}
      <Link
        to="/affiliate-disclosure"
        className="shrink-0 text-gold-ink underline hover:text-navy"
      >
        Learn more
      </Link>
    </p>
  );
}
