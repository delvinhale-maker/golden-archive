/**
 * Server-only re-encryption pass for payout secrets.
 *
 * Reads every stored envelope with the full keyring, then rewrites the ones
 * that are plaintext or sealed with a retired key using the active key. Safe to
 * run repeatedly and while the app is serving traffic: reads always work
 * because retired keys stay in the keyring until the pass reports 0 stale rows.
 */
import {
  encryptPayoutDetails,
  decryptPayoutDetails,
  needsReEncryption,
  getKeyringStatus,
} from "./payout-crypto.server";

export type RotationReport = {
  active_kid: string;
  active_env: string;
  decrypt_only: { env: string; kid: string }[];
  payout_methods: { scanned: number; rotated: number; failed: number };
  payout_requests: { scanned: number; rotated: number; failed: number };
  errors: string[];
};

export async function scanAndRotatePayoutKeys(
  options: { dryRun: boolean } = { dryRun: false },
): Promise<RotationReport> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const status = await getKeyringStatus();
  const report: RotationReport = {
    ...status,
    payout_methods: { scanned: 0, rotated: 0, failed: 0 },
    payout_requests: { scanned: 0, rotated: 0, failed: 0 },
    errors: [],
  };

  // --- creator_payout_methods.details ---
  const { data: methods, error: methodsErr } = await supabaseAdmin
    .from("creator_payout_methods" as any)
    .select("seller_id, details");
  if (methodsErr) report.errors.push(`payout methods: ${methodsErr.message}`);

  for (const row of (methods ?? []) as any[]) {
    report.payout_methods.scanned += 1;
    try {
      if (!(await needsReEncryption(row.details))) continue;
      if (options.dryRun) {
        report.payout_methods.rotated += 1;
        continue;
      }
      const plain = await decryptPayoutDetails(row.details);
      const { error } = await supabaseAdmin
        .from("creator_payout_methods" as any)
        .update({ details: await encryptPayoutDetails(plain) })
        .eq("seller_id", row.seller_id);
      if (error) throw new Error(error.message);
      report.payout_methods.rotated += 1;
    } catch (err) {
      report.payout_methods.failed += 1;
      report.errors.push(
        `payout method ${row.seller_id}: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
  }

  // --- payout_requests.method_snapshot.details ---
  const { data: requests, error: requestsErr } = await supabaseAdmin
    .from("payout_requests" as any)
    .select("id, method_snapshot");
  if (requestsErr) report.errors.push(`payout requests: ${requestsErr.message}`);

  for (const row of (requests ?? []) as any[]) {
    const snapshot = row.method_snapshot;
    if (!snapshot || typeof snapshot !== "object" || snapshot.details == null) continue;
    report.payout_requests.scanned += 1;
    try {
      if (!(await needsReEncryption(snapshot.details))) continue;
      if (options.dryRun) {
        report.payout_requests.rotated += 1;
        continue;
      }
      const plain = await decryptPayoutDetails(snapshot.details);
      const { error } = await supabaseAdmin
        .from("payout_requests" as any)
        .update({
          method_snapshot: { ...snapshot, details: await encryptPayoutDetails(plain) },
        })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      report.payout_requests.rotated += 1;
    } catch (err) {
      report.payout_requests.failed += 1;
      report.errors.push(
        `payout request ${row.id}: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
  }

  return report;
}
