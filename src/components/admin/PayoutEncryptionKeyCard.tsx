import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  getPayoutKeyStatus,
  rotatePayoutEncryptionKeys,
  type RotationReport,
} from "@/lib/payout-key-rotation.functions";

/**
 * Admin control for the payout-details encryption keyring.
 * Shows the active key, retired (decrypt-only) keys, and how many stored
 * secrets still need re-encrypting — then runs the re-encrypt pass on demand.
 */
export function PayoutEncryptionKeyCard() {
  const checkStatus = useServerFn(getPayoutKeyStatus);
  const rotate = useServerFn(rotatePayoutEncryptionKeys);
  const [report, setReport] = useState<RotationReport | null>(null);
  const [busy, setBusy] = useState<"scan" | "rotate" | null>(null);

  async function run(mode: "scan" | "rotate") {
    setBusy(mode);
    try {
      const res =
        mode === "scan" ? await checkStatus() : await rotate({ data: { dry_run: false } });
      setReport(res as RotationReport);
      if (mode === "rotate") {
        const total = res.payout_methods.rotated + res.payout_requests.rotated;
        toast.success(
          total === 0
            ? "All payout secrets already use the active key."
            : `Re-encrypted ${total} record(s) with the active key.`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Key check failed");
    } finally {
      setBusy(null);
    }
  }

  const stale = report
    ? report.payout_methods.rotated + report.payout_requests.rotated
    : null;

  return (
    <section className="rounded-2xl bg-white border border-ink/10 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <KeyRound size={16} className="text-navy" />
        <h2 className="font-display text-xl text-navy">Payout encryption keys</h2>
        <button
          onClick={() => run("scan")}
          disabled={busy !== null}
          className="ml-auto text-xs text-mute hover:text-navy inline-flex items-center gap-1"
        >
          {busy === "scan" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Check status
        </button>
      </div>

      <p className="mt-2 text-sm text-mute">
        Bank and PayPal details are stored with AES-256-GCM. Adding a newer key secret makes it
        the active key immediately; older keys stay decrypt-only so nothing breaks. Run the
        re-encrypt pass to move existing records onto the active key, then the old secret can be
        removed.
      </p>

      {report && (
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 text-xs">
              <ShieldCheck size={12} /> Active key {report.active_kid} · {report.active_env}
            </span>
            {report.decrypt_only.map((k) => (
              <span
                key={k.env}
                className="rounded-full bg-ink/5 text-mute border border-ink/10 px-3 py-1 text-xs"
              >
                Decrypt-only {k.kid} · {k.env}
              </span>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-ink/10 p-3">
              <div className="text-xs uppercase tracking-wider text-mute">Payout methods</div>
              <div className="text-navy">
                {report.payout_methods.scanned} scanned · {report.payout_methods.rotated} needing
                re-encryption · {report.payout_methods.failed} failed
              </div>
            </div>
            <div className="rounded-xl border border-ink/10 p-3">
              <div className="text-xs uppercase tracking-wider text-mute">Request snapshots</div>
              <div className="text-navy">
                {report.payout_requests.scanned} scanned · {report.payout_requests.rotated} needing
                re-encryption · {report.payout_requests.failed} failed
              </div>
            </div>
          </div>

          {stale === 0 && (
            <p className="text-xs text-emerald-700">
              Every stored payout secret uses the active key. Retired key secrets are safe to delete.
            </p>
          )}

          {report.errors.length > 0 && (
            <ul className="text-xs text-red-700 list-disc pl-5 space-y-0.5">
              {report.errors.slice(0, 5).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        onClick={() => run("rotate")}
        disabled={busy !== null}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-navy text-white px-4 py-2 text-sm disabled:opacity-60"
      >
        {busy === "rotate" ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
        Re-encrypt with active key
      </button>
    </section>
  );
}
