import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";

/**
 * Public, marketing-oriented Canva banner for the AurumVault home page.
 *
 * Unlike the authenticated dashboard CanvaConnectBanner (which reads live
 * connection status via a protected server function), this banner is visible
 * to every visitor — signed-in or not — and drives them to the Creator
 * Dashboard to connect Canva. The `/dashboard/integrations` route gate
 * redirects signed-out visitors to sign in first.
 *
 * Visual language mirrors the dashboard banner: warm ivory/cream surfaces,
 * restrained gold, premium typography, and the Canva → AurumVault → Sell story.
 */
export function CanvaHomeBanner() {
  return (
    <section
      aria-labelledby="canva-home-banner-heading"
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
            <FlowMark />
            <span className="rounded-full border border-gold/40 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-navy">
              Creator studio
            </span>
          </div>

          <h2
            id="canva-home-banner-heading"
            className="mt-4 font-display text-2xl leading-tight text-navy sm:text-3xl md:text-4xl"
          >
            Design in Canva. Sell on AurumVault.
          </h2>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-mute sm:text-base">
            Connect your Canva account to bring your designs and creative assets into AurumVault
            and turn them into products ready to sell — eBooks, planners, templates, and more.
          </p>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-3 lg:w-auto lg:items-end">
          <Link
            to="/dashboard/integrations"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-8 py-4 text-base font-semibold text-navy shadow-sm transition hover:bg-gold/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 lg:w-auto"
          >
            <Sparkles size={18} aria-hidden="true" /> Connect Canva
            <ArrowRight size={16} aria-hidden="true" className="-ml-0.5" />
          </Link>
          <p className="text-center text-sm text-mute lg:text-right">
            Takes less than a minute
          </p>
        </div>
      </div>
    </section>
  );
}

function FlowMark() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-3 py-1 text-[11px] font-semibold tracking-wide text-navy"
    >
      <span className="text-[#00C4CC]">Canva</span>
      <span className="h-px w-4 bg-gold" />
      <span>AurumVault</span>
      <span className="h-px w-4 bg-gold" />
      <span className="text-gold">Sell</span>
    </span>
  );
}
