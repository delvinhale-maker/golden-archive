import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { getPassport } from "@/lib/rights-passport.functions";
import { listAiConsents, upsertAiConsent } from "@/lib/rights-passport-ai-consent.functions";
import {
  AI_USE_CASES,
  AI_USE_CASE_COPY,
  HIGH_RISK_AI_USE_CASES,
  PERMISSION_VALUES,
  PERMISSION_LABELS,
  type Permission,
} from "@/lib/rights-passport-workspace.schema";
import { RIGHTS_PASSPORT_DISCLAIMER } from "@/lib/rights-passport.schema";

export const Route = createFileRoute(
  "/_authenticated/dashboard/rights-passport/$passportId/ai-consent",
)({
  component: AiConsentPage,
});

function AiConsentPage() {
  const { passportId } = Route.useParams();
  const queryClient = useQueryClient();
  const getPassportFn = useServerFn(getPassport);
  const listFn = useServerFn(listAiConsents);
  const upsertFn = useServerFn(upsertAiConsent);

  const [passportKey, setPassportKey] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    getPassportFn({ data: { id: passportId } })
      .then((p) => setPassportKey(p.passport_key))
      .catch(() => setPassportKey(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passportId]);

  const { data: consents } = useQuery({
    queryKey: ["rights-passport", "ai-consent", passportKey],
    queryFn: () => listFn({ data: { passportKey: passportKey! } }),
    enabled: !!passportKey,
  });

  const byUseCase = new Map((consents ?? []).map((c) => [c.use_case, c]));
  const declaredCount = consents?.length ?? 0;

  async function handleSetPermission(useCase: string, permission: Permission) {
    if (!passportKey) return;
    setSaving(useCase);
    try {
      await upsertFn({ data: { passportKey, assetId: null, useCase: useCase as any, permission } });
      queryClient.invalidateQueries({ queryKey: ["rights-passport", "ai-consent", passportKey] });
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save");
    } finally {
      setSaving(null);
    }
  }

  return (
    <PublisherShell accent={ACCENTS.help}>
      <Link
        to="/dashboard/rights-passport"
        className="inline-flex items-center gap-1 text-sm text-mute hover:text-navy"
      >
        <ArrowLeft size={14} /> Back to Passport Home
      </Link>
      <h1 className="mt-3 font-display text-3xl text-navy">AI Consent Builder™</h1>
      <p className="text-sm text-mute mt-1">
        {declaredCount}/{AI_USE_CASES.length} uses declared. Anything not declared below is treated
        as <strong>NOT DECLARED</strong> — never as an implicit allow.
      </p>

      <div className="mt-6 space-y-3">
        {AI_USE_CASES.map((useCase) => {
          const copy = AI_USE_CASE_COPY[useCase];
          const row = byUseCase.get(useCase);
          const isHighRisk = HIGH_RISK_AI_USE_CASES.includes(useCase);
          return (
            <div
              key={useCase}
              className={`rounded-xl border bg-white p-4 ${isHighRisk ? "border-amber-300" : "border-ink/10"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-navy">{copy.label}</p>
                    {isHighRisk && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        <AlertTriangle size={10} /> HIGH RISK
                      </span>
                    )}
                    {!row && (
                      <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-bold text-mute">
                        NOT DECLARED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-mute mt-1">{copy.description}</p>
                </div>
                <select
                  value={row?.permission ?? ""}
                  disabled={saving === useCase}
                  onChange={(e) => handleSetPermission(useCase, e.target.value as Permission)}
                  className="rounded-lg border border-ink/15 px-3 py-2 text-sm text-navy shrink-0"
                >
                  <option value="" disabled>
                    Not declared — choose one
                  </option>
                  {PERMISSION_VALUES.map((p) => (
                    <option key={p} value={p}>
                      {PERMISSION_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 max-w-xl text-xs text-mute italic">{RIGHTS_PASSPORT_DISCLAIMER}</p>
    </PublisherShell>
  );
}
