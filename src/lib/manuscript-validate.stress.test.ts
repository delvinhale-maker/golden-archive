import { describe, it, expect } from "vitest";
import { validateManuscriptFile } from "./manuscript-validate";

/**
 * Stress / regression tests for the large-PDF upload path.
 *
 * Background: on mobile Chrome, `File.arrayBuffer()` on a 300–650 MB PDF
 * blows past the tab's memory ceiling and kills the tab mid-validation —
 * the browser then navigates back, so users experience it as the upload
 * "routing away" to Lovable. The validator was refactored to sniff only
 * the first 5 bytes (`%PDF-`) and the last 2048 bytes (`%%EOF`) via
 * `File.slice(...).arrayBuffer()`, never reading the whole file.
 *
 * These tests guard that contract by using a synthetic File-like whose
 * `slice()` returns a Blob-like that tracks total bytes materialized. If
 * the validator ever regresses to a full-file read on PDFs, the byte
 * counter will explode and the test will fail long before it OOMs CI.
 */

type SliceCall = { start: number; end: number };

function fakePdfFile(sizeBytes: number, opts: { corruptHeader?: boolean; noEof?: boolean } = {}) {
  const sliceCalls: SliceCall[] = [];
  let totalMaterialized = 0;

  const HEADER = new TextEncoder().encode(opts.corruptHeader ? "NOPDF" : "%PDF-1.7\n");
  const EOF_MARKER = new TextEncoder().encode(opts.noEof ? "not-an-eof\n" : "\n%%EOF\n");

  const materialize = (start: number, end: number): Uint8Array => {
    // Only synthesize bytes for slices near the head or tail. Anything else
    // means the validator tried to read the body — the very regression we
    // are guarding against.
    const len = end - start;
    if (len > 1024 * 1024) {
      throw new Error(
        `Regression: validator requested a ${len}-byte slice (start=${start}, end=${end}). ` +
          `The mobile OOM fix requires head+tail sniff only.`,
      );
    }
    const buf = new Uint8Array(len);
    if (start === 0) {
      buf.set(HEADER.subarray(0, Math.min(HEADER.length, len)), 0);
    }
    if (end === sizeBytes) {
      const tail = EOF_MARKER;
      buf.set(tail.subarray(0, Math.min(tail.length, len)), Math.max(0, len - tail.length));
    }
    return buf;
  };

  const file = {
    name: "big-manuscript.pdf",
    size: sizeBytes,
    type: "application/pdf",
    slice(start = 0, end: number = sizeBytes) {
      sliceCalls.push({ start, end });
      const bytes = materialize(start, end);
      totalMaterialized += bytes.byteLength;
      return {
        size: bytes.byteLength,
        async arrayBuffer() {
          return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        },
      };
    },
    async arrayBuffer() {
      throw new Error(
        "Regression: validator called File.arrayBuffer() on a large PDF. " +
          "This is the exact call that OOM-crashes mobile Chrome tabs.",
      );
    },
  } as unknown as File;

  return {
    file,
    get sliceCalls() {
      return sliceCalls;
    },
    get totalMaterialized() {
      return totalMaterialized;
    },
  };
}

describe("validateManuscriptFile — large PDF stress / mobile OOM regression", () => {
  const SIZES_MB = [50, 250, 650, 1024];

  for (const mb of SIZES_MB) {
    it(`validates a ${mb} MB PDF without materializing the body`, async () => {
      const size = mb * 1024 * 1024;
      const harness = fakePdfFile(size);

      const res = await validateManuscriptFile(harness.file);

      expect(res.ok).toBe(true);
      if (res.ok) expect(res.ext).toBe("pdf");

      // The whole point: the validator must have read only tiny slices.
      // 5 bytes for the header + up to 2048 for the tail = well under 4 KB.
      expect(harness.totalMaterialized).toBeLessThan(4 * 1024);

      // And it must never have touched a "middle" byte of the file.
      for (const call of harness.sliceCalls) {
        const isHead = call.start === 0 && call.end <= 64;
        const isTail = call.end === size && call.end - call.start <= 4096;
        expect(isHead || isTail).toBe(true);
      }
    });
  }

  it("rejects a large PDF with a bad header without reading the body", async () => {
    const harness = fakePdfFile(500 * 1024 * 1024, { corruptHeader: true });
    const res = await validateManuscriptFile(harness.file);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/header/i);
    expect(harness.totalMaterialized).toBeLessThan(1024);
  });

  it("rejects a large PDF missing %%EOF without reading the body", async () => {
    const harness = fakePdfFile(500 * 1024 * 1024, { noEof: true });
    const res = await validateManuscriptFile(harness.file);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/eof|truncated/i);
    expect(harness.totalMaterialized).toBeLessThan(4 * 1024);
  });

  it("never falls back to File.arrayBuffer() for PDFs (mobile OOM guard)", async () => {
    // fakePdfFile.arrayBuffer() throws — if the validator ever calls it, the
    // test fails with the guard message rather than silently regressing.
    const harness = fakePdfFile(300 * 1024 * 1024);
    await expect(validateManuscriptFile(harness.file)).resolves.toEqual({ ok: true, ext: "pdf" });
  });
});
