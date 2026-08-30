import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldX, Fingerprint } from "lucide-react";
import { AVLogo } from "@/components/marketplace/AVLogo";
import { getPublicRightsCard } from "@/lib/rights-passport-publish.functions";

export const Route = createFileRoute("/rights/$publicId")({
  component: PublicRightsCardPage,
});

const CURATED_AI_SUMMARY = [
  "GENERAL_AI_TRAINING",
  "VOICE_CLONE",
  "SYNTHETIC_VOICE",
  "DIGITAL_REPLICA",
  "GENERATED_ADVERTISEMENT",
  "COMMERCIAL_MODEL_OUTPUT",
  "POSTHUMOUS_ESTATE_USE",
];

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const PERMISSION_TONE: Record<string, string> = {
  ALLOWED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "ALLOWED WITH TERMS": "bg-emerald-50 text-emerald-700 border-emerald-200",
  PROHIBITED: "bg-red-50 text-red-700 border-red-200",
  "CASE-BY-CASE": "bg-amber-50 text-amber-700 border-amber-200",
  "CONTACT FOR LICENSE": "bg-sky-50 text-sky-700 border-sky-200",
  "REVIEW REQUIRED": "bg-ink/5 text-mute border-ink/10",
};

function PublicRightsCardPage() {
  const { publicId } = Route.useParams();
  const getCardFn = useServerFn(getPublicRightsCard);

  const { data, isLoading } = useQuery({
    queryKey: ["public-rights-card", publicId],
    queryFn: () => getCardFn({ data: { publicId } }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <p className="text-sm text-mute">Loading…</p>
      </div>
    );
  }

  if (!data?.found) {
    return (
      <div className="min-h-screen bg-ivory flex flex-col items-center justify-center gap-4 px-6 text-center">
        <AVLogo dark />
        <p className="font-display text-2xl text-navy">Passport not found</p>
        <p className="text-sm text-mute max-w-sm">
          This link doesn't correspond to a published AurumVault Digital Rights Passport.
        </p>
      </div>
    );
  }

  const payload = data.payload as any;

  return (
    <div className="min-h-screen bg-ivory">
      <div className="bg-navy py-8 px-6">
        <div className="mx-auto max-w-2xl">
          <AVLogo />
          <p className="mt-6 text-xs font-bold uppercase tracking-widest text-gold">
            AurumVault Digital Rights Passport™
          </p>
          <p className="mt-1 font-display text-3xl text-white">
            {payload.subject.public_name ?? "Unnamed Passport"}
          </p>
          {payload.subject.professional_name && (
            <p className="text-sm text-white/70 mt-1">{payload.subject.professional_name}</p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-8">
        {data.revoked && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
            <ShieldX className="mx-auto text-red-600" size={24} />
            <p className="mt-2 font-display text-xl text-red-700">PASSPORT REVOKED</p>
            <p className="text-xs text-red-700 mt-1">This passport is no longer active.</p>
          </div>
        )}

        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-navy/5 px-2.5 py-1 text-[10px] font-bold text-navy">
              v{payload.passport.passport_version}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                data.revoked
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              {data.revoked ? "REVOKED" : "ACTIVE"}
            </span>
            <span className="rounded-full bg-gold/10 px-2.5 py-1 text-[10px] font-bold text-navy">
              {payload.subject.verification_level}
            </span>
          </div>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-mute">Rights Entity</dt>
              <dd className="text-navy">{payload.subject.rights_entity ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-mute">Jurisdiction</dt>
              <dd className="text-navy">{payload.subject.jurisdiction ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-mute">Rights Contact</dt>
              <dd className="text-navy">{payload.subject.rights_contact.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-mute">Rights URL</dt>
              <dd className="text-navy break-all">{payload.subject.rights_contact.url ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-mute">Effective Date</dt>
              <dd className="text-navy">{payload.passport.effective_at ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-mute">Published</dt>
              <dd className="text-navy">{new Date(data.publishedAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-mute">AI Rights Summary</p>
          <div className="mt-3 space-y-2">
            {CURATED_AI_SUMMARY.map((useCase) => {
              const entry = payload.ai_permissions.find((p: any) => p.use_case === useCase);
              const value = entry?.permission ?? "NOT DECLARED";
              return (
                <div key={useCase} className="flex items-center justify-between gap-2">
                  <p className="text-sm text-navy">{humanize(useCase)}</p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${PERMISSION_TONE[value] ?? "bg-ink/5 text-mute border-ink/10"}`}
                  >
                    {value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {payload.assets.length > 0 && (
          <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-mute">Rights Assets</p>
            <div className="mt-3 space-y-2">
              {payload.assets.map((a: any, i: number) => (
                <div key={i} className="text-sm text-navy">
                  {a.name} — <span className="text-mute">{humanize(a.asset_type)}</span>
                  {a.territory && <span className="text-mute"> · {a.territory}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {payload.license_notice && (
          <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-mute">License Notice</p>
            <p className="mt-2 text-sm text-navy">{payload.license_notice}</p>
          </div>
        )}

        <div className="mt-6 flex items-center gap-2 text-xs text-mute">
          <ShieldCheck size={14} />
          <span>{payload.subject.verification_level}</span>
          <span className="mx-1">·</span>
          <Fingerprint size={14} />
          <span>Integrity ID: {data.shortIntegrityId}</span>
        </div>

        <p className="mt-6 text-xs text-mute italic">{payload.notices.legal_effect}</p>
        <p className="mt-2 text-xs text-mute/70">{payload.notices.standards}</p>
      </div>
    </div>
  );
}
