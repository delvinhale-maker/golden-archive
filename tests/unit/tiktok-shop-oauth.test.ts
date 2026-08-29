import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  TIKTOK_SHOP_AUTHORIZE_URL,
  TIKTOK_SHOP_CANONICAL_REDIRECT_URI,
  TIKTOK_SHOP_PROVIDER,
  TIKTOK_SHOP_TOKEN_URL,
  STATE_MAX_LENGTH,
  STATE_MIN_LENGTH,
  STATE_TTL_MS,
  assertCanonicalRedirectUri,
  buildTikTokShopAuthorizeUrl,
  claimTikTokShopState,
  createOAuthState,
  isValidStateFormat,
} from "@/lib/tiktok-shop-oauth";
import { CANVA_SCOPES } from "@/lib/canva-oauth";
import {
  decryptOAuthSecret,
  encryptOAuthSecret,
  isOAuthEnvelope,
  resetOAuthKeyring,
} from "@/lib/oauth-token-crypto.server";
import { readFileSync } from "node:fs";

const CANONICAL = "https://www.aurumvault.store/api/public/integrations/tiktok-shop/callback";

beforeAll(() => {
  process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY"] = "unit-test-key-primary";
  delete process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY_V2"];
  delete process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY_V3"];
  delete process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY_V4"];
  resetOAuthKeyring();
});

describe("TikTok Shop OAuth state", () => {
  it("is opaque hex with high entropy and bounded length", () => {
    const values = Array.from({ length: 60 }, () => createOAuthState());
    for (const s of values) {
      expect(s).toMatch(/^[0-9a-f]+$/);
      expect(s.length).toBeGreaterThanOrEqual(STATE_MIN_LENGTH);
      expect(s.length).toBeLessThanOrEqual(STATE_MAX_LENGTH);
      expect(s.length).toBe(48);
    }
    expect(new Set(values).size).toBe(60);
  });

  it("uses a ten minute TTL", () => {
    expect(STATE_TTL_MS).toBe(10 * 60 * 1000);
  });

  it("rejects malformed, empty, short, oversized and non-hex state", () => {
    expect(isValidStateFormat("")).toBe(false);
    expect(isValidStateFormat("abc")).toBe(false);
    expect(isValidStateFormat("Z".repeat(24))).toBe(false);
    expect(isValidStateFormat("a".repeat(STATE_MAX_LENGTH + 1))).toBe(false);
    expect(isValidStateFormat(null)).toBe(false);
    expect(isValidStateFormat(createOAuthState())).toBe(true);
  });
});

function stubClient(rows: { id: string; user_id: string }[] | null, staleExists = false) {
  const calls: string[] = [];
  const client = {
    from() {
      return {
        update() {
          return {
            eq() {
              return this;
            },
            gt() {
              return this;
            },
            select() {
              return {
                maybeSingle: async () => {
                  calls.push("claim");
                  const row = rows?.shift() ?? null;
                  return { data: row, error: null };
                },
              };
            },
          };
        },
        select() {
          return {
            eq() {
              return this;
            },
            maybeSingle: async () => ({ data: staleExists ? { id: "stale" } : null, error: null }),
          };
        },
      };
    },
  };
  return { client: client as never, calls };
}

describe("TikTok Shop atomic state claim", () => {
  it("returns the row to the first caller and rejects replay", async () => {
    const state = createOAuthState();
    const { client } = stubClient([{ id: "row-1", user_id: "user-1" }]);
    await expect(claimTikTokShopState(client, state)).resolves.toEqual({
      id: "row-1",
      user_id: "user-1",
    });
    // Second (replayed) callback: the conditional UPDATE matches nothing.
    await expect(claimTikTokShopState(client, state)).rejects.toThrow("invalid_state");
  });

  it("classifies an expired handshake distinctly", async () => {
    const { client } = stubClient([], true);
    await expect(claimTikTokShopState(client, createOAuthState())).rejects.toThrow("expired_state");
  });

  it("never queries the database for malformed state", async () => {
    const { client, calls } = stubClient([{ id: "x", user_id: "y" }]);
    await expect(claimTikTokShopState(client, "nope")).rejects.toThrow("invalid_state");
    expect(calls).toHaveLength(0);
  });
});

