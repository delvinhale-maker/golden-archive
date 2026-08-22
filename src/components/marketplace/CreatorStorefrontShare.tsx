import { useMemo, useState } from "react";
import { Copy, QrCode, Share2, Check } from "lucide-react";
import { toast } from "sonner";
import { trackStorefront } from "@/lib/storefront-track";

type Props = {
  /** Public storefront path, e.g. `/creator/golden-archive`. */
  path: string;
  brandName: string;
  creatorUserId: string;
};

/**
 * Share panel for the creator's own storefront: copy link, native share sheet,
 * and a downloadable QR code for print/packaging.
 */
export function CreatorStorefrontShare({ path, brandName, creatorUserId }: Props) {
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${path}`;
  }, [path]);

  const qrSrc = url
    ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(url)}`
    : "";

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.success("Storefront link copied");
      trackStorefront("share", creatorUserId);
    } catch {
      toast.error("Couldn't copy link", { description: url });
    }
  };

  const share = async () => {
    if (!url) return;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: `${brandName} · AurumVault`, url });
        trackStorefront("share", creatorUserId);
        return;
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
    }
    void copy();
  };

  return (
    <section className="mt-6 rounded-2xl bg-white border border-ink/10 p-5">
      <h2 className="font-display text-xl text-navy inline-flex items-center gap-2">
        <QrCode size={18} /> Share your storefront
      </h2>
      <p className="text-sm text-mute mt-1">
        One link for every bio, email signature, and printed insert.
      </p>

      <div className="mt-4 flex flex-col md:flex-row gap-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 rounded-lg border border-ink/15 bg-paper px-3 py-2">
            <span className="flex-1 truncate text-sm text-navy font-mono">{url || path}</span>
            <button
              type="button"
              onClick={copy}
              className="shrink-0 p-1.5 rounded-md text-mute hover:text-navy"
              aria-label="Copy storefront link"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={share}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-navy text-white text-sm hover:bg-navy/90"
            >
              <Share2 size={14} /> Share
            </button>
            {qrSrc && (
              <a
                href={qrSrc}
                download={`${brandName.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}-qr.png`}
                onClick={() => trackStorefront("qr", creatorUserId)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-ink/15 text-navy text-sm hover:bg-paper"
              >
                <QrCode size={14} /> Download QR
              </a>
            )}
          </div>
        </div>

        {qrSrc && (
          <img
            src={qrSrc}
            alt={`QR code linking to ${brandName}'s storefront`}
            width={128}
            height={128}
            loading="lazy"
            className="h-32 w-32 rounded-xl border border-ink/10 bg-white p-2 self-start"
          />
        )}
      </div>
    </section>
  );
}
