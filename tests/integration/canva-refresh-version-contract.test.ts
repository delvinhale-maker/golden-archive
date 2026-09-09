import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/canva-oauth.ts", "utf8");
const migration = readFileSync("docs/proposed-migrations/20260909112100_add_integration_refresh_version.sql", "utf8");

describe("Canva refresh_version CAS contract", () => {
  test("uses monotonic refresh_version for claim/store/error CAS", () => {
    expect(source).toContain("refresh_version: number");
    expect(source).toContain('.eq("refresh_version", expectedRefreshVersion)');
    expect(source).not.toContain('.eq("updated_at", expectedUpdatedAt)');
  });
  test("never unconditionally stores a refreshed token after CAS loss", () => {
    expect(source).toContain("return resolveRefreshStoreCasLoss(supabase, userId)");
    expect(source).not.toContain("unconditionally rather than discarding a successfully refreshed token");
  });
  test("migration increments version on every update and keeps it server-only", () => {
    expect(migration).toContain("refresh_version BIGINT NOT NULL DEFAULT 0");
    expect(migration).toContain("NEW.refresh_version = OLD.refresh_version + 1");
    expect(migration).toContain("REVOKE ALL (refresh_version)");
  });
});
