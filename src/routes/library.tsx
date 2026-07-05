import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BookOpen, Crown, Download, Loader2, Search as SearchIcon } from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { getMyOrders, type AccountOrder } from "@/lib/account.functions";
import { getDownloadInfo } from "@/lib/payments.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/library")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({
        to: "/auth",
        search: {
          redirect: "/library",
          message: "Sign in to access your Kingdom Library",
        },
      });
    }
  },
  head: () => ({
    meta: [
      { title: "My Kingdom Library — AurumVault" },
      { name: "description", content: "Your purchased Kingdom resources — downloads and previews." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LibraryPage,
});

type LibraryItem = AccountOrder["items"][number] & {
  orderId: string;
  purchasedAt: string;
};

type SortKey = "recent" | "title";

function formatBytes(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function fileFormat(path: string | null): string {
  if (!path) return "FILE";
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf", "epub", "docx", "mobi", "azw3", "txt", "zip"].includes(ext)) return ext.toUpperCase();
  return ext ? ext.toUpperCase() : "FILE";
}

function LibraryPage() {
  const myOrders = useServerFn(getMyOrders);
  const ordersQ = useQuery({
    queryKey: ["library", "orders"],
    queryFn: () => myOrders(),
  });

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const dl = useServerFn(getDownloadInfo);
  const errorToastedRef = useRef(false);

  useEffect(() => {
    if (ordersQ.isError && !errorToastedRef.current) {
      errorToastedRef.current = true;
      const msg = ordersQ.error instanceof Error ? ordersQ.error.message : "Couldn't load your library";
      toast.error(msg);
    }
    if (!ordersQ.isError) errorToastedRef.current = false;
  }, [ordersQ.isError, ordersQ.error]);

  const items = useMemo<LibraryItem[]>(() => {
    const orders = ordersQ.data ?? [];
    const flat: LibraryItem[] = orders.flatMap((o) =>
      (o.items ?? []).map((it) => ({
        ...it,
        orderId: o.id,
        purchasedAt: o.created_at,
      })),
    );
    const filtered = query.trim()
      ? flat.filter((i) =>
          i.product_title.toLowerCase().includes(query.trim().toLowerCase()),
        )
      : flat;
    const sorted = [...filtered].sort((a, b) => {
      if (sort === "title") return a.product_title.localeCompare(b.product_title);
      return new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime();
    });
    return sorted;
  }, [ordersQ.data, query, sort]);

  async function handleDownload(item: LibraryItem) {
    if (!item.download_token) {
      toast.error("Download link unavailable for this item");
      return;
    }
    setDownloadingId(item.id);
    const t = toast.loading(`Preparing "${item.product_title}"…`);
    try {
      const res = await dl({ data: { token: item.download_token } });
      if ("error" in res) {
        toast.error(res.error ?? "Download unavailable", { id: t });
        return;
      }
      if (!res.url) {
        toast.error("Signed URL missing", { id: t });
        return;
      }
      toast.success("Download ready", { id: t });
      window.location.href = res.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed", { id: t });
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <MarketShell>
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        <header className="flex items-center gap-3">
          <Crown className="text-gold" size={28} />
          <div>
            <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">
              My Kingdom Library
            </h1>
            <p className="mt-1 text-sm text-mute">Your purchased resources</p>
          </div>
        </header>

        {/* Controls */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-sm">
            <SearchIcon
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your library…"
              className="h-11 w-full rounded-full border border-line bg-white pl-9 pr-4 text-sm text-ink placeholder:text-mute focus:border-gold focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-mute">
            <span className="hidden sm:inline">Sort:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-11 rounded-full border border-line bg-white px-3 text-sm font-medium text-ink focus:border-gold focus:outline-none"
            >
              <option value="recent">Recently Purchased</option>
              <option value="title">Title A–Z</option>
            </select>
          </label>
        </div>

        {/* Content */}
        <section className="mt-6">
          {ordersQ.isLoading ? (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy="true" aria-label="Loading library">
              {Array.from({ length: 4 }).map((_, i) => (
                <LibraryCardSkeleton key={i} />
              ))}
            </ul>
          ) : ordersQ.isError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
              We couldn't load your library right now.{" "}
              <button
                type="button"
                onClick={() => ordersQ.refetch()}
                className="underline"
              >
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <EmptyState hasQuery={!!query.trim()} />
          ) : (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {items.map((item) => (
                <LibraryCard
                  key={item.id}
                  item={item}
                  downloading={downloadingId === item.id}
                  onDownload={() => handleDownload(item)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </MarketShell>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  if (hasQuery) {
    return (
      <div className="rounded-2xl border border-line bg-white p-10 text-center">
        <p className="text-sm text-mute">No books match your search.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-line bg-white p-10 text-center">
      <BookOpen className="mx-auto text-gold" size={40} />
      <p className="mt-4 text-base font-semibold text-ink">
        Your library is empty.
      </p>
      <p className="mt-1 text-sm text-mute">
        Browse the Vault to find your first Kingdom resource.
      </p>
      <Link
        to="/products"
        className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-gold px-6 py-2.5 text-sm font-bold text-navy"
      >
        Browse Now →
      </Link>
    </div>
  );
}

function LibraryCard({
  item,
  downloading,
  onDownload,
}: {
  item: LibraryItem;
  downloading: boolean;
  onDownload: () => void;
}) {
  const size = formatBytes(item.file_size_bytes);
  const format = fileFormat(item.file_path);
  const hasToken = !!item.download_token;

  return (
    <li className="relative overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      {/* Gold left accent */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5 bg-gold"
      />
      <div className="flex gap-4 p-4 pl-5">
        <div className="h-28 w-20 flex-shrink-0 overflow-hidden rounded-md bg-muted sm:h-32 sm:w-24">
          {item.cover_url ? (
            <img
              src={item.cover_url}
              alt={item.product_title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-mute">
              <BookOpen size={22} />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="line-clamp-2 font-display text-base font-bold text-ink">
            {item.product_title}
          </h3>
          {item.creator_name && (
            <p className="mt-0.5 truncate text-xs text-mute">
              by {item.creator_name}
            </p>
          )}
          <p className="mt-1 text-[11px] text-mute">
            Purchased {formatDate(item.purchasedAt)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
            <span className="rounded-full bg-navy px-2 py-0.5 text-gold">
              {format}
            </span>
            {size && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-mute">
                {size}
              </span>
            )}
          </div>

          <div className="mt-auto flex flex-wrap gap-2 pt-3">
            {hasToken ? (
              <>
                <button
                  type="button"
                  onClick={onDownload}
                  disabled={downloading}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-bold text-navy disabled:opacity-60"
                >
                  {downloading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  Download
                </button>
                <Link
                  to="/download/$token"
                  params={{ token: item.download_token! }}
                  search={{ preview: 1 }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-navy px-4 py-2 text-xs font-bold text-navy hover:bg-navy hover:text-white"
                >
                  <BookOpen size={14} /> Read Preview
                </Link>
              </>
            ) : (
              <span className="text-xs text-mute">Download link expired</span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function LibraryCardSkeleton() {
  return (
    <li className="relative overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gold/40" />
      <div className="flex gap-4 p-4 pl-5">
        <div className="h-28 w-20 flex-shrink-0 animate-pulse rounded-md bg-muted sm:h-32 sm:w-24" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          <div className="mt-1 flex gap-1.5">
            <div className="h-4 w-10 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-12 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="mt-auto flex gap-2 pt-3">
            <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />
            <div className="h-8 w-28 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
      </div>
    </li>
  );
}
