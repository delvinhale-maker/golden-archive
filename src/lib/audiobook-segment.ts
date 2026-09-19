/**
 * AurumVault Audiobook Studio — Phase 2 pure long-form segmentation.
 *
 * Deterministic by construction: the same input text and the same options
 * always produce byte-identical segment boundaries. This matters because
 * segment boundaries feed the idempotency key — non-deterministic chunking
 * would silently re-bill a provider for identical work.
 *
 * Dependency-free (no zod, no Supabase, no @tanstack) so it is unit-testable
 * and safe to import from both server and client code.
 */

export type AudiobookSegment = {
  /** 0-based, stable across runs. */
  index: number;
  text: string;
  charCount: number;
  /** Offsets into the ORIGINAL text (never mutated). */
  startOffset: number;
  endOffset: number;
};

export type SegmentOptions = {
  /** Hard ceiling per segment. Providers cap request size; default is conservative. */
  maxChars?: number;
  /** Below this we never split, to avoid orphan fragments. */
  minChars?: number;
};

export const DEFAULT_MAX_SEGMENT_CHARS = 3500;
export const DEFAULT_MIN_SEGMENT_CHARS = 400;

/** Normalizes line endings only. Never trims or rewrites the author's words. */
export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function lastIndexOfAny(haystack: string, needles: string[], from: number): number {
  let best = -1;
  for (const n of needles) {
    const i = haystack.lastIndexOf(n, from);
    if (i > best) best = i;
  }
  return best;
}

/**
 * Splits text into narration segments, preferring (in order) paragraph
 * breaks, sentence terminators, then whitespace, then a hard cut.
 */
export function segmentText(rawText: string, options: SegmentOptions = {}): AudiobookSegment[] {
  const maxChars = Math.max(200, options.maxChars ?? DEFAULT_MAX_SEGMENT_CHARS);
  const minChars = Math.max(0, Math.min(options.minChars ?? DEFAULT_MIN_SEGMENT_CHARS, maxChars - 1));
  const text = normalizeLineEndings(rawText);

  if (text.trim().length === 0) return [];
  if (text.length <= maxChars) {
    return [
      { index: 0, text, charCount: text.length, startOffset: 0, endOffset: text.length },
    ];
  }

  const segments: AudiobookSegment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const remaining = text.length - cursor;
    if (remaining <= maxChars) {
      const slice = text.slice(cursor);
      segments.push({
        index: segments.length,
        text: slice,
        charCount: slice.length,
        startOffset: cursor,
        endOffset: text.length,
      });
      break;
    }

    const window = text.slice(cursor, cursor + maxChars);
    const searchFrom = window.length - 1;
    let cut = -1;

    const paragraph = window.lastIndexOf("\n\n", searchFrom);
    if (paragraph >= minChars) cut = paragraph + 2;

    if (cut < 0) {
      const sentence = lastIndexOfAny(window, [". ", ".\n", "! ", "? ", '." ', "!\n", "?\n"], searchFrom);
      if (sentence >= minChars) cut = sentence + 2;
    }
    if (cut < 0) {
      const space = lastIndexOfAny(window, [" ", "\n"], searchFrom);
      if (space >= minChars) cut = space + 1;
    }
    if (cut <= 0 || cut > window.length) cut = maxChars;

    const slice = text.slice(cursor, cursor + cut);
    segments.push({
      index: segments.length,
      text: slice,
      charCount: slice.length,
      startOffset: cursor,
      endOffset: cursor + cut,
    });
    cursor += cut;
  }

  return segments;
}

/** Total billable characters for a set of segments. */
export function totalCharacters(segments: AudiobookSegment[]): number {
  return segments.reduce((sum, s) => sum + s.charCount, 0);
}

/**
 * Stable canonical fingerprint of a segmentation plan. Used by the
 * idempotency helper so identical narration requests collapse to one job.
 */
export function segmentationFingerprint(segments: AudiobookSegment[]): string {
  return segments.map((s) => `${s.index}:${s.startOffset}-${s.endOffset}`).join("|");
}