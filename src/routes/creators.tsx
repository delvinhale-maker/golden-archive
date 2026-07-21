import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BadgeCheck, MapPin, Search } from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { getApprovedCreators, type CreatorSummary } from "@/lib/creators.functions";
import { CATEGORIES } from "@/lib/categories";

const creatorsQ = queryOptions({
  queryKey: ["mp", "creators-all"],
  queryFn: () => getApprovedCreators(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/creators")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(creatorsQ);
  },
  head: () => ({
    meta: [
      { title: "Browse Creators — AurumVault" },
      {
        name: "description",
        content:
          "Discover creators shipping premium digital resources on AurumVault — filter by category and country.",
      },
      { property: "og:title", content: "Browse Creators — AurumVault" },
      {
        property: "og:description",
        content:
          "Discover creators shipping premium digital resources on AurumVault.",
      },
    ],
  }),
  component: CreatorsPage,
});

function CreatorsPage() {
  const { data } = useSuspenseQuery(creatorsQ);
  const all = data as CreatorSummary[];
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((c) => {
      const catOk =
        cat === "all" ||
        (c.categories && c.categories.some((x) => x === cat));
      if (!catOk) return false;
      if (!needle) return true;
      return (
        c.brandName.toLowerCase().includes(needle) ||
        (c.pitch ?? "").toLowerCase().includes(needle) ||
        (c.country ?? "").toLowerCase().includes(needle)
      );
    });
  }, [all, q, cat]);

  return (
    <MarketShell>
      <section className="av-hero-bg border-b border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
          <div className="text-[11px] font-semibold tracking-caps text-gold-ink">
            THE CREATORS
          </div>
          <h1 className="mt-2 font-display text-4xl font-bold text-white md:text-5xl">
            Meet the vault
          </h1>
          <p className="mt-3 max-w-2xl text-white/70">
            Creators shipping eBooks, courses, templates, and audio to the AurumVault community.
          </p>
        </div>
      </section>

      <section className="bg-bg-page py-8">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-mute"
              />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search creators, pitch, country…"
                className="h-11 w-full rounded-full bg-white pl-11 pr-5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              className="h-11 rounded-full border border-white/15 bg-white/5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gold"
            >
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug} className="text-ink">
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Creator count intentionally hidden — restore when catalog grows. */}


          {filtered.length === 0 ? (
            <div className="mt-12 rounded-xl border border-white/10 bg-white/5 p-10 text-center">
              <p className="text-white/70">No creators match those filters yet.</p>
              <Link
                to="/become-a-creator"
                className="mt-4 inline-flex h-10 items-center rounded-full bg-gold px-5 text-sm font-bold text-navy"
              >
                Become a Creator →
              </Link>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((c) => (
                <Link
                  key={c.userId}
                  to="/store/$slug"
                  params={{ slug: c.brandSlug }}
                  className="group overflow-hidden rounded-xl border border-white/10 bg-white/5 transition hover:-translate-y-1 hover:border-gold"
                >
                  <div
                    className="h-28"
                    style={{
                      background: c.coverUrl
                        ? `url(${c.coverUrl}) center/cover`
                        : "linear-gradient(135deg,#0f1629,#1a2744 55%,#c9a227 130%)",
                    }}
                  />
                  <div className="px-5 pb-5">
                    <div className="-mt-8 grid h-14 w-14 place-items-center overflow-hidden rounded-full border-[3px] border-navy bg-navy">
                      {c.avatarUrl ? (
                        <img
                          src={c.avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="font-display text-lg text-gold-ink">
                          {c.brandName.slice(0, 1)}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <div className="truncate font-display text-lg font-bold text-white">
                        {c.brandName}
                      </div>
                      
                    </div>
                    {c.pitch && (
                      <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-white/70">
                        {c.pitch}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-3 text-[11px] text-white/50">
                      {c.country && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={11} /> {c.country}
                        </span>
                      )}
                      {c.categories && c.categories.length > 0 && (
                        <span className="truncate">
                          {c.categories.slice(0, 2).join(" · ")}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </MarketShell>
  );
}
