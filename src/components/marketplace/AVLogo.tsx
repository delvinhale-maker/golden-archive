import { Link } from "@tanstack/react-router";

export function AVLogo({ dark = false }: { dark?: boolean }) {
  const wordmark = dark ? "text-navy" : "text-white";
  return (
    <Link to="/" className="flex items-center gap-3">
      <span
        className="flex h-10 w-10 items-center justify-center rounded-full font-display text-[18px] font-bold text-navy"
        style={{
          background:
            "linear-gradient(135deg, #f1d77a 0%, #c9a227 55%, #8a6b14 100%)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.4)",
          letterSpacing: "-0.04em",
        }}
        aria-hidden
      >
        <span style={{ marginRight: "-3px" }}>A</span>
        <span>V</span>
      </span>
      <span className="leading-tight">
        <span className={`block font-display text-[19px] font-bold ${wordmark}`}>
          AurumVault
        </span>
        <span className="block text-[9px] font-semibold tracking-[0.32em] text-gold">
          ILLUSTRIOUS CAPITAL™
        </span>
      </span>
    </Link>
  );
}
