import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getMoreFromCreator } from "@/lib/storefront.functions";
import { trackStorefront } from "@/lib/storefront-track";

type Props = { sellerId: string; excludeProductId?: string; brandName?: string | null };

/** Horizontal rack of the same creator's other live products. */
export function MoreFromCreator({ sellerId, excludeProductId, brandName }: Props) {
  const fetchMore = useServerFn(getMoreFromCreator);
  const { data } = useQuery({
    queryKey: ["more-from-creator", sellerId, excludeProductId ?? null],
    queryFn: () => fetchMore({ data: { sellerId, excludeProductId } }),
    staleTime: 5 * 60 * 1000,
  });

  if (!data?.length) return null;

  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-navy">
        More from {brandName?.trim() || "this creator"}
      </h2>
      <div className="mt-4 flex snap-x gap-4 overflow-x-auto pb-2">
        {data.map((p) => (
          <Link
            key={p.id}
            to="/products/$id"
            params={{ id: p.id }}
            onClick={() => trackStorefront("product_click", sellerId, p.id)}
            className="w-40 shrink-0 snap-start rounded-xl border border-line bg-white p-3 transition hover:shadow-md"
          >
            <div
              className="aspect-[4/5] rounded-lg bg-paper bg-cover bg-center"
              style={p.cover_url ? { backgroundImage: `url(${p.cover_url})` } : undefined}
            />
            <p className="mt-2 line-clamp-2 text-xs font-medium text-navy">{p.title}</p>
            <p className="mt-1 text-xs text-mute">${(p.price_cents / 100).toFixed(2)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
