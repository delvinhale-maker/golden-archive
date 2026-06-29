import { Crown, ArrowRight } from "lucide-react";

export function KingdomBibleAppBanner() {
  return (
    <section className="bg-bg-page py-6 md:py-8">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <a
          href="https://www.kingdombibleapp.com"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col items-center justify-between gap-4 rounded-2xl border-2 border-gold/60 bg-navy px-5 py-4 text-gold shadow-card-hover transition hover:border-gold hover:shadow-lg md:flex-row md:px-8 md:py-5"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
              <Crown size={22} />
            </div>
            <div className="text-center md:text-left">
              <div className="text-[10px] font-bold uppercase tracking-caps text-gold/80">
                👑 Also by Illustrious Capital™
              </div>
              <div className="font-display text-lg font-bold text-gold md:text-xl">
                Kingdom Bible App
              </div>
              <div className="text-xs text-cream/80 md:text-sm">
                Daily Word, AI Coach &amp; 30-Day Challenges
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy transition group-hover:gap-3">
            Download Free <ArrowRight size={16} />
          </span>
        </a>
      </div>
    </section>
  );
}
