import { describe, expect, it } from "vitest";
import {
  MIN_FILL_MS,
  looksAutomated,
  normalizeLeadEmail,
  sanitizeHeaderValue,
  starterPackSubmitSchema,
} from "@/lib/starter-pack-validation";
import {
  CREATOR_APPLICATION_ROUTE,
  STARTER_PACK_CONTENTS,
  STARTER_PACK_URL,
} from "@/lib/starter-pack";

const base = {
  firstName: "Jordan",
  email: "Jordan@Example.COM",
  elapsedMs: 5000,
};

describe("starter pack submission validation", () => {
  it("accepts a valid submission", () => {
    const parsed = starterPackSubmitSchema.parse(base);
    expect(parsed.email).toBe("Jordan@Example.COM");
    expect(parsed.firstName).toBe("Jordan");
  });

  it("rejects an invalid email", () => {
    expect(() => starterPackSubmitSchema.parse({ ...base, email: "not-an-email" })).toThrow();
  });

  it("rejects an empty first name", () => {
    expect(() => starterPackSubmitSchema.parse({ ...base, firstName: "   " })).toThrow();
  });

  it("rejects a missing email", () => {
    expect(() => starterPackSubmitSchema.parse({ firstName: "Jordan" })).toThrow();
  });

  it("defaults marketing consent to false when unchecked", () => {
    expect(starterPackSubmitSchema.parse(base).marketingConsent).toBe(false);
  });

  it("stores marketing consent when explicitly opted in", () => {
    expect(starterPackSubmitSchema.parse({ ...base, marketingConsent: true }).marketingConsent).toBe(
      true,
    );
  });

  it("keeps UTM attribution fields", () => {
    const parsed = starterPackSubmitSchema.parse({
      ...base,
      utmSource: "tiktok",
      utmMedium: "social",
      utmCampaign: "founding-100",
      referringUrl: "https://tiktok.com/@creator",
      landingPage: "/creator-starter-pack?utm_source=tiktok",
    });
    expect(parsed.utmSource).toBe("tiktok");
    expect(parsed.utmMedium).toBe("social");
    expect(parsed.utmCampaign).toBe("founding-100");
    expect(parsed.referringUrl).toContain("tiktok.com");
    expect(parsed.landingPage).toContain("/creator-starter-pack");
  });
});

describe("email normalization and sanitizing", () => {
  it("lowercases and trims the address for idempotent lead matching", () => {
    expect(normalizeLeadEmail("  Jordan@Example.COM ")).toBe("jordan@example.com");
    expect(normalizeLeadEmail("jordan@example.com")).toBe(normalizeLeadEmail("JORDAN@EXAMPLE.COM"));
  });

  it("strips CR/LF so a name cannot inject an email header", () => {
    expect(sanitizeHeaderValue("Jordan\r\nBcc: victim@example.com")).toBe(
      "Jordan Bcc: victim@example.com",
    );
    expect(sanitizeHeaderValue("Jordan")).toBe("Jordan");
  });
});

describe("bot heuristics", () => {
  it("flags a filled honeypot", () => {
    expect(looksAutomated({ company: "Acme", elapsedMs: 9000 })).toBe(true);
  });

  it("flags an instant submit", () => {
    expect(looksAutomated({ company: "", elapsedMs: MIN_FILL_MS - 1 })).toBe(true);
  });

  it("passes a normal human submission", () => {
    expect(looksAutomated({ company: "", elapsedMs: MIN_FILL_MS + 500 })).toBe(false);
  });
});

describe("starter pack constants", () => {
  it("points at the public PDF asset", () => {
    expect(STARTER_PACK_URL).toBe("/downloads/AurumVault-Digital-Creator-Starter-Pack.pdf");
  });

  it("reuses the existing creator application route", () => {
    expect(CREATOR_APPLICATION_ROUTE).toBe("/sell");
  });

  it("lists all eight starter pack assets", () => {
    expect(STARTER_PACK_CONTENTS).toHaveLength(8);
  });
});
