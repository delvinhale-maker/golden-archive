import { describe, expect, it } from "vitest";
import { AGENT_AUTHORITY_INTEGRATION_CATALOG, assertFoundationOnlyIntegration } from "./catalog";

describe("Agent Authority integration catalog", () => {
  it("keeps all connectors foundation-only with server-side secret handling", () => {
    expect(AGENT_AUTHORITY_INTEGRATION_CATALOG).toHaveLength(9);
    for (const integration of AGENT_AUTHORITY_INTEGRATION_CATALOG) {
      expect(integration.status).toBe("FOUNDATION_ONLY");
      expect(integration.secretHandling).toBe("SERVER_SECRET_STORE_REQUIRED");
      expect(integration.capabilities.length).toBeGreaterThan(0);
    }
  });

  it("defaults destructive/financial authority conservatively", () => {
    const dangerous = AGENT_AUTHORITY_INTEGRATION_CATALOG.flatMap((integration) => integration.capabilities)
      .filter((capability) => capability.risk === "CRITICAL");
    expect(dangerous.length).toBeGreaterThan(0);
    expect(dangerous.every((capability) => capability.defaultAuthority === "BLOCK")).toBe(true);
  });

  it("cannot accidentally invoke a foundation-only connector", () => {
    expect(() => assertFoundationOnlyIntegration("stripe")).toThrow(/execution is not enabled/i);
  });
});
