import { describe, expect, it } from "vitest";
import { buildDeterministicIntent, scoreGap, toMerchantSignal } from "../../src/lib/aurum-intelligence";

describe("Aurum Intelligence Phase I", () => {
  it("turns natural language into a stable intent envelope", () => {
    const intent = buildDeterministicIntent({
      sessionId: "11111111-1111-4111-8111-111111111111",
      channel: "voice",
      rawInput: "Help me start a pressure washing business and figure out pricing",
    });
    expect(intent.channel).toBe("voice");
    expect(intent.objective).toContain("start a pressure washing business");
    expect(intent.stage).toBe("planning");
    expect(intent.consent.analytics).toBe(false);
  });

  it("scores unmet demand without storing raw conversation content", () => {
    const gap = {
      objectiveKey: "price a cleaning business",
      categoryHint: "business",
      requestCount: 100,
      resultCount: 1,
      noResultCount: 55,
      lowConfidenceCount: 25,
      conversionCount: 4,
      firstSeenAt: new Date(0).toISOString(),
      lastSeenAt: new Date().toISOString(),
    };
    expect(scoreGap(gap)).toBeGreaterThan(50);
    expect(toMerchantSignal(gap).kind).toBe("weak_category");
  });
});
