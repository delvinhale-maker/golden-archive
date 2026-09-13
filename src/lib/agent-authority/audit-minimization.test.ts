import { describe, expect, it } from "vitest";
import { minimizeAuditMetadata } from "./audit-minimization";

describe("audit metadata minimization", () => {
  it("redacts common credential/token fields recursively", () => {
    const value = minimizeAuditMetadata({
      action: "email.send",
      accessToken: "abc",
      nested: { api_key: "key", authorization: "Bearer secret", safe: "ok" },
    });
    expect(value.accessToken).toBe("[redacted]");
    expect((value.nested as any).api_key).toBe("[redacted]");
    expect((value.nested as any).authorization).toBe("[redacted]");
    expect((value.nested as any).safe).toBe("ok");
  });

  it("bounds payload size and depth", () => {
    const value = minimizeAuditMetadata({
      long: "x".repeat(700),
      deep: { a: { b: { c: { d: "never stored" } } } },
      many: Array.from({ length: 40 }, (_, i) => i),
    });
    expect(String(value.long)).toContain("[truncated]");
    expect((value.many as unknown[]).length).toBe(25);
    expect(JSON.stringify(value)).not.toContain("never stored");
  });
});
