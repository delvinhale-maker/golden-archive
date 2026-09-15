import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Save, History } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import {
  getPassport,
  updatePassport,
  createNewPassportVersion,
} from "@/lib/rights-passport.functions";
import {
  RIGHTS_PASSPORT_DISCLAIMER,
  VERIFICATION_LEVELS,
  VERIFICATION_LEVEL_LABELS,
  type PassportUpsertInput,
  type VerificationLevel,
  type PassportStatus,
} from "@/lib/rights-passport.schema";

export const Route = createFileRoute("/_authenticated/dashboard/rights-passport/$passportId")({
  component: PassportEditPage,
});

const EMPTY: PassportUpsertInput = {
  publicProfessionalName: "",
  legalName: "",
  stageBrandName: "",
  primaryRole: "",
  jurisdiction: "",
  rightsContactEmail: "",
  rightsEntity: "",
  publicRightsUrl: "",
  verificationLevel: "SELF_DECLARED",
  representativeName: "",
  representativeContact: "",
  agentManagerName: "",
  agentManagerContact: "",
  successorEstateContact: "",
  effectiveDate: "",
  reviewFrequency: "",
  publicNotes: "",
  privateNotes: "",
};

function Field({
  label,
  value,
  onChange,
  type = "text",
  private: isPrivate,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  private?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-navy">
        {label} {isPrivate && <span className="text-[10px] text-mute font-normal">(private)</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
      />
    </label>
  );
}

function PassportEditPage() {
  const { passportId } = Route.useParams();
  const getFn = useServerFn(getPassport);
  const updateFn = useServerFn(updatePassport);
  const newVersionFn = useServerFn(createNewPassportVersion);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [status, setStatus] = useState<PassportStatus>("DRAFT");
  const [version, setVersion] = useState(1);
  const [form, setForm] = useState<PassportUpsertInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    getFn({ data: { id: passportId } })
      .then((row) => {
        setStatus(row.status);
        setVersion(row.version);
        setForm({
          publicProfessionalName: row.public_professional_name ?? "",
          legalName: row.legal_name ?? "",
          stageBrandName: row.stage_brand_name ?? "",
          primaryRole: row.primary_role ?? "",
          jurisdiction: row.jurisdiction ?? "",
          rightsContactEmail: row.rights_contact_email ?? "",
          rightsEntity: row.rights_entity ?? "",
          publicRightsUrl: row.public_rights_url ?? "",
          verificationLevel: row.verification_level,
          representativeName: row.representative_name ?? "",
          representativeContact: row.representative_contact ?? "",
          agentManagerName: row.agent_manager_name ?? "",
          agentManagerContact: row.agent_manager_contact ?? "",
          successorEstateContact: row.successor_estate_contact ?? "",
          effectiveDate: row.effective_date ?? "",
          reviewFrequency: row.review_frequency ?? "",
          publicNotes: row.public_notes ?? "",
          privateNotes: row.private_notes ?? "",
        });
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passportId]);

  function set<K extends keyof PassportUpsertInput>(key: K, value: string) {
    setForm((f: PassportUpsertInput) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Empty strings should clear a field, not fail the email/url validators.
      const payload: Record<string, unknown> = { id: passportId };
      for (const [k, v] of Object.entries(form)) {
        payload[k] = v === "" ? null : v;
      }
      await updateFn({ data: payload as any });
      toast.success("Passport saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save passport");
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate() {
    setActivating(true);
    try {
      await updateFn({ data: { id: passportId, status: "ACTIVE" } as any });
      setStatus("ACTIVE");
      toast.success("Passport activated — this is now your current version");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't activate passport");
    } finally {
      setActivating(false);
    }
  }

  async function handleNewVersion() {
    try {
      const draft = await newVersionFn({ data: { id: passportId } });
      toast.success(`Draft v${draft.version} created — edit it, then activate when ready`);
      window.location.href = `/dashboard/rights-passport/${draft.id}`;
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't create new version");
    }
  }

  if (loading) {
    return (
      <PublisherShell accent={ACCENTS.help}>
        <p className="text-mute">Loading…</p>
      </PublisherShell>
    );
  }

  if (notFound) {
    return (
      <PublisherShell accent={ACCENTS.help}>
        <p className="text-navy font-semibold">Passport not found.</p>
        <Link to="/dashboard/rights-passport" className="text-sm text-mute hover:text-navy">
          Back to Passport Home
        </Link>
      </PublisherShell>
    );
  }

  return (
    <PublisherShell accent={ACCENTS.help}>
      <Link
        to="/dashboard/rights-passport"
        className="inline-flex items-center gap-1 text-sm text-mute hover:text-navy"
      >
        <ArrowLeft size={14} /> Back to Passport Home
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-navy">
          Passport Details{" "}
          <span className="text-base text-mute font-normal">
            v{version} · {status}
          </span>
        </h1>
        <div className="flex gap-2">
          {status === "DRAFT" && (
            <button
              type="button"
              onClick={handleActivate}
              disabled={activating}
              className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-semibold text-navy disabled:opacity-50"
            >
              {activating ? "Activating…" : "Activate this version"}
            </button>
          )}
          {status === "ACTIVE" && (
            <button
              type="button"
              onClick={handleNewVersion}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 px-4 py-2 text-sm font-semibold text-navy"
            >
              <History size={14} /> Create New Version
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-bold text-navy disabled:opacity-50"
          >
            <Save size={14} /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-ink/10 bg-white p-5 space-y-4">
          <h2 className="font-display text-lg text-navy">Identity</h2>
          <Field
            label="Public / professional name"
            value={form.publicProfessionalName ?? ""}
            onChange={(v) => set("publicProfessionalName", v)}
          />
          <Field
            label="Legal name"
            value={form.legalName ?? ""}
            onChange={(v) => set("legalName", v)}
            private
          />
          <Field
            label="Professional / stage / brand name"
            value={form.stageBrandName ?? ""}
            onChange={(v) => set("stageBrandName", v)}
          />
          <Field
            label="Primary role"
            value={form.primaryRole ?? ""}
            onChange={(v) => set("primaryRole", v)}
          />
          <Field
            label="Country / jurisdiction"
            value={form.jurisdiction ?? ""}
            onChange={(v) => set("jurisdiction", v)}
          />
        </section>

        <section className="rounded-2xl border border-ink/10 bg-white p-5 space-y-4">
          <h2 className="font-display text-lg text-navy">Contact & Verification</h2>
          <Field
            label="Rights contact email"
            value={form.rightsContactEmail ?? ""}
            onChange={(v) => set("rightsContactEmail", v)}
            type="email"
          />
          <Field
            label="Business / rights entity"
            value={form.rightsEntity ?? ""}
            onChange={(v) => set("rightsEntity", v)}
          />
          <Field
            label="Public rights URL"
            value={form.publicRightsUrl ?? ""}
            onChange={(v) => set("publicRightsUrl", v)}
            type="url"
          />
          <label className="block">
            <span className="text-sm font-medium text-navy">Verification level</span>
            <select
              value={form.verificationLevel as VerificationLevel}
              onChange={(e) => set("verificationLevel", e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm text-navy"
            >
              {VERIFICATION_LEVELS.map((v) => (
                <option key={v} value={v}>
                  {VERIFICATION_LEVEL_LABELS[v]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-mute">
              This describes how this record was compiled — it is not a certification.
            </p>
          </label>
        </section>

        <section className="rounded-2xl border border-ink/10 bg-white p-5 space-y-4">
          <h2 className="font-display text-lg text-navy">Representation</h2>
          <Field
            label="Representative / attorney"
            value={form.representativeName ?? ""}
            onChange={(v) => set("representativeName", v)}
          />
          <Field
            label="Representative contact"
            value={form.representativeContact ?? ""}
            onChange={(v) => set("representativeContact", v)}
          />
          <Field
            label="Agent / manager"
            value={form.agentManagerName ?? ""}
            onChange={(v) => set("agentManagerName", v)}
          />
          <Field
            label="Agent / manager contact"
            value={form.agentManagerContact ?? ""}
            onChange={(v) => set("agentManagerContact", v)}
          />
          <Field
            label="Successor / estate contact"
            value={form.successorEstateContact ?? ""}
            onChange={(v) => set("successorEstateContact", v)}
          />
        </section>

        <section className="rounded-2xl border border-ink/10 bg-white p-5 space-y-4">
          <h2 className="font-display text-lg text-navy">Review & Notes</h2>
          <Field
            label="Effective date"
            value={form.effectiveDate ?? ""}
            onChange={(v) => set("effectiveDate", v)}
            type="date"
          />
          <Field
            label="Review frequency"
            value={form.reviewFrequency ?? ""}
            onChange={(v) => set("reviewFrequency", v)}
          />
          <label className="block">
            <span className="text-sm font-medium text-navy">Public notes</span>
            <textarea
              value={form.publicNotes ?? ""}
              onChange={(e) => set("publicNotes", e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-navy">
              Private notes <span className="text-[10px] text-mute font-normal">(private)</span>
            </span>
            <textarea
              value={form.privateNotes ?? ""}
              onChange={(e) => set("privateNotes", e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
          </label>
        </section>
      </div>

      <p className="mt-8 max-w-xl text-xs text-mute italic">{RIGHTS_PASSPORT_DISCLAIMER}</p>
    </PublisherShell>
  );
}
