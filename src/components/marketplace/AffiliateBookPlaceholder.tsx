/**
 * Navy/gold branded placeholder shown in place of stock imagery
 * for affiliate product cards. Renders a book-cover silhouette
 * with the title centered over a subtle radial-gold background.
 */
export function AffiliateBookPlaceholder({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  return (
    <div
      className={
        "relative flex h-full w-full items-center justify-center overflow-hidden " +
        (className ?? "")
      }
      style={{
        background:
          "radial-gradient(circle at 50% 40%, rgba(201,168,76,0.28) 0%, rgba(201,168,76,0) 55%), linear-gradient(160deg,#0F1E35 0%,#0B1526 100%)",
      }}
      aria-label={title}
    >
      {/* Book-cover silhouette watermark for visual parity with real covers */}
      <svg
        aria-hidden
        viewBox="0 0 100 130"
        className="absolute inset-0 h-full w-full opacity-[0.10]"
        preserveAspectRatio="xMidYMid slice"
      >
        <rect x="22" y="14" width="56" height="102" rx="3" fill="none" stroke="#c9a84c" strokeWidth="1.2" />
        <line x1="30" y1="26" x2="70" y2="26" stroke="#c9a84c" strokeWidth="0.8" />
        <line x1="30" y1="104" x2="70" y2="104" stroke="#c9a84c" strokeWidth="0.8" />
      </svg>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-3 rounded-md border"
        style={{ borderColor: "rgba(201,168,76,0.35)" }}
      />
      <h4
        className="relative z-10 line-clamp-4 px-5 text-center font-display text-base font-bold leading-tight text-white sm:text-lg"
        style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
      >
        {title}
      </h4>
    </div>
  );
}

export function isPlaceholderImage(url: string | null | undefined): boolean {
  if (!url) return true;
  if (url.trim() === "") return true;
  if (url.includes("unsplash.com")) return true;
  return false;
}

