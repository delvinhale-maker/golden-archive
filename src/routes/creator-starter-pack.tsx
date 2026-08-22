import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Check, Download, ShieldCheck, Sparkles } from "lucide-react";
import { submitStarterPackLead } from "@/lib/starter-pack.functions";
import { logCtaClick } from "@/lib/cta-tracking";
import {
  CREATOR_APPLICATION_ROUTE,
  STARTER_PACK_CONTENTS,
  STARTER_PACK_EVENTS,
  STARTER_PACK_URL,
} from "@/lib/starter-pack";
import mockup from "@/assets/creator-starter-pack-mockup.png";

const TITLE = "Free Digital Creator Starter Pack | AurumVault";
const DESCRIPTION =
  "Get the free AurumVault Digital Creator Starter Pack: 25 product ideas, a pricing worksheet, launch checklist, quality checks, AI prompts and a 7-Day Creator Sprint.";

export const Route = createFileRoute("/creator-starter-pack")({
  component: CreatorStarterPackPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Build Something Worth Selling | AurumVault" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Build Something Worth Selling | AurumVault" },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: "https://www.aurumvault.store/creator-starter-pack" }],
  }),
});

const formSchema = z.object({
  firstName: z.string().trim().min(1, "Please enter your first name").max(80, "That name is too long"),
  email: z
    .string()
    .trim()
    .min(3, "Please enter your email")
    .max(255, "That email is too long")
    .email("Please enter a valid email address"),
});

/** Reads UTM/referrer attribution from the browser without adding form friction. */
function useAttribution() {
  const [attr, setAttr] = useState<Record<string, string | undefined>>({});
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const val = (k: string) => p.get(k)?.slice(0, 160) || undefined;
    setAttr({
      utmSource: val("utm_source"),
      utmMedium: val("utm_medium"),
      utmCampaign: val("utm_campaign"),
      utmContent: val("utm_content"),
      utmTerm: val("utm_term"),
      referringUrl: document.referrer ? document.referrer.slice(0, 500) : undefined,
      landingPage: window.location.pathname + window.location.search.slice(0, 400),
    });
  }, []);
  return attr;
}

