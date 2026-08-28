import { beforeAll, describe, expect, it } from "vitest";
import {
  buildCanvaAuthorizeUrl,
  claimCanvaState,
  createCodeVerifier,
  createOAuthState,
  deriveCodeChallenge,
  isValidStateFormat,
  CANVA_AUTHORIZE_URL,
  CANVA_CODE_CHALLENGE_METHOD,
  CANVA_SCOPES,
  STATE_MAX_LENGTH,
  STATE_TTL_MS,
} from "@/lib/canva-oauth";
import {
  decryptOAuthSecret,
  encryptOAuthSecret,
  isOAuthEnvelope,
  resetOAuthKeyring,
} from "@/lib/oauth-token-crypto.server";

beforeAll(() => {
  process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY"] = "unit-test-key-primary";
  delete process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY_V2"];
  resetOAuthKeyring();
});

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

describe("Canva scope set (regression guard)", () => {
  it("contains exactly the five intended scopes", () => {
    expect([...CANVA_SCOPES].sort()).toEqual(
      [
        "asset:read",
        "asset:write",
        "design:content:read",
        "design:meta:read",
        "profile:read",
      ].sort(),
    );
    expect(CANVA_SCOPES).toHaveLength(5);
  });

  it("includes asset:write so cover pushes keep working", () => {
    expect(CANVA_SCOPES).toContain("asset:write");
  });

  it("puts every scope on the authorize URL", () => {
    const url = new URL(
      buildCanvaAuthorizeUrl({
        clientId: "c",
        redirectUri: "https://www.aurumvault.store/api/public/integrations/canva/callback",
        state: "a".repeat(24),
        codeChallenge: "x",
      }),
    );
    const requested = (url.searchParams.get("scope") ?? "").split(" ");
    for (const scope of CANVA_SCOPES) expect(requested).toContain(scope);
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

  it("requests an authorization code with Canva's lowercase s256 PKCE method", () => {
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(CANVA_CODE_CHALLENGE_METHOD).toBe("s256");
    expect(url.searchParams.get("code_challenge_method")).toBe("s256");
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

describe("OAuth state format validation", () => {
  it("accepts minted states", () => {
    for (let i = 0; i < 10; i++) expect(isValidStateFormat(createOAuthState())).toBe(true);
  });

  it("rejects empty, short, oversized and malformed states", () => {
    expect(isValidStateFormat("")).toBe(false);
    expect(isValidStateFormat("abc123")).toBe(false);
    expect(isValidStateFormat("f".repeat(STATE_MAX_LENGTH + 1))).toBe(false);
    expect(isValidStateFormat("../../etc/passwd0000")).toBe(false);
    expect(isValidStateFormat("ZZZZZZZZZZZZZZZZZZZZ")).toBe(false);
    expect(isValidStateFormat(null)).toBe(false);
    expect(isValidStateFormat("12345678901234567890abcdefg!")).toBe(false);
  });
});

/**
 * Minimal fake of the single conditional-UPDATE / SELECT chain used by
 * claimCanvaState. It models the database's atomicity: the pending state is
 * cleared by the first successful claim, so a second claim matches nothing.
 */
function fakeSupabase(
  row: { id: string; user_id: string; code_verifier_enc: unknown } | null,
  opts: {
    expired?: boolean;
  } = {},
) {
  const state = { row, cleared: false };
  const chain = (mode: "update" | "select") => {
    const filters: Record<string, unknown> = {};
    const api: Record<string, unknown> = {
      eq(col: string, val: unknown) {
        filters[col] = val;
        return api;
      },
      gt(_col: string, _val: unknown) {
        filters["unexpired"] = true;
        return api;
      },
      select() {
        return api;
      },
      async maybeSingle() {
        if (!state.row) return { data: null, error: null };
        if (mode === "update") {
          if (state.cleared) return { data: null, error: null };
          if (filters["unexpired"] && opts.expired) return { data: null, error: null };
          state.cleared = true;
          return { data: state.row, error: null };
        }
        // classification lookup: only finds the row while state is still set
        return { data: state.cleared ? null : { id: state.row.id }, error: null };
      },
    };
    return api;
  };

  return {
    from() {
      return {
        update() {
          return chain("update");
        },
        select() {
          return chain("select");
        },
      };
    },
  } as never;
}

describe("atomic single-use state claim", () => {
  const validState = "a".repeat(48);

  async function sealedRow() {
    return {
      id: "row-1",
      user_id: "user-1",
      code_verifier_enc: await encryptOAuthSecret("the-pkce-verifier"),
    };
  }

  it("claims once and returns the decrypted verifier", async () => {
    const supabase = fakeSupabase(await sealedRow());
    const claimed = await claimCanvaState(supabase, validState);
    expect(claimed.id).toBe("row-1");
    expect(claimed.user_id).toBe("user-1");
    expect(claimed.codeVerifier).toBe("the-pkce-verifier");
  });

  it("rejects a replayed (double-consumed) state", async () => {
    const supabase = fakeSupabase(await sealedRow());
    await claimCanvaState(supabase, validState);
    await expect(claimCanvaState(supabase, validState)).rejects.toThrow("invalid_state");
  });

  it("rejects an expired state", async () => {
    const supabase = fakeSupabase(await sealedRow(), { expired: true });
    await expect(claimCanvaState(supabase, validState)).rejects.toThrow("expired_state");
  });

  it("rejects an unknown state", async () => {
    const supabase = fakeSupabase(null);
    await expect(claimCanvaState(supabase, validState)).rejects.toThrow("invalid_state");
  });

  it("rejects malformed state before touching the database", async () => {
    const supabase = fakeSupabase(await sealedRow());
    await expect(claimCanvaState(supabase, "nope")).rejects.toThrow("invalid_state");
    await expect(claimCanvaState(supabase, "g".repeat(48))).rejects.toThrow("invalid_state");
  });
});

describe("OAuth credential encryption", () => {
  it("round-trips a token", async () => {
    const env = await encryptOAuthSecret("canva-access-token-value");
    expect(isOAuthEnvelope(env)).toBe(true);
    expect(await decryptOAuthSecret(env)).toBe("canva-access-token-value");
  });

  it("encrypts the PKCE verifier at rest", async () => {
    const verifier = createCodeVerifier();
    const env = await encryptOAuthSecret(verifier);
    expect(JSON.stringify(env)).not.toContain(verifier);
    expect(await decryptOAuthSecret(env)).toBe(verifier);
  });

  it("stores no plaintext in the envelope", async () => {
    const env = await encryptOAuthSecret("super-secret-token");
    expect(JSON.stringify(env)).not.toContain("super-secret-token");
    expect(env.kid).toMatch(/^[0-9a-f]{8}$/);
  });

  it("uses a fresh IV per encryption", async () => {
    const a = await encryptOAuthSecret("same");
    const b = await encryptOAuthSecret("same");
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });

  it("rejects non-envelope values", async () => {
    await expect(decryptOAuthSecret("plaintext")).rejects.toThrow();
    await expect(decryptOAuthSecret(null)).rejects.toThrow();
  });

  it("decrypts across the full four-slot keyring (V4 -> V3 -> V2 -> original)", async () => {
    // Sealed with the original key only.
    const v1 = await encryptOAuthSecret("token-v1");

    process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY_V2"] = "unit-test-key-v2";
    resetOAuthKeyring();
    const v2 = await encryptOAuthSecret("token-v2");

    process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY_V3"] = "unit-test-key-v3";
    resetOAuthKeyring();
    const v3 = await encryptOAuthSecret("token-v3");

    process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY_V4"] = "unit-test-key-v4";
    resetOAuthKeyring();
    const v4 = await encryptOAuthSecret("token-v4");

    // Newest slot is active, and every retired slot still decrypts.
    expect(new Set([v1.kid, v2.kid, v3.kid, v4.kid]).size).toBe(4);
    expect(await decryptOAuthSecret(v1)).toBe("token-v1");
    expect(await decryptOAuthSecret(v2)).toBe("token-v2");
    expect(await decryptOAuthSecret(v3)).toBe("token-v3");
    expect(await decryptOAuthSecret(v4)).toBe("token-v4");

    delete process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY_V2"];
    delete process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY_V3"];
    delete process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY_V4"];
    resetOAuthKeyring();
  });

  it("decrypts rows sealed with a retired key after rotation", async () => {
    const old = await encryptOAuthSecret("legacy-token");
    process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY_V2"] = "unit-test-key-rotated";
    resetOAuthKeyring();

    const fresh = await encryptOAuthSecret("new-token");
    expect(fresh.kid).not.toBe(old.kid);
    expect(await decryptOAuthSecret(old)).toBe("legacy-token");
    expect(await decryptOAuthSecret(fresh)).toBe("new-token");

    delete process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY_V2"];
    resetOAuthKeyring();
  });
});
