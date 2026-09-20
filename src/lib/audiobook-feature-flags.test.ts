import { describe, it, expect } from "vitest";
import {
  isAudiobookStudioEnabled,
  isAudiobookLiveTtsEnabled,
  isAudiobookStudioEnabledClient,
  getAudiobookTtsProvider,
} from "./audiobook-feature-flags";

describe("isAudiobookStudioEnabled — fail-closed defaults", () => {
  it("is false when the env var is absent entirely", () => {
    expect(isAudiobookStudioEnabled({})).toBe(false);
  });

  it("is false for every value except literal 'true' or '1'", () => {
    for (const bad of ["True", "TRUE", "yes", "on", "enabled", "", " true", "true ", "0", "false"]) {
      expect(isAudiobookStudioEnabled({ AUDIOBOOK_STUDIO_ENABLED: bad })).toBe(false);
    }
  });

  it("is true for 'true' or '1'", () => {
    expect(isAudiobookStudioEnabled({ AUDIOBOOK_STUDIO_ENABLED: "true" })).toBe(true);
    expect(isAudiobookStudioEnabled({ AUDIOBOOK_STUDIO_ENABLED: "1" })).toBe(true);
  });
});

describe("isAudiobookLiveTtsEnabled — implies the master switch", () => {
  it("is false when only the TTS flag is set", () => {
    expect(isAudiobookLiveTtsEnabled({ AUDIOBOOK_TTS_LIVE_ENABLED: "true" })).toBe(false);
  });

  it("is false when only master is on", () => {
    expect(isAudiobookLiveTtsEnabled({ AUDIOBOOK_STUDIO_ENABLED: "true" })).toBe(false);
  });

  it("is true only when both are explicitly true", () => {
    expect(
      isAudiobookLiveTtsEnabled({
        AUDIOBOOK_STUDIO_ENABLED: "true",
        AUDIOBOOK_TTS_LIVE_ENABLED: "true",
      }),
    ).toBe(true);
  });
});

describe("getAudiobookTtsProvider — mock unless live TTS is fully enabled", () => {
  it("defaults to mock with no env", () => {
    expect(getAudiobookTtsProvider({})).toBe("mock");
  });

  it("ignores a configured provider while live TTS is disabled", () => {
    expect(getAudiobookTtsProvider({ AUDIOBOOK_TTS_PROVIDER: "openai" })).toBe("mock");
    expect(
      getAudiobookTtsProvider({
        AUDIOBOOK_STUDIO_ENABLED: "true",
        AUDIOBOOK_TTS_PROVIDER: "openai",
      }),
    ).toBe("mock");
  });

  it("returns the configured provider only when both flags are true", () => {
    expect(
      getAudiobookTtsProvider({
        AUDIOBOOK_STUDIO_ENABLED: "true",
        AUDIOBOOK_TTS_LIVE_ENABLED: "true",
        AUDIOBOOK_TTS_PROVIDER: "openai",
      }),
    ).toBe("openai");
  });

  it("falls back to mock when the provider value is blank", () => {
    expect(
      getAudiobookTtsProvider({
        AUDIOBOOK_STUDIO_ENABLED: "true",
        AUDIOBOOK_TTS_LIVE_ENABLED: "true",
        AUDIOBOOK_TTS_PROVIDER: "  ",
      }),
    ).toBe("mock");
  });
});

describe("isAudiobookStudioEnabledClient — render gate only", () => {
  it("is false by default", () => {
    expect(isAudiobookStudioEnabledClient({})).toBe(false);
  });

  it("reads the VITE_-prefixed var, not the server-side one", () => {
    expect(isAudiobookStudioEnabledClient({ AUDIOBOOK_STUDIO_ENABLED: "true" })).toBe(false);
    expect(isAudiobookStudioEnabledClient({ VITE_AUDIOBOOK_STUDIO_ENABLED: "true" })).toBe(true);
  });
});