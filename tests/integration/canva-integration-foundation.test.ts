import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Static (source-only) verification of the consolidated Canva OAuth foundation
 * and the proposed integration_connections migration. Nothing here touches the
 * database: the migration is intentionally NOT applied, so these assertions
 * guard the SQL text and source/route contracts instead.
 */

const MIGRATION_PATH =
  "docs/proposed-migrations/20260828004015_create_integration_connections.sql";
const sqlRaw = readFileSync(MIGRATION_PATH, "utf8");
/** Executable SQL only — line comments carry rollback/design notes, not statements. */
const sql = sqlRaw
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");
const core = readFileSync("src/lib/canva-oauth.ts", "utf8");
const crypto = readFileSync("src/lib/oauth-token-crypto.server.ts", "utf8");
const functions = readFileSync("src/lib/canva.functions.ts", "utf8");
const callback = readFileSync(
  "src/routes/api/public/integrations/canva/callback.ts",
  "utf8",
);
const ui = readFileSync("src/routes/_authenticated/dashboard.integrations.tsx", "utf8");
const routeTree = readFileSync("src/routeTree.gen.ts", "utf8");

describe("migration is additive-only", () => {
  it("contains no destructive statements against existing objects", () => {
    expect(sql).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/ALTER\s+TABLE\s+public\.(?!integration_connections)/i);
  });

  it("creates exactly one new table", () => {
    expect(sql.match(/CREATE TABLE/gi)?.length).toBe(1);
    expect(sql).toContain("CREATE TABLE public.integration_connections");
  });

  it("is not staged in supabase/migrations (unapplied by design)", () => {
    expect(existsSync("supabase/migrations/20260828004015_create_integration_connections.sql")).toBe(
      false,
    );
  });
});

describe("migration security model", () => {
  it("enables RLS", () => {
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  });

  it("grants only to service_role and explicitly revokes anon", () => {
    expect(sql).toContain("GRANT ALL ON public.integration_connections TO service_role;");
    expect(sql).not.toMatch(/GRANT[^;]+TO\s+anon/i);
    expect(sql).not.toMatch(/GRANT[^;]+TO\s+authenticated/i);
    expect(sql).toContain("REVOKE ALL ON public.integration_connections FROM anon;");
  });

  it("scopes owner policies by auth.uid() with an admin escape hatch", () => {
    expect(sql).toContain("USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))");
  });

  it("keeps token material out of client-reachable columns via encryption", () => {
    for (const col of ["access_token_enc", "refresh_token_enc", "code_verifier_enc"]) {
      expect(sql).toContain(`${col} JSONB`);
    }
    expect(sql).not.toMatch(/access_token\s+TEXT/i);
    expect(sql).not.toMatch(/code_verifier\s+TEXT/i);
  });

  it("protects owner reassignment with a guard trigger", () => {
    expect(sql).toContain("guard_integration_connection_owner");
    expect(sql).toContain("trg_integration_connections_owner_guard");
    expect(sql).toContain("is immutable");
  });

  it("enforces idempotency and unique handshake state", () => {
    expect(sql).toContain(
      "CREATE UNIQUE INDEX integration_connections_user_provider_key",
    );
    expect(sql).toContain("CREATE UNIQUE INDEX integration_connections_oauth_state_key");
  });

  it("bounds stored state length", () => {
    expect(sql).toContain("char_length(oauth_state) BETWEEN 16 AND 128");
  });

  it("reuses existing helpers without redefining them", () => {
    expect(sql).toContain("public.touch_updated_at()");
    expect(sql).toContain("public.has_role(auth.uid(), 'admin')");
    expect(sql).not.toMatch(/CREATE (OR REPLACE )?FUNCTION public\.touch_updated_at/i);
    expect(sql).not.toMatch(/CREATE (OR REPLACE )?FUNCTION public\.has_role/i);
  });

  it("documents a self-contained rollback", () => {
    expect(sqlRaw).toContain("DROP TABLE IF EXISTS public.integration_connections CASCADE;");
  });
});

