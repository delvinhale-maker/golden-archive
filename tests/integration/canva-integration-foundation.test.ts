import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Static (source-only) verification of the proposed integration_connections
 * migration and the Canva OAuth wiring. Nothing here touches the database:
 * the migration is intentionally NOT applied, so these assertions guard the SQL
 * text and route/source contracts instead.
 */

const MIGRATION_PATH =
  "docs/proposed-migrations/20260828004015_create_integration_connections.sql";
const sql = readFileSync(MIGRATION_PATH, "utf8");
const callback = readFileSync(
  "src/routes/api/public/integrations/canva/callback.ts",
  "utf8",
);
const serverLib = readFileSync("src/lib/canva-oauth.server.ts", "utf8");
const functions = readFileSync("src/lib/canva-oauth.functions.ts", "utf8");

describe("migration is additive-only", () => {
  it("contains no destructive statements", () => {
    const body = sql
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("--"))
      .join("\n");
    expect(body).not.toMatch(/\bDROP\s+(TABLE|COLUMN|POLICY|FUNCTION|INDEX|TRIGGER)\b/i);
    expect(body).not.toMatch(/\bTRUNCATE\b/i);
    expect(body).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(body).not.toMatch(/\bREVOKE\b/i);
  });

  it("only ALTERs the table it creates", () => {
    const alters = sql.match(/ALTER TABLE\s+[a-z_.]+/gi) ?? [];
    for (const a of alters) expect(a).toMatch(/public\.integration_connections/i);
  });

  it("creates exactly one new table", () => {
    expect(sql.match(/CREATE TABLE/gi)?.length).toBe(1);
    expect(sql).toContain("CREATE TABLE public.integration_connections");
  });

  it("documents a self-contained rollback", () => {
    expect(sql).toContain("DROP TABLE IF EXISTS public.integration_connections CASCADE;");
  });
});

describe("migration security posture", () => {
  it("enables row level security", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.integration_connections ENABLE ROW LEVEL SECURITY/i,
    );
  });

  it("grants only to service_role — never anon or authenticated", () => {
    const grants = sql.match(/GRANT[^;]+;/gi) ?? [];
    expect(grants.length).toBeGreaterThan(0);
    for (const g of grants) {
      expect(g).toMatch(/TO service_role/i);
      expect(g).not.toMatch(/\banon\b/i);
      expect(g).not.toMatch(/\bauthenticated\b/i);
    }
  });

  it("scopes every policy to the owning user or an admin", () => {
    const policies = sql.match(/CREATE POLICY[\s\S]*?;/gi) ?? [];
    expect(policies.length).toBeGreaterThanOrEqual(2);
    for (const p of policies) {
      expect(p).toMatch(/user_id = auth\.uid\(\)/);
      expect(p).toMatch(/public\.has_role\(auth\.uid\(\), 'admin'\)/);
      expect(p).toMatch(/TO authenticated/);
    }
  });

  it("reuses existing helpers instead of redefining them", () => {
    expect(sql).toContain("public.touch_updated_at()");
    expect(sql).toContain("public.has_role(");
    expect(sql).not.toMatch(/CREATE\s+(OR REPLACE\s+)?FUNCTION\s+public\.(has_role|touch_updated_at)/i);
  });

  it("cascades rows when the auth user is removed", () => {
    expect(sql).toMatch(/user_id UUID NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/i);
  });
});

describe("uniqueness and idempotency", () => {
  it("allows one connection per user and provider", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX integration_connections_user_provider_key[\s\S]*?\(user_id, provider\)/i,
    );
  });

  it("makes oauth_state globally unique while non-null", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX integration_connections_oauth_state_key[\s\S]*?WHERE oauth_state IS NOT NULL/i,
    );
  });

  it("constrains status and provider values", () => {
    expect(sql).toMatch(/status[\s\S]*?CHECK \(status IN \('pending', 'connected', 'revoked', 'error'\)\)/i);
    expect(sql).toMatch(/provider TEXT NOT NULL CHECK \(provider IN \('canva'\)\)/i);
  });

  it("keeps updated_at maintained by the shared trigger", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER trg_integration_connections_updated[\s\S]*?EXECUTE FUNCTION public\.touch_updated_at\(\)/i,
    );
  });
});

describe("callback route contract", () => {
  it("is registered at the public integrations path", () => {
    expect(callback).toContain(
      'createFileRoute("/api/public/integrations/canva/callback")',
    );
  });

  it("authorizes by opaque state rather than trusting query identity", () => {
    expect(callback).toContain("consumeCanvaState");
    expect(callback).not.toMatch(/searchParams\.get\(["']user_id["']\)/);
  });

  it("always redirects and never returns token material", () => {
    expect(callback).toMatch(/status: 302/);
    expect(callback).not.toMatch(/access_token/);
  });

  it("records provider denial and exchange failures", () => {
    expect(callback).toContain("markCanvaError");
    expect(callback).toContain('canva: "denied"');
  });
});

describe("server library and server functions", () => {
  it("uses S256 PKCE and never puts the secret in the browser redirect", () => {
    expect(serverLib).toContain('url.searchParams.set("code_challenge_method", "S256")');
    expect(serverLib).not.toMatch(/searchParams\.set\("client_secret"/);
  });

  it("encrypts every stored credential", () => {
    expect(serverLib).toContain("encryptIntegrationSecret(verifier)");
    expect(serverLib).toContain("encryptIntegrationSecret(args.tokens.access_token)");
  });

  it("scopes reads and writes by user_id", () => {
    expect(serverLib).toMatch(/\.eq\("user_id", userId\)/);
  });

  it("wipes secrets on disconnect", () => {
    const disconnect = serverLib.slice(serverLib.indexOf("export async function disconnectCanva"));
    expect(disconnect).toContain("access_token_enc: null");
    expect(disconnect).toContain("refresh_token_enc: null");
    expect(disconnect).toContain('status: "revoked"');
  });

  it("derives the caller from verified auth claims only", () => {
    expect(functions).toContain("requireSupabaseAuth");
    expect(functions).toContain("context.userId");
    expect(functions).not.toMatch(/inputValidator/);
  });

  it("keeps the server-only module out of the client bundle", () => {
    expect(functions).not.toMatch(/^import .*canva-oauth\.server/m);
    expect(functions).toContain('await import("./canva-oauth.server")');
  });
});
