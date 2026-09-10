import { describe, it, expect } from "bun:test";
import {
  isCreatorStudioEnabled,
  isCreatorStudioRenderingEnabled,
  isCreatorStudioBillingEnabled,
  isCreatorStudioEnabledClient,
} from "./creator-studio-feature-flags";

describe("isCreatorStudioEnabled — fail-safe defaults", () => {
  it("is false when the env var is absent entirely", () => {
    expect(isCreatorStudioEnabled({})).toBe(false);
  });

  it("is false for every value except literal 'true' or '1'", () => {
    for (const bad of ["True", "TRUE", "yes", "on", "enabled", "1 ", " true", "0", "false", ""]) {
      expect(isCreatorStudioEnabled({ CREATOR_STUDIO_ENABLED: bad })).toBe(false);
    }
  });

  it("is true only for literal 'true' or '1'", () => {
    expect(isCreatorStudioEnabled({ CREATOR_STUDIO_ENABLED: "true" })).toBe(true);
    expect(isCreatorStudioEnabled({ CREATOR_STUDIO_ENABLED: "1" })).toBe(true);
  });
});

describe("isCreatorStudioRenderingEnabled — implies the master switch", () => {
  it("is false when rendering is 'true' but the master switch is off", () => {
    expect(
      isCreatorStudioRenderingEnabled({
        CREATOR_STUDIO_ENABLED: "false",
        CREATOR_STUDIO_RENDERING_ENABLED: "true",
      }),
    ).toBe(false);
  });

  it("is false when rendering is unset even if the master switch is on", () => {
    expect(isCreatorStudioRenderingEnabled({ CREATOR_STUDIO_ENABLED: "true" })).toBe(false);
  });

  it("is true only when both are explicitly true", () => {
    expect(
      isCreatorStudioRenderingEnabled({
        CREATOR_STUDIO_ENABLED: "true",
        CREATOR_STUDIO_RENDERING_ENABLED: "true",
      }),
    ).toBe(true);
  });
});

describe("isCreatorStudioBillingEnabled — implies the master switch", () => {
  it("is false when billing is 'true' but the master switch is off", () => {
    expect(
      isCreatorStudioBillingEnabled({
        CREATOR_STUDIO_ENABLED: "false",
        CREATOR_STUDIO_BILLING_ENABLED: "true",
      }),
    ).toBe(false);
  });

  it("is true only when both are explicitly true", () => {
    expect(
      isCreatorStudioBillingEnabled({
        CREATOR_STUDIO_ENABLED: "true",
        CREATOR_STUDIO_BILLING_ENABLED: "true",
      }),
    ).toBe(true);
  });
});

describe("isCreatorStudioEnabledClient — reads the VITE_ mirror only", () => {
  it("is false by default", () => {
    expect(isCreatorStudioEnabledClient({})).toBe(false);
  });

  it("does not fall back to the server-side var", () => {
    expect(isCreatorStudioEnabledClient({ CREATOR_STUDIO_ENABLED: "true" })).toBe(false);
  });

  it("is true for the VITE_-prefixed var", () => {
    expect(isCreatorStudioEnabledClient({ VITE_CREATOR_STUDIO_ENABLED: "true" })).toBe(true);
  });
});
