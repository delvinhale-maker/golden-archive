import { Link } from "@tanstack/react-router";

/**
 * Homepage brand/entity band. This carries the single homepage <h1> so the
 * page states plainly what AurumVault is (the rotating hero headline is
 * presentational copy). Keep the copy factual — it feeds brand/entity search.
 */
export function BrandIntro() {
  return (
    <section className="border-b border-ink/10 bg-ivory">
      <div className="mx-auto max-w-5xl px-6 py-12 text-center lg:px-8">
        <h1 className="font-display text-3xl leading-tight text-navy md:text-4xl">
          AurumVault — Professional Digital Systems, Creator Tools &amp; Specialized Resources
        </h1>
        <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-ink/75 md:text-lg">
          Practical digital systems and resources built for businesses, creators, filmmakers,
          professionals and independent operators. AurumVault at AurumVault.store offers
          professional operating systems, creator business tools, film &amp; production resources,
          and specialized digital products — alongside eBooks, planners, journals and templates —
          all delivered instantly. Eligible creators can also sell their own digital products and
          keep 85% of every sale.
        </p>
        <nav
          aria-label="Brand navigation"
          className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-medium"
        >
          <Link to="/business-systems" className="text-navy underline underline-offset-4 hover:text-gold-ink">
            Business systems
          </Link>
          <Link to="/creator-business-tools" className="text-navy underline underline-offset-4 hover:text-gold-ink">
            Creator business tools
          </Link>
          <Link to="/collections/film-tv-creator-production" className="text-navy underline underline-offset-4 hover:text-gold-ink">
            Film, TV &amp; production
          </Link>
          <Link to="/products" className="text-navy underline underline-offset-4 hover:text-gold-ink">
            Browse digital products
          </Link>
          <Link to="/academy" className="text-navy underline underline-offset-4 hover:text-gold-ink">
            AurumVault Academy
          </Link>
          <Link to="/sell" className="text-navy underline underline-offset-4 hover:text-gold-ink">
            Sell on AurumVault
          </Link>
          <Link to="/about" className="text-navy underline underline-offset-4 hover:text-gold-ink">
            About AurumVault
          </Link>
          <Link to="/about/trust" className="text-navy underline underline-offset-4 hover:text-gold-ink">
            Trust Center
          </Link>
        </nav>
      </div>
    </section>
  );
}
