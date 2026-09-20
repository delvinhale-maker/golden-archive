import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  History,
  Loader2,
  Save,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { supabase } from "@/integrations/supabase/client";
import {
  getWalletDocument,
  updateWalletDocument,
  deleteWalletDocument,
  getWalletFileUrl,
  WALLET_BUCKET,
} from "@/lib/license-wallet.functions";
import {
  CATEGORY_LABELS,
  LICENSE_WALLET_CATEGORIES,
  STATUS_LABELS,
  WALLET_ACCEPT,
  activityLabel,
  computeWalletStatus,
  formatFileSize,
  walletFileError,
  type LicenseWalletCategory,
} from "@/lib/license-wallet";
import { Field, STATUS_TONE, inputCls } from "@/components/wallet/WalletUi";

export const Route = createFileRoute("/_authenticated/dashboard/license-wallet/$documentId")({
  head: () => ({
    meta: [
      { title: "Wallet document | AurumVault License Wallet" },
      { name: "description", content: "View, update or replace a document in your AurumVault License Wallet." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WalletDocumentPage,
});

function WalletDocumentPage() {
  const { documentId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const getFn = useServerFn(getWalletDocument);
  const updateFn = useServerFn(updateWalletDocument);
  const deleteFn = useServerFn(deleteWalletDocument);
  const fileUrlFn = useServerFn(getWalletFileUrl);

  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["license-wallet", "document", documentId],
    queryFn: () => getFn({ data: { id: documentId } }),
    retry: false,
  });

  if (isLoading) {
    return (
      <PublisherShell accent={ACCENTS.help}>
        <p className="flex items-center gap-2 text-mute">
          <Loader2 className="animate-spin" size={16} /> Loading document…
        </p>
      </PublisherShell>
    );
  }

  if (error || !data) {
    return (
      <PublisherShell accent={ACCENTS.help}>
        <div className="max-w-xl rounded-2xl border border-ink/10 bg-white p-8 text-center">
          <AlertTriangle className="mx-auto text-mute" size={28} />
          <p className="mt-3 font-display text-xl text-navy">Document unavailable</p>
          <p className="mt-2 text-sm text-mute">{(error as any)?.message ?? "It may have been deleted."}</p>
          <Link
            to="/dashboard/license-wallet"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline"
          >
            <ArrowLeft size={14} /> Back to wallet
          </Link>
        </div>
      </PublisherShell>
    );
  }

  const doc = data.document;
  const status = computeWalletStatus(doc);

  async function handleSave(form: HTMLFormElement) {
    const fd = new FormData(form);
    const file = fd.get("file") as File | null;
    const noExpiration = fd.get("no_expiration") === "on";
    setSaving(true);
    try {
      let filePayload:
        | {
            file_path: string;
            file_name: string;
            file_mime: "application/pdf" | "image/jpeg" | "image/png";
            file_size_bytes: number;
          }
        | null = null;

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

      await updateFn({
        data: {
          id: doc.id,
          title: String(fd.get("title") ?? "").trim(),
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
      toast.success(filePayload ? "Document and file updated" : "Document updated");
      await queryClient.invalidateQueries({ queryKey: ["license-wallet"] });
    } catch (e: any) {
      toast.error(e?.message ?? "We couldn't save your changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PublisherShell accent={ACCENTS.help}>
      <Link
        to="/dashboard/license-wallet"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-mute hover:text-navy"
      >
        <ArrowLeft size={14} /> Back to wallet
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl text-navy">{doc.title}</h1>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${STATUS_TONE[status]}`}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave(e.currentTarget);
          }}
          className="space-y-4 rounded-2xl border border-ink/10 bg-white p-5"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Title *">
              <input name="title" required defaultValue={doc.title} className={inputCls} />
            </Field>
            <Field label="Category *">
              <select name="category" defaultValue={doc.category} className={inputCls}>
                {LICENSE_WALLET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Issuer">
              <input name="issuer" defaultValue={doc.issuer ?? ""} className={inputCls} />
            </Field>
            <Field label="Number">
              <input name="doc_number" defaultValue={doc.doc_number ?? ""} className={inputCls} />
            </Field>
            <Field label="Issue date">
              <input type="date" name="issue_date" defaultValue={doc.issue_date ?? ""} className={inputCls} />
            </Field>
            <Field label="Expiration date">
              <input
                type="date"
                name="expiration_date"
                defaultValue={doc.expiration_date ?? ""}
                className={inputCls}
              />
            </Field>
            <Field label="Location">
              <select name="location_id" defaultValue={doc.location_id ?? ""} className={inputCls}>
                <option value="">No location</option>
                {data.locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-end gap-2 pb-2 text-sm text-navy">
              <input
                type="checkbox"
                name="no_expiration"
                defaultChecked={doc.no_expiration}
                className="size-4 accent-[#b8860b]"
              />
              This document does not expire
            </label>
          </div>
          <Field label="Notes">
            <textarea name="notes" rows={3} defaultValue={doc.notes ?? ""} className={inputCls} />
          </Field>
          <Field label="Replace file (PDF, JPG or PNG · up to 10 MB · stored privately)">
            <input type="file" name="file" accept={WALLET_ACCEPT} className={inputCls} />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm(`Delete "${doc.title}" and its file? This can't be undone.`)) return;
                try {
                  await deleteFn({ data: { id: doc.id } });
                  toast.success("Document deleted");
                  await queryClient.invalidateQueries({ queryKey: ["license-wallet"] });
                  navigate({ to: "/dashboard/license-wallet" });
                } catch (e: any) {
                  toast.error(e?.message ?? "We couldn't delete that document.");
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </form>

        <div className="space-y-6">
          <div className="rounded-2xl border border-ink/10 bg-white p-5">
            <h2 className="flex items-center gap-2 font-display text-lg text-navy">
              <UploadCloud size={16} className="text-gold-ink" /> Stored file
            </h2>
            {doc.file_name ? (
              <>
                <p className="mt-2 truncate text-sm text-navy" title={doc.file_name}>
                  {doc.file_name}
                </p>
                <p className="text-xs text-mute">
                  {formatFileSize(doc.file_size_bytes)} · private · signed links expire in 5 minutes
                </p>
                <button
                  type="button"
                  disabled={opening}
                  onClick={async () => {
                    setOpening(true);
                    try {
                      const { url } = await fileUrlFn({ data: { id: doc.id } });
                      window.open(url, "_blank", "noopener,noreferrer");
                      await queryClient.invalidateQueries({
                        queryKey: ["license-wallet", "document", doc.id],
                      });
                    } catch (e: any) {
                      toast.error(e?.message ?? "We couldn't open that file.");
                    } finally {
                      setOpening(false);
                    }
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {opening ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                  View file
                </button>
              </>
            ) : (
              <p className="mt-2 text-sm text-mute">
                No file attached yet. Use “Replace file” to upload the PDF or photo.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-ink/10 bg-white p-5">
            <h2 className="flex items-center gap-2 font-display text-lg text-navy">
              <History size={16} className="text-gold-ink" /> Activity
            </h2>
            {data.activity.length === 0 ? (
              <p className="mt-2 text-sm text-mute">No activity recorded yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.activity.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-navy">{activityLabel(a.action)}</span>
                    <span className="text-mute">{new Date(a.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </PublisherShell>
  );
}