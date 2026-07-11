import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { validateManuscriptBytes, validateManuscriptFile } from "./manuscript-validate";

/**
 * Regression tests for the .docx upload path.
 *
 * On Android Chrome (and some desktop browsers), a user-selected `.docx`
 * file is exposed to JS with `File.type === "application/octet-stream"` or
 * an empty string. The upload flow used to reject those files by MIME even
 * though the bytes were a perfectly valid Word document. We now validate by
 * extension + structural signature instead. These tests lock that in.
 */

function makeDocxBytes(): Uint8Array {
  return zipSync({
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `</Types>`,
    ),
    "word/document.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
        `<w:body><w:p><w:r><w:t>hello</w:t></w:r></w:p></w:body>` +
        `</w:document>`,
    ),
  });
}

describe("validateManuscriptBytes (docx)", () => {
  it("accepts a well-formed .docx by structure, not MIME", () => {
    const bytes = makeDocxBytes();
    const res = validateManuscriptBytes(bytes, "chapter-one.docx");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.ext).toBe("docx");
  });

  it("accepts uppercase extension (.DOCX)", () => {
    const res = validateManuscriptBytes(makeDocxBytes(), "Chapter.DOCX");
    expect(res.ok).toBe(true);
  });

  it("rejects a non-ZIP payload named .docx", () => {
    const junk = strToU8("this is not a zip");
    const res = validateManuscriptBytes(junk, "fake.docx");
    expect(res.ok).toBe(false);
  });

  it("rejects an empty file", () => {
    const res = validateManuscriptBytes(new Uint8Array(0), "empty.docx");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/empty/i);
  });
});

describe("validateManuscriptFile (docx) — MIME regression", () => {
  const cases = [
    { label: "Android Chrome generic octet-stream", type: "application/octet-stream" },
    { label: "empty MIME string (some Android pickers)", type: "" },
    { label: "correct Word MIME", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    { label: "legacy .doc MIME reported for .docx", type: "application/msword" },
  ];

  for (const { label, type } of cases) {
    it(`accepts a valid .docx regardless of browser-reported MIME (${label})`, async () => {
      const bytes = makeDocxBytes();
      const file = new File([bytes.buffer as ArrayBuffer], "manuscript.docx", { type });
      const res = await validateManuscriptFile(file);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.ext).toBe("docx");
    });
  }
});

describe("validateManuscriptFile (pdf) — Android picker filename regression", () => {
  const pdfBytes = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n");

  it("accepts a valid PDF even when the picked display name has no extension", async () => {
    const file = new File([pdfBytes], "Not_For_Sale_Manuscript", { type: "application/pdf" });
    const res = await validateManuscriptFile(file);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.ext).toBe("pdf");
  });

  it("accepts a valid PDF with no extension and an empty browser MIME", async () => {
    const file = new File([pdfBytes], "Not_For_Sale_Manuscript", { type: "" });
    const res = await validateManuscriptFile(file);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.ext).toBe("pdf");
  });
});
