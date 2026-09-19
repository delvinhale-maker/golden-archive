/**
 * AurumVault Audiobook Studio — Phase 2 pure manuscript-to-chapters parser.
 *
 * SOURCE TEXT IS IMMUTABLE: this module never rewrites the author's words.
 * It only *locates* chapter boundaries in the extracted flat text and emits
 * chapters as separate records (offsets into the original string), matching
 * the Phase 1 schema rule that audiobook_chapters.original_text is immutable
 * and all edits live in audiobook_chapter_versions.
 *
 * Binary extraction (DOCX/EPUB/PDF) lives in audiobook-parse.server.ts —
 * this file stays dependency-free and unit-testable.
 */

export type AudiobookSourceKind = "txt" | "docx" | "epub" | "pdf";

export type ParsedChapter = {
  index: number;
  title: string | null;
  text: string;
  charCount: number;
  startOffset: number;
  endOffset: number;
};

export type ParseChaptersResult =
  | { ok: true; chapters: ParsedChapter[]; charCount: number; wordCount: number }
  | { ok: false; reason: string };

const SUPPORTED: AudiobookSourceKind[] = ["txt", "docx", "epub", "pdf"];

export function audiobookSourceKind(filename: string): AudiobookSourceKind | "unknown" {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return (SUPPORTED as string[]).includes(ext) ? (ext as AudiobookSourceKind) : "unknown";
}

/**
 * Heading detector. Deliberately conservative — a false positive splits a
 * chapter mid-prose, which is worse for narration than under-splitting.
 */
const HEADING_PATTERNS: RegExp[] = [
  /^\s*chapter\s+([0-9]+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b.*$/i,
  /^\s*(prologue|epilogue|foreword|preface|introduction|afterword|acknowledg(e)?ments|dedication)\s*$/i,
  /^\s*part\s+([0-9]+|[ivxlcdm]+)\b.*$/i,
];

export function isChapterHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 120) return false;
  return HEADING_PATTERNS.some((re) => re.test(trimmed));
}

export function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

/**
 * Splits already-extracted flat text into chapters. When no headings are
 * found the whole manuscript becomes a single chapter — truthful rather than
 * inventing structure that is not in the source.
 */
export function parseChaptersFromText(rawText: string): ParseChaptersResult {
  if (typeof rawText !== "string") return { ok: false, reason: "No text extracted." };
  const text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (text.trim().length === 0) {
    return { ok: false, reason: "Manuscript contains no readable text." };
  }

  const lines = text.split("\n");
  const boundaries: Array<{ offset: number; title: string }> = [];
  let offset = 0;
  for (const line of lines) {
    if (isChapterHeading(line)) boundaries.push({ offset, title: line.trim() });
    offset += line.length + 1;
  }

  const chapters: ParsedChapter[] = [];
  if (boundaries.length === 0) {
    chapters.push({
      index: 0,
      title: null,
      text,
      charCount: text.length,
      startOffset: 0,
      endOffset: text.length,
    });
  } else {
    // Preserve any front matter that precedes the first heading.
    const first = boundaries[0]!;
    if (text.slice(0, first.offset).trim().length > 0) {
      const front = text.slice(0, first.offset);
      chapters.push({
        index: 0,
        title: null,
        text: front,
        charCount: front.length,
        startOffset: 0,
        endOffset: first.offset,
      });
    }
    for (let i = 0; i < boundaries.length; i++) {
      const start = boundaries[i]!.offset;
      const end = i + 1 < boundaries.length ? boundaries[i + 1]!.offset : text.length;
      const slice = text.slice(start, end);
      if (slice.trim().length === 0) continue;
      chapters.push({
        index: chapters.length,
        title: boundaries[i]!.title,
        text: slice,
        charCount: slice.length,
        startOffset: start,
        endOffset: end,
      });
    }
  }

  return {
    ok: true,
    chapters: chapters.map((c, i) => ({ ...c, index: i })),
    charCount: text.length,
    wordCount: countWords(text),
  };
}