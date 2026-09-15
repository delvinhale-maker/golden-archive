import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  FileText,
  Infinity as InfinityIcon,
  Loader2,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { supabase } from "@/integrations/supabase/client";
import { StripeEmbeddedWalletPlanCheckout } from "@/components/StripeEmbeddedCheckout";
import { getStripeEnvironment } from "@/lib/stripe";
import { createWalletBillingPortal } from "@/lib/license-wallet-billing.functions";
import { Field, StatusPill, inputCls } from "@/components/wallet/WalletUi";
import {
  getWalletHome,
  createWalletDocument,
  saveWalletLocation,
  deleteWalletLocation,
  saveWalletReminderSettings,
  WALLET_BUCKET,
  type WalletDocument,
} from "@/lib/license-wallet.functions";
import {
  CATEGORY_LABELS,
  LICENSE_WALLET_CATEGORIES,
  STATUS_LABELS,
  WALLET_ACCEPT,
  WALLET_PLANS,
  REMINDER_OFFSETS,
  computeWalletStatus,
  daysUntil,
  formatPlanPrice,
  reminderOffsetLabel,
  summarizeStatuses,
  walletBillingConfigured,
  walletPlanCheckoutEnabled,
  walletFileError,
  type LicenseWalletCategory,
  type WalletStatus,
} from "@/lib/license-wallet";

