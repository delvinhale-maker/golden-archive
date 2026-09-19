/**
 * AurumVault Digital Rights Passport Generator — Round 3 document chunking.
 *
 * Pure, dependency-free (like rights-passport-risk-rules.ts and
 * rights-passport-readiness-v2.ts before it) — no zod, no
 * @supabase/supabase-js, no pdfjs-dist/mammoth. Those libraries do the
 * actual byte-level extraction in rights-passport-doc-parse.server.ts; this
 * module turns their raw text output into the page/section/offset-preserving
 * ParsedPage[] shape the analysis layer and the evidence-grounded finding
 * format both depend on. Being dependency-free keeps it genuinely
 * executable in this sandbox's test runner (which lacks those packages).
 *
 * SAFETY: this module never invents text. A page/section with no extractable
 * content is preserved as an empty string, never dropped or fabricated.
 */

export type ParsedPage = {
  page: number | null;
  section: string | null;
  text: string;
  charStart: number;
  charEnd: number;
};

/** A line is treated as a heading if it's short and looks like a title/number, not prose. */
const HEADING_PATTERNS = [
  /^\s*(ARTICLE|SECTION|EXHIBIT|SCHEDULE|APPENDIX)\s+[A-Z0-9]+[.:)]?\s*.{0,80}$/i,
  /^\s*\d{1,3}(\.\d{1,3})*[.)]\s+[A-Z][A-Za-z0-9 ,'&/-]{2,80}$/,
  /^\s*[A-Z][A-Z0-9 ,'&/-]{3,80}$/, // ALL CAPS heading line
];

function looksLikeHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 90) return false;
  if (trimmed.endsWith(".") && !/^\d/.test(trimmed)) return false; // prose sentences end in periods
  return HEADING_PATTERNS.some((re) => re.test(trimmed));
}

/**
 * Splits flat text (DOCX/TXT extraction has no native page concept) into
 * section-labeled chunks by detecting heading-shaped lines. Text before the
 * first detected heading gets section: null. Offsets are character indices
 * into the ORIGINAL full text passed in, so a finding's source.quote can
 * always be traced back to exactly where it came from.
 */
export function chunkFlatText(fullText: string): ParsedPage[] {
  if (!fullText) return [];
  const lines = fullText.split("\n");

  type Section = { heading: string | null; startLine: number };
  const firstLineIsHeading = lines.length > 0 && looksLikeHeading(lines[0]);
  const sections: Section[] = [
    { heading: firstLineIsHeading ? lines[0].trim() : null, startLine: 0 },
  ];

  let offset = 0;
  const lineOffsets: number[] = [];
  for (const line of lines) {
    lineOffsets.push(offset);
    offset += line.length + 1; // +1 for the split "\n"
  }

  lines.forEach((line, i) => {
    if (i > 0 && looksLikeHeading(line)) {
      sections.push({ heading: line.trim(), startLine: i });
    }
  });

  const pages: ParsedPage[] = [];
  for (let s = 0; s < sections.length; s++) {
    const startLine = sections[s].startLine;
    const endLine = s + 1 < sections.length ? sections[s + 1].startLine : lines.length;
    if (endLine <= startLine) continue;
    const charStart = lineOffsets[startLine] ?? 0;
    const lastLineIdx = endLine - 1;
    const lastLineText = lines[lastLineIdx] ?? "";
    const charEnd = (lineOffsets[lastLineIdx] ?? charStart) + lastLineText.length;
    const text = fullText.slice(charStart, charEnd);
    if (!text.trim() && sections[s].heading === null) continue; // skip a fully-empty leading section
    pages.push({ page: null, section: sections[s].heading, text, charStart, charEnd });
  }

  return pages.length > 0
    ? pages
    : [{ page: null, section: null, text: fullText, charStart: 0, charEnd: fullText.length }];
}

/**
 * Turns per-page raw text (as extracted page-by-page by a PDF parser) into
 * ParsedPage[] with correct offsets, applying the same section-heading
 * detection within each page. Offsets are per-page (charStart/charEnd index
 * into that page's own text), since PDF pages are the natural addressable
 * unit for a source citation (`page: N`) — unlike flat DOCX/TXT text, which
 * has no page boundaries to offset against.
 */
export function pagesFromPdfText(pageTexts: string[]): ParsedPage[] {
  const pages: ParsedPage[] = [];
  pageTexts.forEach((raw, idx) => {
    const pageNumber = idx + 1;
    if (!raw.trim()) {
      pages.push({ page: pageNumber, section: null, text: raw, charStart: 0, charEnd: raw.length });
      return;
    }
    const chunks = chunkFlatText(raw);
    for (const chunk of chunks) {
      pages.push({ ...chunk, page: pageNumber });
    }
  });
  return pages;
}

/**
 * True when a PDF's extracted per-page text is effectively empty across
 * every page — i.e. the PDF has no text layer and is image-only. Marks
 * parse_status = OCR_REQUIRED rather than silently treating the document as
 * having no content (never hallucinate text; never silently drop the page).
 */
export function looksLikeOcrRequired(pageTexts: string[]): boolean {
  if (pageTexts.length === 0) return false;
  return pageTexts.every((t) => t.trim().length < 20);
}

/** Total extractable character count across all parsed pages/sections. */
export function totalParsedChars(pages: ParsedPage[]): number {
  return pages.reduce((sum, p) => sum + p.text.length, 0);
}

/**
 * Joins parsed pages into one bounded string for a single AI pass prompt —
 * cost control (§14): avoids sending the whole document on every pass by
 * capping total characters, while keeping each page's own [Page N] / section
 * marker intact so the model can still cite a real page/section in its
 * findings. Never truncates mid-page silently without a marker — a
 * truncated document ends with an explicit "[TRUNCATED]" note so the model
 * (and, by extension, any finding it produces past that point) never treats
 * cut-off content as complete.
 */
export function boundDocumentText(pages: ParsedPage[], maxChars: number): string {
  const parts: string[] = [];
  let used = 0;
  for (const p of pages) {
    const label = [p.page ? `Page ${p.page}` : null, p.section].filter(Boolean).join(" — ");
    const chunk = label ? `[${label}]\n${p.text}` : p.text;
    if (used + chunk.length > maxChars) {
      const remaining = maxChars - used;
      if (remaining > 0) parts.push(chunk.slice(0, remaining));
      parts.push("\n[TRUNCATED — remaining document content omitted for length]");
      used = maxChars;
      break;
    }
    parts.push(chunk);
    used += chunk.length;
  }
  return parts.join("\n\n");
}
