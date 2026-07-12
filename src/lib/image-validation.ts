// Pure validation helpers for admin thumbnail uploads.
// Extracted so they can be unit-tested without pulling in the route/UI.

export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp", "gif"] as const;
export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const MIN_DIMENSION = 200; // px
export const MAX_DIMENSION = 4000; // px

export type ValidationError = { title: string; description: string };

export function formatBytes(n: number) {
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateImageFile(file: File): ValidationError | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeOk = ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number]);
  const extOk = ALLOWED_EXT.includes(ext as (typeof ALLOWED_EXT)[number]);
  if (!mimeOk && !extOk) {
    return {
      title: "Unsupported file type",
      description: `Please upload a JPG, PNG, WEBP, or GIF image. The selected file does not match any of these formats.`,
    };
  }
  if (file.size === 0) {
    return {
      title: "File is empty",
      description: "The selected image has no content. Please choose a different file.",
    };
  }
  if (file.size > MAX_BYTES) {
    return {
      title: "File too large",
      description: `This image is ${formatBytes(file.size)}. Please compress or resize it to ${formatBytes(MAX_BYTES)} or smaller before uploading.`,
    };
  }
  return null;
}

export function validateImageDimensions(width: number, height: number): ValidationError | null {
  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    return {
      title: "Image dimensions too small",
      description: `This image is ${width}×${height} px. Please use an image that is at least ${MIN_DIMENSION}×${MIN_DIMENSION} px on each side.`,
    };
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    return {
      title: "Image dimensions too large",
      description: `This image is ${width}×${height} px. Please use an image that is no larger than ${MAX_DIMENSION}×${MAX_DIMENSION} px on each side.`,
    };
  }
  return null;
}
