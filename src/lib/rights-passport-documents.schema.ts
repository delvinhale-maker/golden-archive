/**
 * AurumVault Digital Rights Passport Generator — Round 3 (Upload & Analyze)
 * document record schema: types, statuses, Zod validators, row shapes.
 *
 * Kept separate from rights-passport-workspace.schema.ts for the same
 * reason that module gave for existing on its own: a large, independently
 * reusable slice. storage_path and parsed_content are deliberately excluded
 * from DOCUMENT_LIST_COLS — the document list screen never needs the raw
 * storage path (access is always server-mediated through a signed URL) or
 * the full parsed text (which can be large); DOCUMENT_COLS (with both) is
 * for internal server-function use only, never returned to a list query.
 */
import { z } from "zod";

export const DOCUMENT_TYPES = [
  "LICENSING_AGREEMENT",
  "ENDORSEMENT_AGREEMENT",
  "MUSIC_AGREEMENT",
  "CREATOR_AGREEMENT",
  "TALENT_RELEASE",
  "ASSIGNMENT",
  "BRAND_AGREEMENT",
  "REGISTRATION",
  "EVIDENCE_DOCUMENT",
  "PLATFORM_TERMS",
  "OTHER",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  LICENSING_AGREEMENT: "Licensing Agreement",
  ENDORSEMENT_AGREEMENT: "Endorsement Agreement",
  MUSIC_AGREEMENT: "Music Agreement",
  CREATOR_AGREEMENT: "Creator Agreement",
  TALENT_RELEASE: "Talent Release",
  ASSIGNMENT: "Assignment",
  BRAND_AGREEMENT: "Brand Agreement",
  REGISTRATION: "Registration",
  EVIDENCE_DOCUMENT: "Evidence Document",
  PLATFORM_TERMS: "Platform Terms",
  OTHER: "Other",
};

// Server-computed lifecycle. EMPTY and UPLOADING are client-only UI states
// that never appear here — EMPTY means no document row exists yet, and
// UPLOADING means the browser is still writing bytes to storage before
// registerDocument has been called.
export const DOCUMENT_STATUSES = [
  "UPLOADED",
  "PARSING",
  "PARSED",
  "ANALYZING",
  "REVIEW_REQUIRED",
  "READY_FOR_REVIEW",
  "ACCEPTED",
  "PARTIALLY_ACCEPTED",
  "REJECTED",
  "FAILED",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const PARSE_STATUSES = ["PENDING", "PARSING", "PARSED", "OCR_REQUIRED", "FAILED"] as const;
export type ParseStatus = (typeof PARSE_STATUSES)[number];

export const ANALYSIS_STATUSES = ["PENDING", "ANALYZING", "COMPLETE", "PARTIAL", "FAILED"] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MIME_TO_EXT: Record<AllowedMimeType, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
};

/** Mirrors the DB CHECK constraint (rights_passport_documents_size_bounds). */
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

/** One page/section chunk of parsed source text, offsets into that chunk only. */
export type ParsedPage = {
  page: number | null;
  section: string | null;
  text: string;
  charStart: number;
  charEnd: number;
};

/**
 * Sanitizes a user-supplied filename to a safe storage leaf: strips path
 * separators and anything outside a conservative allowlist, so it can never
 * be used to escape the {user_id}/{passport_key}/{document_id}/ prefix or
 * inject a path traversal segment.
 */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file";
  const cleaned = base.replace(/[^a-zA-Z0-9.\-_ ]/g, "_").trim();
  const trimmed = cleaned.length > 0 ? cleaned : "file";
  return trimmed.slice(0, 200);
}

export const registerDocumentSchema = z.object({
  passportKey: z.string().uuid(),
  fileName: z.string().trim().min(1).max(200),
  originalFileName: z.string().trim().min(1).max(300),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  fileSizeBytes: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
  storagePath: z.string().trim().min(1).max(1000),
  documentType: z.enum(DOCUMENT_TYPES).optional(),
});
export type RegisterDocumentInput = z.infer<typeof registerDocumentSchema>;

export type DocumentRow = {
  id: string;
  passport_key: string;
  file_name: string;
  original_file_name: string;
  mime_type: string;
  file_size_bytes: number;
  document_type: DocumentType;
  status: DocumentStatus;
  page_count: number | null;
  parse_status: ParseStatus;
  analysis_status: AnalysisStatus;
  uploaded_at: string;
  parsed_at: string | null;
  analyzed_at: string | null;
  error_code: string | null;
  error_message_safe: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentRowInternal = DocumentRow & {
  storage_path: string;
  parsed_content: ParsedPage[] | null;
};

/** Never includes storage_path or parsed_content — see module docstring. */
export const DOCUMENT_LIST_COLS =
  "id,passport_key,file_name,original_file_name,mime_type,file_size_bytes,document_type,status,page_count,parse_status,analysis_status,uploaded_at,parsed_at,analyzed_at,error_code,error_message_safe,created_at,updated_at";

/** Server-internal only — includes storage_path and parsed_content. */
export const DOCUMENT_INTERNAL_COLS = `${DOCUMENT_LIST_COLS},storage_path,parsed_content`;
