import { beforeAll, describe, expect, it } from "vitest";
import {
  buildCanvaAuthorizeUrl,
  createCodeVerifier,
  deriveCodeChallenge,
  CANVA_AUTHORIZE_URL,
  CANVA_SCOPES,
  STATE_TTL_MS,
} from "@/lib/canva-oauth.server";
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
  isIntegrationEnvelope,
  resetIntegrationKeyring,
} from "@/lib/integration-crypto.server";

describe("Canva PKCE", () => {
  it("mints verifiers in the RFC 7636 length range", () => {
    for (let i = 0; i < 25; i++) {
      const v = createCodeVerifier();
      expect(v.length).toBeGreaterThanOrEqual(43);
      expect(v.length).toBeLessThanOrEqual(128);
      expect(v).toMatch(/^[A-Za-z0-9\-._~]+$/);
    }
  });

  it("mints unique verifiers", () => {
    const seen = new Set(Array.from({ length: 50 }, () => createCodeVerifier()));
    expect(seen.size).toBe(50);
  });

  it("derives a stable, base64url S256 challenge", async () => {
    // Known RFC 7636 appendix B vector.
    const challenge = await deriveCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("challenge differs from the verifier", async () => {
    const v = createCodeVerifier();
    expect(await deriveCodeChallenge(v)).not.toBe(v);
  });
});

describe("authorize URL", () => {
  const url = new URL(
    buildCanvaAuthorizeUrl({
      clientId: "test-client",
      redirectUri: "https://www.aurumvault.store/api/public/integrations/canva/callback",
      state: "0123456789abcdef0123",
      codeChallenge: "challenge-value",
    }),
  );

  it("targets Canva's authorize endpoint", () => {
    expect(`${url.origin}${url.pathname}`).toBe(CANVA_AUTHORIZE_URL);
  });

  it("requests an authorization code with S256 PKCE", () => {
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-value");
  });

  it("carries client, redirect, state and least-privilege scopes", () => {
    expect(url.searchParams.get("client_id")).toBe("test-client");
    expect(url.searchParams.get("redirect_uri")).toContain(
      "/api/public/integrations/canva/callback",
    );
    expect(url.searchParams.get("state")).toBe("0123456789abcdef0123");
    expect(url.searchParams.get("scope")).toBe(CANVA_SCOPES.join(" "));
  });

  it("never leaks the client secret or a verifier", () => {
    expect(url.searchParams.get("client_secret")).toBeNull();
    expect(url.searchParams.get("code_verifier")).toBeNull();
  });

  it("keeps handshake state short-lived", () => {
    expect(STATE_TTL_MS).toBeLessThanOrEqual(15 * 60 * 1000);
  });
});

describe("integration credential encryption", () => {
  beforeAll(() => {
    process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY"] = "unit-test-key-primary";
    delete process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY_V2"];
    resetIntegrationKeyring();
  });

  it("round-trips a token", async () => {
    const env = await encryptIntegrationSecret("canva-access-token-value");
    expect(isIntegrationEnvelope(env)).toBe(true);
    expect(await decryptIntegrationSecret(env)).toBe("canva-access-token-value");
  });

  it("stores no plaintext in the envelope", async () => {
    const env = await encryptIntegrationSecret("super-secret-token");
    expect(JSON.stringify(env)).not.toContain("super-secret-token");
    expect(env.kid).toMatch(/^[0-9a-f]{8}$/);
  });

  it("uses a fresh IV per encryption", async () => {
    const a = await encryptIntegrationSecret("same");
    const b = await encryptIntegrationSecret("same");
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });

  it("rejects non-envelope values", async () => {
    await expect(decryptIntegrationSecret("plaintext")).rejects.toThrow();
    await expect(decryptIntegrationSecret(null)).rejects.toThrow();
  });

  it("decrypts rows sealed with a retired key after rotation", async () => {
    const old = await encryptIntegrationSecret("legacy-token");
    process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY_V2"] = "unit-test-key-rotated";
    resetIntegrationKeyring();

    const fresh = await encryptIntegrationSecret("new-token");
    expect(fresh.kid).not.toBe(old.kid);
    expect(await decryptIntegrationSecret(old)).toBe("legacy-token");
    expect(await decryptIntegrationSecret(fresh)).toBe("new-token");

    delete process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY_V2"];
    resetIntegrationKeyring();
  });
});
