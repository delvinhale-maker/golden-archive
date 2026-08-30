import { describe, it, expect } from "bun:test";
import {
  isRightsPassportEnabled,
  isRightsPassportAiEnabled,
  isRightsPassportPublicPublishEnabled,
  isRightsPassportEnabledClient,
} from "./rights-passport-feature-flags";

describe("isRightsPassportEnabled — fail-safe defaults", () => {
  it("is false when the env var is absent entirely", () => {
    expect(isRightsPassportEnabled({})).toBe(false);
  });

  it("is false for every value except literal 'true' or '1'", () => {
    for (const bad of [
      "True",
      "TRUE",
      "yes",
      "on",
      "enabled",
      "",
      " true",
      "true ",
      "0",
      "false",
    ]) {
      expect(isRightsPassportEnabled({ DIGITAL_RIGHTS_PASSPORT_ENABLED: bad })).toBe(false);
    }
  });

  it("is true for 'true' or '1'", () => {
    expect(isRightsPassportEnabled({ DIGITAL_RIGHTS_PASSPORT_ENABLED: "true" })).toBe(true);
    expect(isRightsPassportEnabled({ DIGITAL_RIGHTS_PASSPORT_ENABLED: "1" })).toBe(true);
  });
});

describe("isRightsPassportAiEnabled — implies the master switch", () => {
  it("is false when only the AI flag is set but master is off", () => {
    expect(isRightsPassportAiEnabled({ DIGITAL_RIGHTS_PASSPORT_AI_ENABLED: "true" })).toBe(false);
  });

  it("is false when only master is on but AI flag is unset", () => {
    expect(isRightsPassportAiEnabled({ DIGITAL_RIGHTS_PASSPORT_ENABLED: "true" })).toBe(false);
  });

  it("is true only when both are explicitly true", () => {
    expect(
      isRightsPassportAiEnabled({
        DIGITAL_RIGHTS_PASSPORT_ENABLED: "true",
        DIGITAL_RIGHTS_PASSPORT_AI_ENABLED: "true",
      }),
    ).toBe(true);
  });
});

describe("isRightsPassportPublicPublishEnabled — implies the master switch", () => {
  it("is false when only the publish flag is set but master is off", () => {
    expect(
      isRightsPassportPublicPublishEnabled({
        DIGITAL_RIGHTS_PASSPORT_PUBLIC_PUBLISH_ENABLED: "true",
      }),
    ).toBe(false);
  });

  it("is true only when both are explicitly true", () => {
    expect(
      isRightsPassportPublicPublishEnabled({
        DIGITAL_RIGHTS_PASSPORT_ENABLED: "true",
        DIGITAL_RIGHTS_PASSPORT_PUBLIC_PUBLISH_ENABLED: "true",
      }),
    ).toBe(true);
  });

  it("master alone does not imply publish is enabled", () => {
    expect(isRightsPassportPublicPublishEnabled({ DIGITAL_RIGHTS_PASSPORT_ENABLED: "true" })).toBe(
      false,
    );
  });
});

describe("isRightsPassportEnabledClient — render-gate only, independent env var", () => {
  it("is false by default", () => {
    expect(isRightsPassportEnabledClient({})).toBe(false);
  });

  it("reads the VITE_-prefixed var, not the server-side one", () => {
    expect(isRightsPassportEnabledClient({ DIGITAL_RIGHTS_PASSPORT_ENABLED: "true" })).toBe(false);
    expect(isRightsPassportEnabledClient({ VITE_DIGITAL_RIGHTS_PASSPORT_ENABLED: "true" })).toBe(
      true,
    );
  });
});
