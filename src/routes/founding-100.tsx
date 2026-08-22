import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Crown, Download, ShieldCheck, Sparkles } from "lucide-react";
import { getFoundingCohortStatus } from "@/lib/founding.functions";
import { logCtaClick } from "@/lib/cta-tracking";
import {
  FOUNDING_APPLICATION_ROUTE,
  FOUNDING_BENEFITS,
  FOUNDING_COHORT_SIZE,
  FOUNDING_EVENTS,
  FOUNDING_FAQ,
  FOUNDING_LOOKING_FOR,
  captureFoundingAttribution,
} from "@/lib/founding";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";

const TITLE = "AurumVault Founding 100 Creators | Apply to the First Cohort";
const DESCRIPTION =
  "AurumVault is accepting its first 100 independent creators. Keep 85% of every sale, get a permanent numbered Founding Creator mark, launch support and early access to new tools.";

const cohortQuery = queryOptions({
  queryKey: ["founding-cohort-status"],
  queryFn: () => getFoundingCohortStatus(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/founding-100")({
  loader: ({ context }) => context.queryClient.ensureQueryData(cohortQuery),
  errorComponent: RouteErrorFallback,
  component: Founding100Page,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Become an AurumVault Founding Creator" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Become an AurumVault Founding Creator" },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: "https://www.aurumvault.store/founding-100" }],
  }),
});

function Counter({ accepted, remaining, isFull }: { accepted: number; remaining: number; isFull: boolean }) {
  const pct = Math.min(100, Math.round((accepted / FOUNDING_COHORT_SIZE) * 100));
  return (
    <div className="mx-auto mt-8 w-full max-w-md rounded-2xl border border-gold/30 bg-white/5 p-5 backdrop-blur">
      <div className="flex items-baseline justify-between text-white">
        <span className="font-display text-3xl">
          {accepted}
          <span className="text-white/50">/{FOUNDING_COHORT_SIZE}</span>
        </span>
        <span className="text-xs uppercase tracking-caps text-gold">
          {isFull ? "Cohort closed" : `${remaining} spots remaining`}
        </span>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"
        role="progressbar"
        aria-valuenow={accepted}
        aria-valuemin={0}
        aria-valuemax={FOUNDING_COHORT_SIZE}
        aria-label="Founding creators accepted"
      >
        <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-3 text-xs text-white/60">
        {accepted === 0
          ? "No founding creators accepted yet — the first numbers are still open."
          : "Founding numbers are assigned only after an application is approved."}
      </p>
    </div>
  );
}