export const Route = createFileRoute("/_authenticated/dashboard/license-wallet/")({
  head: () => ({
    meta: [
      { title: "Business Certificate & License Wallet™ | AurumVault" },
      {
        name: "description",
        content:
          "Keep every business licence, permit, insurance certificate and registration in one private, reminder-driven wallet inside AurumVault.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LicenseWalletPage,
});

function LicenseWalletPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const homeFn = useServerFn(getWalletHome);
  const createFn = useServerFn(createWalletDocument);
  const saveLocationFn = useServerFn(saveWalletLocation);
  const deleteLocationFn = useServerFn(deleteWalletLocation);
  const saveRemindersFn = useServerFn(saveWalletReminderSettings);
  const portalFn = useServerFn(createWalletBillingPortal);
  const [checkoutTier, setCheckoutTier] = useState<
    "SOLO" | "BUSINESS" | "MULTI_LOCATION" | null
  >(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["license-wallet", "home"],
    queryFn: () => homeFn(),
    retry: false,
  });

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | LicenseWalletCategory>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | WalletStatus>("ALL");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newLocation, setNewLocation] = useState("");

  const documents = data?.documents ?? [];
  const counts = useMemo(() => summarizeStatuses(documents), [documents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (categoryFilter !== "ALL" && d.category !== categoryFilter) return false;
      if (statusFilter !== "ALL" && computeWalletStatus(d) !== statusFilter) return false;
      if (!q) return true;
      return [d.title, d.issuer, d.doc_number, d.notes]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [documents, search, categoryFilter, statusFilter]);

  const upcoming = useMemo(
    () =>
      documents
        .filter((d) => !d.no_expiration && d.expiration_date)
        .filter((d) => {
          const s = computeWalletStatus(d);
          return s === "EXPIRING_SOON" || s === "EXPIRED";
        })
        .slice(0, 6),
    [documents],
  );

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["license-wallet"] });
  }

  async function handleCreate(form: HTMLFormElement) {
    const fd = new FormData(form);
    const file = fd.get("file") as File | null;
    const noExpiration = fd.get("no_expiration") === "on";
    const title = String(fd.get("title") ?? "").trim();
    if (!title) return toast.error("Add a title for this document.");
    if (!noExpiration && !fd.get("expiration_date")) {
      return toast.error("Add an expiration date, or mark it as no expiration.");
    }

    setSaving(true);
    try {
      let filePayload: {
        file_path: string;
        file_name: string;
        file_mime: "application/pdf" | "image/jpeg" | "image/png";
        file_size_bytes: number;
      } | null = null;

      if (file && file.size > 0) {
        const err = walletFileError(file.name, file.type, file.size);
        if (err) throw new Error(err);
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) throw new Error("Please sign in again.");
        const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const path = `${uid}/${Date.now()}-${safe}`;
        const up = await supabase.storage.from(WALLET_BUCKET).upload(path, file, { upsert: false });
        if (up.error) throw new Error("We couldn't upload that file. Please try again.");
        filePayload = {
          file_path: path,
          file_name: file.name,
          file_mime: (file.type || "application/pdf") as "application/pdf",
          file_size_bytes: file.size,
        };
      }

      const created = await createFn({
        data: {
          title,
          category: String(fd.get("category") ?? "OTHER") as LicenseWalletCategory,
          issuer: String(fd.get("issuer") ?? "") || null,
          doc_number: String(fd.get("doc_number") ?? "") || null,
          issue_date: String(fd.get("issue_date") ?? "") || null,
          expiration_date: noExpiration ? null : String(fd.get("expiration_date") ?? "") || null,
          no_expiration: noExpiration,
          location_id: String(fd.get("location_id") ?? "") || null,
          notes: String(fd.get("notes") ?? "") || null,
          file: filePayload,
        },
      });
      toast.success("Document added to your wallet");
      setShowAdd(false);
      await refresh();
      navigate({
        to: "/dashboard/license-wallet/$documentId",
        params: { documentId: created.id },
      });
    } catch (e: any) {
      toast.error(e?.message ?? "We couldn't save this document.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <PublisherShell accent={ACCENTS.help}>
        <p className="flex items-center gap-2 text-mute">
          <Loader2 className="animate-spin" size={16} /> Loading your wallet…
        </p>
      </PublisherShell>
    );
  }

  if (error || !data) {
    return (
      <PublisherShell accent={ACCENTS.help}>
        <h1 className="font-display text-3xl text-navy">Business Certificate &amp; License Wallet™</h1>
        <div className="mt-8 max-w-xl rounded-2xl border border-ink/10 bg-white p-8 text-center">
          <AlertTriangle className="mx-auto text-mute" size={30} />
          <p className="mt-3 font-display text-xl text-navy">Temporarily unavailable</p>
          <p className="mt-2 text-sm text-mute">
            {(error as any)?.message ?? "Please try again in a moment."}
          </p>
        </div>
      </PublisherShell>
    );
  }

  const plan = data.plan;
  const planConfig = WALLET_PLANS[plan];

  return (
    <PublisherShell accent={ACCENTS.help}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-gold-ink">
            AurumVault Business Tools
          </div>
          <h1 className="mt-1 font-display text-3xl text-navy">
            Business Certificate &amp; License Wallet™
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-mute">
            Every licence, permit, insurance certificate and registration in one private place — with
            renewal reminders before anything lapses.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy hover:brightness-105"
        >
          <Plus size={16} /> Add document
        </button>
      </div>

      {/* Plan / entitlement boundary */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm">
        <ShieldCheck size={16} className="text-gold-ink" />
        <span className="font-semibold text-navy">{planConfig.label} plan</span>
        <span className="text-mute">{formatPlanPrice(plan)}</span>
        <span className="text-mute">
          · {documents.length}/{planConfig.maxDocuments} documents ·{" "}
          {data.locations.length}/{planConfig.maxLocations} locations ·{" "}
          {planConfig.remindersEnabled ? "reminders on" : "reminders not included"}
        </span>
      </div>

      {/* Dashboard cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            ["CURRENT", CheckCircle2],
            ["EXPIRING_SOON", CalendarClock],
            ["EXPIRED", AlertTriangle],
            ["NO_EXPIRATION", InfinityIcon],
          ] as [WalletStatus, typeof CheckCircle2][]
        ).map(([status, Icon]) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter((v) => (v === status ? "ALL" : status))}
            className={`rounded-2xl border bg-white p-4 text-left transition hover:border-gold ${
              statusFilter === status ? "border-gold" : "border-ink/10"
            }`}
          >
            <Icon size={18} className="text-gold-ink" />
            <p className="mt-2 font-display text-2xl text-navy">{counts[status]}</p>
            <p className="text-xs text-mute">{STATUS_LABELS[status]}</p>
          </button>
        ))}
      </div>

      {/* Add form */}
      {showAdd && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreate(e.currentTarget);
          }}
          className="mt-6 space-y-4 rounded-2xl border border-ink/10 bg-white p-5"
        >
          <h2 className="font-display text-xl text-navy">New document</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Title *">
              <input name="title" required className={inputCls} placeholder="General Liability COI" />
            </Field>
            <Field label="Category *">
              <select name="category" className={inputCls} defaultValue="INSURANCE_CERTIFICATE">
                {LICENSE_WALLET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Issuer">
              <input name="issuer" className={inputCls} placeholder="State of Texas" />
            </Field>
            <Field label="Number">
              <input name="doc_number" className={inputCls} />
            </Field>
            <Field label="Issue date">
              <input type="date" name="issue_date" className={inputCls} />
            </Field>
            <Field label="Expiration date">
              <input type="date" name="expiration_date" className={inputCls} />
            </Field>
            <Field label="Location">
              <select name="location_id" className={inputCls} defaultValue="">
                <option value="">No location</option>
                {data.locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-end gap-2 pb-2 text-sm text-navy">
              <input type="checkbox" name="no_expiration" className="size-4 accent-[#b8860b]" />
              This document does not expire
            </label>
          </div>
          <Field label="Notes">
            <textarea name="notes" rows={2} className={inputCls} />
          </Field>
          <Field label="File (PDF, JPG or PNG · up to 10 MB · stored privately)">
            <input type="file" name="file" accept={WALLET_ACCEPT} className={inputCls} />
          </Field>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
              {saving ? "Saving…" : "Save document"}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-sm font-semibold text-mute hover:text-navy"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Upcoming expirations */}
      {upcoming.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl text-navy">Upcoming expirations</h2>
          <ul className="mt-3 divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-white">
            {upcoming.map((d) => {
              const days = d.expiration_date ? daysUntil(d.expiration_date, new Date().toISOString().slice(0, 10)) : 0;
              return (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <Link
                    to="/dashboard/license-wallet/$documentId"
                    params={{ documentId: d.id }}
                    className="min-w-0 text-sm font-semibold text-navy hover:underline"
                  >
                    {d.title}
                  </Link>
                  <div className="flex items-center gap-3 text-xs text-mute">
                    <span>{d.expiration_date}</span>
                    <span>{days < 0 ? `${Math.abs(days)} days ago` : `in ${days} days`}</span>
                    <StatusPill status={computeWalletStatus(d)} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Documents */}
      <section className="mt-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="font-display text-xl text-navy">Documents</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, issuer, number"
                className="w-56 rounded-full border border-ink/15 bg-white py-2 pl-8 pr-3 text-sm"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="rounded-full border border-ink/15 bg-white px-3 py-2 text-sm"
            >
              <option value="ALL">All categories</option>
              {LICENSE_WALLET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-8 text-center">
            <FileText className="mx-auto text-mute" size={28} />
            <p className="mt-3 font-display text-lg text-navy">Your wallet is empty</p>
            <p className="mt-1 text-sm text-mute">
              Add your first certificate or licence and we'll track its renewal date for you.
            </p>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy"
            >
              <Plus size={15} /> Add document
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-ink/10 bg-white p-6 text-sm text-mute">
            No documents match these filters.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {filtered.map((d: WalletDocument) => (
              <li key={d.id} className="rounded-2xl border border-ink/10 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to="/dashboard/license-wallet/$documentId"
                    params={{ documentId: d.id }}
                    className="font-display text-lg text-navy hover:underline"
                  >
                    {d.title}
                  </Link>
                  <StatusPill status={computeWalletStatus(d)} />
                </div>
                <p className="mt-1 text-xs text-mute">
                  {CATEGORY_LABELS[d.category as LicenseWalletCategory] ?? d.category}
                  {d.issuer ? ` · ${d.issuer}` : ""}
                  {d.doc_number ? ` · #${d.doc_number}` : ""}
                </p>
                <p className="mt-2 text-xs text-mute">
                  {d.no_expiration ? "No expiration" : `Expires ${d.expiration_date ?? "—"}`}
                  {d.file_name ? " · file attached" : " · no file"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Locations */}
      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <h2 className="flex items-center gap-2 font-display text-lg text-navy">
            <MapPin size={16} className="text-gold-ink" /> Locations
          </h2>
          <ul className="mt-3 space-y-2">
            {data.locations.length === 0 && (
              <li className="text-sm text-mute">No locations yet — optional, but handy for multi-site records.</li>
            )}
            {data.locations.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 rounded-lg border border-ink/10 px-3 py-2">
                <span className="min-w-0 truncate text-sm text-navy">{l.name}</span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await deleteLocationFn({ data: { id: l.id } });
                      toast.success("Location removed");
                      await refresh();
                    } catch (e: any) {
                      toast.error(e?.message ?? "Couldn't remove that location.");
                    }
                  }}
                  className="text-mute hover:text-red-600"
                  aria-label={`Remove ${l.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newLocation.trim()) return;
              try {
                await saveLocationFn({ data: { name: newLocation.trim() } });
                setNewLocation("");
                toast.success("Location added");
                await refresh();
              } catch (err: any) {
                toast.error(err?.message ?? "Couldn't add that location.");
              }
            }}
            className="mt-3 flex gap-2"
          >
            <input
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              placeholder="Main Street Studio"
              className={inputCls}
            />
            <button type="submit" className="rounded-full bg-navy px-4 py-2 text-sm font-bold text-white">
              Add
            </button>
          </form>
        </div>

        {/* Reminder settings */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            try {
              await saveRemindersFn({
                data: {
                  enabled: fd.get("enabled") === "on",
                  recipient_email: String(fd.get("recipient_email") ?? "") || null,
                  offsets: fd.getAll("offset").map((v) => Number(v)),
                },
              });
              toast.success("Reminder settings saved");
              await refresh();
            } catch (err: any) {
              toast.error(err?.message ?? "Couldn't save your reminder settings.");
            }
          }}
          className="rounded-2xl border border-ink/10 bg-white p-5"
        >
          <h2 className="flex items-center gap-2 font-display text-lg text-navy">
            <BellRing size={16} className="text-gold-ink" /> Renewal reminders
          </h2>
          <p className="mt-2 text-sm text-mute">
            Choose exactly when you want to hear about a renewal. Reminders go out once per document
            per milestone.
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm text-navy">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={data.reminderSettings.enabled}
              className="size-4 accent-[#b8860b]"
            />
            Send me renewal reminders
          </label>
          <div className="mt-3">
            <Field label="Send reminders to">
              <input
                type="email"
                name="recipient_email"
                defaultValue={data.reminderSettings.recipient_email ?? ""}
                placeholder={data.accountEmail ?? "you@business.com"}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="mt-4">
            <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-mute">
              Reminder milestones
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {REMINDER_OFFSETS.map((offset) => (
                <label key={offset} className="flex items-center gap-2 text-sm text-navy">
                  <input
                    type="checkbox"
                    name="offset"
                    value={offset}
                    defaultChecked={data.reminderSettings.offsets.includes(offset)}
                    className="size-4 accent-[#b8860b]"
                  />
                  {reminderOffsetLabel(offset)}
                </label>
              ))}
            </div>
          </div>
          {!planConfig.remindersEnabled && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Reminder emails are included from the Solo plan up. Your settings are saved and take
              effect as soon as your plan includes reminders.
            </p>
          )}
          <button type="submit" className="mt-4 rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white">
            Save settings
          </button>
        </form>
      </section>

      {/* Plan comparison + recurring checkout (fail-closed when unconfigured) */}
      <section className="mt-6 rounded-2xl border border-ink/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy">Wallet plans</h2>
        <p className="mt-1 text-sm text-mute">
          Store the proof. See what&rsquo;s current. Get warned before anything expires.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(["SOLO", "BUSINESS", "MULTI_LOCATION"] as const).map((tier) => {
            const cfg = WALLET_PLANS[tier];
            const buyable = walletPlanCheckoutEnabled(tier) && plan !== tier;
            return (
              <div
                key={tier}
                className={`rounded-xl border p-4 ${plan === tier ? "border-gold bg-paper" : "border-ink/10"}`}
              >
                <div className="text-sm font-bold text-navy">{cfg.label}</div>
                <div className="mt-1 font-display text-2xl text-navy">{formatPlanPrice(tier)}</div>
                <ul className="mt-3 space-y-1 text-xs text-mute">
                  <li>{cfg.maxDocuments} documents</li>
                  <li>
                    {cfg.maxLocations} location{cfg.maxLocations === 1 ? "" : "s"}
                  </li>
                  <li>Renewal reminder emails</li>
                </ul>
                {plan === tier ? (
                  <div className="mt-3 text-[11px] font-bold uppercase tracking-wider text-gold-ink">
                    Your plan
                  </div>
                ) : buyable ? (
                  <button
                    type="button"
                    onClick={() => setCheckoutTier(tier)}
                    className="mt-3 w-full rounded-full bg-navy px-4 py-2 text-xs font-bold text-white hover:brightness-110"
                  >
                    Choose {cfg.label}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        {checkoutTier && (
          <div className="mt-5 rounded-xl border border-ink/10 p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-navy">
                {WALLET_PLANS[checkoutTier].label} — {formatPlanPrice(checkoutTier)}
              </p>
              <button
                type="button"
                onClick={() => setCheckoutTier(null)}
                className="text-xs font-semibold text-mute underline"
              >
                Cancel
              </button>
            </div>
            <StripeEmbeddedWalletPlanCheckout plan={checkoutTier} />
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-xs text-mute">
            {walletBillingConfigured()
              ? "Choose a plan any time — your wallet limits update as soon as the subscription is active."
              : "Plan billing activation is pending — pricing is shown for reference. Your wallet keeps working on the free preview limits until billing goes live."}
          </p>
          {walletBillingConfigured() && plan !== "FREE" && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const result = await portalFn({
                    data: {
                      returnUrl: `${window.location.origin}/dashboard/license-wallet`,
                      environment: getStripeEnvironment(),
                    },
                  });
                  if ("error" in result) throw new Error(result.error);
                  window.open(result.url, "_blank", "noopener");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Billing is unavailable.");
                }
              }}
              className="rounded-full border border-ink/15 px-4 py-2 text-xs font-bold text-navy"
            >
              Manage billing
            </button>
          )}
        </div>
      </section>
    </PublisherShell>
  );
}