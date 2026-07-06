/**
 * Navy/gold branded placeholder shown in place of stock imagery
 * for affiliate product cards. Renders the book title centered
 * over a subtle radial-gold background on deep navy.
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
