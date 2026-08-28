import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  encryptIntegrationTokens,
  decryptIntegrationTokens,
  isEncrypted,
} from "./oauth-token-crypto.server";

const ORIGINAL_KEY = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
const ORIGINAL_KEY_V2 = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY_V2;

beforeAll(() => {
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = "test-key-material-for-unit-tests-only-v1";
});

afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  else process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = ORIGINAL_KEY;
  if (ORIGINAL_KEY_V2 === undefined) delete process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY_V2;
  else process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY_V2 = ORIGINAL_KEY_V2;
});

describe("encryptIntegrationTokens / decryptIntegrationTokens", () => {
  it("round-trips an access + refresh token pair exactly", async () => {
    const original = { accessToken: "canva-access-abc123", refreshToken: "canva-refresh-xyz789" };
    const envelope = await encryptIntegrationTokens(original);
    const decrypted = await decryptIntegrationTokens(envelope);
    expect(decrypted).toEqual(original);
  });

  it("produces an envelope that does not contain the plaintext token anywhere", async () => {
    const original = { accessToken: "super-secret-plaintext-token-value-11111" };
    const envelope = await encryptIntegrationTokens(original);
    const serialized = JSON.stringify(envelope);
    expect(serialized).not.toContain("super-secret-plaintext-token-value-11111");
  });

  it("marks its output as a valid v1 envelope via isEncrypted()", async () => {
    const envelope = await encryptIntegrationTokens({ accessToken: "x" });
    expect(isEncrypted(envelope)).toBe(true);
    expect(isEncrypted({ accessToken: "plain" })).toBe(false);
    expect(isEncrypted(null)).toBe(false);
  });

  it("uses a fresh random IV each time — same plaintext, different ciphertext", async () => {
    const a = await encryptIntegrationTokens({ accessToken: "same-value" });
    const b = await encryptIntegrationTokens({ accessToken: "same-value" });
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });

  it("decrypting a tampered ciphertext throws rather than returning garbage", async () => {
    const envelope = await encryptIntegrationTokens({ accessToken: "value" });
    const tampered = { ...envelope, data: envelope.data.slice(0, -4) + "abcd" };
    await expect(decryptIntegrationTokens(tampered)).rejects.toThrow();
  });

  it("returns {} for null/undefined input rather than throwing", async () => {
    expect(await decryptIntegrationTokens(null)).toEqual({});
    expect(await decryptIntegrationTokens(undefined)).toEqual({});
  });
});