function Founding100Page() {
  const { data } = useSuspenseQuery(cohortQuery);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    captureFoundingAttribution();
    logCtaClick(FOUNDING_EVENTS.viewed);
  }, []);

  const applyHref = `${FOUNDING_APPLICATION_ROUTE}?campaign=founding_100`;

  return (
    <div className="min-h-screen bg-paper">
      {/* Hero */}
      <section className="bg-gradient-to-br from-navy via-navy to-[#22335A] py-16 text-white md:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center md:px-8">
          <p className="inline-flex items-center gap-2 rounded-full border border-gold/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-caps text-gold">
            <Crown size={13} /> Founding 100 Creators
          </p>
          <h1 className="mt-5 font-display text-4xl leading-tight md:text-6xl">
            Be one of the first 100 creators on AurumVault
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-white/80">
            AurumVault is a curated marketplace for premium digital resources. We're accepting a
            first cohort of independent creators — reviewed, numbered, and treated like partners
            rather than inventory.
          </p>

          <Counter accepted={data.accepted} remaining={data.remaining} isFull={data.isFull} />

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {data.isFull ? (
              <div className="rounded-2xl border border-white/20 bg-white/5 px-5 py-4 text-sm text-white/80">
                The Founding 100 cohort is now closed. Applications are still open for the general
                creator programme —{" "}
                <Link to="/sell" className="font-semibold text-gold underline">
                  apply to sell on AurumVault
                </Link>
                .
              </div>
            ) : (
              <>
                <a
                  href={applyHref}
                  onClick={() => logCtaClick(FOUNDING_EVENTS.applyClicked)}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-gold px-7 font-semibold text-navy transition hover:brightness-105"
                >
                  Apply for a founding spot <ArrowRight size={17} />
                </a>
                <Link
                  to="/creator-starter-pack"
                  onClick={() => logCtaClick(FOUNDING_EVENTS.starterPackClicked)}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-white/30 px-6 font-semibold text-white transition hover:bg-white/10"
                >
                  <Download size={17} /> Get the free Starter Pack
                </Link>
              </>
            )}
          </div>
          <p className="mt-4 text-xs text-white/50">
            Free to apply · You keep 85% of every sale · Every application is reviewed
          </p>
        </div>
      </section>

      {/* Why join */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:px-8 md:py-20">
        <h2 className="text-center font-display text-3xl text-navy md:text-4xl">
          What founding creators get
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {FOUNDING_BENEFITS.map((b) => (
            <div key={b.title} className="rounded-2xl border border-ink/10 bg-white p-6">
              <Sparkles className="text-gold" size={18} />
              <h3 className="mt-3 font-semibold text-navy">{b.title}</h3>
              <p className="mt-2 text-sm text-mute">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who we look for */}
      <section className="bg-white py-14 md:py-20">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 md:grid-cols-2 md:px-8">
          <div>
            <h2 className="font-display text-3xl text-navy md:text-4xl">Who we're looking for</h2>
            <p className="mt-3 text-mute">
              We keep the catalogue small on purpose. Applications are reviewed by a person, and we
              only accept creators whose work we'd be comfortable recommending.
            </p>
          </div>
          <ul className="space-y-4">
            {FOUNDING_LOOKING_FOR.map((item) => (
              <li key={item} className="flex gap-3 text-sm text-ink">
                <Check className="mt-0.5 shrink-0 text-gold" size={17} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-4 py-14 md:px-8 md:py-20">
        <h2 className="text-center font-display text-3xl text-navy md:text-4xl">How it works</h2>
        <ol className="mt-10 grid gap-5 md:grid-cols-4">
          {[
            { t: "Apply", d: "Complete the standard creator application — four short steps." },
            { t: "Review", d: "A person reviews your work, usually within 48 hours." },
            { t: "Accepted", d: "You get your permanent founding number and welcome email." },
            { t: "Launch", d: "Open your Launch Kit, publish your first product, start selling." },
          ].map((s, i) => (
            <li key={s.t} className="rounded-2xl border border-ink/10 bg-white p-6">
              <span className="font-mono text-xs text-gold">0{i + 1}</span>
              <h3 className="mt-2 font-semibold text-navy">{s.t}</h3>
              <p className="mt-1 text-sm text-mute">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ */}
      <section className="bg-white py-14 md:py-20">
        <div className="mx-auto max-w-3xl px-4 md:px-8">
          <h2 className="text-center font-display text-3xl text-navy md:text-4xl">
            Founding 100 questions
          </h2>
          <div className="mt-8 divide-y divide-ink/10 rounded-2xl border border-ink/10">
            {FOUNDING_FAQ.map((f, i) => (
              <div key={f.q}>
                <button
                  onClick={() => {
                    setOpenFaq(openFaq === i ? null : i);
                    if (openFaq !== i) logCtaClick(FOUNDING_EVENTS.faqOpened);
                  }}
                  aria-expanded={openFaq === i}
                  className="flex min-h-[56px] w-full items-center justify-between gap-4 px-5 text-left font-semibold text-navy"
                >
                  {f.q}
                  <span className="text-gold">{openFaq === i ? "–" : "+"}</span>
                </button>
                {openFaq === i ? <p className="px-5 pb-5 text-sm text-mute">{f.a}</p> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-navy py-14 text-white md:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center md:px-8">
          <ShieldCheck className="mx-auto text-gold" size={22} />
          <h2 className="mt-4 font-display text-3xl md:text-4xl">
            {data.isFull ? "The founding cohort is complete" : `${data.remaining} founding spots remain`}
          </h2>
          <p className="mt-3 text-white/75">
            {data.isFull
              ? "Thank you to every founding creator. General creator applications are still open."
              : "Apply once, get reviewed by a person, and keep 85% of every sale."}
          </p>
          <a
            href={data.isFull ? FOUNDING_APPLICATION_ROUTE : applyHref}
            onClick={() => logCtaClick(FOUNDING_EVENTS.applyClicked)}
            className="mt-7 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-gold px-7 font-semibold text-navy"
          >
            {data.isFull ? "Apply to sell on AurumVault" : "Apply for a founding spot"}
            <ArrowRight size={17} />
          </a>
        </div>
      </section>
    </div>
  );
}
