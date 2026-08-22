import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Download, Mail } from "lucide-react";
import { logCtaClick } from "@/lib/cta-tracking";
import {
  CREATOR_APPLICATION_ROUTE,
  STARTER_PACK_EVENTS,
  STARTER_PACK_FILENAME,
  STARTER_PACK_URL,
} from "@/lib/starter-pack";

const TITLE = "Your Creator Starter Pack Is On Its Way | AurumVault";
const DESCRIPTION =
  "Thanks for requesting the AurumVault Digital Creator Starter Pack. Check your inbox, or download it right here.";

export const Route = createFileRoute("/creator-starter-pack_/thank-you")({
  validateSearch: (search: Record<string, unknown>) => ({
    resent: search.resent ? 1 : undefined,
  }),
  component: ThankYouPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
});

function ThankYouPage() {
  const { resent } = Route.useSearch();

  return (
    <div className="relative min-h-screen bg-navy text-white">
      <header className="border-b border-white/10 bg-navy/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3 md:px-8">
          <Link to="/" className="font-display text-lg font-bold text-white">
            AurumVault
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-16 text-center md:px-8 md:py-24">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold">
          <CheckCircle2 size={30} aria-hidden="true" />
        </span>
        <h1 className="mt-6 font-display text-3xl leading-tight !text-white md:text-4xl">
          Your Creator Starter Pack is on its way
        </h1>
        <p className="mt-4 text-base text-white/75">
          {resent
            ? "You were already on the list, so we've sent the Starter Pack again. Check your inbox."
            : "Check your inbox — it should arrive within a couple of minutes."}
        </p>
        <p className="mt-3 flex items-center justify-center gap-2 text-sm text-white/50">
          <Mail size={15} aria-hidden="true" /> Not there? Check spam or promotions.
        </p>

        <a
          href={STARTER_PACK_URL}
          download={STARTER_PACK_FILENAME}
          onClick={() => logCtaClick(STARTER_PACK_EVENTS.downloadClicked)}
          className="mt-9 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-gold px-7 text-base font-semibold text-navy transition hover:brightness-110"
        >
          <Download size={18} aria-hidden="true" /> Download it now
        </a>

        <div className="mt-14 rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-left md:p-8">
          <h2 className="font-display text-xl !text-white md:text-2xl">What's next?</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            Work through the 7-Day Creator Sprint inside the pack. When your first product is close,
            apply to sell on AurumVault — you keep 85% of every sale, paid every Friday.
          </p>
          <Link
            to={CREATOR_APPLICATION_ROUTE}
            onClick={() => logCtaClick(STARTER_PACK_EVENTS.applicationClicked)}
            className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-xl border border-gold/50 px-6 text-sm font-semibold text-gold transition hover:bg-gold hover:text-navy"
          >
            Apply to become an AurumVault Creator
          </Link>
        </div>
      </main>
    </div>
  );
}
