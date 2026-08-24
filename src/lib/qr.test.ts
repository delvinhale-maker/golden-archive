import { describe, it, expect } from "bun:test";
import {
  validateDestination,
  buildDynamicQrUrl,
  generateQrPublicId,
  validateQrColors,
  contrastRatio,
  resolveQrSizePx,
  MAX_ACTIVE_DYNAMIC_QR,
  SITE_URL,
} from "./qr";

describe("validateDestination — url", () => {
  it("accepts a well-formed https URL", () => {
    const r = validateDestination("url", "https://example.com/menu");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload).toBe("https://example.com/menu");
  });

  it("rejects http (non-https) protocol", () => {
    const r = validateDestination("url", "http://example.com");
    expect(r.ok).toBe(false);
  });

  it("rejects javascript: protocol", () => {
    const r = validateDestination("url", "javascript:alert(1)");
    expect(r.ok).toBe(false);
  });

  it("rejects data: protocol", () => {
    const r = validateDestination("url", "data:text/html,<script>alert(1)</script>");
    expect(r.ok).toBe(false);
  });

  it("rejects file: protocol", () => {
    const r = validateDestination("url", "file:///etc/passwd");
    expect(r.ok).toBe(false);
  });

  it("rejects protocol-relative tricks (no scheme at all)", () => {
    const r = validateDestination("url", "//evil.example.com");
    expect(r.ok).toBe(false);
  });

  it("rejects malformed URLs", () => {
    const r = validateDestination("url", "not a url");
    expect(r.ok).toBe(false);
  });

  it("rejects a hostname with no dot (not a real public domain)", () => {
    const r = validateDestination("url", "https://localhost");
    expect(r.ok).toBe(false);
  });

  it("strips control-character injection attempts", () => {
    const r = validateDestination("url", "https://example.com/\x00\x07page");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload).not.toMatch(/[\x00-\x1f]/);
  });

  it("rejects empty input", () => {
    expect(validateDestination("url", "").ok).toBe(false);
    expect(validateDestination("url", "   ").ok).toBe(false);
  });

  it("rejects excessively long input", () => {
    const r = validateDestination("url", "https://example.com/" + "a".repeat(3000));
    expect(r.ok).toBe(false);
  });
});

describe("validateDestination — email/tel/sms/text", () => {
  it("accepts a valid email and encodes as mailto:", () => {
    const r = validateDestination("email", "hello@example.com");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload).toBe("mailto:hello@example.com");
  });

  it("rejects an invalid email", () => {
    expect(validateDestination("email", "not-an-email").ok).toBe(false);
  });

  it("accepts a valid phone and encodes as tel:", () => {
    const r = validateDestination("tel", "(555) 123-4567");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload).toBe("tel:5551234567");
  });

  it("accepts a valid phone and encodes as sms:", () => {
    const r = validateDestination("sms", "+1 555 123 4567");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload).toBe("sms:+15551234567");
  });

  it("rejects a phone number containing letters", () => {
    expect(validateDestination("tel", "CALL-NOW-PLZ").ok).toBe(false);
  });

  it("accepts plain text under the length cap", () => {
    const r = validateDestination("text", "Welcome to our shop!");
    expect(r.ok).toBe(true);
  });

  it("rejects plain text over the length cap", () => {
    const r = validateDestination("text", "a".repeat(501));
    expect(r.ok).toBe(false);
  });
});

describe("buildDynamicQrUrl", () => {
  it("always encodes the production SITE_URL, never a staging origin", () => {
    const url = buildDynamicQrUrl("abc123");
    expect(url).toBe(`${SITE_URL}/q/abc123`);
    expect(url).toStartWith("https://www.aurumvault.store/q/");
  });
});

describe("generateQrPublicId", () => {
  it("produces a high-entropy, non-sequential hex identifier", () => {
    const id = generateQrPublicId();
    expect(id).toMatch(/^[0-9a-f]{40}$/);
  });

  it("never produces the same id twice across many calls (collision-resistant)", () => {
    const ids = new Set(Array.from({ length: 500 }, () => generateQrPublicId()));
    expect(ids.size).toBe(500);
  });

  it("fits the database's public_id length constraint (16-64 chars)", () => {
    const id = generateQrPublicId();
    expect(id.length).toBeGreaterThanOrEqual(16);
    expect(id.length).toBeLessThanOrEqual(64);
  });
});

describe("validateQrColors — scannability (Section 19)", () => {
  it("accepts default black-on-white", () => {
    const r = validateQrColors("#000000", "#FFFFFF");
    expect(r.ok).toBe(true);
  });

  it("rejects a non-hex color", () => {
    expect(validateQrColors("blue", "#FFFFFF").ok).toBe(false);
  });

  it("rejects a color with an alpha channel (no transparency allowed)", () => {
    expect(validateQrColors("#000000FF", "#FFFFFF").ok).toBe(false);
  });

  it("rejects low-contrast combinations that would not scan reliably", () => {
    const r = validateQrColors("#CCCCCC", "#DDDDDD");
    expect(r.ok).toBe(false);
  });

  it("accepts a legitimate high-contrast brand color pair", () => {
    const r = validateQrColors("#1A2E4A", "#FFFFFF");
    expect(r.ok).toBe(true);
  });
});

describe("contrastRatio", () => {
  it("black vs white is the maximum ratio (21:1)", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
  });

  it("identical colors have a ratio of 1", () => {
    expect(contrastRatio("#808080", "#808080")).toBeCloseTo(1, 5);
  });
});

describe("resolveQrSizePx", () => {
  it("defaults to standard for an unknown/missing preset", () => {
    expect(resolveQrSizePx(undefined)).toBe(512);
    expect(resolveQrSizePx("bogus")).toBe(512);
  });

  it("resolves each named preset", () => {
    expect(resolveQrSizePx("small")).toBe(256);
    expect(resolveQrSizePx("standard")).toBe(512);
    expect(resolveQrSizePx("print")).toBe(1024);
  });
});

describe("MAX_ACTIVE_DYNAMIC_QR", () => {
  it("is the Phase 1 configured default of 3, not hard-coded commercial language elsewhere", () => {
    expect(MAX_ACTIVE_DYNAMIC_QR).toBe(3);
  });
});