describe("single canonical implementation", () => {
  it("has exactly one crypto/keyring module for OAuth material", () => {
    expect(existsSync("src/lib/integration-crypto.server.ts")).toBe(false);
    expect(crypto).toContain("INTEGRATION_TOKEN_ENCRYPTION_KEY");
  });

  it("has exactly one Canva OAuth core and one server-function module", () => {
    expect(existsSync("src/lib/canva-oauth.server.ts")).toBe(false);
    expect(existsSync("src/lib/canva-oauth.functions.ts")).toBe(false);
  });

  it("has no leftover references to the superseded modules", () => {
    for (const source of [core, crypto, functions, callback, ui]) {
      expect(source).not.toContain("canva-oauth.server");
      expect(source).not.toContain("integration-crypto.server");
      expect(source).not.toContain("canva-oauth.functions");
    }
  });
});

describe("callback route hardening", () => {
  it("validates state format before any database work", () => {
    expect(callback).toContain("isValidStateFormat");
    expect(callback.indexOf("isValidStateFormat(state)")).toBeLessThan(
      callback.indexOf("claimCanvaState(supabase, state)"),
    );
  });

  it("uses the atomic single-use claim", () => {
    expect(callback).toContain("claimCanvaState");
    expect(callback).not.toContain("consumeCanvaState");
  });

  it("redirects to a fixed allow-listed origin, not the request origin", () => {
    expect(callback).toContain("canvaReturnOrigin()");
    expect(callback).not.toContain("new URL(request.url).origin");
  });

  it("passes the claimed owner id through to storage", () => {
    expect(callback).toContain("ownerUserId: claimed.user_id");
  });

  it("never returns tokens or secrets to the browser", () => {
    // The only mention of a token is the truthiness guard before storage —
    // nothing token-shaped is ever written into the redirect or the body.
    expect(callback.match(/tokens\.access_token/g)?.length).toBe(1);
    expect(callback).toContain("if (!tokens.access_token)");
    expect(callback).not.toMatch(/Location.*token/i);
    expect(callback).toContain("status: 302");
  });

  it("loads server-only modules dynamically inside the handler", () => {
    expect(callback).toContain('await import("@/lib/canva-oauth")');
  });
});

describe("core OAuth behaviour", () => {
  it("claims state atomically with expiry enforcement", () => {
    expect(core).toContain('.eq("oauth_state", state)');
    expect(core).toContain('.gt("state_expires_at", nowIso)');
    expect(core).toContain('.update({ oauth_state: null, state_expires_at: null })');
  });

  it("encrypts verifier and tokens at rest", () => {
    expect(core).toContain("code_verifier_enc: await encryptOAuthSecret(verifier)");
    expect(core).toContain("access_token_enc: await encryptOAuthSecret(args.tokens.access_token)");
  });

  it("scopes connection writes by owner id", () => {
    expect(core).toContain('.eq("user_id", args.ownerUserId)');
  });

  it("revokes remotely on disconnect", () => {
    expect(core).toContain("CANVA_REVOKE_URL");
    expect(core).toContain("revokeCanvaTokenRemotely");
  });

  it("uses Canva's lowercase s256 challenge method", () => {
    expect(core).toContain('CANVA_CODE_CHALLENGE_METHOD = "s256"');
  });
});

describe("server functions derive identity from the verified session", () => {
  it("requires auth on every entry point", () => {
    expect(functions.match(/\.middleware\(\[requireSupabaseAuth\]\)/g)?.length).toBe(3);
  });

  it("never accepts a user id from client input", () => {
    expect(functions).not.toContain("inputValidator");
    expect(functions).toContain("context.userId");
  });
});

describe("routes are registered", () => {
  it("registers the public Canva callback", () => {
    expect(routeTree).toContain("/api/public/integrations/canva/callback");
  });

  it("registers the authenticated integrations dashboard", () => {
    expect(routeTree).toContain("/_authenticated/dashboard/integrations");
  });
});
