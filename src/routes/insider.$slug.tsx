import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { InsiderSignup } from "@/components/insider/InsiderSignup";
import { getPublicEdition } from "@/lib/insider.functions";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";

function editionQuery(slug: string) {
  return queryOptions({
    queryKey: ["insider", "edition", slug],
    queryFn: () => getPublicEdition({ data: { slug } }),
  });
}

export const Route = createFileRoute("/insider/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(editionQuery(params.slug));
    if (!data.edition) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => {
    const e = loaderData?.edition;
    if (!e) {
      return {
        meta: [
          { title: "Edition not found — AurumVault Insider" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = `${e.title} — AurumVault Insider`;
    const desc = e.preview_text ?? "An edition of AurumVault Insider.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [
        {
          rel: "canonical",
          href: `https://www.aurumvault.store/insider/${params.slug}`,
        },
      ],
    };
  },
  errorComponent: RouteErrorFallback,
  notFoundComponent: () => (
    <MarketShell>
      <div className="mx-auto max-w-3xl px-4 py-16 md:px-8">
        <h1 className="font-display text-2xl text-navy">Edition not found</h1>
        <Link to="/insider" className="mt-4 inline-block text-sm text-navy underline">
          Back to AurumVault Insider
        </Link>
      </div>
    </MarketShell>
  ),
  component: EditionPage,
});

function EditionPage() {
  const { data } = useSuspenseQuery(editionQuery(Route.useParams().slug));
  const e = data.edition!;
  const paragraphs = String(e.body_md ?? "")
    .split(/\n{2,}/)
    .map((p: string) => p.trim())
    .filter(Boolean);

  return (
    <MarketShell>
      <article className="mx-auto max-w-3xl px-4 py-12 md:px-8">
        <div className="text-[11px] font-semibold tracking-caps text-gold">
          AURUMVAULT INSIDER
        </div>
        <h1 className="mt-2 font-display text-3xl text-navy">{e.title}</h1>
        {e.published_at ? (
          <p className="mt-2 text-xs text-mute">
            {new Date(e.published_at).toLocaleDateString()}
          </p>
        ) : null}
        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-ink">
          {paragraphs.map((p: string, i: number) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </article>
      <section className="bg-navy py-12">
        <div className="mx-auto max-w-3xl px-4 text-center md:px-8">
          <InsiderSignup
            source="insider_page"
            variant="hero"
            heading="Get the next edition"
            description="Digital tools, creator opportunities, and marketplace releases."
            buttonLabel="Join Free"
            className="text-left sm:text-center"
          />
        </div>
      </section>
    </MarketShell>
  );
}
