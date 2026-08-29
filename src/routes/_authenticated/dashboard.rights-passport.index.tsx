import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, FileText, Sparkles, AlertTriangle, ArrowRight } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { getPassportHome, createPassport } from "@/lib/rights-passport.functions";
import { RIGHTS_PASSPORT_DISCLAIMER } from "@/lib/rights-passport.schema";

export const Route = createFileRoute("/_authenticated/dashboard/rights-passport/")({
  component: PassportHomePage,
});

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

  const { passport, readiness, assetCount, openReviewCount } = data;

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
          params={{ passportId: passport.id }}
          className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy hover:brightness-105"
        >
          Create / Continue Passport <ArrowRight size={15} />
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-ink/10 bg-white p-4">
          <p className="text-xs text-mute">Digital Rights Readiness Score™</p>
          <p className="font-display text-3xl text-navy mt-1">
            {readiness?.score ?? 0}
            <span className="text-base text-mute">/100</span>
          </p>
        </div>
        <div className="rounded-xl border border-ink/10 bg-white p-4">
          <p className="text-xs text-mute">Registered Assets</p>
          <p className="font-display text-3xl text-navy mt-1">{assetCount}</p>
        </div>
        <div className="rounded-xl border border-ink/10 bg-white p-4">
          <p className="text-xs text-mute">Open Review Flags</p>
          <p className="font-display text-3xl text-navy mt-1">{openReviewCount}</p>
        </div>
      </div>

      {readiness?.primaryGap && (
        <div className="mt-4 inline-flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            <strong>Recommended next move:</strong> {readiness.primaryGap.label}
          </span>
        </div>
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/dashboard/rights-passport/$passportId"
          params={{ passportId: passport.id }}
          className="rounded-xl border border-ink/10 bg-white p-4 hover:border-navy/30"
        >
          <FileText size={18} className="text-navy" />
          <p className="text-sm font-semibold text-navy mt-2">Passport Details</p>
          <p className="text-xs text-mute mt-1">Identity, contact, and verification level</p>
        </Link>
        <Link
          to="/dashboard/rights-passport/$passportId/assets"
          params={{ passportId: passport.id }}
          className="rounded-xl border border-ink/10 bg-white p-4 hover:border-navy/30"
        >
          <Sparkles size={18} className="text-navy" />
          <p className="text-sm font-semibold text-navy mt-2">Rights Asset Registry</p>
          <p className="text-xs text-mute mt-1">
            {assetCount} asset{assetCount === 1 ? "" : "s"} registered
          </p>
        </Link>
      </div>

      <p className="mt-8 max-w-xl text-xs text-mute italic">{RIGHTS_PASSPORT_DISCLAIMER}</p>
    </PublisherShell>
  );
}
