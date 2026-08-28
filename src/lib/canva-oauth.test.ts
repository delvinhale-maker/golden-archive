import { describe, it, expect } from "bun:test";
import {
  generateCodeVerifier,
  deriveCodeChallenge,
  generateOAuthState,
  buildCanvaAuthorizeUrl,
  CANVA_OAUTH_SCOPES,
  CANVA_AUTHORIZE_URL,
} from "./canva-oauth";

describe("generateCodeVerifier — RFC 7636 §4.1", () => {
  it("produces a string within the 43-128 char range", () => {
    const v = generateCodeVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v.length).toBeLessThanOrEqual(128);
  });

  it("only uses unreserved / base64url-safe characters (no +, /, =)", () => {
    const v = generateCodeVerifier();
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("is different every call (CSPRNG, not deterministic)", () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });
});

describe("deriveCodeChallenge — RFC 7636 §4.2 (S256)", () => {
  it("is deterministic for the same verifier", async () => {
    const verifier = "a-fixed-test-verifier-value-for-repeatability-000000";
    const a = await deriveCodeChallenge(verifier);
    const b = await deriveCodeChallenge(verifier);
    expect(a).toBe(b);
  });

  it("differs for different verifiers", async () => {
    const a = await deriveCodeChallenge("verifier-one-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    const b = await deriveCodeChallenge("verifier-two-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(a).not.toBe(b);
  });

  it("matches the known RFC 7636 Appendix B test vector", async () => {
    // RFC 7636 Appendix B: verifier "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk" →
    // challenge "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    const challenge = await deriveCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("never contains +, /, or = (base64url, not base64)", async () => {
    // Run several verifiers to reduce the chance of coincidentally avoiding
    // these characters — a real bug would show up almost immediately.
    for (let i = 0; i < 10; i++) {
      const challenge = await deriveCodeChallenge(generateCodeVerifier());
      expect(challenge).not.toMatch(/[+/=]/);
    }
  });
});

describe("generateOAuthState", () => {
  it("produces 64 hex characters (32 bytes)", () => {
    const s = generateOAuthState();
    expect(s).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is different every call", () => {
    const a = generateOAuthState();
    const b = generateOAuthState();
    expect(a).not.toBe(b);
  });

  it("is never equal to a code verifier's own alphabet coincidence — distinct generator", () => {
    // state and verifier are generated independently; this just documents
    // that they are NOT the same value even across many draws.
    const states = new Set<string>();
    for (let i = 0; i < 50; i++) states.add(generateOAuthState());
    expect(states.size).toBe(50);
  });
});

describe("buildCanvaAuthorizeUrl", () => {
  it("targets Canva's real authorize endpoint", () => {
    const url = buildCanvaAuthorizeUrl({
      clientId: "test-client-id",
      redirectUri: "https://www.aurumvault.store/api/public/integrations/canva/callback",
      state: "abc123",
      codeChallenge: "chal123",
    });
    expect(url.startsWith(CANVA_AUTHORIZE_URL)).toBe(true);
  });

  it("includes exactly the pre-configured scopes, space-delimited, nothing broader", () => {
    const url = new URL(
      buildCanvaAuthorizeUrl({
        clientId: "c",
        redirectUri: "https://www.aurumvault.store/api/public/integrations/canva/callback",
        state: "s",
        codeChallenge: "cc",
      }),
    );
    const scope = url.searchParams.get("scope");
    expect(scope).toBe(CANVA_OAUTH_SCOPES.join(" "));
    expect(CANVA_OAUTH_SCOPES).toEqual([
      "profile:read",
      "asset:read",
      "asset:write",
      "design:content:read",
      "design:meta:read",
    ]);
  });

  it("sets code_challenge_method to s256, never plain", () => {
    const url = new URL(
      buildCanvaAuthorizeUrl({
        clientId: "c",
        redirectUri: "https://www.aurumvault.store/api/public/integrations/canva/callback",
        state: "s",
        codeChallenge: "cc",
      }),
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("s256");
  });

  it("round-trips client_id, redirect_uri, state, and code_challenge exactly", () => {
    const input = {
      clientId: "my-client-id",
      redirectUri: "https://www.aurumvault.store/api/public/integrations/canva/callback",
      state: "state-value-123",
      codeChallenge: "challenge-value-456",
    };
    const url = new URL(buildCanvaAuthorizeUrl(input));
    expect(url.searchParams.get("client_id")).toBe(input.clientId);
    expect(url.searchParams.get("redirect_uri")).toBe(input.redirectUri);
    expect(url.searchParams.get("state")).toBe(input.state);
    expect(url.searchParams.get("code_challenge")).toBe(input.codeChallenge);
    expect(url.searchParams.get("response_type")).toBe("code");
  });
});
