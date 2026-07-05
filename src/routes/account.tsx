import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  BookOpen,
  LayoutDashboard,
  Loader2,
  LogOut,
  Package,
  User as UserIcon,
  X,
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

  const [removedIds, setRemovedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("av-removed-downloads");
      return raw ? new Set(JSON.parse(raw)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });
  const [confirmRemove, setConfirmRemove] = useState<
    { id: string; title: string } | null
  >(null);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    localStorage.setItem("av-removed-downloads", JSON.stringify(Array.from(removedIds)));
  }, [removedIds]);

  const visibleDownloads = downloads.filter((d) => !removedIds.has(d.id));

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

        {/* My Library */}
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold text-ink">My Library</h2>
          <div className="mt-3 rounded-2xl border border-line bg-white p-5">
            {ordersQ.isLoading ? (
              <div className="flex items-center gap-3">
                <Loader2 size={18} className="animate-spin text-gold" />
                <span className="text-sm text-mute">Loading your library…</span>
              </div>
            ) : ordersQ.isError ? (
              <p className="text-sm text-red-700">
                We couldn't load your library.{" "}
                <button
                  type="button"
                  onClick={() => ordersQ.refetch()}
                  className="underline"
                >
                  Try again
                </button>
              </p>
            ) : downloads.length === 0 ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-mute">
                  Your library is empty — browse the Vault
                </p>
                <Link
                  to="/products"
                  className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-bold text-navy"
                >
                  Browse the Vault →
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold text-ink">
                  You own {downloads.length} Kingdom resource
                  {downloads.length === 1 ? "" : "s"}
                </p>
                <Link
                  to="/library"
                  className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-bold text-navy"
                >
                  Open Library →
                </Link>
              </div>
            )}
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
          ) : visibleDownloads.length === 0 ? (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-line bg-white p-4">
              <p className="text-sm text-mute">
                {downloads.length === 0
                  ? "No purchases yet. Items you buy will appear here for download."
                  : `All ${downloads.length} item${downloads.length === 1 ? "" : "s"} hidden. You can still find them in your Library.`}
              </p>
              {downloads.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRemovedIds(new Set())}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold underline"
                >
                  Show all
                </button>
              )}
            </div>

          ) : (
            <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
              {visibleDownloads.map((d) => (
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
                  <div className="flex items-center gap-2">
                    {d.download_token ? (
                      <Link
                        to="/download/$token"
                        params={{ token: d.download_token }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-bold text-navy"
                      >
                        <BookOpen size={14} /> Read
                      </Link>
                    ) : (
                      <span className="text-xs text-mute">Expired</span>
                    )}
                    <button
                      type="button"
                      disabled={isRemoving && confirmRemove?.id === d.id}
                      onClick={() =>
                        setConfirmRemove({ id: d.id, title: d.product_title })
                      }
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-mute hover:bg-muted hover:text-red-600 disabled:opacity-50"
                      aria-label={`Remove ${d.product_title} from My Downloads`}
                      title="Remove from My Downloads"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {visibleDownloads.length > 0 && removedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setRemovedIds(new Set())}
              className="mt-3 text-xs font-semibold text-gold underline"
            >
              Show {removedIds.size} hidden item{removedIds.size === 1 ? "" : "s"}
            </button>
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

      {confirmRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-download-title"
          onClick={() => setConfirmRemove(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="remove-download-title"
              className="font-display text-lg font-bold text-ink"
            >
              Remove from My Downloads?
            </h3>
            <p className="mt-2 text-sm text-mute">
              <span className="font-semibold text-ink">{confirmRemove.title}</span>{" "}
              will be removed from this list. You'll still own it and can access it
              anytime from your Library.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={isRemoving}
                onClick={() => setConfirmRemove(null)}
                className="flex-1 rounded-full border border-line py-2.5 text-sm font-semibold text-ink hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRemoving}
                onClick={async () => {
                  if (!confirmRemove || isRemoving) return;
                  setIsRemoving(true);
                  await new Promise((resolve) => setTimeout(resolve, 300));
                  setRemovedIds((prev) => new Set([...prev, confirmRemove.id]));
                  setIsRemoving(false);
                  setConfirmRemove(null);
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isRemoving && <Loader2 size={14} className="animate-spin" />}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </MarketShell>
  );
}
