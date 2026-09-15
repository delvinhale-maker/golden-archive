/**
 * AurumVault Audiobook Studio — Phase 2 server-side manuscript extraction.
 *
 * Mirrors the already-proven extraction pattern in
 * rights-passport-doc-parse.server.ts (dynamic pdfjs-dist legacy build,
 * mammoth for DOCX) and adds EPUB via fflate, then hands the flat text to the
 * pure chapter splitter in audiobook-parser.ts.
 *
 * TRUTHFUL FAILURE: encrypted, scanned or garbled documents return an error —
 * text is never fabricated, and the caller must not persist a chapter set.
 */
import {
  parseChaptersFromText,
  audiobookSourceKind,
  type ParseChaptersResult,
  type AudiobookSourceKind,
} from "@/lib/audiobook-parser";

export type ExtractResult =
  | { ok: true; text: string; pageCount: number | null }
  | { ok: false; errorCode: string; message: string };

/** Heuristic for image-only / OCR-required PDFs. */
function looksUnextractable(text: string, unit: number): boolean {
  const perUnit = text.replace(/\s+/g, "").length / Math.max(1, unit);
  return perUnit < 40;
}

export async function extractTxt(bytes: Uint8Array): Promise<ExtractResult> {
  try {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (text.trim().length === 0) {
      return { ok: false, errorCode: "TXT_EMPTY", message: "This text file contains no readable text." };
    }
    return { ok: true, text, pageCount: null };
  } catch {
    return { ok: false, errorCode: "TXT_PARSE_FAILED", message: "Couldn't read this text file." };
  }
}

export async function extractDocx(bytes: Uint8Array): Promise<ExtractResult> {
  try {
    const mammoth: any = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    const text: string = result?.value ?? "";
    if (text.trim().length === 0) {
      return {
        ok: false,
        errorCode: "DOCX_EMPTY",
        message: "This Word document contains no extractable text.",
      };
    }
    return { ok: true, text, pageCount: null };
  } catch {
    return {
      ok: false,
      errorCode: "DOCX_PARSE_FAILED",
      message: "Couldn't read this Word document. It may be corrupted or password-protected.",
    };
  }
}

export async function extractPdf(bytes: Uint8Array): Promise<ExtractResult> {
  try {
    const { ensurePdfJsRuntimeCompat } = await import("@/lib/pdfjs-compat");
    ensurePdfJsRuntimeCompat();
    const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: bytes, disableWorker: true, isEvalSupported: false })
      .promise;

    const parts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      parts.push(
        (content.items as Array<{ str?: string }>).map((item) => item.str ?? "").join(" "),
      );
    }
    const text = parts.join("\n\n");
    if (text.trim().length === 0 || looksUnextractable(text, doc.numPages)) {
      return {
        ok: false,
        errorCode: "PDF_TEXT_UNAVAILABLE",
        message:
          "This PDF has no extractable text (it may be scanned or image-only). Upload a text-based PDF, DOCX, EPUB or TXT file.",
      };
    }
    return { ok: true, text, pageCount: doc.numPages };
  } catch {
    return {
      ok: false,
      errorCode: "PDF_PARSE_FAILED",
      message: "Couldn't read this PDF. It may be corrupted or password-protected.",
    };
  }
}

function stripXhtml(xhtml: string): string {
  return xhtml
    .replace(/<\s*(script|style)[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<\s*\/\s*(p|div|h[1-6]|li|br)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

export async function extractEpub(bytes: Uint8Array): Promise<ExtractResult> {
  try {
    const { unzipSync, strFromU8 } = await import("fflate");
    const files = unzipSync(bytes);
    const names = Object.keys(files).filter((n) => /\.(x?html|htm)$/i.test(n)).sort();
    if (names.length === 0) {
      return {
        ok: false,
        errorCode: "EPUB_NO_CONTENT",
        message: "This EPUB has no readable content documents.",
      };
    }
    const parts: string[] = [];
    for (const name of names) {
      const raw = files[name];
      if (!raw) continue;
      const text = stripXhtml(strFromU8(raw)).trim();
      if (text.length > 0) parts.push(text);
    }
    const text = parts.join("\n\n");
    if (text.trim().length === 0) {
      return {
        ok: false,
        errorCode: "EPUB_EMPTY",
        message: "This EPUB contains no extractable text.",
      };
    }
    return { ok: true, text, pageCount: null };
  } catch {
    return {
      ok: false,
      errorCode: "EPUB_PARSE_FAILED",
      message: "Couldn't read this EPUB. It may be corrupted or DRM-protected.",
    };
  }
}

export async function extractManuscriptText(
  filename: string,
  bytes: Uint8Array,
): Promise<ExtractResult> {
  const kind: AudiobookSourceKind | "unknown" = audiobookSourceKind(filename);
  switch (kind) {
    case "txt":
      return extractTxt(bytes);
    case "docx":
      return extractDocx(bytes);
    case "epub":
      return extractEpub(bytes);
    case "pdf":
      return extractPdf(bytes);
    default:
      return {
        ok: false,
        errorCode: "UNSUPPORTED_SOURCE_TYPE",
        message: "Unsupported manuscript type. Upload a TXT, DOCX, EPUB or text-based PDF.",
      };
  }
}

export type ParseSourceResult =
  | { ok: true; chapters: ParseChaptersResult; pageCount: number | null; text: string }
  | { ok: false; errorCode: string; message: string };

/** Extract + split. The returned text is the authoritative immutable source. */
export async function parseManuscriptSource(
  filename: string,
  bytes: Uint8Array,
): Promise<ParseSourceResult> {
  const extracted = await extractManuscriptText(filename, bytes);
  if (!extracted.ok) return extracted;
  const chapters = parseChaptersFromText(extracted.text);
  if (!chapters.ok) {
    return { ok: false, errorCode: "CHAPTER_SPLIT_FAILED", message: chapters.reason };
  }
  return { ok: true, chapters, pageCount: extracted.pageCount, text: extracted.text };
}