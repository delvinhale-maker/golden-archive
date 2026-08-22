import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Store } from "lucide-react";
import { getCreatorPublicCard } from "@/lib/storefront.functions";
import { FoundingCreatorBadge } from "./FoundingCreatorBadge";
import { accentClasses } from "@/lib/storefront";
import { trackStorefront } from "@/lib/storefront-track";

/**
 * Product-page creator attribution: links to the creator's storefront and shows
 * their server-assigned Founding Creator mark when one exists.
 */
export function ProductCreatorPanel({ sellerId }: { sellerId: string }) {
  const fetchCard = useServerFn(getCreatorPublicCard);
  const { data } = useQuery({
    queryKey: ["creator-public-card", sellerId],
    queryFn: () => fetchCard({ data: { sellerId } }),
    staleTime: 10 * 60 * 1000,
  });

  if (!data) return null;
  const a = accentClasses(data.accent);
  const name = data.brandName || data.displayName || "AurumVault creator";

  return (
    <div className="mt-5 rounded-lg border border-line bg-white p-5">
      <div className="flex items-start gap-4">
        {data.avatarUrl ? (
          <img src={data.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div className="grid h-12 w-12 place-items-center rounded-full bg-navy/5 font-display text-lg text-navy">
            {name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">{name}</p>
          {data.headline || data.pitch ? (
            <p className="mt-1 line-clamp-2 text-xs text-mute">{data.headline || data.pitch}</p>
          ) : null}
          <p className="mt-1 text-xs text-mute">
            {data.productCount} {data.productCount === 1 ? "product" : "products"} on AurumVault
          </p>
          {data.foundingNumber ? (
            <FoundingCreatorBadge foundingNumber={data.foundingNumber} className="mt-2" />
          ) : null}
        </div>
        {data.brandSlug ? (
          <Link
            to="/creator/$slug"
            params={{ slug: data.brandSlug }}
            onClick={() => trackStorefront("product_click", data.sellerId)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold ${a.chip}`}
          >
            <Store size={13} /> Visit store
          </Link>
        ) : null}
      </div>
    </div>
  );
}
