import { describe, it, expect } from "vitest";
import {
  chunkFlatText,
  pagesFromPdfText,
  looksLikeOcrRequired,
  totalParsedChars,
  boundDocumentText,
} from "./rights-passport-doc-chunk";

describe("chunkFlatText", () => {
  it("returns empty array for empty input", () => {
    expect(chunkFlatText("")).toEqual([]);
  });

  it("treats text with no headings as a single section: null chunk", () => {
    const text = "This is a plain paragraph with no headings at all in it whatsoever.";
    const pages = chunkFlatText(text);
    expect(pages.length).toBe(1);
    expect(pages[0].section).toBeNull();
    expect(pages[0].text).toBe(text);
    expect(pages[0].charStart).toBe(0);
    expect(pages[0].charEnd).toBe(text.length);
  });

  it("detects ALL CAPS heading lines and splits into labeled sections", () => {
    const text = [
      "DEFINITIONS",
      "Some definition text here.",
      "GRANT OF RIGHTS",
      "Some grant text here.",
    ].join("\n");
    const pages = chunkFlatText(text);
    expect(pages.some((p) => p.section === "DEFINITIONS")).toBe(true);
    expect(pages.some((p) => p.section === "GRANT OF RIGHTS")).toBe(true);
  });

  it("detects numbered section headings (e.g. '1. DEFINITIONS')", () => {
    const text = [
      "1. Definitions",
      "Body text under definitions.",
      "2. Grant of Rights",
      "Body text under grant.",
    ].join("\n");
    const pages = chunkFlatText(text);
    const headings = pages.map((p) => p.section).filter(Boolean);
    expect(headings).toContain("1. Definitions");
    expect(headings).toContain("2. Grant of Rights");
  });

  it("detects ARTICLE/SECTION-style headings", () => {
    const text = ["ARTICLE 1: TERM", "This agreement is effective as stated below."].join("\n");
    const pages = chunkFlatText(text);
    expect(pages[0].section).toBe("ARTICLE 1: TERM");
  });

  it("offsets slice back to the exact original substring for every chunk", () => {
    const text = ["DEFINITIONS", "Def text.", "GRANT OF RIGHTS", "Grant text."].join("\n");
    const pages = chunkFlatText(text);
    for (const p of pages) {
      expect(text.slice(p.charStart, p.charEnd)).toBe(p.text);
    }
  });

  it("never fabricates text — a chunk's text is always a verbatim substring of the input", () => {
    const text =
      "SECTION 1. INTRO\nHello world, this is the intro body text.\nSECTION 2. TERMS\nMore body text.";
    const pages = chunkFlatText(text);
    for (const p of pages) {
      expect(text.includes(p.text)).toBe(true);
    }
  });

  it("does not treat an ordinary prose sentence ending in a period as a heading", () => {
    const text = "This is a long sentence that describes the licensing terms in full detail.";
    const pages = chunkFlatText(text);
    expect(pages.length).toBe(1);
    expect(pages[0].section).toBeNull();
  });
});

describe("pagesFromPdfText", () => {
  it("assigns sequential 1-based page numbers", () => {
    const pages = pagesFromPdfText(["Page one text.", "Page two text."]);
    const pageNumbers = [...new Set(pages.map((p) => p.page))];
    expect(pageNumbers).toEqual([1, 2]);
  });

  it("preserves an empty page as an empty chunk rather than dropping it", () => {
    const pages = pagesFromPdfText(["Some text.", "   ", "More text."]);
    expect(pages.some((p) => p.page === 2 && p.text.trim() === "")).toBe(true);
  });

  it("applies section detection within each page independently", () => {
    const pages = pagesFromPdfText(["DEFINITIONS\nDef body.", "GRANT OF RIGHTS\nGrant body."]);
    const page1 = pages.filter((p) => p.page === 1);
    const page2 = pages.filter((p) => p.page === 2);
    expect(page1.some((p) => p.section === "DEFINITIONS")).toBe(true);
    expect(page2.some((p) => p.section === "GRANT OF RIGHTS")).toBe(true);
  });

  it("never invents a page number beyond the input array's length", () => {
    const pages = pagesFromPdfText(["only page"]);
    expect(pages.every((p) => p.page === 1)).toBe(true);
  });
});

describe("looksLikeOcrRequired", () => {
  it("is false for an empty page array (nothing to judge)", () => {
    expect(looksLikeOcrRequired([])).toBe(false);
  });

  it("is true when every page has effectively no extractable text (image-only PDF)", () => {
    expect(looksLikeOcrRequired(["", "   ", "\n\n"])).toBe(true);
  });

  it("is false when at least one page has real extractable text", () => {
    expect(
      looksLikeOcrRequired(["", "This page has real, substantial extractable text content."]),
    ).toBe(false);
  });

  it("is false for a normal multi-page text-layer PDF", () => {
    expect(
      looksLikeOcrRequired([
        "Page one has real text.",
        "Page two also has real text content here.",
      ]),
    ).toBe(false);
  });
});

describe("totalParsedChars", () => {
  it("sums text length across all chunks", () => {
    const pages = [
      { page: 1, section: null, text: "abc", charStart: 0, charEnd: 3 },
      { page: 2, section: null, text: "de", charStart: 0, charEnd: 2 },
    ];
    expect(totalParsedChars(pages)).toBe(5);
  });

  it("returns 0 for an empty page list", () => {
    expect(totalParsedChars([])).toBe(0);
  });
});

describe("boundDocumentText", () => {
  const pages = [
    { page: 1, section: null, text: "Short page one text.", charStart: 0, charEnd: 21 },
    {
      page: 2,
      section: "GRANT OF RIGHTS",
      text: "Short page two text.",
      charStart: 0,
      charEnd: 21,
    },
  ];

  it("includes all pages when total is under the char budget", () => {
    const result = boundDocumentText(pages, 10_000);
    expect(result).toContain("Short page one text.");
    expect(result).toContain("Short page two text.");
    expect(result).not.toContain("TRUNCATED");
  });

  it("includes page/section markers so a model can cite a real page number", () => {
    const result = boundDocumentText(pages, 10_000);
    expect(result).toContain("[Page 1]");
    expect(result).toContain("Page 2 — GRANT OF RIGHTS");
  });

  it("truncates and marks the cut clearly when the budget is exceeded", () => {
    const result = boundDocumentText(pages, 15);
    expect(result).toContain("[TRUNCATED");
    expect(result.length).toBeLessThan(pages.reduce((s, p) => s + p.text.length, 0) + 200);
  });

  it("never silently drops content without a TRUNCATED marker when truncation occurs", () => {
    const longPages = [
      { page: 1, section: null, text: "x".repeat(1000), charStart: 0, charEnd: 1000 },
    ];
    const result = boundDocumentText(longPages, 50);
    expect(result).toContain("TRUNCATED");
  });

  it("returns an empty string for an empty page list", () => {
    expect(boundDocumentText([], 1000)).toBe("");
  });
});
