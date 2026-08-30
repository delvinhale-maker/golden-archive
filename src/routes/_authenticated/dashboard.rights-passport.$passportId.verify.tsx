import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, XCircle, ShieldCheck, AlertTriangle } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { getPassport } from "@/lib/rights-passport.functions";
import { getVerifyStatus } from "@/lib/rights-passport-publish.functions";
import { READINESS_STATUS_LABELS, type ReadinessStatus } from "@/lib/rights-passport-readiness-v2";
import type { VerificationCategory } from "@/lib/rights-passport-verify";
import { RIGHTS_PASSPORT_DISCLAIMER } from "@/lib/rights-passport.schema";

export const Route = createFileRoute(
  "/_authenticated/dashboard/rights-passport/$passportId/verify",
)({
  component: VerifyPage,
});

const STATUS_TONE: Record<ReadinessStatus, string> = {
  PUBLISH_READY: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CONTROLLED_WITH_GAPS: "bg-sky-50 text-sky-700 border-sky-200",
  INCOMPLETE: "bg-amber-50 text-amber-700 border-amber-200",
  HIGH_RIGHTS_EXPOSURE: "bg-red-50 text-red-700 border-red-200",
};

const CATEGORY_ORDER: VerificationCategory[] = [
  "IDENTITY",
  "ASSETS",
  "AI_CONSENT",
  "LICENSES",
  "EVIDENCE",
  "VERSION",
  "LEGACY",
  "PRIVACY",
];

const CATEGORY_LABELS: Record<VerificationCategory, string> = {
  IDENTITY: "Identity",
  ASSETS: "Assets",
  AI_CONSENT: "AI Consent",
  LICENSES: "Licenses",
  EVIDENCE: "Evidence",
  VERSION: "Version",
  LEGACY: "Legacy",
  PRIVACY: "Privacy",
};

function VerifyPage() {
  const { passportId } = Route.useParams();
  const getPassportFn = useServerFn(getPassport);
  const getVerifyFn = useServerFn(getVerifyStatus);

  const [passportKey, setPassportKey] = useState<string | null>(null);

  useEffect(() => {
    getPassportFn({ data: { id: passportId } })
      .then((p) => setPassportKey(p.passport_key))
      .catch(() => setPassportKey(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passportId]);

  const {
    data: verification,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["rights-passport", "verify", passportKey],
    queryFn: () => getVerifyFn({ data: { passportKey: passportKey! } }),
    enabled: !!passportKey,
    retry: false,
  });

  return (
    <PublisherShell accent={ACCENTS.help}>
      <Link
        to="/dashboard/rights-passport"
        className="inline-flex items-center gap-1 text-sm text-mute hover:text-navy"
      >
        <ArrowLeft size={14} /> Back to Passport Home
      </Link>
      <h1 className="mt-3 font-display text-3xl text-navy">Verify Passport™</h1>
      <p className="text-sm text-mute mt-1 max-w-2xl">
        The final quality gate before publication. Review every check below — blockers must be
        resolved before you can publish, regardless of your numerical score.
      </p>

      {isLoading && <p className="mt-6 text-sm text-mute">Loading…</p>}

      {error && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          {(error as any)?.message ?? "This passport has no ACTIVE workspace version yet."}
        </div>
      )}

      {verification && (
        <>
          <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-mute">Digital Rights Readiness Score™</p>
                <p className="font-display text-3xl text-navy mt-1">
                  {verification.score}
                  <span className="text-base text-mute">/100</span>
                </p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-bold ${STATUS_TONE[verification.status]}`}
              >
                {READINESS_STATUS_LABELS[verification.status]}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-mute sm:grid-cols-4">
              <p>Version: v{verification.version}</p>
              <p>Open flags: {verification.openReviewFlags}</p>
              <p>
                Last updated:{" "}
                {verification.lastUpdated
                  ? new Date(verification.lastUpdated).toLocaleDateString()
                  : "—"}
              </p>
              <p>Primary gap: {verification.primaryGap ?? "None"}</p>
            </div>

            <div
              className="mt-4 rounded-xl border p-4"
              style={{ borderColor: verification.readyToPublish ? "#10b98155" : "#ef444455" }}
            >
              {verification.readyToPublish ? (
                <p className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700">
                  <ShieldCheck size={16} /> READY TO PUBLISH
                </p>
              ) : (
                <div>
                  <p className="inline-flex items-center gap-2 text-sm font-bold text-red-700">
                    <AlertTriangle size={16} /> Publish blocked
                  </p>
                  <ul className="mt-2 space-y-1">
                    {verification.blockers.map((b) => (
                      <li key={b} className="text-xs text-red-700">
                        • {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-5">
            {CATEGORY_ORDER.map((category) => {
              const checks = verification.checks.filter((c) => c.category === category);
              if (checks.length === 0) return null;
              return (
                <div key={category} className="rounded-2xl border border-ink/10 bg-white p-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-mute">
                    {CATEGORY_LABELS[category]}
                  </p>
                  <div className="mt-3 space-y-2.5">
                    {checks.map((c) => (
                      <div key={c.id} className="flex items-start gap-2.5">
                        {c.passed ? (
                          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                        ) : (
                          <XCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm text-navy">
                            {c.label}
                            {c.blocking && !c.passed && (
                              <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                BLOCKS PUBLISH
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-mute">{c.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-end">
            <Link
              to="/dashboard/rights-passport/$passportId/generate"
              params={{ passportId }}
              className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold ${
                verification.readyToPublish
                  ? "bg-gold text-navy hover:brightness-105"
                  : "bg-ink/10 text-mute pointer-events-none"
              }`}
            >
              Continue to Export Center
            </Link>
          </div>
        </>
      )}

      <p className="mt-8 max-w-xl text-xs text-mute italic">{RIGHTS_PASSPORT_DISCLAIMER}</p>
    </PublisherShell>
  );
}
