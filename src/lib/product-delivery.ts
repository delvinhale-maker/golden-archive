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

/** Human label for a delivery file, falling back to the stored file name. */
export function displayName(f: Pick<DeliveryFile, "label" | "file_path">): string {
  const label = f.label?.trim();
  if (label) return label;
  const raw = f.file_path.split("/").pop() ?? f.file_path;
  return raw.replace(/^\d+-/, "");
}

/** Sorts primary first, then by explicit order, then label. */
export function sortDeliveryFiles<T extends Pick<DeliveryFile, "is_primary" | "sort_order" | "label">>(
  files: T[],
): T[] {
  return [...files].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return (a.label ?? "").localeCompare(b.label ?? "");
  });
}
