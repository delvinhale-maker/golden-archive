import { describe, it, expect } from "vitest";
import {
  canonicalStringify,
  hashCanonicalPayload,
  shortIntegrityId,
} from "./rights-passport-canonical-json";

describe("canonicalStringify", () => {
  it("sorts object keys regardless of insertion order", () => {
    const a = canonicalStringify({ b: 1, a: 2, c: 3 });
    const b = canonicalStringify({ c: 3, a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"b":1,"c":3}');
  });

  it("sorts nested object keys recursively", () => {
    const a = canonicalStringify({ outer: { z: 1, a: 2 } });
    expect(a).toBe('{"outer":{"a":2,"z":1}}');
  });

  it("preserves array order as meaningful data", () => {
    const a = canonicalStringify({ list: [3, 1, 2] });
    expect(a).toBe('{"list":[3,1,2]}');
  });

  it("treats null and undefined the same way", () => {
    expect(canonicalStringify({ a: null })).toBe(canonicalStringify({ a: undefined }));
  });

  it("handles nested arrays of objects with sorted keys inside", () => {
    const a = canonicalStringify({ items: [{ z: 1, a: 2 }] });
    expect(a).toBe('{"items":[{"a":2,"z":1}]}');
  });
});

describe("hashCanonicalPayload", () => {
  it("produces the same hash for the same logical payload regardless of key order", async () => {
    const h1 = await hashCanonicalPayload({ a: 1, b: 2 });
    const h2 = await hashCanonicalPayload({ b: 2, a: 1 });
    expect(h1).toBe(h2);
  });

  it("produces a different hash when the payload changes", async () => {
    const h1 = await hashCanonicalPayload({ a: 1 });
    const h2 = await hashCanonicalPayload({ a: 2 });
    expect(h1).not.toBe(h2);
  });

  it("returns a 64-character lowercase hex string (SHA-256)", async () => {
    const h = await hashCanonicalPayload({ x: "y" });
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic across repeated calls with the identical payload", async () => {
    const payload = { passport_id: "abc", assets: [{ id: "1" }, { id: "2" }] };
    const h1 = await hashCanonicalPayload(payload);
    const h2 = await hashCanonicalPayload(payload);
    expect(h1).toBe(h2);
  });

  it("a deep nested change produces a different hash", async () => {
    const base = { subject: { name: "Jordan" }, assets: [{ status: "ACTIVE" }] };
    const changed = { subject: { name: "Jordan" }, assets: [{ status: "REVOKED" }] };
    const h1 = await hashCanonicalPayload(base);
    const h2 = await hashCanonicalPayload(changed);
    expect(h1).not.toBe(h2);
  });
});

describe("shortIntegrityId", () => {
  it("returns the first 16 characters by default", () => {
    const full = "a".repeat(64);
    expect(shortIntegrityId(full)).toBe("a".repeat(16));
    expect(shortIntegrityId(full).length).toBe(16);
  });

  it("respects a custom length", () => {
    const full = "b".repeat(64);
    expect(shortIntegrityId(full, 12).length).toBe(12);
  });
});
