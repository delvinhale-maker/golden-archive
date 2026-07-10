import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyEarnings,
  getMyPayoutMethod,
  upsertPayoutMethod,
  deletePayoutMethod,
  requestPayout,
  submitTaxForm,
  listMyTaxForms,
  type MyEarningsSummary,
  type PayoutMethod,
  type TaxFormRow,
} from "@/lib/earnings.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Banknote, Wallet, Send, FileText, Loader2, CheckCircle2, Clock, XCircle, Mail, Pencil, Trash2, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/payouts")({
  component: PayoutsPage,
});

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type FieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "email";
  minLength?: number;
};
const METHOD_FIELDS: Record<PayoutMethod["method"], FieldDef[]> = {
  bank: [
    { key: "account_holder", label: "Account holder name", required: true, minLength: 2 },
    { key: "bank_name", label: "Bank name", required: true, minLength: 2 },
    { key: "account_number", label: "Account number", required: true, minLength: 4 },
    { key: "routing_number", label: "Routing / SWIFT", required: true, minLength: 4 },
    { key: "country", label: "Country", required: true, minLength: 2 },
  ],
  paypal: [{ key: "paypal_email", label: "PayPal email", placeholder: "you@example.com", required: true, type: "email" }],
  wise: [{ key: "wise_email", label: "Wise email or handle", required: true, minLength: 3 }],
  other: [{ key: "instructions", label: "Payment instructions", required: true, minLength: 10 }],
};

function validateDetails(method: PayoutMethod["method"], details: Record<string, string>): { ok: true; cleaned: Record<string, string> } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const cleaned: Record<string, string> = {};
  for (const f of METHOD_FIELDS[method]) {
    const v = (details[f.key] ?? "").trim();
    if (f.required && !v) {
      errors[f.key] = `${f.label} is required`;
      continue;
    }
    if (v && f.minLength && v.length < f.minLength) {
      errors[f.key] = `${f.label} is too short`;
      continue;
    }
    if (v && f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      errors[f.key] = "Enter a valid email address";
      continue;
    }
    if (v) cleaned[f.key] = v;
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, cleaned };
}

