/**
 * AurumVault Audiobook Studio — Phase 2 rights-attestation rules.
 *
 * Pure. This module NEVER determines who legally owns anything; it only
 * evaluates whether the creator has completed a current, non-revoked
 * attestation, and blocks narration/export when they have not.
 */

export type AttestationStatus = "PENDING" | "ATTESTED" | "REVOKED";

export type RightsAttestationInput = {
  status?: AttestationStatus | null;
  version?: number | null;
  statementText?: string | null;
  attestedAt?: string | null;
  revokedAt?: string | null;
};

export type RightsIssue = { code: string; severity: "BLOCKER" | "WARNING"; message: string };

export type RightsEvaluation = {
  attested: boolean;
  /** Narration and export must be refused when true. */
  blocked: boolean;
  blockers: RightsIssue[];
  warnings: RightsIssue[];
};

export const RIGHTS_ATTESTATION_REQUIRED_MESSAGE =
  "You must confirm you hold audio/narration rights for this work before generating or exporting narration.";

export const MIN_ATTESTATION_STATEMENT_CHARS = 20;

export function evaluateRightsAttestation(
  input: RightsAttestationInput | null | undefined,
): RightsEvaluation {
  const blockers: RightsIssue[] = [];
  const warnings: RightsIssue[] = [];

  if (!input || !input.status) {
    blockers.push({
      code: "RIGHTS_ATTESTATION_MISSING",
      severity: "BLOCKER",
      message: RIGHTS_ATTESTATION_REQUIRED_MESSAGE,
    });
    return { attested: false, blocked: true, blockers, warnings };
  }

  if (input.status === "REVOKED") {
    blockers.push({
      code: "RIGHTS_ATTESTATION_REVOKED",
      severity: "BLOCKER",
      message: "This rights attestation was revoked. Re-attest before generating narration.",
    });
  } else if (input.status !== "ATTESTED") {
    blockers.push({
      code: "RIGHTS_ATTESTATION_PENDING",
      severity: "BLOCKER",
      message: RIGHTS_ATTESTATION_REQUIRED_MESSAGE,
    });
  }

  if (input.status === "ATTESTED" && !input.attestedAt) {
    blockers.push({
      code: "RIGHTS_ATTESTATION_TIMESTAMP_MISSING",
      severity: "BLOCKER",
      message: "Attestation is missing its confirmation timestamp.",
    });
  }

  if (
    input.status === "ATTESTED" &&
    (input.statementText ?? "").trim().length < MIN_ATTESTATION_STATEMENT_CHARS
  ) {
    warnings.push({
      code: "RIGHTS_STATEMENT_THIN",
      severity: "WARNING",
      message: "Record a fuller description of the rights you hold.",
    });
  }

  const blocked = blockers.length > 0;
  return { attested: !blocked, blocked, blockers, warnings };
}