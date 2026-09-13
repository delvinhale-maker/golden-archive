import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { getProducts } from "@/lib/marketplace.functions";
import {
  BUSINESS_SYSTEMS_LABEL,
  BUSINESS_SYSTEMS_SLUG,
} from "@/lib/business-systems";

/**
 * Homepage band for AurumVault Business Systems. The Agent Authority feature
 * is live software, so it remains distinct from downloadable operating-system
 * products while still living inside the AurumVault brand and department.
 */
export function BusinessSystemsRow() {
  const { data } = useQuery({
    queryKey: ["home-business-systems"],
    queryFn: () =>
      getProducts({
        data: { category: BUSINESS_SYSTEMS_SLUG, pageSize: 6, page: 1 },
      }),
    staleTime: 60_000,
  });
  const products = (data?.items ?? []).slice(0, 6);

  return (
    <section
      aria-labelledby="home-business-systems"
      className="border-y border-white/10 bg-[#080A11]"
    >
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8 md:py-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-caps text-gold">
              AurumVault
            </div>
            <h2
              id="home-business-systems"
              className="mt-1 font-display text-2xl font-bold text-white md:text-3xl"
            >
              {BUSINESS_SYSTEMS_LABEL}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-white/65">
              Downloadable operating systems and live software built for real business workflows.
            </p>
          </div>
          <Link
            to="/business-systems"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-gold/50 px-5 py-2.5 text-[12px] font-bold uppercase tracking-caps text-gold transition hover:bg-gold hover:text-navy"
          >
            Explore Business Systems <ArrowRight size={14} aria-hidden />
          </Link>
        </div>

        <a
          href="/agent-authority-passport"
          className="group mt-8 grid gap-5 rounded-2xl border border-gold/30 bg-[linear-gradient(135deg,rgba(184,134,11,0.11),rgba(255,255,255,0.025))] p-5 transition hover:border-gold/60 sm:p-6 lg:grid-cols-[auto_1fr_auto] lg:items-center"
          data-testid="home-agent-authority-card"
        >
          <span
            aria-hidden
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10 text-gold"
          >
            <ShieldCheck size={23} />
          </span>
          <span className="min-w-0">
            <span className="inline-flex rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-200">
              Live Software
            </span>
            <span className="mt-2 block font-display text-xl font-bold text-white md:text-2xl">
              AI Agent Authority Passport™
            </span>
            <span className="mt-1 block max-w-3xl text-[13px] leading-relaxed text-white/60">
              Govern AI employees with enforceable authority, human approvals, risk controls, execution receipts, and a defensible evidence trail.
            </span>
          </span>
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-caps text-gold">
            Explore Software
            <ArrowRight
              size={14}
              aria-hidden
              className="transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </a>

        {products.length > 0 && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
