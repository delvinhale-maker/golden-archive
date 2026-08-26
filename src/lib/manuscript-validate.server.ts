import { validateManuscriptBytes, type ManuscriptExt } from "@/lib/manuscript-validate";

export type StoredCheck =
  | { ok: true; ext?: ManuscriptExt | "unknown" }
  | { ok: false; reason: string; ext?: ManuscriptExt | "unknown" };

/** Absolute publish cap (mirrors the client MAX_FILE_MB). */
export const MAX_STORED_BYTES = 650 * 1024 * 1024;

/**
 * Above this size we do NOT pull the whole object into the Worker. The
 * serverless runtime has a hard memory ceiling (~128 MB), so buffering a
 * 100 MB+ EPUB/PDF — and then unzipping it — crashes the request and the
 * client only sees "Internal server error". For those files we verify the
 * container signature (and the PDF EOF trailer) using ranged reads instead.
 */
export const DEEP_SCAN_LIMIT = 32 * 1024 * 1024;

function asciiOf(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] ?? 0);
  return s;
}

async function rangeBytes(url: string, range: string): Promise<Uint8Array | null> {
  const res = await fetch(url, { headers: { Range: range } });
  if (!res.ok && res.status !== 206) return null;
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Validates a manuscript already stored in the `product-files` bucket without
 * ever holding a huge file in memory.
 */
export async function validateStoredObject(opts: {
  signedUrl: string;
  size: number;
  filename: string;
  allowed: string[];
  download: () => Promise<Uint8Array>;
}): Promise<StoredCheck> {
  const { signedUrl, size, filename, allowed } = opts;

  if (size === 0) return { ok: false, reason: "File is empty (0 bytes)." };
  if (size > MAX_STORED_BYTES) {
    return {
      ok: false,
      reason: `File exceeds the ${MAX_STORED_BYTES / 1024 / 1024} MB limit (${(size / 1024 / 1024).toFixed(1)} MB).`,
    };
  }

  const nameExt = filename.toLowerCase().split(".").pop() ?? "";
  if (!allowed.includes(nameExt)) {
    return {
      ok: false,
      reason: `Unsupported file type ".${nameExt}". Allowed: ${allowed.map((e) => `.${e.toUpperCase()}`).join(", ")}.`,
    };
  }

  if (size <= DEEP_SCAN_LIMIT) {
    const bytes = await opts.download();
    const result = validateManuscriptBytes(bytes, filename);
    return result.ok
      ? { ok: true, ext: result.ext }
      : { ok: false, reason: result.reason, ext: result.ext };
  }

  // Large file: ranged signature checks only.
  const head = await rangeBytes(signedUrl, "bytes=0-7");
  if (!head || head.length < 4) {
    return { ok: false, reason: "Could not read the stored file. Please re-upload." };
  }

  if (nameExt === "pdf") {
    if (asciiOf(head.slice(0, 5)) !== "%PDF-") {
      return { ok: false, reason: "Not a valid PDF (missing header).", ext: "pdf" };
    }
    const tail = await rangeBytes(signedUrl, `bytes=${Math.max(0, size - 4096)}-${size - 1}`);
    if (tail && !asciiOf(tail).includes("%%EOF")) {
      return { ok: false, reason: "PDF appears truncated (no EOF marker).", ext: "pdf" };
    }
    return { ok: true, ext: "pdf" };
  }

  // docx / epub are ZIP containers.
  if (head[0] !== 0x50 || head[1] !== 0x4b) {
    return {
      ok: false,
      reason:
        nameExt === "docx"
          ? "Not a valid .docx file (wrong signature). Re-save from Word and try again."
          : "Not a valid .epub file (wrong signature).",
      ext: nameExt as ManuscriptExt,
    };
  }
  return { ok: true, ext: nameExt as ManuscriptExt };
}
