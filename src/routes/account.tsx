import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Download,
  LayoutDashboard,
  Loader2,
  LogOut,
  Package,
  User as UserIcon,
} from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { useAuth } from "@/hooks/use-auth";
import { getMyOrders } from "@/lib/account.functions";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Your Account — AurumVault" }] }),
  component: AccountPage,
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback error={error} reset={reset} title="Your account isn't loading" />
  ),
});


function AccountPage() {
  const { user, loading, signOut, isAdmin, isSeller } = useAuth();
  const navigate = useNavigate();
  const myOrders = useServerFn(getMyOrders);

  const ordersQ = useQuery({
    queryKey: ["account", "orders"],
    queryFn: () => myOrders(),
    enabled: !!user,
  });

  if (loading) {
    return (
      <MarketShell>
        <div className="py-24 text-center">
          <Loader2 className="mx-auto animate-spin text-gold" />
        </div>
      </MarketShell>
    );
  }

  if (!user) {
    return (
      <MarketShell>
        <div className="mx-auto max-w-md px-6 py-16 text-center">
          <UserIcon size={36} className="mx-auto text-gold" />
          <h1 className="mt-4 font-display text-3xl font-bold text-ink">
            Your Account
          </h1>
          <p className="mt-2 text-sm text-mute">
            Sign in or create an account to access your orders, downloads, and
            wishlist.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              to="/auth"
              className="rounded-full bg-gold py-3 text-sm font-bold text-navy"
            >
              Sign In
            </Link>
            <Link
              to="/auth"
              className="rounded-full border border-navy py-3 text-sm font-bold text-navy"
            >
              Create an account
            </Link>
          </div>
        </div>
      </MarketShell>
    );
  }

  const meta = user.user_metadata as { full_name?: string; avatar_url?: string } | undefined;
  const displayName = meta?.full_name || user.email?.split("@")[0] || "User";
  const avatar = meta?.avatar_url;
  const orders = ordersQ.data ?? [];
  const ordersFailed = ordersQ.isError;
  const downloads = orders.flatMap((o) =>
    (o.items ?? []).map((it) => ({ ...it, orderId: o.id })),
  );


  return (
    <MarketShell>
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
        {/* Profile */}
        <section className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5">
          <div className="h-16 w-16 overflow-hidden rounded-full bg-gold/15">
            {avatar ? (
              <img src={avatar} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-bold text-gold">
                {displayName[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-xl font-bold text-ink">
              {displayName}
            </p>
            <p className="truncate text-sm text-mute">{user.email}</p>
          </div>
        </section>

        {(isAdmin || isSeller) && (
          <Link
            to="/dashboard"
            className="mt-3 flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/5 p-4 font-semibold text-navy hover:bg-gold/10"
          >
            <LayoutDashboard size={18} className="text-gold" />
            Open Publisher Dashboard
          </Link>
        )}

        {/* My Downloads */}
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold text-ink">My Downloads</h2>
          {ordersQ.isLoading ? (
            <Loader2 className="mt-4 animate-spin text-gold" />
          ) : ordersFailed ? (
            <p className="mt-3 text-sm text-red-700">
              We couldn't load your downloads right now.{" "}
              <button type="button" onClick={() => ordersQ.refetch()} className="underline">Try again</button>
            </p>
          ) : downloads.length === 0 ? (
            <p className="mt-3 text-sm text-mute">
              No purchases yet. Items you buy will appear here for download.
            </p>

          ) : (
            <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
              {downloads.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-3 p-4"
                >
                  <div className="h-14 w-12 flex-shrink-0 overflow-hidden rounded bg-muted">
                    {d.cover_url ? (
                      <img
                        src={d.cover_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{d.product_title}</p>
                    <p className="text-xs text-mute">
                      ${(d.unit_amount_cents / 100).toFixed(2)}
                    </p>
                  </div>
                  {d.download_token ? (
                    <Link
                      to="/download/$token"
                      params={{ token: d.download_token }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-bold text-navy"
                    >
                      <Download size={14} /> Download
                    </Link>
                  ) : (
                    <span className="text-xs text-mute">Expired</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Order history */}
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold text-ink">Order History</h2>
          {ordersQ.isLoading ? (
            <Loader2 className="mt-4 animate-spin text-gold" />
          ) : orders.length === 0 ? (
            <p className="mt-3 text-sm text-mute">No orders yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
              {orders.map((o) => (
                <li key={o.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <Package size={14} className="text-gold" />
                        Order #{o.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-mute">
                        {new Date(o.created_at).toLocaleDateString()} · {o.items.length}{" "}
                        item{o.items.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <p className="font-display font-bold text-gold">
                      ${(o.amount_cents / 100).toFixed(2)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <button
          type="button"
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-full border border-line bg-white py-3 text-sm font-semibold text-ink hover:bg-muted"
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </MarketShell>
  );
}
