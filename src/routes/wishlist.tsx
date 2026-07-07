import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Heart, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { ProductCover } from "@/components/marketplace/ProductCover";
import { useAuth } from "@/hooks/use-auth";
import { listWishlist, removeWishlist } from "@/lib/wishlist.functions";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [{ title: "Your Wishlist — AurumVault" }] }),
  component: WishlistPage,
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback error={error} reset={reset} title="Wishlist isn't loading" />
  ),
});


function WishlistPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listWishlist);
  const remove = useServerFn(removeWishlist);

  useEffect(() => {
    if (!loading && !user) {
      toast("Sign in to save your wishlist");
      navigate({ to: "/auth" });
    }
  }, [loading, user, navigate]);

  const query = useQuery({
    queryKey: ["wishlist", "list"],
    queryFn: () => list(),
    enabled: !!user,
  });

  if (loading || !user) {
    return (
      <MarketShell>
        <div className="py-24 text-center">
          <Loader2 className="mx-auto animate-spin text-gold-ink" />
        </div>
      </MarketShell>
    );
  }

  const items = query.data ?? [];

  return (
    <MarketShell>
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">
          Your Wishlist
        </h1>
        <p className="mt-1 text-sm text-mute">
          {items.length} saved {items.length === 1 ? "product" : "products"}
        </p>

        {query.isLoading ? (
          <div className="py-16 text-center">
            <Loader2 className="mx-auto animate-spin text-gold-ink" />
          </div>
        ) : items.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-line bg-white py-16 text-center">
            <Heart size={36} className="mx-auto text-gold-ink" />
            <p className="mt-4 font-display text-xl font-bold text-ink">
              Your wishlist is empty
            </p>
            <p className="mt-1 text-sm text-mute">
              Start browsing to save products.
            </p>
            <Link
              to="/products"
              className="mt-6 inline-block rounded-full bg-gold px-6 py-2.5 text-sm font-bold text-navy"
            >
              Browse the Vault
            </Link>
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {items.map((p) => (
              <li
                key={p.id}
                className="flex gap-4 rounded-xl border border-line bg-white p-4"
              >
                <Link
                  to="/products/$id"
                  params={{ id: p.id }}
                  className="block h-24 w-20 flex-shrink-0 overflow-hidden rounded bg-muted"
                >
                  {p.cover_url ? (
                    <img
                      src={p.cover_url}
                      alt={p.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ProductCover
                      title={p.title}
                      category={p.category}
                      productId={p.id}
                      className="h-full w-full object-cover"
                    />
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link
                    to="/products/$id"
                    params={{ id: p.id }}
                    className="line-clamp-2 font-display font-bold text-ink hover:text-navy"
                  >
                    {p.title}
                  </Link>
                  <span className="mt-1 text-xs uppercase tracking-caps text-gold-ink">
                    {p.category}
                  </span>
                  <span className="mt-auto font-display text-lg font-bold text-gold-ink tabular-nums whitespace-nowrap">
                    ${(p.price_cents / 100).toFixed(2)}
                  </span>

                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await remove({ data: { productId: p.id } });
                    qc.invalidateQueries({ queryKey: ["wishlist"] });
                    toast("Removed from wishlist");
                  }}
                  aria-label="Remove"
                  className="self-start rounded-full p-2 text-mute hover:bg-muted hover:text-red-600"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MarketShell>
  );
}
