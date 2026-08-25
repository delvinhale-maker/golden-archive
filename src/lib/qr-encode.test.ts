/**
 * QR encode verification (Section 20) using the real "qrcode" package
 * directly. qr.functions.ts itself can't be imported in this test run — it
 * pulls in zod/@supabase/supabase-js/@tanstack/react-start, none of which
 * are installed in this sandbox (the long-standing, pre-existing
 * environment constraint noted throughout this project's test suite: see
 * every other tests/integration/*.test.ts file's "Cannot find package"
 * cascade). This file tests the one thing that actually can be verified
 * here: that the real "qrcode" dependency, called with exactly the payload
 * shapes qr.ts's validateDestination()/buildDynamicQrUrl() produce, encodes
 * them faithfully.
 *
 * IMPORTANT — what this test does and does not prove:
 *   - It DOES prove the library's internal segment/data model contains the
 *     exact intended payload, for every Phase 1 destination-type shape,
 *     and that PNG/SVG rendering completes without error for both default
 *     and custom colors.
 *   - It does NOT decode a rendered PNG/SVG back into text via camera-style
 *     QR decoding (finder-pattern detection, perspective correction,
 *     Reed-Solomon decode). No QR decoder package could be installed in
 *     this sandbox (installs are blocked — see the Phase 1 report). A true
 *     image round-trip decode test is BLOCKED BY ENVIRONMENT and remains
 *     the one open item before this encoder can be called fully verified.
 */
import { describe, it, expect } from "vitest";
import QRCode from "qrcode";
import { validateDestination, buildDynamicQrUrl, validateQrColors } from "./qr";

function reconstructPayloadFromSegments(qr: any): string {
  return qr.segments
    .map((s: any) => {
      if (s.mode?.id === "Byte")
        return Buffer.from(Object.values(s.data as Record<string, number>)).toString("utf8");
      return String(s.data);
    })
    .join("");
}

describe("qrcode encoder — segment fidelity for every Phase 1 destination shape", () => {
  const cases: Array<[string, string]> = [
    ["url", "https://example.com/menu"],
    ["email", "hello@example.com"],
    ["tel", "(555) 123-4567"],
    ["sms", "+1 555 123 4567"],
  ];

  for (const [type, raw] of cases) {
    it(`encodes the validated ${type} payload exactly`, () => {
      const dest = validateDestination(type as any, raw);
      expect(dest.ok).toBe(true);
      if (!dest.ok) return;
      const qr = QRCode.create(dest.payload, { errorCorrectionLevel: "M" });
      expect(reconstructPayloadFromSegments(qr)).toBe(dest.payload);
    });
  }

  it("encodes a dynamic /q/ redirect URL exactly", () => {
    const url = buildDynamicQrUrl("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2");
    const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
    expect(reconstructPayloadFromSegments(qr)).toBe(url);
    expect(url.startsWith("https://www.aurumvault.store/q/")).toBe(true);
  });
});

describe("qrcode encoder — PNG/SVG rendering with validated colors", () => {
  it("renders a valid PNG data URL with default colors", async () => {
    const colors = validateQrColors(undefined, undefined);
    expect(colors.ok).toBe(true);
    if (!colors.ok) return;
    const dataUrl = await QRCode.toDataURL("https://example.com", {
      errorCorrectionLevel: "M",
      margin: 4,
      width: 512,
      color: { dark: colors.foreground, light: colors.background },
    });
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(dataUrl.length).toBeGreaterThan(100);
  });

  it("renders a valid SVG string with custom validated colors", async () => {
    const colors = validateQrColors("#1A2E4A", "#FFFFFF");
    expect(colors.ok).toBe(true);
    if (!colors.ok) return;
    const svg = await QRCode.toString("https://example.com", {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 4,
      width: 512,
      color: { dark: colors.foreground, light: colors.background },
    });
    expect(svg).toContain("<svg");
    expect(svg.toLowerCase()).toContain("1a2e4a");
  });

  it("never reaches the encoder for a rejected low-contrast color pair", () => {
    // Section 19's contract: the encoder is never called at all when
    // colors fail the scannability check — validated at the qr.ts layer
    // before any render call, in both generateStaticQrImage and
    // renderQrProjectImage.
    const colors = validateQrColors("#CCCCCC", "#DDDDDD");
    expect(colors.ok).toBe(false);
  });

  it("rejects encoding a payload over the library's practical capacity gracefully", async () => {
    const huge = "a".repeat(5000);
    await expect(QRCode.toDataURL(huge, { errorCorrectionLevel: "H" })).rejects.toBeTruthy();
  });
});
