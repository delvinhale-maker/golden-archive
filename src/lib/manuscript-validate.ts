/**
 * Isomorphic manuscript validator.
 *
 * Validates the *internal structure* of uploaded manuscripts so malformed
 * files can be rejected before buyers download them. Runs in the browser
 * (during upload) and in the Cloudflare Worker (before publish) using the
 * same code.
 *
 *  - .docx  → must be a valid ZIP, must contain `word/document.xml`, and
 *             that XML must be well-formed and contain a <w:document> root.
 *  - .epub  → must be a valid ZIP, must contain `META-INF/container.xml`
 *             and at least one `.opf` package file.
 *  - .pdf   → must start with the `%PDF-` header.
 */
import { unzipSync, strFromU8 } from "fflate";

export type ManuscriptExt = "docx" | "epub" | "pdf";

export type ValidateResult =
  | { ok: true; ext: ManuscriptExt }
  | { ok: false; ext: ManuscriptExt | "unknown"; reason: string };

export function extFromName(name: string): ManuscriptExt | "unknown" {
  const e = name.toLowerCase().split(".").pop() ?? "";
  if (e === "docx" || e === "epub" || e === "pdf") return e;
  return "unknown";
}

function isXmlWellFormed(xml: string, requiredTag?: string): boolean {
  // Cheap parser-free validation: matched < / >, presence of the required
  // root tag, and no obvious mid-stream truncation. Avoids DOMParser so we
  // stay isomorphic (no DOMParser in the Worker runtime).
  if (!xml || xml.length < 20) return false;
  if (!xml.trimStart().startsWith("<")) return false;
  const opens = (xml.match(/</g) ?? []).length;
  const closes = (xml.match(/>/g) ?? []).length;
  if (opens !== closes) return false;
  if (requiredTag && !xml.includes(requiredTag)) return false;
  return true;
}

export function validateManuscriptBytes(
  bytes: Uint8Array,
  filename: string,
): ValidateResult {
  const ext = extFromName(filename);
  if (ext === "unknown") {
    return { ok: false, ext, reason: "Unsupported file type." };
  }
  if (bytes.byteLength === 0) {
    return { ok: false, ext, reason: "File is empty." };
  }

  if (ext === "pdf") {
    const header = String.fromCharCode(...bytes.slice(0, 5));
    if (header !== "%PDF-") {
      return { ok: false, ext, reason: "Not a valid PDF (missing header)." };
    }
    // Optional: check the trailer marker exists somewhere in the last 2KB.
    const tail = bytes.slice(Math.max(0, bytes.byteLength - 2048));
    const tailStr = String.fromCharCode(...tail);
    if (!tailStr.includes("%%EOF")) {
      return { ok: false, ext, reason: "PDF appears truncated (no EOF marker)." };
    }
    return { ok: true, ext };
  }

  // Both docx and epub are ZIP containers.
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    return {
      ok: false,
      ext,
      reason:
        ext === "docx"
          ? "Not a valid .docx file (wrong signature). Re-save from Word and try again."
          : "Not a valid .epub file (wrong signature).",
    };
  }

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch (e) {
    return {
      ok: false,
      ext,
      reason: `${ext.toUpperCase()} archive is corrupted (${(e as Error).message}).`,
    };
  }

  if (ext === "docx") {
    const doc = entries["word/document.xml"];
    if (!doc) {
      return {
        ok: false,
        ext,
        reason: "DOCX is missing word/document.xml — Word will refuse to open it.",
      };
    }
    let xml: string;
    try {
      xml = strFromU8(doc);
    } catch {
      return { ok: false, ext, reason: "DOCX main document is not valid UTF-8." };
    }
    if (!isXmlWellFormed(xml, "<w:document")) {
      return {
        ok: false,
        ext,
        reason:
          "DOCX main document is malformed. Re-save from Word (File → Save As → .docx) and re-upload.",
      };
    }
    // Content Types file is also required by OOXML.
    if (!entries["[Content_Types].xml"]) {
      return {
        ok: false,
        ext,
        reason: "DOCX is missing [Content_Types].xml.",
      };
    }
    return { ok: true, ext };
  }

  // epub
  const container = entries["META-INF/container.xml"];
  if (!container) {
    return { ok: false, ext, reason: "EPUB is missing META-INF/container.xml." };
  }
  const hasOpf = Object.keys(entries).some((k) => k.toLowerCase().endsWith(".opf"));
  if (!hasOpf) {
    return { ok: false, ext, reason: "EPUB is missing its .opf package file." };
  }
  return { ok: true, ext };
}

export async function validateManuscriptFile(file: File): Promise<ValidateResult> {
  const ext = extFromName(file.name);
  if (ext === "unknown") {
    return { ok: false, ext, reason: "Unsupported file type." };
  }
  if (file.size === 0) {
    return { ok: false, ext, reason: "File is empty." };
  }

  // PDFs can be hundreds of MB. Loading the whole file into memory just to
  // sniff the header/EOF crashes mobile Chrome tabs on large uploads (tab
  // dies mid-validation and the browser navigates back — appearing as if
  // the upload silently "routes away"). Read only the head + tail slices.
  if (ext === "pdf") {
    const headBuf = await file.slice(0, 5).arrayBuffer();
    const head = new Uint8Array(headBuf);
    const headerStr = String.fromCharCode(head[0] ?? 0, head[1] ?? 0, head[2] ?? 0, head[3] ?? 0, head[4] ?? 0);
    if (headerStr !== "%PDF-") {
      return { ok: false, ext, reason: "Not a valid PDF (missing header)." };
    }
    const tailStart = Math.max(0, file.size - 2048);
    const tailBuf = await file.slice(tailStart).arrayBuffer();
    const tail = new Uint8Array(tailBuf);
    let tailStr = "";
    for (let i = 0; i < tail.length; i++) tailStr += String.fromCharCode(tail[i]);
    if (!tailStr.includes("%%EOF")) {
      return { ok: false, ext, reason: "PDF appears truncated (no EOF marker)." };
    }
    return { ok: true, ext };
  }

  // docx/epub are ZIP containers — we need the full bytes to unzip.
  const buf = await file.arrayBuffer();
  return validateManuscriptBytes(new Uint8Array(buf), file.name);
}
