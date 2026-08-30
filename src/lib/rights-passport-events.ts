/**
 * AurumVault Digital Rights Passport Generator — release-candidate
 * observability. Pure event-name/detail-shape definitions, mirroring the
 * existing `merch_events`/`trackMerch` fire-and-forget convention (see
 * merch-track.ts, bundles.functions.ts) rather than inventing a new
 * telemetry system. See rights-passport-events.functions.ts for the
 * server-side writer and docs/proposed-migrations/20260830193000_rights_passport_events.sql
 * for the backing table (proposed, not applied).
 *
 * SAFETY — never put these in a `detail` payload, even indirectly: raw
 * contracts, private legal identity, raw document contents, full AI
 * prompts containing contract text, signed storage URLs, sensitive
 * evidence. `RightsPassportEventDetail` is an explicit allowlist for
 * exactly this reason — there is no `[key: string]: unknown` escape hatch
 * on it, so a caller cannot accidentally spread an unreviewed object in.
 */

export const RIGHTS_PASSPORT_EVENT_KINDS = [
  "rights_passport_created",
  "rights_asset_added",
  "rights_ai_consent_updated",
  "rights_license_added",
  "rights_evidence_added",
  "rights_document_uploaded",
  "rights_parse_failed",
  "rights_analysis_started",
  "rights_analysis_pass_failed",
  "rights_analysis_completed",
  "rights_finding_reviewed",
  "rights_publish_blocked",
  "rights_passport_published",
  "rights_passport_revoked",
  "rights_export_failed",
] as const;

export type RightsPassportEventKind = (typeof RIGHTS_PASSPORT_EVENT_KINDS)[number];

/**
 * Explicit allowlist of safe detail fields. Every field is a bare
 * identifier, count, code, or enum-shaped string — never free text a user
 * typed, never a document excerpt, never a URL.
 */
export type RightsPassportEventDetail = {
  assetType?: string;
  useCase?: string;
  documentType?: string;
  mimeType?: string;
  passType?: string;
  errorCode?: string;
  reviewAction?: "ACCEPTED" | "EDITED" | "REJECTED" | "DEFERRED";
  blockerCount?: number;
  findingCount?: number;
  passportVersion?: number;
  exportMode?: "public" | "private";
  exportFormat?: "pdf" | "json";
};

export function isValidRightsPassportEventKind(kind: string): kind is RightsPassportEventKind {
  return (RIGHTS_PASSPORT_EVENT_KINDS as readonly string[]).includes(kind);
}
