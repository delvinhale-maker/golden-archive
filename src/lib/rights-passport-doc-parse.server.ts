/**
 * AurumVault Digital Rights Passport Generator — Round 3 server-side text
 * extraction. Turns raw document bytes into ParsedPage[] using this repo's
 * already-installed parser libraries (pdfjs-dist, mammoth), then hands the
 * raw per-page/flat text to the pure chunker in rights-passport-doc-chunk.ts
 * for section detection and offset bookkeeping.
 *
 * PDF extraction mirrors the exact dynamic-import pattern already used
 * client-side in ManuscriptPreviewer.tsx (`pdfjs-dist/legacy/build/pdf.mjs`
 * + ensurePdfJsRuntimeCompat), run here in the legacy Node-compatible build
 * with no worker (server-side has no Worker/DOM to hand rendering off to —
 * text extraction runs synchronously in-process instead).
 *
 * Cannot be executed in this sandbox (pdfjs-dist/mammoth are declared in
 * package.json but not installed here — the same pre-existing,
 * environment-wide constraint documented for every other AI/parsing module
 * in this codebase). Source-level verified only; will run for real once
 * deployed where those packages are installed.
 */
import { ensurePdfJsRuntimeCompat } from "@/lib/pdfjs-compat";
import {
  chunkFlatText,
  pagesFromPdfText,
  looksLikeOcrRequired,
  type ParsedPage,
} from "@/lib/rights-passport-doc-chunk";

export type ParseResult =
  | { ok: true; pages: ParsedPage[]; pageCount: number | null; ocrRequired: false }
  | { ok: true; pages: ParsedPage[]; pageCount: number | null; ocrRequired: true }
  | { ok: false; errorCode: string; errorMessageSafe: string };

export async function parsePdfBytes(bytes: Uint8Array): Promise<ParseResult> {
  try {
    ensurePdfJsRuntimeCompat();
    const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({
      data: bytes,
      disableWorker: true,
      isEvalSupported: false,
    });
    const doc = await loadingTask.promise;

    const pageTexts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = (content.items as Array<{ str?: string }>)
        .map((item) => item.str ?? "")
        .join(" ");
      pageTexts.push(text);
    }

    if (looksLikeOcrRequired(pageTexts)) {
      return {
        ok: true,
        pages: pagesFromPdfText(pageTexts),
        pageCount: doc.numPages,
        ocrRequired: true,
      };
    }
    return {
      ok: true,
      pages: pagesFromPdfText(pageTexts),
      pageCount: doc.numPages,
      ocrRequired: false,
    };
  } catch (e) {
    return {
      ok: false,
      errorCode: "PDF_PARSE_FAILED",
      errorMessageSafe: "Couldn't read this PDF. It may be corrupted or password-protected.",
    };
  }
}

export async function parseDocxBytes(bytes: Uint8Array): Promise<ParseResult> {
  try {
    const mammoth: any = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    const text: string = result?.value ?? "";
    return { ok: true, pages: chunkFlatText(text), pageCount: null, ocrRequired: false };
  } catch (e) {
    return {
      ok: false,
      errorCode: "DOCX_PARSE_FAILED",
      errorMessageSafe:
        "Couldn't read this Word document. It may be corrupted or in an unsupported format.",
    };
  }
}

export function parseTxtBytes(bytes: Uint8Array): ParseResult {
  try {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return { ok: true, pages: chunkFlatText(text), pageCount: null, ocrRequired: false };
  } catch (e) {
    return {
      ok: false,
      errorCode: "TXT_PARSE_FAILED",
      errorMessageSafe: "Couldn't read this text file.",
    };
  }
}

export async function parseDocumentBytes(
  mimeType: string,
  bytes: Uint8Array,
): Promise<ParseResult> {
  switch (mimeType) {
    case "application/pdf":
      return parsePdfBytes(bytes);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return parseDocxBytes(bytes);
    case "text/plain":
      return parseTxtBytes(bytes);
    default:
      return {
        ok: false,
        errorCode: "UNSUPPORTED_MIME_TYPE",
        errorMessageSafe: "This file type isn't supported for parsing.",
      };
  }
}
