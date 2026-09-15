/**
 * AurumVault Digital Rights Passport Generator — release-candidate
 * observability writer. Fire-and-forget, matching trackMerch's contract
 * (see merch-track.ts): never throws into the caller's control flow, never
 * blocks the action it's observing. Writes via the caller's own RLS-bound
 * `context.supabase` (never service-role) so a write is only ever possible
 * for the acting user's own owner_user_id, matching every other Rights
 * Passport table.
 *
 * WIRING STATUS (documented honestly): wired into publishPassport (success
 * and blocked-by-verification paths) and revokeSnapshot in
 * rights-passport-publish.functions.ts as the end-to-end proof this module
 * works. The remaining event kinds (asset/consent/license/evidence
 * mutations, document upload, parse/analysis lifecycle, finding review) are
 * fully defined and typed in rights-passport-events.ts but not yet called
 * from their respective handlers — each is a single `logRightsPassportEvent(...)`
 * call, following the exact pattern below, called out explicitly as
 * remaining work in the release report rather than rushed in across a dozen
 * more call sites without a live database to verify against.
 */
import {
  isValidRightsPassportEventKind,
  type RightsPassportEventDetail,
  type RightsPassportEventKind,
} from "@/lib/rights-passport-events";

export async function logRightsPassportEvent(
  supabase: any,
  userId: string,
  kind: RightsPassportEventKind,
  opts: { passportKey?: string; detail?: RightsPassportEventDetail } = {},
): Promise<void> {
  if (!isValidRightsPassportEventKind(kind)) return;
  try {
    await supabase.from("rights_passport_events" as never).insert({
      owner_user_id: userId,
      passport_key: opts.passportKey ?? null,
      kind,
      detail: opts.detail ?? null,
    } as never);
  } catch {
    // Fire-and-forget — a telemetry failure must never surface to the user
    // or interrupt the action it's observing (same contract as trackMerch).
  }
}
