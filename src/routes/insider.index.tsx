import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { InsiderSignup } from "@/components/insider/InsiderSignup";
import { listPublicEditions } from "@/lib/insider.functions";
import { INSIDER_TAGLINE } from "@/lib/insider";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";

const editionsQuery = queryOptions({
  queryKey: ["insider", "editions"],
  queryFn: () => listPublicEditions(),
});

const TITLE = "AurumVault Insider — Digital Tools & Creator Opportunities";
const DESC =
  "Join AurumVault Insider for useful digital tools, creator opportunities, small-business resources, and marketplace releases.";

export const Route = createFileRoute("/insider/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(editionsQuery),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://www.aurumvault.store/insider" }],
  }),
  errorComponent: RouteErrorFallback,
  notFoundComponent: () => <p className="p-8">Not found.</p>,
  component: InsiderPage,
});

function InsiderPage() {
  const { data } = useSuspenseQuery(editionsQuery);
  const editions = data.editions ?? [];

  return (
    <MarketShell>
      <section className="bg-navy py-14 text-white">
        <div className="mx-auto max-w-3xl px-4 text-center md:px-8">
          <div className="text-[11px] font-semibold tracking-caps text-gold">
            AURUMVAULT INSIDER
          </div>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl">
            Build smarter. Discover better tools.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/70">{INSIDER_TAGLINE}</p>
          <InsiderSignup
            source="insider_page"
            variant="hero"
            buttonLabel="Join AurumVault Insider"
            className="mt-6 text-left sm:text-center"
          />
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-12 md:px-8">
        <h2 className="font-display text-2xl text-navy">Recent editions</h2>
        {editions.length === 0 ? (
          <p className="mt-3 text-sm text-mute">
            The first public edition is on its way. Subscribe above to get it first.
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {editions.map((e: any) => (
              <li
                key={e.slug}
                className="rounded-2xl border border-ink/10 bg-white p-5 transition hover:border-gold/50"
              >
                <Link to="/insider/$slug" params={{ slug: e.slug }} className="block">
                  <h3 className="font-display text-lg text-navy">{e.title}</h3>
                  {e.preview_text ? (
                    <p className="mt-1 text-sm text-mute">{e.preview_text}</p>
                  ) : null}
                  {e.published_at ? (
                    <p className="mt-2 text-xs text-mute">
                      {new Date(e.published_at).toLocaleDateString()}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </MarketShell>
  );
}
