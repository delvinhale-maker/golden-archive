/**
 * Shared helpers for the digital delivery system: a product can ship several
 * downloadable files (e.g. a ZIP bundle plus the individual PDFs inside it).
 * ZIP is a delivery format only — never a storefront category.
 */

export type DeliveryFile = {
  id: string;
  product_id: string;
  seller_id: string;
  label: string;
  file_path: string;
  file_size_bytes: number | null;
  format: string | null;
  is_primary: boolean;
  sort_order: number;
};

export type DeliveryFileSummary = {
  id: string;
  product_id: string;
  label: string;
  file_size_bytes: number | null;
  format: string | null;
  is_primary: boolean;
  sort_order: number;
};

export const DELIVERY_EXTENSIONS = [
  "zip",
  "pdf",
  "docx",
  "xlsx",
  "pptx",
  "csv",
  "epub",
  "txt",
  "png",
  "jpg",
  "jpeg",
  "mp3",
] as const;

export const DELIVERY_ACCEPT = DELIVERY_EXTENSIONS.map((e) => `.${e}`).join(",");

export const MAX_DELIVERY_BYTES = 500 * 1024 * 1024;

export function extOf(nameOrPath: string): string {
  const cleaned = nameOrPath.split("#")[0].split("?")[0];
  return cleaned.includes(".") ? (cleaned.split(".").pop() ?? "").toLowerCase() : "";
}

export function isAllowedDeliveryFile(name: string): boolean {
  return (DELIVERY_EXTENSIONS as readonly string[]).includes(extOf(name));
}

/**
 * MIME types browsers report per delivery extension. Kept permissive because
 * mobile browsers frequently send "" or application/octet-stream for ZIP and
 * Office files — those are accepted, anything that clearly contradicts the
 * extension is not.
 */
const DELIVERY_MIME: Record<string, string[]> = {
  zip: [
    "application/zip",
    "application/x-zip-compressed",
    "application/x-zip",
    "multipart/x-zip",
  ],
  pdf: ["application/pdf"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  csv: ["text/csv", "application/csv", "text/plain"],
  epub: ["application/epub+zip"],
  txt: ["text/plain"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  mp3: ["audio/mpeg", "audio/mp3"],
};

const NEUTRAL_MIME = ["", "application/octet-stream", "application/binary"];

/** True when the reported MIME type is consistent with the file extension. */
export function isAllowedDeliveryMime(name: string, mime: string | undefined): boolean {
  const expected = DELIVERY_MIME[extOf(name)];
  if (!expected) return false;
  const m = (mime ?? "").toLowerCase().split(";")[0].trim();
  if (NEUTRAL_MIME.includes(m)) return true;
  return expected.includes(m);
}

export function formatLabel(nameOrPath: string | null): string {
  const e = extOf(nameOrPath ?? "");
  return e ? e.toUpperCase() : "FILE";
}

export function formatBytes(bytes: number | null | undefined): string | null {
  if (!bytes || bytes <= 0) return null;
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

/** Human label for a delivery file, falling back to the stored file name only on private admin views. */
export function displayName(f: { label?: string | null; file_path?: string | null }): string {
  const label = f.label?.trim();
  if (label) return label;
  const raw = f.file_path?.split("/").pop() ?? "Included file";
  return raw.replace(/^\d+-/, "");
}

/** Sorts primary first, then by explicit order, then label. */
export function sortDeliveryFiles<T extends Pick<DeliveryFileSummary, "is_primary" | "sort_order" | "label">>(
  files: T[],
): T[] {
  return [...files].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return (a.label ?? "").localeCompare(b.label ?? "");
  });
}
