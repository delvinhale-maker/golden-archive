import { Link } from "@tanstack/react-router";
import { ArrowRight, QrCode } from "lucide-react";

/**
 * Public, marketing-oriented QR Code Generator banner for the AurumVault home page.
 *
 * Drives every visitor — signed-in or not — to the QR Code Generator. The
 * `/dashboard/qr` route gate redirects signed-out visitors to sign in first.
 */
export function QrCodeHomeBanner() {
  return (
    <section
      aria-labelledby="qr-home-banner-heading"
      className="relative overflow-hidden rounded-3xl border border-gold/30 bg-[linear-gradient(100deg,var(--paper,#FBF7EF)_0%,#FFFDF8_55%,#FFF9EC_100%)] px-6 py-8 shadow-[0_18px_44px_-28px_rgba(28,32,56,0.35)] sm:px-8 sm:py-10"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border border-gold/25"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 right-16 h-56 w-56 rounded-full border border-gold/15"
      />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gold/40 bg-white text-navy"
            >
              <QrCode size={18} />
            </span>
            <span className="rounded-full border border-gold/40 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-navy">
              Free tool
            </span>
          </div>

          <h2
            id="qr-home-banner-heading"
            className="mt-4 font-display text-2xl leading-tight text-navy sm:text-3xl md:text-4xl"
          >
            Create QR codes that grow with your business.
          </h2>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-mute sm:text-base">
            Build branded static and dynamic QR codes for your products, links, and campaigns.
            Update the destination anytime, track scans, and never reprint.
          </p>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-3 lg:w-auto lg:items-end">
          <Link
            to="/dashboard/qr"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-navy px-8 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-navy/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 lg:w-auto"
          >
            <QrCode size={18} aria-hidden="true" /> Create a QR Code
            <ArrowRight size={16} aria-hidden="true" className="-ml-0.5" />
          </Link>
          <p className="text-center text-sm text-mute lg:text-right">
            Static & dynamic codes • Scan tracking included
          </p>
        </div>
      </div>
    </section>
  );
}