describe("TikTok Shop redirect URI", () => {
  it("is the exact production callback", () => {
    expect(TIKTOK_SHOP_CANONICAL_REDIRECT_URI).toBe(CANONICAL);
    const u = new URL(CANONICAL);
    expect(u.protocol).toBe("https:");
    expect(u.hostname).toBe("www.aurumvault.store");
    expect(u.pathname).toBe("/api/public/integrations/tiktok-shop/callback");
    expect(CANONICAL.endsWith("/")).toBe(false);
    expect(CANONICAL).not.toContain("intergrations");
    expect(CANONICAL).not.toContain("/tik-tok/");
    expect(CANONICAL).not.toMatch(/\/tiktok\//);
  });

  it("rejects typos, trailing slashes, wrong hosts and preview domains", () => {
    for (const bad of [
      "https://www.aurumvault.store/api/public/intergrations/tiktok-shop/callback",
      `${CANONICAL}/`,
      "https://aurumvault.store/api/public/integrations/tiktok-shop/callback",
      "https://sunstone-safe-haven.lovable.app/api/public/integrations/tiktok-shop/callback",
      "https://www.aurumvault.store/api/public/integrations/tiktok/callback",
      "http://www.aurumvault.store/api/public/integrations/tiktok-shop/callback",
    ]) {
      expect(() => assertCanonicalRedirectUri(bad)).toThrow();
    }
    expect(() => assertCanonicalRedirectUri(CANONICAL)).not.toThrow();
  });
});

describe("TikTok Shop authorize URL", () => {
  const url = () =>
    new URL(
      buildTikTokShopAuthorizeUrl({
        serviceId: "svc-123",
        state: createOAuthState(),
        redirectUri: CANONICAL,
      }),
    );

  it("targets the documented US seller authorization endpoint", () => {
    expect(TIKTOK_SHOP_AUTHORIZE_URL).toBe("https://services.us.tiktokshop.com/open/authorize");
    expect(url().origin + url().pathname).toBe(TIKTOK_SHOP_AUTHORIZE_URL);
  });

  it("carries service_id and opaque state only", () => {
    const u = url();
    expect(u.searchParams.get("service_id")).toBe("svc-123");
    expect(isValidStateFormat(u.searchParams.get("state"))).toBe(true);
  });

  it("never leaks the app secret, tokens or the auth code", () => {
    const raw = buildTikTokShopAuthorizeUrl({
      serviceId: "svc-123",
      state: createOAuthState(),
      redirectUri: CANONICAL,
    });
    for (const forbidden of ["app_secret", "access_token", "refresh_token", "auth_code", "code="]) {
      expect(raw).not.toContain(forbidden);
    }
  });

  it("refuses to build a handshake for a non-approved redirect URI", () => {
    expect(() =>
      buildTikTokShopAuthorizeUrl({
        serviceId: "svc",
        state: createOAuthState(),
        redirectUri: "https://evil.example.com/cb",
      }),
    ).toThrow();
  });

  it("exchanges tokens against the documented server-side token endpoint", () => {
    expect(TIKTOK_SHOP_TOKEN_URL).toBe("https://auth.tiktok-shops.com/api/v2/token/get");
  });
});

describe("TikTok Shop token encryption (shared keyring)", () => {
  it("stores an envelope, never plaintext", async () => {
    const sealed = await encryptOAuthSecret("tiktok-access-token");
    expect(isOAuthEnvelope(sealed)).toBe(true);
    expect(JSON.stringify(sealed)).not.toContain("tiktok-access-token");
    expect(await decryptOAuthSecret(sealed)).toBe("tiktok-access-token");
  });

  it("stays decryptable after key rotation into a newer slot", async () => {
    const sealed = await encryptOAuthSecret("rotate-me");
    process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY_V2"] = "unit-test-key-v2";
    resetOAuthKeyring();
    expect(await decryptOAuthSecret(sealed)).toBe("rotate-me");
    const resealed = await encryptOAuthSecret("new-token");
    expect(await decryptOAuthSecret(resealed)).toBe("new-token");
    delete process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY_V2"];
    resetOAuthKeyring();
  });
});

describe("provider identity and shared storage", () => {
  it("uses the tiktok_shop provider id on the shared connections table", () => {
    expect(TIKTOK_SHOP_PROVIDER).toBe("tiktok_shop");
    const src = readFileSync("src/lib/tiktok-shop-oauth.ts", "utf8");
    expect(src).toContain("integration_connections");
    // No parallel table, no second crypto system.
    expect(src).not.toMatch(/create table/i);
    expect(src).toContain("./oauth-token-crypto.server");
  });

  it("never selects encrypted columns on the owner status read", () => {
    const src = readFileSync("src/lib/tiktok-shop-oauth.ts", "utf8");
    const statusRead = src.slice(src.indexOf("export async function readTikTokShopStatus"));
    const select = statusRead.slice(0, statusRead.indexOf("maybeSingle"));
    for (const col of ["access_token_enc", "refresh_token_enc", "code_verifier_enc"]) {
      expect(select).not.toContain(col);
    }
  });

  it("scopes writes by owner user id", () => {
    const src = readFileSync("src/lib/tiktok-shop-oauth.ts", "utf8");
    const store = src.slice(src.indexOf("export async function storeTikTokShopConnection"));
    expect(store).toContain('.eq("user_id", args.ownerUserId)');
  });
});

describe("callback route + browser safety", () => {
  const route = readFileSync("src/routes/api/public/integrations/tiktok-shop/callback.ts", "utf8");

  it("registers the exact canonical path", () => {
    expect(route).toContain('createFileRoute("/api/public/integrations/tiktok-shop/callback")');
    const tree = readFileSync("src/routeTree.gen.ts", "utf8");
    expect(tree).toContain("/api/public/integrations/tiktok-shop/callback");
  });

  it("builds redirects from the fixed configured origin, not the request host", () => {
    expect(route).toContain("tiktokShopReturnOrigin()");
    expect(route).not.toContain('request.headers.get("host")');
    expect(route).not.toContain("x-forwarded-host");
  });

  it("never puts tokens, codes or secrets in the browser redirect", () => {
    const backTo = route.slice(
      route.indexOf("function backTo"),
      route.indexOf("export const Route"),
    );
    for (const forbidden of ["access_token", "refresh_token", "app_secret"]) {
      expect(backTo).not.toContain(forbidden);
      expect(route.split("backTo(origin,")[1] ?? "").not.toContain(forbidden);
    }
    expect(route).toContain('tiktok_shop: "connected"');
    expect(route).toContain('reason: "exchange_failed"');
    expect(route).toContain('tiktok_shop: "denied"');
  });
});

describe("Canva regression guard", () => {
  it("keeps exactly the five approved Canva scopes", () => {
    expect([...CANVA_SCOPES]).toEqual([
      "profile:read",
      "asset:read",
      "asset:write",
      "design:content:read",
      "design:meta:read",
    ]);
  });

  it("keeps the Canva callback path unchanged", () => {
    const route = readFileSync("src/routes/api/public/integrations/canva/callback.ts", "utf8");
    expect(route).toContain('createFileRoute("/api/public/integrations/canva/callback")');
  });
});

describe("no typo anywhere in shipped integration sources", () => {
  it("does not contain 'intergrations'", () => {
    for (const f of [
      "src/lib/tiktok-shop-oauth.ts",
      "src/lib/tiktok-shop.functions.ts",
      "src/routes/api/public/integrations/tiktok-shop/callback.ts",
      "src/routes/_authenticated/dashboard.integrations.tsx",
    ]) {
      expect(readFileSync(f, "utf8")).not.toContain("intergrations");
    }
  });
});

// Keeps vitest's `vi` import meaningful if future stubs are added.
void vi;
