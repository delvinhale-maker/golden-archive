import { Mail } from "lucide-react";

const CONTACT_HREF = "/#contact";

/**
 * Inline text link that routes to the homepage contact card grid.
 * Used in place of raw mailto: links so no email address is shown
 * outside the homepage "Contact AurumVault" section.
 */
export function ContactLink({
  children = "contact us",
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={CONTACT_HREF}
      className={
        className ??
        "font-medium text-navy underline underline-offset-4 hover:text-gold-ink"
      }
    >
      {children}
    </a>
  );
}

/** Pill/button variant for CTA placements. */
export function ContactButton({
  children = "Contact us",
  className,
  showIcon = true,
}: {
  children?: React.ReactNode;
  className?: string;
  showIcon?: boolean;
}) {
  return (
    <a
      href={CONTACT_HREF}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-navy/90"
      }
    >
      {showIcon && <Mail size={14} />}
      {children}
    </a>
  );
}
