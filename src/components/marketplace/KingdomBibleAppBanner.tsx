import { Crown, ArrowRight, Sparkles } from "lucide-react";

export function KingdomBibleAppBanner() {
  return (
    <section className="bg-bg-page py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <a
          href="https://www.kingdombibleapp.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Download the Kingdom Bible App — free"
          className="group relative block overflow-hidden rounded-3xl"
          style={{
            background:
              "radial-gradient(120% 140% at 0% 0%, #1a2547 0%, #0f1629 55%, #080d1c 100%)",
            boxShadow:
              "0 30px 80px -30px rgba(201,168,76,0.45), 0 0 0 1px rgba(201,168,76,0.35) inset",
          }}
        >
          {/* Gold hairline frame */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-[6px] rounded-[22px] border border-gold/25"
          />
          {/* Corner glow */}
          <span
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-60 blur-3xl transition duration-700 group-hover:opacity-90"
            style={{
              background:
                "radial-gradient(closest-side, rgba(201,168,76,0.55), transparent 70%)",
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-28 -left-16 h-56 w-56 rounded-full opacity-40 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(201,168,76,0.35), transparent 70%)",
            }}
          />
          {/* Subtle diagonal shine sweep on hover */}
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-y-8 -left-1/3 w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-all duration-700 group-hover:left-full group-hover:opacity-100"
          />

          <div className="relative flex flex-col items-center gap-8 px-6 py-10 text-center md:flex-row md:items-center md:gap-10 md:px-12 md:py-14 md:text-left">
            {/* Emblem */}
            <div className="relative shrink-0">
              <span
                aria-hidden
                className="absolute inset-0 rounded-full opacity-70 blur-2xl"
                style={{
                  background:
                    "radial-gradient(closest-side, rgba(201,168,76,0.55), transparent 70%)",
                }}
              />
              <div
                className="relative flex h-24 w-24 items-center justify-center rounded-full md:h-28 md:w-28"
                style={{
                  background:
                    "linear-gradient(145deg, #f0d78c 0%, #c9a84c 45%, #8b6f2a 100%)",
                  boxShadow:
                    "0 12px 30px -10px rgba(201,168,76,0.6), 0 0 0 1px rgba(255,255,255,0.15) inset",
                }}
              >
                <div className="flex h-[86%] w-[86%] items-center justify-center rounded-full bg-navy">
                  <Crown size={40} className="text-gold" strokeWidth={1.6} />
                </div>
              </div>
            </div>

            {/* Copy */}
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-caps text-gold">
                <Sparkles size={12} /> Also by AurumVault
              </div>
              <h3
                className="mt-4 font-display text-3xl font-bold leading-tight text-white md:text-4xl"
              >
                Kingdom{" "}
                <span
                  style={{
                    background:
                      "linear-gradient(135deg, #f6e3a1 0%, #c9a84c 55%, #f0d78c 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Bible App
                </span>
              </h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-cream/75 md:mx-0 md:text-base">
                Daily Word, AI Coach &amp; 30-Day Challenges — crafted to renew
                your mind, morning by morning.
              </p>

              <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row md:items-center md:justify-start">
                <span
                  className="inline-flex h-12 items-center gap-2 rounded-full px-7 text-sm font-bold text-navy transition group-hover:gap-3"
                  style={{
                    background:
                      "linear-gradient(135deg, #f0d78c 0%, #c9a84c 100%)",
                    boxShadow:
                      "0 10px 25px -8px rgba(201,168,76,0.55), 0 0 0 1px rgba(255,255,255,0.25) inset",
                  }}
                >
                  Download Free <ArrowRight size={16} />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-caps text-gold/70">
                  Free · iOS &amp; Android
                </span>
              </div>
            </div>
          </div>
        </a>
      </div>
    </section>
  );
}
