/**
 * AurumVault Audiobook Studio — Phase 2 ZIP assembly (server-only).
 *
 * Uses fflate (already a production dependency, used by manuscript
 * validation) with deterministic file ordering. Callers supply the audio bytes
 * they have already authorised and downloaded, so this module performs no
 * storage or network access itself.
 *
 * MEMORY GUARD: the Worker runtime has a hard memory ceiling, so exports above
 * MAX_PACKAGE_BYTES are refused with a truthful error rather than crashing the
 * request.
 */
import {
  buildPackageManifest,
  buildPackageReadme,
  packageArchiveName,
  sortPackageAudio,
  sanitizeAudioFileName,
  type PackageInput,
  type PackageManifest,
} from "@/lib/audiobook-package";

/** Conservative ceiling for in-Worker ZIP assembly. */
export const MAX_PACKAGE_BYTES = 24 * 1024 * 1024;

export type BuiltPackage = {
  filename: string;
  manifest: PackageManifest;
  zip: Uint8Array;
};

export async function buildAudiobookPackageZip(input: PackageInput): Promise<BuiltPackage> {
  const total = input.audio.reduce((sum, a) => sum + a.bytes.byteLength, 0);
  if (total > MAX_PACKAGE_BYTES) {
    throw new Error(
      `This export is too large to package in one request (${(total / 1024 / 1024).toFixed(1)} MB). Export fewer chapters at a time.`,
    );
  }

  const manifest = buildPackageManifest(input);
  const readme = buildPackageReadme(manifest);
  const { zipSync, strToU8 } = await import("fflate");

  const files: Record<string, Uint8Array> = {};
  const sorted = sortPackageAudio(input.audio);
  sorted.forEach((item, i) => {
    files[sanitizeAudioFileName(item.label, i)] = item.bytes;
  });
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  files["README.txt"] = strToU8(readme);

  // Deterministic entry order.
  const ordered: Record<string, Uint8Array> = {};
  for (const key of Object.keys(files).sort()) {
    ordered[key] = files[key]!;
  }

  const zip = zipSync(ordered, { level: 6, mtime: 0 });
  return {
    filename: packageArchiveName(input.projectTitle, manifest.contains_mock_narration),
    manifest,
    zip,
  };
}