import { createFileRoute, Link } from "@tanstack/react-router";
import { Clapperboard, Film, Video } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";

export const Route = createFileRoute("/_authenticated/creator-studio")({
  component: CreatorStudioHome,
});

/**
 * Creator Studio(tm) landing page. Customer-facing only -- wording stays
 * plain throughout (see docs/creator-studio/README.md's UX rules). Whether
 * the feature is actually turned on is enforced server-side by every
 * creator-studio function (requireCreatorStudioEnabled); this page renders
 * unconditionally and the wizard fails closed with a plain message if the
 * flag is off.
 */
function CreatorStudioHome() {
  return (
    <PublisherShell accent={ACCENTS.creatorStudio}>
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7A2E52]/30 bg-[#7A2E52]/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A2E52]">
          <Clapperboard size={13} aria-hidden="true" /> AurumVault Creator Studio
        </span>
        <h1 className="mt-4 font-display text-3xl leading-tight text-navy md:text-4xl">
          Your product. Your brand. Your promo—done.
        </h1>
        <p className="mt-3 text-base text-mute md:text-lg">
          Turn your digital product into a polished promotional video without learning video editing
          software.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/creator-studio/new"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-8 py-4 text-base font-semibold text-navy shadow-sm transition hover:bg-gold/90 sm:w-auto"
          >
            <Video size={18} aria-hidden="true" /> Create My Video
          </Link>
          <Link
            to="/creator-studio/library"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-white px-8 py-4 text-base font-semibold text-navy transition hover:border-[#7A2E52]/50 sm:w-auto"
          >
            <Film size={18} aria-hidden="true" /> View My Videos
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            title: "Choose your goal",
            body: "eBook, course, planner, TikTok ad, Reel, trailer — you pick.",
          },
          {
            title: "Add your assets",
            body: "Cover, screenshots, logo, message and call to action.",
          },
          { title: "Get your video", body: "Pick a style and duration. We build the rest." },
        ].map((step) => (
          <div key={step.title} className="rounded-2xl border border-ink/10 bg-white p-5 text-left">
            <h3 className="font-display text-base text-navy">{step.title}</h3>
            <p className="mt-1.5 text-sm text-mute">{step.body}</p>
          </div>
        ))}
      </div>
    </PublisherShell>
  );
}
