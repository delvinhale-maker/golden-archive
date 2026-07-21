import bannerAsset from "@/assets/kingdom-bible-app-banner.png.asset.json";

export function KingdomBibleAppBanner() {
  return (
    <section className="bg-bg-page py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <a
          href="https://www.kingdombibleapp.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Visit the Kingdom Bible App"
          className="group relative block overflow-hidden rounded-3xl shadow-2xl transition-transform duration-500 hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <img
            src={bannerAsset.url}
            alt="Kingdom Bible App — Daily Verses, Prayer Streaks, Devotionals"
            width={1024}
            height={500}
            sizes="(min-width: 1024px) 1024px, (min-width: 640px) 90vw, 100vw"
            className="block h-auto w-full"
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />

        </a>
      </div>
    </section>
  );
}
