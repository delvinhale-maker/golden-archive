import { Link } from "@tanstack/react-router";
import sealAsset from "@/assets/av-seal-120.png.asset.json";

type AVLogoProps = {
  dark?: boolean;
  /** Rendered size of the seal in pixels. Wordmark stays constant. */
  size?: number;
  /** Hide the wordmark and show only the seal. */
  markOnly?: boolean;
};

export function AVLogo({ dark = false, size = 48, markOnly = false }: AVLogoProps) {
  const wordmark = dark ? "text-navy" : "text-white";
  return (
    <Link to="/" className="flex items-center gap-3">
      <img
        src={sealAsset.url}
        alt="AurumVault"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-contain"
      />
      {!markOnly && (
        <span className="leading-tight">
          <span className={`block font-display text-[19px] font-bold ${wordmark}`}>
            AurumVault
          </span>
        </span>
      )}
    </Link>
  );
}
