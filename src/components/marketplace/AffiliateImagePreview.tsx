import { ImageOff } from "lucide-react";

interface AffiliateImagePreviewProps {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  placeholderClassName?: string;
}

/**
 * Public affiliate image preview with a consistent fallback placeholder.
 * Renders the uploaded image when available, otherwise a dashed “image coming soon”
 * placeholder so the card keeps its shape and remains visually balanced.
 */
export function AffiliateImagePreview({
  src,
  alt,
  className = "",
  imgClassName = "",
  placeholderClassName = "",
}: AffiliateImagePreviewProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={`h-full w-full ${imgClassName}`}
      />
    );
  }

  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-navy/20 bg-[#F4F1E8] ${placeholderClassName}`}
      aria-label={`No image uploaded for ${alt}`}
    >
      <ImageOff size={28} className="text-navy/35" aria-hidden />
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-navy/50">
        Image coming soon
      </span>
    </div>
  );
}
