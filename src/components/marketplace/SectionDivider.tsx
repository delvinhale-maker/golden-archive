type Variant = "navy-to-ivory" | "ivory-to-navy" | "navy-glow" | "ivory-glow";

/**
 * Subtle section transition. Renders a thin gradient band with an
 * optional soft gold glow so adjacent sections never abut with a hard edge.
 */
export function SectionDivider({ variant = "navy-to-ivory" }: { variant?: Variant }) {
  const bg =
    variant === "navy-to-ivory"
      ? "bg-gradient-to-b from-[#08101D] via-[#0f1629] to-[#F8F6F2]"
      : variant === "ivory-to-navy"
        ? "bg-gradient-to-b from-[#F8F6F2] via-[#1a2138] to-[#08101D]"
        : variant === "navy-glow"
          ? "bg-[#08101D]"
          : "bg-[#F8F6F2]";

  return (
    <div className={`relative h-16 w-full overflow-hidden md:h-24 ${bg}`} aria-hidden="true">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/10 blur-3xl" />
    </div>
  );
}