function PayoutsPage() {
  const [summary, setSummary] = useState<MyEarningsSummary | null>(null);
  const [method, setMethod] = useState<PayoutMethod | null>(null);
  const [taxForms, setTaxForms] = useState<TaxFormRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedMethod, setSelectedMethod] = useState<PayoutMethod["method"]>("bank");
  const [details, setDetails] = useState<Record<string, string>>({});
  const [savingMethod, setSavingMethod] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [editingMethod, setEditingMethod] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingMethod, setDeletingMethod] = useState(false);

  const [requestAmount, setRequestAmount] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [requesting, setRequesting] = useState(false);

  const [taxType, setTaxType] = useState<"W9" | "W8BEN">("W9");
  const [taxFile, setTaxFile] = useState<File | null>(null);
  const [uploadingTax, setUploadingTax] = useState(false);

  const fetchSummary = useServerFn(getMyEarnings);
  const fetchMethod = useServerFn(getMyPayoutMethod);
  const fetchTax = useServerFn(listMyTaxForms);
  const saveMethodFn = useServerFn(upsertPayoutMethod);
  const deleteMethodFn = useServerFn(deletePayoutMethod);
  const requestFn = useServerFn(requestPayout);
  const submitTaxFn = useServerFn(submitTaxForm);

  async function refresh() {
    const [s, m, t] = await Promise.all([fetchSummary(), fetchMethod(), fetchTax()]);
    setSummary(s);
    setMethod(m);
    setTaxForms(t);
    if (m) {
      setSelectedMethod(m.method);
      setDetails(m.details ?? {});
    }
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const canRequest = useMemo(() => {
    if (!summary) return false;
    if (!summary.email_verified) return false;
    if (summary.open_request) return false;
    if (!summary.has_method) return false;
    if (!summary.has_tax_form) return false;
    const cents = Math.round(parseFloat(requestAmount || "0") * 100);
    return cents >= 2500 && cents <= summary.pending_cents;
  }, [summary, requestAmount]);

  const [resendingVerify, setResendingVerify] = useState(false);
  async function resendVerification() {
    if (!summary?.email) return;
    setResendingVerify(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: summary.email,
        options: { emailRedirectTo: `${window.location.origin}/dashboard/payouts` },
      });
      if (error) throw error;
      toast.success("Verification email sent — check your inbox.");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send verification email");
    } finally {
      setResendingVerify(false);
    }
  }

  async function saveMethod() {
    const result = validateDetails(selectedMethod, details);
    if (!result.ok) {
      setFieldErrors(result.errors);
      toast.error("Fix the highlighted fields before saving.");
      return;
    }
    setFieldErrors({});
    setSavingMethod(true);
    try {
      await saveMethodFn({ data: { method: selectedMethod, details: result.cleaned } });
      setSavedAt(new Date());
      toast.success("Payout method saved");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSavingMethod(false);
    }
  }

  async function confirmRemoveMethod() {
    if (deleteConfirmText.trim().toUpperCase() !== "REMOVE") {
      toast.error('Type REMOVE to confirm.');
      return;
    }
    setDeletingMethod(true);
    try {
      await deleteMethodFn();
      toast.success("Payout method removed");
      setConfirmDelete(false);
      setDeleteConfirmText("");
      setDetails({});
      setSelectedMethod("bank");
      setEditingMethod(false);
      setSavedAt(null);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not remove payout method");
    } finally {
      setDeletingMethod(false);
    }
  }

  async function submitRequest() {
    setRequesting(true);
    try {
      const cents = Math.round(parseFloat(requestAmount) * 100);
      await requestFn({ data: { amount_cents: cents, note: requestNote || null } });
      toast.success("Payout request submitted");
      setRequestAmount("");
      setRequestNote("");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Request failed");
    } finally {
      setRequesting(false);
    }
  }

  const ALLOWED_TAX_MIMES = ["application/pdf", "image/png", "image/jpeg"];
  const MAX_TAX_BYTES = 10 * 1024 * 1024; // 10 MB

  function pickTaxFile(f: File | null) {
    if (!f) {
      setTaxFile(null);
      return;
    }
    const mime = f.type || "";
    const ext = f.name.toLowerCase().split(".").pop() ?? "";
    const okMime = ALLOWED_TAX_MIMES.includes(mime);
    const okExt = ["pdf", "png", "jpg", "jpeg"].includes(ext);
    if (!okMime || !okExt) {
      toast.error("Only PDF, PNG, or JPG files are accepted for W-9 / W-8BEN.");
      return;
    }
    if (f.size > MAX_TAX_BYTES) {
      toast.error("File is too large. Max 10 MB.");
      return;
    }
    setTaxFile(f);
  }

  async function uploadTax() {
    if (!taxFile) return;
    // Re-check on submit in case something slipped through.
    if (!ALLOWED_TAX_MIMES.includes(taxFile.type) || taxFile.size > MAX_TAX_BYTES) {
      toast.error("Invalid file. Only PDF/PNG/JPG up to 10 MB.");
      return;
    }
    setUploadingTax(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("not signed in");
      const safeName = taxFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${uid}/${taxType}-${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from("tax-forms").upload(path, taxFile, {
        upsert: false,
        contentType: taxFile.type,
      });
      if (error) throw error;
      await submitTaxFn({ data: { form_type: taxType, file_path: path } });
      toast.success("Tax form submitted");
      setTaxFile(null);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploadingTax(false);
    }
  }

  return (
    <PublisherShell accent={ACCENTS.earn}>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-navy">Payouts & Tax</h1>
          <p className="mt-1 text-mute">Track earnings, request payouts, and submit tax forms.</p>
        </div>
      </div>

      {loading || !summary ? (
        <div className="mt-8 flex items-center gap-2 text-mute">
          <Loader2 className="animate-spin" size={16} /> Loading…
        </div>
      ) : (
        <>
          {!summary.email_verified ? (
            <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 flex flex-wrap items-center gap-3">
              <Mail className="text-amber-700" size={18} />
              <div className="text-sm text-amber-900 flex-1 min-w-[220px]">
                <strong>Verify your email</strong> {summary.email ? `(${summary.email})` : ""} to request
                payouts and receive payout notifications.
              </div>
              <button
                onClick={resendVerification}
                disabled={resendingVerify}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-700 text-white px-3 py-1.5 text-sm disabled:opacity-60"
              >
                {resendingVerify ? <Loader2 className="animate-spin" size={14} /> : <Mail size={14} />}
                Resend verification
              </button>
            </div>
          ) : null}

          <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard icon={<Wallet size={18} />} label="Available balance" value={fmt(summary.pending_cents)} accent="text-emerald-700" />
            <StatCard icon={<Banknote size={18} />} label="Lifetime earnings" value={fmt(summary.lifetime_cents)} />
            <StatCard icon={<CheckCircle2 size={18} />} label="Paid out" value={fmt(summary.paid_cents)} />
          </section>


          {/* Payout method */}
          <section className="mt-10 rounded-2xl border border-navy/10 bg-white p-6">
            <h2 className="font-display text-xl text-navy">Payout method</h2>
            <p className="text-sm text-mute mt-1">
              Where should AurumVault send your payouts? Details are private and only visible to admin during payout.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(["bank", "paypal", "wise", "other"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setSelectedMethod(m);
                    setDetails({});
                    setFieldErrors({});
                    setSavedAt(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm border capitalize ${
                    selectedMethod === m ? "bg-navy text-white border-navy" : "border-navy/20 text-navy"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {METHOD_FIELDS[selectedMethod].map((f) => {
                const err = fieldErrors[f.key];
                return (
                  <label key={f.key} className="text-sm">
                    <span className="block text-navy/70 mb-1">
                      {f.label}
                      {f.required ? <span className="text-red-600 ml-0.5" aria-hidden="true">*</span> : null}
                    </span>
                    <input
                      type={f.type === "email" ? "email" : "text"}
                      value={details[f.key] ?? ""}
                      placeholder={f.placeholder}
                      aria-invalid={err ? true : undefined}
                      aria-required={f.required || undefined}
                      onChange={(e) => {
                        setDetails((d) => ({ ...d, [f.key]: e.target.value }));
                        if (fieldErrors[f.key]) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next[f.key];
                            return next;
                          });
                        }
                        if (savedAt) setSavedAt(null);
                      }}
                      className={`w-full rounded-lg border px-3 py-2 ${err ? "border-red-400 bg-red-50" : "border-navy/15"}`}
                    />
                    {err ? <span className="mt-1 block text-xs text-red-600">{err}</span> : null}
                  </label>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-mute">
              <span className="text-red-600">*</span> Required fields. All fields marked required must be filled before saving.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={saveMethod}
                disabled={savingMethod}
                className="inline-flex items-center gap-2 rounded-lg bg-navy text-white px-4 py-2 text-sm disabled:opacity-60"
              >
                {savingMethod ? <Loader2 className="animate-spin" size={14} /> : null}
                {method ? "Update method" : "Save method"}
              </button>
              {savedAt ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1 text-xs">
                  <CheckCircle2 size={14} /> Saved {savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              ) : method ? (
                <span className="text-xs text-mute">
                  Current method on file: <strong className="text-navy capitalize">{method.method}</strong>
                </span>
              ) : null}
            </div>
          </section>

          {/* Request payout */}
          <section className="mt-6 rounded-2xl border border-navy/10 bg-white p-6">
            <h2 className="font-display text-xl text-navy">Request payout</h2>
            <p className="text-sm text-mute mt-1">
              $25 minimum. One open request at a time. Admin reviews and sends via your selected method.
            </p>
            {!summary.email_verified ? (
              <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
                Verify your email address (see banner above) before requesting a payout.
              </div>
            ) : summary.open_request ? (
              <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
                Your request for {fmt(summary.open_request.amount_cents)} is{" "}
                <strong>{summary.open_request.status}</strong>.
              </div>
            ) : !summary.has_method ? (
              <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
                Save a payout method above before requesting.
              </div>
            ) : !summary.has_tax_form ? (
              <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
                Submit a W-9 (US) or W-8BEN (international) tax form below before requesting a payout.
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-[160px_1fr_auto] gap-3 items-end">
                <label className="text-sm">
                  <span className="block text-navy/70 mb-1">Amount (USD)</span>
                  <input
                    type="number"
                    min="25"
                    step="0.01"
                    max={summary.pending_cents / 100}
                    value={requestAmount}
                    onChange={(e) => setRequestAmount(e.target.value)}
                    className="w-full rounded-lg border border-navy/15 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="block text-navy/70 mb-1">Note (optional)</span>
                  <input
                    type="text"
                    value={requestNote}
                    onChange={(e) => setRequestNote(e.target.value)}
                    className="w-full rounded-lg border border-navy/15 px-3 py-2"
                  />
                </label>
                <button
                  onClick={submitRequest}
                  disabled={!canRequest || requesting}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 text-white px-4 py-2 text-sm disabled:opacity-60"
                >
                  {requesting ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                  Request
                </button>
              </div>
            )}
          </section>

          {/* Request & payout history */}
          <section className="mt-6 rounded-2xl border border-navy/10 bg-white p-6">
            <h2 className="font-display text-xl text-navy">History</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-navy/60">
                  <tr>
                    <th className="text-left font-medium py-2 pr-4">Date</th>
                    <th className="text-left font-medium py-2 pr-4">Type</th>
                    <th className="text-right font-medium py-2 pr-4">Amount</th>
                    <th className="text-left font-medium py-2 pr-4">Status</th>
                    <th className="text-left font-medium py-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.requests.map((r) => (
                    <tr key={r.id} className="border-t border-navy/5">
                      <td className="py-2 pr-4">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="py-2 pr-4">Request</td>
                      <td className="py-2 pr-4 text-right">{fmt(r.amount_cents)}</td>
                      <td className="py-2 pr-4">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-2">{r.admin_note ?? r.seller_note ?? ""}</td>
                    </tr>
                  ))}
                  {summary.payouts.map((p) => (
                    <tr key={p.id} className="border-t border-navy/5">
                      <td className="py-2 pr-4">{new Date(p.paid_at).toLocaleDateString()}</td>
                      <td className="py-2 pr-4">Payout ({p.method ?? "—"})</td>
                      <td className="py-2 pr-4 text-right">{fmt(p.amount_cents)}</td>
                      <td className="py-2 pr-4">
                        <StatusBadge status="paid" />
                      </td>
                      <td className="py-2">{p.note ?? ""}</td>
                    </tr>
                  ))}
                  {summary.requests.length === 0 && summary.payouts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-mute">
                        No payouts yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          {/* Tax forms */}
          <section className="mt-6 rounded-2xl border border-navy/10 bg-white p-6">
            <h2 className="font-display text-xl text-navy">Tax forms</h2>
            <p className="text-sm text-mute mt-1">
              US creators submit a W-9. International creators submit a W-8BEN. PDF preferred.
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="block text-navy/70 mb-1">Form type</span>
                <select
                  value={taxType}
                  onChange={(e) => setTaxType(e.target.value as "W9" | "W8BEN")}
                  className="rounded-lg border border-navy/15 px-3 py-2"
                >
                  <option value="W9">W-9 (US)</option>
                  <option value="W8BEN">W-8BEN (International)</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-navy/70 mb-1">File</span>
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
                  onChange={(e) => pickTaxFile(e.target.files?.[0] ?? null)}
                  className="text-sm"
                />
              </label>
              <button
                onClick={uploadTax}
                disabled={!taxFile || uploadingTax}
                className="inline-flex items-center gap-2 rounded-lg bg-navy text-white px-4 py-2 text-sm disabled:opacity-60"
              >
                {uploadingTax ? <Loader2 className="animate-spin" size={14} /> : <FileText size={14} />}
                Submit
              </button>
            </div>
            {taxForms.length > 0 ? (
              <ul className="mt-4 divide-y divide-navy/5">
                {taxForms.map((t) => (
                  <li key={t.id} className="py-2 flex items-center gap-3 text-sm">
                    <FileText size={14} className="text-navy/60" />
                    <span className="font-medium text-navy">{t.form_type}</span>
                    <span className="text-mute">{new Date(t.submitted_at).toLocaleDateString()}</span>
                    <StatusBadge status={t.status} />
                    {t.admin_note ? <span className="text-mute italic">— {t.admin_note}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </>
      )}
    </PublisherShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-5">
      <div className="flex items-center gap-2 text-navy/60 text-sm">
        {icon} {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold ${accent ?? "text-navy"}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode }> = {
    pending: { cls: "bg-amber-100 text-amber-900", icon: <Clock size={12} /> },
    approved: { cls: "bg-blue-100 text-blue-900", icon: <Clock size={12} /> },
    submitted: { cls: "bg-amber-100 text-amber-900", icon: <Clock size={12} /> },
    paid: { cls: "bg-emerald-100 text-emerald-900", icon: <CheckCircle2 size={12} /> },
    approved_tax: { cls: "bg-emerald-100 text-emerald-900", icon: <CheckCircle2 size={12} /> },
    rejected: { cls: "bg-rose-100 text-rose-900", icon: <XCircle size={12} /> },
  };
  const s = status === "approved" && map[status] ? map[status] : map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${s.cls}`}>
      {s.icon} {status}
    </span>
  );
}
