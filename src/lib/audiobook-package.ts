/**
 * AurumVault Audiobook Studio — Phase 2 package core (pure).
 *
 * Builds the deterministic file list + manifest for an export bundle. Zipping
 * lives in audiobook-package.server.ts; everything decision-shaped lives here
 * so it is unit-testable without a Worker runtime.
 *
 * TRUTHFULNESS: when any included audio is mock, the manifest carries both
 * MOCK_NARRATION and NOT_DISTRIBUTION_READY markers, and a README states it
 * plainly. A mock export must never look like a deliverable master.
 */
import type { AudiobookMetadataInput } from "@/lib/audiobook-metadata";
import type { RightsEvaluation } from "@/lib/audiobook-rights";
import type { AudiobookReadinessState } from "@/lib/audiobook-readiness";

export const MOCK_NARRATION_MARKER = "MOCK_NARRATION";
export const NOT_DISTRIBUTION_READY_MARKER = "NOT_DISTRIBUTION_READY";

export type PackageAudioInput = {
  /** Chapter ordering index; ties broken by label for determinism. */
  order: number;
  label: string;
  bytes: Uint8Array;
  checksumSha256: string;
  isMock: boolean;
  durationSeconds: number | null;
};

export type PackageInput = {
  projectId: string;
  projectTitle: string;
  metadata: AudiobookMetadataInput | null;
  rights: RightsEvaluation;
  readinessState: AudiobookReadinessState;
  audio: PackageAudioInput[];
  generatedAt: string;
};

export type PackageFileEntry = {
  path: string;
  checksumSha256: string;
  bytes: number;
  durationSeconds: number | null;
  isMock: boolean;
};

export type PackageManifest = {
  schema: "aurumvault.audiobook.package/1";
  project_id: string;
  project_title: string;
  generated_at: string;
  readiness_state: AudiobookReadinessState;
  markers: string[];
  contains_mock_narration: boolean;
  distribution_ready: false | true;
  files: PackageFileEntry[];
  metadata: AudiobookMetadataInput | null;
  rights: { attested: boolean; blocked: boolean; blockers: string[] };
};

/** Filesystem-safe, deterministic filename. */
export function sanitizeAudioFileName(label: string, order: number): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const index = String(order + 1).padStart(3, "0");
  return `audio/${index}-${base.length > 0 ? base : "chapter"}.wav`;
}

/** Stable ordering: order asc, then label asc. */
export function sortPackageAudio(audio: PackageAudioInput[]): PackageAudioInput[] {
  return [...audio].sort((a, b) =>
    a.order === b.order ? a.label.localeCompare(b.label) : a.order - b.order,
  );
}

export function buildPackageManifest(input: PackageInput): PackageManifest {
  const sorted = sortPackageAudio(input.audio);
  const files: PackageFileEntry[] = sorted.map((item, i) => ({
    path: sanitizeAudioFileName(item.label, i),
    checksumSha256: item.checksumSha256,
    bytes: item.bytes.byteLength,
    durationSeconds: item.durationSeconds,
    isMock: item.isMock,
  }));

  const containsMock = sorted.some((a) => a.isMock);
  const distributionReady =
    !containsMock &&
    !input.rights.blocked &&
    (input.readinessState === "DISTRIBUTION_ELIGIBLE" || input.readinessState === "DISTRIBUTED");

  const markers: string[] = [];
  if (containsMock) markers.push(MOCK_NARRATION_MARKER);
  if (!distributionReady) markers.push(NOT_DISTRIBUTION_READY_MARKER);

  return {
    schema: "aurumvault.audiobook.package/1",
    project_id: input.projectId,
    project_title: input.projectTitle,
    generated_at: input.generatedAt,
    readiness_state: input.readinessState,
    markers,
    contains_mock_narration: containsMock,
    distribution_ready: distributionReady,
    files,
    metadata: input.metadata,
    rights: {
      attested: input.rights.attested,
      blocked: input.rights.blocked,
      blockers: input.rights.blockers.map((b) => b.code),
    },
  };
}

export function buildPackageReadme(manifest: PackageManifest): string {
  const lines = [
    `# ${manifest.project_title} — audiobook export`,
    "",
    `Generated: ${manifest.generated_at}`,
    `Readiness state: ${manifest.readiness_state}`,
    `Markers: ${manifest.markers.length > 0 ? manifest.markers.join(", ") : "none"}`,
    "",
  ];
  if (manifest.contains_mock_narration) {
    lines.push(
      `## ${MOCK_NARRATION_MARKER}`,
      "",
      "This package contains placeholder (mock) narration generated without a",
      "text-to-speech provider. It is NOT speech, NOT a master recording, and",
      `is explicitly ${NOT_DISTRIBUTION_READY_MARKER}. Do not deliver it to any`,
      "distributor, retailer or customer.",
      "",
    );
  } else if (!manifest.distribution_ready) {
    lines.push(
      `## ${NOT_DISTRIBUTION_READY_MARKER}`,
      "",
      "This package is not distribution ready. See manifest.json for blockers.",
      "",
    );
  }
  lines.push("## Files", "");
  for (const f of manifest.files) {
    lines.push(`- ${f.path} (${f.bytes} bytes, sha256 ${f.checksumSha256})`);
  }
  lines.push("");
  return lines.join("\n");
}

/** Deterministic, sanitized name for the downloaded archive. */
export function packageArchiveName(projectTitle: string, containsMock: boolean): string {
  const base =
    projectTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "audiobook";
  return containsMock ? `${base}-MOCK-NOT-DISTRIBUTION-READY.zip` : `${base}-audiobook.zip`;
}