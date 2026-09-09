import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, RotateCcw, ShieldCheck } from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import {
  RIGHTS_QUESTIONS,
  scoreRightsReadiness,
  type RightsAnswer,
} from "@/lib/ai-likeness-rights-risk-checker";

const SITE_URL = "https://www.aurumvault.store";
const CANONICAL = `${SITE_URL}/tools/ai-likeness-rights-risk-checker`;
const SEO_TITLE = "AI Likeness Rights Risk Checker | Free Creator Tool | AurumVault";
const SEO_DESC =
  "Check how well your AI likeness, voice, consent, licensing and digital-rights controls are documented with this free private AurumVault assessment.";

export const Route = createFileRoute("/tools/ai-likeness-rights-risk-checker")({
  head: () => ({
    meta: [
      { title: SEO_TITLE },
      { name: "description", content: SEO_DESC },
      { name: "robots", content: "index, follow" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: SEO_TITLE },
      { property: "og:description", content: SEO_DESC },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: SEO_TITLE },
      { name: "twitter:description", content: SEO_DESC },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "AI Likeness & Digital Rights Risk Checker",
          description: SEO_DESC,
          url: CANONICAL,
          isPartOf: {
            "@type": "WebSite",
            name: "AurumVault",
            url: SITE_URL,
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE_URL}/tools/revenue-calculator` },
            {
              "@type": "ListItem",
              position: 3,
              name: "AI Likeness & Digital Rights Risk Checker",
              item: CANONICAL,
            },
          ],
        }),
      },
    ],
  }),
  component: RightsRiskCheckerPage,
});

const OPTIONS: Array<{ value: RightsAnswer; label: string }> = [
  { value: "yes", label: "Yes" },
  { value: "not_sure", label: "Not sure" },
  { value: "no", label: "No" },
];

function RightsRiskCheckerPage() {
  const [answers, setAnswers] = useState<Partial<Record<string, RightsAnswer>>>({});
  const completed = RIGHTS_QUESTIONS.every((q) => Boolean(answers[q.id]));
  const result = useMemo(
    () => (completed ? scoreRightsReadiness(answers) : null),
    [answers, completed],
  );

  function reset() {
    setAnswers({});
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <MarketShell>
      <main className="bg-[#070A10] text-white">
        <section className="border-b border-white/10">
          <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 md:py-20">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/35 bg-gold/10 px-3 py-1 text-[11px] font-bold uppercase tracking-caps text-gold">
              <ShieldCheck size={14} aria-hidden /> Free private assessment
            </span>
            <h1 className="mt-5 font-display text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
              AI Likeness & Digital Rights Risk Checker
            </h1>
            <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-white/75 md:text-base">
              Review how clearly you have documented permissions around your face, voice,
              likeness, content, synthetic media and digital identity. Your answers stay in
              your browser and are not saved.
            </p>
            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-relaxed text-white/65">
              This is an educational and organizational readiness tool, not legal advice.
              It does not determine ownership, enforceability, legal risk, or whether any
              particular use is lawful.
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 md:py-14">
          <div className="space-y-5">
            {RIGHTS_QUESTIONS.map((q, index) => (
              <fieldset
                key={q.id}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
              >
                <legend className="px-1 text-sm font-semibold leading-relaxed text-white">
                  <span className="mr-2 text-gold">{index + 1}.</span>
                  {q.question}
                </legend>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {OPTIONS.map((option) => {
                    const active = answers[q.id] === option.value;
                    return (
                      <label
                        key={option.value}
                        className={`cursor-pointer rounded-xl border px-4 py-3 text-center text-sm font-semibold transition ${
                          active
                            ? "border-gold bg-gold text-navy"
                            : "border-white/15 bg-white/[0.03] text-white/75 hover:border-gold/50"
                        }`}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name={q.id}
                          value={option.value}
                          checked={active}
                          onChange={() =>
                            setAnswers((current) => ({
                              ...current,
                              [q.id]: option.value,
                            }))
                          }
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          {!completed && (
            <p className="mt-6 text-sm text-white/55" aria-live="polite">
              Answer all {RIGHTS_QUESTIONS.length} questions to see your Rights Readiness result.
              {" "}
              {Object.keys(answers).length}/{RIGHTS_QUESTIONS.length} complete.
            </p>
          )}

          {result && (
            <section
              aria-live="polite"
              className="mt-8 rounded-2xl border border-gold/30 bg-[#101522] p-6 md:p-8"
            >
              <p className="text-xs font-bold uppercase tracking-caps text-gold">
                Rights Readiness result
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <span className="font-display text-5xl font-bold text-white">
                  {result.score}
                </span>
                <span className="pb-1 text-sm text-white/50">documentation-gap points / 20</span>
              </div>
              <h2 className="mt-4 font-display text-2xl font-bold">{result.label}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">
                {result.summary}
              </p>

              {result.gaps.length > 0 && (
                <div className="mt-7">
                  <h3 className="font-display text-lg font-bold text-white">
                    Priority areas to clarify
                  </h3>
                  <ol className="mt-4 space-y-3">
                    {result.gaps.map((gap) => (
                      <li key={gap.id} className="rounded-xl border border-white/10 p-4">
                        <p className="font-semibold text-white">{gap.label}</p>
                        <p className="mt-1 text-sm leading-relaxed text-white/65">
                          {gap.guidance}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/products/$id"
                  params={{ id: "digital" }}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-bold text-navy"
                >
                  Explore the Digital Rights Passport <ArrowRight size={15} aria-hidden />
                </Link>
                <Link
                  to="/academy"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-3 text-sm font-bold text-white"
                >
                  Visit the Academy
                </Link>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-bold text-white"
                >
                  <RotateCcw size={15} aria-hidden /> Reset
                </button>
              </div>

              <p className="mt-6 text-xs leading-relaxed text-white/45">
                Keep qualified legal or professional advisers involved when a specific
                contract, law, dispute, ownership question or high-stakes licensing decision
                requires professional judgment.
              </p>
            </section>
          )}
        </section>
      </main>
    </MarketShell>
  );
}
