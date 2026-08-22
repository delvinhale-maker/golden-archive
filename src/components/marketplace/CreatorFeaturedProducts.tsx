import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { accentClasses, type StorefrontAccent } from "@/lib/storefront";
import { trackStorefront } from "@/lib/storefront-track";

type FeaturedProduct = {
  id: string;
  title: string;
  subtitle?: string | null;
  cover_url: string | null;
  price_cents: number;
  compare_at_price_cents?: number | null;
};

type Props = {
  creatorUserId: string;
  products: FeaturedProduct[];
  accent?: StorefrontAccent;
  headline?: string | null;
};

/** Creator-curated picks pinned to the top of their storefront. */
export function CreatorFeaturedProducts({ creatorUserId, products, accent, headline }: Props) {
  if (!products.length) return null;
  const a = accentClasses(accent);

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className={a.text} />
        <h2 className="font-display text-2xl text-navy">Creator picks</h2>
      </div>
      {headline ? <p className="text-mute text-sm mt-1">{headline}</p> : null}

      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
        {products.map((p) => (
          <Link
            key={p.id}
            to="/products/$id"
            params={{ id: p.id }}
            onClick={() => trackStorefront("product_click", creatorUserId, p.id)}
            className={`group rounded-2xl bg-white border border-ink/10 overflow-hidden transition hover:shadow-lg hover:${a.border}`}
          >
            <div
              className="aspect-[4/5] bg-paper bg-cover bg-center"
              style={p.cover_url ? { backgroundImage: `url(${p.cover_url})` } : undefined}
            />
            <div className="p-3">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-caps ${a.chip}`}
              >
                Featured
              </span>
              <p className="mt-1.5 text-sm font-medium text-navy line-clamp-2">{p.title}</p>
              <p className="mt-1 text-sm text-mute">
                ${(p.price_cents / 100).toFixed(2)}
                {p.compare_at_price_cents && p.compare_at_price_cents > p.price_cents ? (
                  <span className="ml-1.5 line-through text-mute/60">
                    ${(p.compare_at_price_cents / 100).toFixed(2)}
                  </span>
                ) : null}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
