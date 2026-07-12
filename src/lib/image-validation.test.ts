import { describe, it, expect } from "vitest";
import {
  validateImageFile,
  validateImageDimensions,
  MAX_BYTES,
  MIN_DIMENSION,
  MAX_DIMENSION,
} from "./image-validation";

function makeFile(opts: { name?: string; type?: string; size?: number } = {}): File {
  const name = opts.name ?? "photo.jpg";
  const type = opts.type ?? "image/jpeg";
  const size = opts.size ?? 1024;
  // Build a Blob of the exact requested size, then wrap as File.
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

describe("validateImageFile — type", () => {
  it.each([
    ["image/jpeg", "photo.jpg"],
    ["image/png", "photo.png"],
    ["image/webp", "photo.webp"],
    ["image/gif", "photo.gif"],
  ])("accepts %s (%s)", (type, name) => {
    expect(validateImageFile(makeFile({ type, name }))).toBeNull();
  });

  it("rejects unsupported MIME + extension (PDF)", () => {
    const err = validateImageFile(makeFile({ type: "application/pdf", name: "doc.pdf" }));
    expect(err?.title).toBe("Unsupported file type");
  });

  it("rejects SVG (not in allow-list)", () => {
    const err = validateImageFile(makeFile({ type: "image/svg+xml", name: "icon.svg" }));
    expect(err?.title).toBe("Unsupported file type");
  });

  it("accepts when MIME is empty but extension is allowed", () => {
    expect(validateImageFile(makeFile({ type: "", name: "photo.png" }))).toBeNull();
  });

  it("accepts when extension is missing but MIME is allowed", () => {
    expect(validateImageFile(makeFile({ type: "image/jpeg", name: "photo" }))).toBeNull();
  });

  it("rejects when both MIME and extension are wrong", () => {
    const err = validateImageFile(makeFile({ type: "text/plain", name: "notes.txt" }));
    expect(err?.title).toBe("Unsupported file type");
  });
});

describe("validateImageFile — size", () => {
  it("rejects empty file", () => {
    const err = validateImageFile(makeFile({ size: 0 }));
    expect(err?.title).toBe("File is empty");
  });

  it("accepts file exactly at the max size", () => {
    expect(validateImageFile(makeFile({ size: MAX_BYTES }))).toBeNull();
  });

  it("rejects file just over the max size", () => {
    const err = validateImageFile(makeFile({ size: MAX_BYTES + 1 }));
    expect(err?.title).toBe("File too large");
    expect(err?.description).toContain("5.0 MB");
  });

  it("checks type before size (bad type + oversized => type error)", () => {
    const err = validateImageFile(
      makeFile({ type: "application/pdf", name: "doc.pdf", size: MAX_BYTES + 1 }),
    );
    expect(err?.title).toBe("Unsupported file type");
  });
});

describe("validateImageDimensions", () => {
  it("accepts an image at the min bound", () => {
    expect(validateImageDimensions(MIN_DIMENSION, MIN_DIMENSION)).toBeNull();
  });

  it("accepts an image at the max bound", () => {
    expect(validateImageDimensions(MAX_DIMENSION, MAX_DIMENSION)).toBeNull();
  });

  it("accepts a typical image", () => {
    expect(validateImageDimensions(1200, 800)).toBeNull();
  });

  it("rejects when width is below min", () => {
    const err = validateImageDimensions(MIN_DIMENSION - 1, 500);
    expect(err?.title).toBe("Image dimensions too small");
  });

  it("rejects when height is below min", () => {
    const err = validateImageDimensions(500, MIN_DIMENSION - 1);
    expect(err?.title).toBe("Image dimensions too small");
  });

  it("rejects when width exceeds max", () => {
    const err = validateImageDimensions(MAX_DIMENSION + 1, 1000);
    expect(err?.title).toBe("Image dimensions too large");
    expect(err?.description).toContain(`${MAX_DIMENSION + 1}`);
  });

  it("rejects when height exceeds max", () => {
    const err = validateImageDimensions(1000, MAX_DIMENSION + 1);
    expect(err?.title).toBe("Image dimensions too large");
  });

  it("reports 'too small' first when an image is both too small and (impossibly) too large", () => {
    // Guards ordering: min-check runs before max-check.
    const err = validateImageDimensions(10, 10);
    expect(err?.title).toBe("Image dimensions too small");
  });
});
