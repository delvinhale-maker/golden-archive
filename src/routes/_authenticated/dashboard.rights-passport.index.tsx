import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ShieldCheck,
  FileText,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Bot,
  ScrollText,
  Fingerprint,
  ShieldAlert,
} from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { getPassportHome, createPassport } from "@/lib/rights-passport.functions";
import { RIGHTS_PASSPORT_DISCLAIMER } from "@/lib/rights-passport.schema";
import { READINESS_STATUS_LABELS, type ReadinessStatus } from "@/lib/rights-passport-readiness-v2";

export const Route = createFileRoute("/_authenticated/dashboard/rights-passport/")({
  component: PassportHomePage,
});

const STATUS_TONE: Record<ReadinessStatus, string> = {
  PUBLISH_READY: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CONTROLLED_WITH_GAPS: "bg-sky-50 text-sky-700 border-sky-200",
  INCOMPLETE: "bg-amber-50 text-amber-700 border-amber-200",
  HIGH_RIGHTS_EXPOSURE: "bg-red-50 text-red-700 border-red-200",
};

function PassportHomePage() {
  const navigate = useNavigate();
  const getHomeFn = useServerFn(getPassportHome);
  const createFn = useServerFn(createPassport);

  const { data, isLoading } = useQuery({
    queryKey: ["rights-passport", "home"],
    queryFn: () => getHomeFn(),
  });

  async function handleCreate() {
    try {
      const passport = await createFn({ data: {} });
      navigate({
        to: "/dashboard/rights-passport/$passportId",
        params: { passportId: passport.id },
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't create your passport");
    }
  }

  if (isLoading) {
    return (
      <PublisherShell accent={ACCENTS.help}>
        <p className="text-mute">Loading…</p>
      </PublisherShell>
    );
  }

  if (!data?.passport) {
    return (
      <PublisherShell accent={ACCENTS.help}>
        <h1 className="font-display text-3xl text-navy">Digital Rights Passport</h1>
        <p className="text-mute text-sm mt-1 max-w-xl">
          Your identity. Your work. Your rules. Build a versioned, organized record of who you are,
          what you've made, and how AI and licensing may use it.
        </p>
        <div className="mt-8 rounded-2xl border border-ink/10 bg-white p-8 text-center max-w-xl">
          <ShieldCheck className="mx-auto text-mute" size={32} />
          <p className="font-display text-xl text-navy mt-3">No passport yet</p>
          <p className="text-sm text-mute mt-2">
            Create your Rights Passport to start building your identity and asset record.
          </p>
          <button
            type="button"
            onClick={handleCreate}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy hover:brightness-105"
          >
            Create / Continue Passport <ArrowRight size={15} />
          </button>
        </div>
        <p className="mt-6 max-w-xl text-xs text-mute italic">{RIGHTS_PASSPORT_DISCLAIMER}</p>
      </PublisherShell>
    );
  }

  const { passport, readiness, assetCount, licenseCount, evidenceCount, openReviewCount } = data;
  const params = { passportId: passport.id };

  const sections = [
    {
      to: "/dashboard/rights-passport/$passportId" as const,
      icon: FileText,
      label: "Profile",
      detail: passport.public_professional_name ? "Complete" : "Needs identity fields",
    },
    {
      to: "/dashboard/rights-passport/$passportId/assets" as const,
      icon: Sparkles,
      label: "Rights Assets",
      detail: `${assetCount} registered`,
    },
    {
      to: "/dashboard/rights-passport/$passportId/ai-consent" as const,
      icon: Bot,
      label: "AI Consent",
      detail: "Manage declared uses",
    },
    {
      to: "/dashboard/rights-passport/$passportId/licenses" as const,
      icon: ScrollText,
      label: "Licenses",
      detail: `${licenseCount} on record`,
    },
    {
      to: "/dashboard/rights-passport/$passportId/evidence" as const,
      icon: Fingerprint,
      label: "Evidence",
      detail: `${evidenceCount} records`,
    },
    {
      to: "/dashboard/rights-passport/$passportId/review" as const,
      icon: ShieldAlert,
      label: "Risk Review",
      detail: `${openReviewCount} open`,
    },
  ];

  return (
    <PublisherShell accent={ACCENTS.help}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-navy">Digital Rights Passport</h1>
          <p className="text-mute text-sm mt-1">
            {passport.public_professional_name || "Untitled passport"} · v{passport.version} ·{" "}
            <span className="font-semibold">{passport.status}</span>
          </p>
        </div>
        <Link
          to="/dashboard/rights-passport/$passportId"
          params={params}
          className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy hover:brightness-105"
        >
          Create / Continue Passport <ArrowRight size={15} />
        </Link>
      </div>

      {readiness && (
        <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-mute">Digital Rights Readiness Score™</p>
              <p className="font-display text-3xl text-navy mt-1">
                {readiness.score}
                <span className="text-base text-mute">/100</span>
              </p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold ${STATUS_TONE[readiness.status]}`}
            >
              {READINESS_STATUS_LABELS[readiness.status]}
            </span>
          </div>
          {readiness.publishBlocked && readiness.blockers.length > 0 && (
            <div className="mt-3 space-y-1">
              {readiness.blockers.map((b) => (
                <p key={b} className="text-xs text-red-700 inline-flex items-center gap-1.5">
                  <ShieldAlert size={12} /> {b}
                </p>
              ))}
            </div>
          )}
          {readiness.primaryGap && (
            <p className="mt-3 text-sm text-navy">
              <strong>Recommended next move:</strong> {readiness.recommendedNextMove}
            </p>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            params={params}
            className="rounded-xl border border-ink/10 bg-white p-4 hover:border-navy/30"
          >
            <s.icon size={18} className="text-navy" />
            <p className="text-sm font-semibold text-navy mt-2">{s.label}</p>
            <p className="text-xs text-mute mt-1">{s.detail}</p>
          </Link>
        ))}
      </div>

      <p className="mt-8 max-w-xl text-xs text-mute italic">{RIGHTS_PASSPORT_DISCLAIMER}</p>
    </PublisherShell>
  );
}
