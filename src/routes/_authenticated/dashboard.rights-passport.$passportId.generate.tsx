import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Copy, Download, ExternalLink, ShieldAlert, ShieldX } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { getPassport } from "@/lib/rights-passport.functions";
import {
  getVerifyStatus,
  publishPassport,
  getPublishedSnapshotStatus,
  revokeSnapshot,
  downloadPublicJson,
  downloadPrivateJson,
} from "@/lib/rights-passport-publish.functions";
import {
  renderPassportQr,
  downloadPublicPassportPdf,
  downloadPrivatePassportPdf,
} from "@/lib/rights-passport-generate.functions";
import { PASSPORT_EXPORT_JSON_SCHEMA } from "@/lib/rights-passport-export-schema";
import { RIGHTS_PASSPORT_DISCLAIMER } from "@/lib/rights-passport.schema";

export const Route = createFileRoute(
  "/_authenticated/dashboard/rights-passport/$passportId/generate",
)({
  component: GeneratePage,
});

function downloadBlob(content: BlobPart, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function GeneratePage() {
  const { passportId } = Route.useParams();
  const queryClient = useQueryClient();
  const getPassportFn = useServerFn(getPassport);
  const getVerifyFn = useServerFn(getVerifyStatus);
  const publishFn = useServerFn(publishPassport);
  const getSnapshotFn = useServerFn(getPublishedSnapshotStatus);
  const revokeFn = useServerFn(revokeSnapshot);
  const publicJsonFn = useServerFn(downloadPublicJson);
  const privateJsonFn = useServerFn(downloadPrivateJson);
  const qrFn = useServerFn(renderPassportQr);
  const publicPdfFn = useServerFn(downloadPublicPassportPdf);
  const privatePdfFn = useServerFn(downloadPrivatePassportPdf);

  const [passportKey, setPassportKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getPassportFn({ data: { id: passportId } })
      .then((p) => setPassportKey(p.passport_key))
      .catch(() => setPassportKey(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passportId]);

  const verifyQueryKey = ["rights-passport", "verify", passportKey];
  const { data: verification } = useQuery({
    queryKey: verifyQueryKey,
    queryFn: () => getVerifyFn({ data: { passportKey: passportKey! } }),
    enabled: !!passportKey,
    retry: false,
  });

  const snapshotQueryKey = ["rights-passport", "snapshot", passportKey];
  const { data: snapshot } = useQuery({
    queryKey: snapshotQueryKey,
    queryFn: () => getSnapshotFn({ data: { passportKey: passportKey! } }),
    enabled: !!passportKey,
  });

  const qrQueryKey = ["rights-passport", "qr", passportKey];
  const { data: qr } = useQuery({
    queryKey: qrQueryKey,
    queryFn: () => qrFn({ data: { passportKey: passportKey!, format: "png" } }),
    enabled: !!passportKey && snapshot?.status === "ACTIVE",
  });

  async function handlePublish() {
    if (!passportKey) return;
    setBusy("publish");
    try {
      const result = await publishFn({ data: { passportKey } });
      toast.success(`Published v${result.passportVersion}`);
      queryClient.invalidateQueries({ queryKey: snapshotQueryKey });
      queryClient.invalidateQueries({ queryKey: qrQueryKey });
      queryClient.invalidateQueries({ queryKey: verifyQueryKey });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't publish");
    } finally {
      setBusy(null);
    }
  }

  async function handleRevoke() {
    if (!passportKey) return;
    if (
      !window.confirm("Revoke the published passport? The public card will show PASSPORT REVOKED.")
    )
      return;
    setBusy("revoke");
    try {
      await revokeFn({ data: { passportKey } });
      toast.success("Passport revoked");
      queryClient.invalidateQueries({ queryKey: snapshotQueryKey });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't revoke");
    } finally {
      setBusy(null);
    }
  }

  async function handleCopyUrl() {
    if (!snapshot) return;
    await navigator.clipboard.writeText(snapshot.publicUrl);
    toast.success("Public URL copied");
  }

  async function handleDownloadJson(mode: "public" | "private") {
    if (!passportKey) return;
    setBusy(`json-${mode}`);
    try {
      const result =
        mode === "public"
          ? await publicJsonFn({ data: { passportKey } })
          : await privateJsonFn({ data: { passportKey } });
      const payload = "payload" in result ? result.payload : result;
      downloadBlob(
        JSON.stringify(payload, null, 2),
        "application/json",
        `rights-passport-${mode}.json`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't build JSON export");
    } finally {
      setBusy(null);
    }
  }

  function handleDownloadSchema() {
    downloadBlob(
      JSON.stringify(PASSPORT_EXPORT_JSON_SCHEMA, null, 2),
      "application/json",
      "rights-passport-schema-1.0.json",
    );
  }

  async function handleDownloadPdf(mode: "public" | "private") {
    if (!passportKey) return;
    setBusy(`pdf-${mode}`);
    try {
      const { pdfBase64 } =
        mode === "public"
          ? await publicPdfFn({ data: { passportKey } })
          : await privatePdfFn({ data: { passportKey } });
      downloadBlob(
        base64ToBytes(pdfBase64),
        "application/pdf",
        `digital-rights-passport-${mode}.pdf`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't generate PDF");
    } finally {
      setBusy(null);
    }
  }

  function handleDownloadQr() {
    if (!qr) return;
    const a = document.createElement("a");
    a.href = qr.data;
    a.download = "rights-passport-qr.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const isPublished = snapshot?.status === "ACTIVE";
  const isRevoked = snapshot?.status === "REVOKED";
  const readyToPublish = verification?.readyToPublish ?? false;

  return (
    <PublisherShell accent={ACCENTS.help}>
      <Link
        to="/dashboard/rights-passport"
        className="inline-flex items-center gap-1 text-sm text-mute hover:text-navy"
      >
        <ArrowLeft size={14} /> Back to Passport Home
      </Link>
      <h1 className="mt-3 font-display text-3xl text-navy">Export Center</h1>
      <p className="text-sm text-mute mt-1 max-w-2xl">
        Publish your passport, share its public card, and download exports.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-mute">Verify status</p>
          {verification ? (
            <>
              <p className="mt-1 font-display text-2xl text-navy">
                {verification.score}
                <span className="text-sm text-mute">/100</span>
              </p>
              <p className={`text-sm mt-1 ${readyToPublish ? "text-emerald-700" : "text-red-700"}`}>
                {readyToPublish ? "Ready to publish" : `${verification.blockers.length} blocker(s)`}
              </p>
              <Link
                to="/dashboard/rights-passport/$passportId/verify"
                params={{ passportId }}
                className="mt-2 inline-block text-xs text-navy underline"
              >
                View full checklist
              </Link>
            </>
          ) : (
            <p className="text-sm text-mute mt-1">Loading…</p>
          )}
        </div>

        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-mute">Passport version</p>
          <p className="mt-1 font-display text-2xl text-navy">v{verification?.version ?? "—"}</p>
          <p className="text-sm text-mute mt-1">
            {isPublished
              ? `Published v${snapshot.passportVersion}`
              : isRevoked
                ? "Revoked"
                : "Not yet published"}
          </p>
        </div>
      </div>

      {isRevoked && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 inline-flex items-center gap-2">
          <ShieldX size={16} /> This passport's public card is currently REVOKED.
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-mute">Public URL</p>
        {snapshot ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-ink/5 px-3 py-2 text-xs text-navy break-all">
              {snapshot.publicUrl}
            </code>
            <button
              type="button"
              onClick={handleCopyUrl}
              className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-navy"
            >
              <Copy size={12} /> Copy
            </button>
            <a
              href={snapshot.publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-navy"
            >
              <ExternalLink size={12} /> View Public Rights Card
            </a>
          </div>
        ) : (
          <p className="text-sm text-mute mt-1">Publish this passport to get its public URL.</p>
        )}
        {snapshot && (
          <p className="mt-2 text-xs text-mute">Integrity ID: {snapshot.shortIntegrityId}</p>
        )}
      </div>

      {isPublished && qr && (
        <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-mute">QR code</p>
          <img
            src={qr.data}
            alt="QR code linking to your Public Rights Card"
            className="mt-2 h-32 w-32"
          />
          <button
            type="button"
            onClick={handleDownloadQr}
            className="mt-2 inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-navy"
          >
            <Download size={12} /> Download QR
          </button>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!readyToPublish || busy === "publish"}
          onClick={handlePublish}
          className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy hover:brightness-105 disabled:opacity-40"
        >
          {isPublished ? "Publish New Version" : "Publish Passport"}
        </button>
        {isPublished && (
          <button
            type="button"
            disabled={busy === "revoke"}
            onClick={handleRevoke}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-700"
          >
            <ShieldAlert size={14} /> Revoke
          </button>
        )}
      </div>

      <div className="mt-8">
        <p className="text-xs font-bold uppercase tracking-wide text-mute mb-3">Exports</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy === "pdf-public"}
            onClick={() => handleDownloadPdf("public")}
            className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-left text-sm font-semibold text-navy hover:border-navy/30"
          >
            Download Public Passport PDF
          </button>
          <button
            type="button"
            disabled={busy === "pdf-private"}
            onClick={() => handleDownloadPdf("private")}
            className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-left text-sm font-semibold text-navy hover:border-navy/30"
          >
            Download Private Owner PDF
          </button>
          <button
            type="button"
            disabled={busy === "json-public"}
            onClick={() => handleDownloadJson("public")}
            className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-left text-sm font-semibold text-navy hover:border-navy/30"
          >
            Download Public JSON
          </button>
          <button
            type="button"
            disabled={busy === "json-private"}
            onClick={() => handleDownloadJson("private")}
            className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-left text-sm font-semibold text-navy hover:border-navy/30"
          >
            Download Private JSON
          </button>
          <button
            type="button"
            onClick={handleDownloadSchema}
            className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-left text-sm font-semibold text-navy hover:border-navy/30"
          >
            Download JSON Schema
          </button>
        </div>
        {!isPublished && (
          <p className="mt-2 text-xs text-mute">
            Not yet published — exports above are a live preview, not a frozen public record.
          </p>
        )}
      </div>

      <p className="mt-8 max-w-xl text-xs text-mute italic">{RIGHTS_PASSPORT_DISCLAIMER}</p>
    </PublisherShell>
  );
}