function CreatorStarterPackPage() {
  const navigate = useNavigate();
  const submit = useServerFn(submitStarterPackLead);
  const attribution = useAttribution();
  const mountedAt = useRef(Date.now());
  const started = useRef(false);

  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [company, setCompany] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    logCtaClick(STARTER_PACK_EVENTS.viewed);
  }, []);

  function markStarted() {
    if (started.current) return;
    started.current = true;
    logCtaClick(STARTER_PACK_EVENTS.formStarted);
  }

  const bullets = useMemo(() => STARTER_PACK_CONTENTS, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = formSchema.safeParse({ firstName, email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    setBusy(true);
    try {
      const res = await submit({
        data: {
          firstName: parsed.data.firstName,
          email: parsed.data.email,
          marketingConsent: consent,
          company,
          elapsedMs: Date.now() - mountedAt.current,
          ...attribution,
        },
      });
      logCtaClick(STARTER_PACK_EVENTS.submitted);
      if (res?.emailQueued) logCtaClick(STARTER_PACK_EVENTS.emailQueued);
      navigate({
        to: "/creator-starter-pack/thank-you",
        search: { resent: res?.duplicate ? 1 : undefined },
      });
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-navy text-white">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage: `
            radial-gradient(circle at 18% 8%, rgba(201,162,39,0.09) 0%, transparent 28%),
            radial-gradient(circle at 82% 26%, rgba(201,162,39,0.06) 0%, transparent 24%),
            radial-gradient(1.5px 1.5px at 12px 18px, rgba(201,162,39,0.2), transparent)
          `,
          backgroundSize: "100% 100%, 100% 100%, 48px 48px",
        }}
      />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-navy/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3 md:px-8">
          <Link to="/" className="font-display text-lg font-bold text-white">
            AurumVault
          </Link>
          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.24em] text-gold sm:inline">
            Create. Sell. Keep Yours.
          </span>
        </div>
      </header>

      {/* Hero + form */}
      <section className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-20">
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
              <Sparkles size={13} aria-hidden="true" /> Free download
            </span>
            <h1 className="mt-5 font-display text-3xl leading-tight !text-white sm:text-4xl md:text-5xl">
              Build Something <span className="text-gold">Worth Selling</span>
            </h1>
            <p className="mt-5 text-base leading-relaxed text-white/75 md:text-lg">
              Get the free AurumVault Digital Creator Starter Pack and turn your knowledge,
              expertise, or creative idea into a polished digital product people can understand,
              use, and buy.
            </p>

            <ul className="mt-7 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-white/80">
                  <Check size={16} className="mt-[3px] shrink-0 text-gold" aria-hidden="true" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 md:hidden">
              <img
                src={mockup}
                alt="The AurumVault Digital Creator Starter Pack workbook cover with sample interior pages"
                width={1024}
                height={1024}
                loading="lazy"
                className="mx-auto w-full max-w-[320px]"
              />
            </div>

            {/* Form */}
            <form onSubmit={onSubmit} noValidate className="mt-8 max-w-md">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur md:p-6">
                <label className="block">
                  <span className="mb-2 block text-[13px] font-semibold text-white/80">
                    First name
                  </span>
                  <input
                    type="text"
                    name="firstName"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => {
                      markStarted();
                      setFirstName(e.target.value);
                    }}
                    placeholder="Jordan"
                    className="min-h-[48px] w-full rounded-xl border border-white/15 bg-navy px-4 text-base text-white outline-none placeholder:text-white/35 focus:border-gold focus:ring-2 focus:ring-gold/25"
                  />
                </label>

                <label className="mt-4 block">
                  <span className="mb-2 block text-[13px] font-semibold text-white/80">
                    Email address
                  </span>
                  <input
                    type="email"
                    name="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => {
                      markStarted();
                      setEmail(e.target.value);
                    }}
                    placeholder="you@example.com"
                    className="min-h-[48px] w-full rounded-xl border border-white/15 bg-navy px-4 text-base text-white outline-none placeholder:text-white/35 focus:border-gold focus:ring-2 focus:ring-gold/25"
                  />
                </label>

                {/* Honeypot — hidden from humans and assistive tech */}
                <div aria-hidden className="absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden">
                  <label>
                    Company
                    <input
                      tabIndex={-1}
                      autoComplete="off"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                    />
                  </label>
                </div>

                <label className="mt-5 flex cursor-pointer items-start gap-3 text-[13px] leading-relaxed text-white/70">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-[3px] h-[18px] w-[18px] shrink-0 rounded border-white/25 accent-[#c9a227]"
                  />
                  <span>
                    Send me creator resources, marketplace opportunities, and occasional AurumVault
                    updates. <span className="text-white/45">(Optional)</span>
                  </span>
                </label>

                {error ? (
                  <p role="alert" className="mt-4 text-sm text-red-300">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-5 min-h-[52px] w-full rounded-xl bg-gold px-6 text-base font-semibold text-navy transition hover:brightness-110 disabled:opacity-60"
                >
                  {busy ? "Sending…" : "Send Me the Free Starter Pack"}
                </button>

                <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-white/50">
                  <ShieldCheck size={14} className="mt-[1px] shrink-0 text-gold/70" aria-hidden="true" />
                  <span>
                    The Starter Pack is sent whether or not you opt into updates. See our{" "}
                    <Link to="/privacy" className="underline hover:text-white/80">
                      Privacy Policy
                    </Link>{" "}
                    and{" "}
                    <Link to="/terms" className="underline hover:text-white/80">
                      Terms
                    </Link>
                    .
                  </span>
                </p>
              </div>
            </form>
          </div>

          <div className="hidden md:block">
            <img
              src={mockup}
              alt="The AurumVault Digital Creator Starter Pack workbook cover with sample interior pages"
              width={1024}
              height={1024}
              className="mx-auto w-full max-w-[460px] drop-shadow-[0_30px_60px_rgba(0,0,0,0.55)]"
            />
          </div>
        </div>
      </section>

      {/* Secondary CTA */}
      <section className="mx-auto max-w-3xl px-5 pb-20 md:px-8">
        <div className="rounded-2xl border border-gold/25 bg-gold/[0.07] p-6 text-center md:p-8">
          <h2 className="font-display text-2xl !text-white md:text-3xl">Already ready to sell?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/70 md:text-base">
            AurumVault is a curated marketplace for premium digital products. You keep 85% of every
            sale and get paid every Friday.
          </p>
          <Link
            to={CREATOR_APPLICATION_ROUTE}
            onClick={() => logCtaClick(STARTER_PACK_EVENTS.applicationClicked)}
            className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-xl border border-gold/50 px-6 text-sm font-semibold text-gold transition hover:bg-gold hover:text-navy"
          >
            Apply to become an AurumVault Creator
          </Link>
          <p className="mt-5 text-[11px] text-white/45">
            Prefer to grab the file directly?{" "}
            <a
              href={STARTER_PACK_URL}
              onClick={() => logCtaClick(STARTER_PACK_EVENTS.downloadClicked)}
              className="inline-flex items-center gap-1 underline hover:text-white/70"
            >
              <Download size={12} aria-hidden="true" /> Download the PDF
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
