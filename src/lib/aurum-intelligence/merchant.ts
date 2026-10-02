import { createHmac, timingSafeEqual } from "node:crypto";
import type { MerchantSignal } from "./contracts";

export function signMerchantPayload(payload: MerchantSignal[], secret: string): string {
  return createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
}

export function verifyMerchantSignature(payload: MerchantSignal[], signature: string, secret: string): boolean {
  const expected = signMerchantPayload(payload, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type MerchantIntelligenceEnvelope = {
  schema: "aurum.merchant-intelligence.v1";
  store: "aurumvault";
  signals: MerchantSignal[];
  generatedAt: string;
};

export function buildMerchantEnvelope(signals: MerchantSignal[]): MerchantIntelligenceEnvelope {
  return {
    schema: "aurum.merchant-intelligence.v1",
    store: "aurumvault",
    signals,
    generatedAt: new Date().toISOString(),
  };
}
