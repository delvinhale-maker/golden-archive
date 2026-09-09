import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const KEY_PREFIX = "avap_live_";

export interface GeneratedApiKey {
  plaintext: string;
  hash: string;
  displayPrefix: string;
  last4: string;
}

export function hashApiKey(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function generateApiKey(): GeneratedApiKey {
  const secret = randomBytes(32).toString("base64url");
  const plaintext = `${KEY_PREFIX}${secret}`;
  return {
    plaintext,
    hash: hashApiKey(plaintext),
    displayPrefix: `${KEY_PREFIX}${secret.slice(0, 6)}`,
    last4: secret.slice(-4),
  };
}

export function apiKeyMatches(presented: string, storedHash: string): boolean {
  const actual = Buffer.from(hashApiKey(presented), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
