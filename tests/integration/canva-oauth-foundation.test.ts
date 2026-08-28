/**
 * AurumVault Canva Connect OAuth foundation — security/regression guard.
 *
 * canva.functions.ts and the callback route pull in zod/@supabase/
 * supabase-js/@tanstack/react-start, none of which are installed in this
 * sandbox (the same pre-existing, environment-wide constraint every other
 * tests/integration/*.test.ts file in this repo works around). This suite
 * is therefore source-level verification. src/lib/canva-oauth.test.ts and
 * src/lib/oauth-token-crypto.server.test.ts cover what genuinely can run
 * (pure PKCE/state generation and the real AES-256-GCM envelope) with
 * real, executed assertions.
 *
 * Run: bun test tests/integration/canva-oauth-foundation.test.ts
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const fn = read("src/lib/canva.functions.ts");
const callback = read("src/routes/api/public/integrations/canva/callback.ts");
const migration = read("supabase/migrations/20260828004015_create_integration_connections.sql");
const crypto = read("src/lib/oauth-token-crypto.server.ts");

function bodyOf(source: string, exportName: string): string {
  const start = source.indexOf(`export const ${exportName}`);
  expect(start, `${exportName} should exist`).toBeGreaterThan(-1);
  const end = source.indexOf("\nexport const", start + 10);
  return source.slice(start, end === -1 ? undefined : end);
}

describe("unauthenticated connect attempts are rejected", () => {
  it("startCanvaConnection, getCanvaConnectionStatus, and disconnectCanva all require requireSupabaseAuth", () => {
    for (const name of ["startCanvaConnection", "getCanvaConnectionStatus", "disconnectCanva"]) {
      expect(bodyOf(fn, name)).toContain(".middleware([requireSupabaseAuth])");
    }
  });

  it("no Canva function accepts an owner/user id from client input", () => {
    expect(fn).not.toMatch(/ownerUserId/);
    expect(fn).not.toMatch(/owner_user_id:\s*data\./);
  });
});

describe("state and PKCE are generated securely, server-side", () => {
  it("startCanvaConnection generates state, a code verifier, and derives the challenge — never accepts them from the client", () => {
    const body = bodyOf(fn, "startCanvaConnection");
    expect(body).toContain("generateOAuthState()");
    expect(body).toContain("generateCodeVerifier()");
    expect(body).toContain("deriveCodeChallenge(codeVerifier)");
    expect(fn).not.toMatch(/\.inputValidator/); // takes no client input at all
  });

  it("the pending request is persisted with a short TTL (request_expires_at), not indefinitely", () => {
    const body = bodyOf(fn, "startCanvaConnection");
    expect(body).toContain("OAUTH_REQUEST_TTL_MS");
    expect(body).toContain("request_expires_at");
  });

  it("the persisted row is bound to the authenticated caller, never a client-supplied id", () => {
    const body = bodyOf(fn, "startCanvaConnection");
    expect(body).toContain("owner_user_id: userId");
    expect(body).toContain("const { userId } = context");
  });
});

describe("callback: missing parameters and OAuth errors are rejected", () => {
  it("rejects when code or state is missing before touching the database", () => {
    expect(callback).toMatch(/if \(!code \|\| !state\)/);
    expect(callback).toContain("reason=missing_params");
  });

  it("handles a Canva-reported OAuth error gracefully, without reflecting raw error text into the redirect", () => {
    expect(callback).toContain('url.searchParams.get("error")');
    expect(callback).toContain("reason=denied");
    // Never actually reads/forwards error_description into a redirect URL
    // (the word appears only in an explanatory comment above, which is
    // fine — the check is for real usage, e.g. searchParams.get(...)).
    expect(callback).not.toMatch(/searchParams\.get\(\s*["']error_description["']\s*\)/);
  });
});

describe("callback: mismatched/replayed state is rejected via an atomic single-claim update", () => {
  it("claims the pending row with a single conditional UPDATE, not a separate read-then-write", () => {
    const claimStart = callback.indexOf('.update({ status: "error" })');
    expect(claimStart).toBeGreaterThan(-1);
    const claimBlock = callback.slice(claimStart, claimStart + 400);
    expect(claimBlock).toContain('.eq("state", state)');
    expect(claimBlock).toContain('.eq("status", "pending")');
    expect(claimBlock).toContain('.gt("request_expires_at", nowIso)');
  });

  it("a failed claim (no row returned) is rejected as invalid_state — no exchange is attempted", () => {
    const claimIdx = callback.indexOf('.update({ status: "error" })');
    const afterClaim = callback.slice(claimIdx);
    expect(afterClaim).toMatch(/if \(!claimed\)/);
    const guardBlock = afterClaim.slice(afterClaim.indexOf("if (!claimed)"), afterClaim.indexOf("if (!claimed)") + 350);
    expect(guardBlock).toContain("reason=invalid_state");
    // The token exchange fetch call must appear AFTER the !claimed guard,
    // proving a rejected claim short-circuits before any network exchange.
    expect(afterClaim.indexOf("fetch(CANVA_TOKEN_URL")).toBeGreaterThan(
      afterClaim.indexOf("if (!claimed)"),
    );
  });

  it("the claim only ever matches status='pending' — a second use of the same state (already 'error' or 'connected') matches nothing", () => {
    // This is what makes replay impossible: once claimed, the row's status
    // is no longer 'pending', so the exact same WHERE clause on a replayed
    // request can never match it again.
    const claimStart = callback.indexOf('.update({ status: "error" })');
    const claimBlock = callback.slice(claimStart, claimStart + 400);
    expect(claimBlock).toContain('.eq("status", "pending")');
  });
});

describe("secrets and tokens are never exposed to client responses", () => {
  it("getCanvaConnectionStatus only selects non-sensitive columns", () => {
    const body = bodyOf(fn, "getCanvaConnectionStatus");
    expect(body).toContain('.select("status,updated_at"');
    expect(body).not.toMatch(/token_envelope|code_verifier|access_token|refresh_token/);
  });

  it("the callback route only ever returns a redirect Response — never JSON with token data", () => {
    const returns = [...callback.matchAll(/return\s+([^;]+);/g)].map((m) => m[1].trim());
    for (const r of returns) {
      // redirectTo(...) is every handler-level return; Response.redirect(...)
      // is redirectTo's own one-line implementation — both are redirects,
      // never a JSON body.
      expect(r.startsWith("redirectTo(") || r.startsWith("Response.redirect(")).toBe(true);
    }
    expect(callback).not.toMatch(/Response\.json/);
  });

  it("the migration never grants sensitive columns (state, code_verifier, token_envelope) to authenticated", () => {
    expect(migration).toMatch(
      /GRANT SELECT \(id, provider, status, created_at, updated_at\) ON public\.integration_connections TO authenticated/,
    );
    expect(migration).not.toMatch(/GRANT SELECT[^;]*token_envelope[^;]*TO authenticated/);
    expect(migration).not.toMatch(/GRANT SELECT[^;]*code_verifier[^;]*TO authenticated/);
  });

  it("the migration grants no INSERT/UPDATE/DELETE to authenticated at all — writes are service-role only", () => {
    expect(migration).not.toMatch(/GRANT\s+(INSERT|UPDATE|DELETE|ALL)[^;]*TO authenticated/);
  });

  it("access/refresh tokens are only ever stored as an encrypted envelope, never a plaintext column", () => {
    expect(migration).toContain("token_envelope JSONB");
    expect(migration).not.toMatch(/access_token TEXT/);
    expect(migration).not.toMatch(/refresh_token TEXT/);
  });
});

describe("never logs secrets", () => {
  it("no console.log/error/warn call in the callback route or Canva functions interpolates the actual code/state/token/secret/verifier variable into the message", () => {
    // Static English words like "state" or "code" in a log message (e.g.
    // "state claim query failed") are fine and expected — what must never
    // happen is template-literal interpolation of the sensitive variable
    // itself, e.g. `${state}`, `${code}`, `${accessToken}`.
    for (const source of [callback, fn]) {
      const logCalls = [...source.matchAll(/console\.(log|error|warn)\(([^)]*)\)/g)].map(
        (m) => m[2],
      );
      for (const args of logCalls) {
        expect(args).not.toMatch(
          /\$\{\s*(code|state|token|verifier|secret|accessToken|refreshToken|codeVerifier|clientSecret)\b/i,
        );
      }
    }
  });

  it("the encryption module never logs the derived key or plaintext", () => {
    expect(crypto).not.toMatch(/console\.(log|error|warn)/);
  });
});

describe("correct authenticated user receives the connection; tenant isolation", () => {
  it("integration_connections has a unique (owner_user_id, provider) constraint — one connection row per user per provider", () => {
    expect(migration).toContain("CONSTRAINT integration_connections_owner_provider_unique UNIQUE (owner_user_id, provider)");
  });

  it("RLS policy scopes reads to the row's own owner_user_id (or admin)", () => {
    expect(migration).toMatch(/owner_user_id = auth\.uid\(\) OR public\.has_role\(auth\.uid\(\), 'admin'\)/);
  });

  it("a defense-in-depth trigger blocks reassigning a connection's owner_user_id", () => {
    expect(migration).toContain("integration_connections_guard_identity");
    expect(migration).toMatch(/NEW\.owner_user_id IS DISTINCT FROM OLD\.owner_user_id/);
  });
});

describe("disconnect removes/revokes local credentials", () => {
  it("disconnectCanva clears every sensitive column and sets status to revoked, scoped to the caller", () => {
    const body = bodyOf(fn, "disconnectCanva");
    expect(body).toContain('status: "revoked"');
    expect(body).toContain("state: null");
    expect(body).toContain("code_verifier: null");
    expect(body).toContain("token_envelope: null");
    expect(body).toMatch(/\.eq\("owner_user_id", userId\)/);
    expect(body).toMatch(/\.eq\("provider", "canva"\)/);
  });

  it("attempts a best-effort remote revoke with Canva but never lets it block local cleanup", () => {
    const body = bodyOf(fn, "disconnectCanva");
    const tryIdx = body.indexOf("try {");
    const catchIdx = body.indexOf("} catch {");
    expect(tryIdx).toBeGreaterThan(-1);
    expect(catchIdx).toBeGreaterThan(tryIdx);
    expect(body.slice(tryIdx, catchIdx)).toContain("CANVA_REVOKE_URL");
  });
});

describe("no broader scopes than what Canva has already configured", () => {
  const oauthLib = read("src/lib/canva-oauth.ts");
  it("requests exactly the five pre-configured scopes, nothing else", () => {
    expect(oauthLib).toContain('"profile:read"');
    expect(oauthLib).toContain('"asset:read"');
    expect(oauthLib).toContain('"asset:write"');
    expect(oauthLib).toContain('"design:content:read"');
    expect(oauthLib).toContain('"design:meta:read"');
    const scopeMatch = oauthLib.match(/CANVA_OAUTH_SCOPES = \[([\s\S]*?)\] as const/);
    expect(scopeMatch).toBeTruthy();
    const count = (scopeMatch![1].match(/"/g) || []).length / 2;
    expect(count).toBe(5);
  });
});

describe("redirect URI is fixed server-side, never taken from the request", () => {
  it("the callback always uses process.env.CANVA_REDIRECT_URI for the token exchange, not a request-derived value", () => {
    expect(callback).toContain("process.env.CANVA_REDIRECT_URI");
    expect(callback).not.toMatch(/redirect_uri:\s*url\./);
  });
});

describe("client secret never referenced from client-safe modules", () => {
  it("canva-oauth.ts (the pure module, potentially reused client-side for the URL builder) never references CANVA_CLIENT_SECRET", () => {
    const oauthLib = read("src/lib/canva-oauth.ts");
    expect(oauthLib).not.toContain("CANVA_CLIENT_SECRET");
    expect(oauthLib).not.toContain("process.env");
  });

  it("CANVA_CLIENT_SECRET is only read in server-only files (callback route and canva.functions.ts)", () => {
    expect(callback).toContain("process.env.CANVA_CLIENT_SECRET");
    expect(fn).toContain("CANVA_CLIENT_SECRET");
  });
});
