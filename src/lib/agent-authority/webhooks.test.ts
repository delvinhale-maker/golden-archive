import { describe, expect, it } from "vitest";
import {
  AUTHORITY_WEBHOOK_EVENTS,
  classifyWebhookDelivery,
  validateWebhookEndpointUrl,
  validateWebhookSubscriptions,
  verifyWebhookSignature,
  webhookReplayFingerprint,
  webhookSignatureHeaders,
} from "./webhooks.server";

describe("Agent Authority webhook security", () => {
  it.each([
    "http://example.com/hook",
    "https://localhost/hook",
    "https://127.0.0.1/hook",
    "https://10.0.0.5/hook",
    "https://192.168.1.5/hook",
    "https://169.254.169.254/latest/meta-data",
    "https://user:pass@example.com/hook",
    "https://example.com:8443/hook",
  ])("rejects unsafe endpoint %s", (url) => {
    expect(() => validateWebhookEndpointUrl(url)).toThrow();
  });

  it("normalizes a public HTTPS webhook URL", () => {
    expect(validateWebhookEndpointUrl("https://hooks.example.com/path#fragment")).toBe("https://hooks.example.com/path");
  });

  it("rejects unsupported subscription events", () => {
    expect(() => validateWebhookSubscriptions(["decision.created", "unknown.event"])).toThrow();
    expect(validateWebhookSubscriptions(["decision.created", "decision.created"])).toEqual(["decision.created"]);
    expect(AUTHORITY_WEBHOOK_EVENTS).toContain("passport.suspended");
  });

  it("produces a stable replay fingerprint while HMAC verification stays body-bound", () => {
    const timestamp = "1800000000";
    const secret = "server-side-secret";
    const body = JSON.stringify({ event: "decision.created", id: "evt_1" });
    const headers = webhookSignatureHeaders(body, secret, timestamp);
    const first = webhookReplayFingerprint(body, timestamp, headers["x-aurumvault-signature"]);
    const second = webhookReplayFingerprint(body, timestamp, headers["x-aurumvault-signature"]);
    expect(first).toBe(second);
    expect(verifyWebhookSignature({ body, secret, timestamp, signatureHeader: headers["x-aurumvault-signature"], nowSeconds: 1800000000 }).valid).toBe(true);
    expect(verifyWebhookSignature({ body: `${body}x`, secret, timestamp, signatureHeader: headers["x-aurumvault-signature"], nowSeconds: 1800000000 }).valid).toBe(false);
  });

  it("moves exhausted failures to dead letter", () => {
    expect(classifyWebhookDelivery({ attemptCount: 6, responseStatus: 503 }).state).toBe("DEAD_LETTER");
  });
});
