/**
 * AurumVault Audiobook Studio — Phase 2 metadata completeness rules.
 *
 * Pure. Produces a completeness score plus explicit blockers. A blocker is a
 * field whose absence makes the audiobook unfit for distribution; a warning is
 * merely advisable. Nothing here claims distribution eligibility on its own —
 * see audiobook-readiness.ts.
 */

export type AudiobookMetadataInput = {
  title?: string | null;
  subtitle?: string | null;
  authorName?: string | null;
  narratorName?: string | null;
  publisher?: string | null;
  description?: string | null;
  language?: string | null;
  isbn?: string | null;
  genre?: string | null;
  keywords?: string[] | null;
  coverPath?: string | null;
  copyrightYear?: number | null;
};

export type MetadataIssue = {
  code: string;
  field: string;
  severity: "BLOCKER" | "WARNING";
  message: string;
};

export type MetadataEvaluation = {
  score: number;
  isComplete: boolean;
  blockers: MetadataIssue[];
  warnings: MetadataIssue[];
};

const MIN_DESCRIPTION_CHARS = 80;

function present(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function evaluateAudiobookMetadata(input: AudiobookMetadataInput): MetadataEvaluation {
  const issues: MetadataIssue[] = [];

  if (!present(input.title)) {
    issues.push({ code: "META_TITLE_MISSING", field: "title", severity: "BLOCKER", message: "Title is required." });
  }
  if (!present(input.authorName)) {
    issues.push({ code: "META_AUTHOR_MISSING", field: "authorName", severity: "BLOCKER", message: "Author name is required." });
  }
  if (!present(input.narratorName)) {
    issues.push({
      code: "META_NARRATOR_MISSING",
      field: "narratorName",
      severity: "BLOCKER",
      message: "Narrator must be credited (synthetic narration still requires disclosure).",
    });
  }
  if (!present(input.language)) {
    issues.push({ code: "META_LANGUAGE_MISSING", field: "language", severity: "BLOCKER", message: "Language is required." });
  }
  if (!present(input.description)) {
    issues.push({
      code: "META_DESCRIPTION_MISSING",
      field: "description",
      severity: "BLOCKER",
      message: "Description is required.",
    });
  } else if ((input.description ?? "").trim().length < MIN_DESCRIPTION_CHARS) {
    issues.push({
      code: "META_DESCRIPTION_SHORT",
      field: "description",
      severity: "BLOCKER",
      message: `Description must be at least ${MIN_DESCRIPTION_CHARS} characters.`,
    });
  }
  if (!present(input.coverPath)) {
    issues.push({ code: "META_COVER_MISSING", field: "coverPath", severity: "BLOCKER", message: "Cover art is required." });
  }

  if (!present(input.publisher)) {
    issues.push({ code: "META_PUBLISHER_MISSING", field: "publisher", severity: "WARNING", message: "Publisher is recommended." });
  }
  if (!present(input.genre)) {
    issues.push({ code: "META_GENRE_MISSING", field: "genre", severity: "WARNING", message: "Genre helps discoverability." });
  }
  if (!input.keywords || input.keywords.length === 0) {
    issues.push({ code: "META_KEYWORDS_MISSING", field: "keywords", severity: "WARNING", message: "Add a few keywords." });
  }
  if (!input.copyrightYear) {
    issues.push({ code: "META_COPYRIGHT_MISSING", field: "copyrightYear", severity: "WARNING", message: "Copyright year is recommended." });
  }
  if (!present(input.isbn)) {
    issues.push({ code: "META_ISBN_MISSING", field: "isbn", severity: "WARNING", message: "ISBN is optional but required by some distributors." });
  }

  const blockers = issues.filter((i) => i.severity === "BLOCKER");
  const warnings = issues.filter((i) => i.severity === "WARNING");

  const blockerFields = 6;
  const warningFields = 5;
  const blockerScore = ((blockerFields - Math.min(blockers.length, blockerFields)) / blockerFields) * 60;
  const warningScore = ((warningFields - Math.min(warnings.length, warningFields)) / warningFields) * 40;
  const score = Math.round(blockerScore + warningScore);

  return { score, isComplete: blockers.length === 0, blockers, warnings };
}