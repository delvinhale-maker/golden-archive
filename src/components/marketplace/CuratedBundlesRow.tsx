import { Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { listActiveBundles } from "@/lib/bundles.functions";
import { BundleCard } from "./BundleCard";

export const curatedBundlesQ = queryOptions({
  queryKey: ["bundles", "row", "curated"],
  queryFn: () => listActiveBundles(),
});

/** Homepage band for curated bundles. Renders nothing when none are live. */
export function CuratedBundlesRow() {
  const { data } = useSuspenseQuery(curatedBundlesQ);
  const bundles = data.slice(0, 3);
  if (!bundles.length) return null;

  return (
    <section className="bg-white py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="text-[11px] font-semibold tracking-caps text-gold-ink">
            CURATED BUNDLES
          </div>
          <h2 className="mt-2 font-display text-3xl font-bold text-navy md:text-4xl">
            Build More. Save More.
          </h2>
          <span className="mt-3 block h-[2px] w-10 bg-gold" />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {bundles.map((b) => (
            <BundleCard key={b.id} bundle={b} surface="homepage" />
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/bundles"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-navy hover:text-gold-ink"
          >
            See all bundles <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
