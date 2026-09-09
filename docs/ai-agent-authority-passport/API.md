# AurumVault AI Agent Authority Passport™ — API & Webhook Foundation

This boundary governs proposed actions and evidence. It does **not** itself execute email, CRM, payment, refund, purchase, invoice or other third-party actions.

## Authentication

OWNER/ADMIN users create API keys through authenticated server actions. Plaintext is returned once and is never persisted. Stored fields are limited to:

- SHA-256 key hash
- non-secret display prefix and last four
- scopes
- configurable per-minute rate limit
- created-by / created-at
- last-used
- expiry / revocation
- rotation predecessor reference

Keys use the `avap_live_` prefix and contain a cryptographically random 256-bit secret.

### Scopes

- `passports:read`
- `decisions:write`
- `approvals:read`
- `receipts:read`
- `evidence:write`
- `webhooks:manage`

Requests with missing, invalid, expired, revoked or insufficient-scope credentials return structured JSON errors. Rate-limit consumption is performed by a service-role-only database-atomic RPC.

## Structured error shape

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "API rate limit exceeded",
    "details": {
      "limit": 60,
      "remaining": 0,
      "resetAt": "2026-09-09T12:01:00.000Z"
    }
  }
}
```

Representative codes include `AUTH_MISSING`, `AUTH_INVALID`, `KEY_EXPIRED`, `KEY_REVOKED`, `INSUFFICIENT_SCOPE`, `RATE_LIMITED`, `INVALID_INPUT`, `NOT_FOUND`, `CONFLICT`, `FORBIDDEN`, and `INTERNAL_ERROR`.

Successful API responses include `x-ratelimit-limit`, `x-ratelimit-remaining` and `x-ratelimit-reset`.

## POST `/api/agent-authority/action`

Requires `decisions:write`.

Submits a proposed action to the deterministic Action Gate. It **never performs the external action**. It returns `ALLOW`, `APPROVAL_REQUIRED`, or `BLOCK` plus explainable reason codes.

`idempotencyKey` is mandatory and unique within a workspace. Reusing the same key returns/anchors to the existing logical request rather than creating duplicate authority records.

Example:

```json
{
  "passportId": "00000000-0000-0000-0000-000000000000",
  "actionKey": "proposal.send",
  "target": "Customer account reference",
  "resourceKey": "crm.proposals",
  "system": "CRM",
  "dataClassification": "INTERNAL",
  "externalCommunication": true,
  "idempotencyKey": "proposal-2026-09-09-abc123"
}
```

Classification can be supplied explicitly or resolved server-side from the Data Classification registry by `resourceKey`/target.

## POST `/api/agent-authority/evidence`

Requires `evidence:write`.

Reports execution/evidence for an action already authorized by the Action Gate. A BLOCK cannot be reported as executed. An `APPROVAL_REQUIRED` action cannot become executable until an attributable human approval exists.

`EXECUTION_VERIFIED` is only available when confirmed execution evidence is present. `SIGNED_EVIDENCE` additionally requires signed evidence. A mere assertion remains `DECLARED` or `APPROVAL_VERIFIED`.

## API-key lifecycle

- **Create:** plaintext returned once; hash stored.
- **Rotate:** a new credential is created and the predecessor is revoked.
- **Revoke:** immediate authentication failure for future uses.
- **Expire:** checked on every request.
- **Scope:** checked before rate-limit consumption and service invocation.
- **Rate limit:** persisted atomically per API key and minute.
- **Last used:** updated after successful authentication/rate-limit admission.

## Outbound webhooks

Supported event foundation includes:

- `decision.created`
- `approval.requested`
- `approval.decided`
- `receipt.created`
- `passport.suspended`
- `passport.reinstated`
- `passport.expired`
- `review.due`
- `incident.created`
- `incident.contained`
- `incident.resolved`
- `delegation.created`
- `delegation.revoked`
- `policy_change.requested`
- `policy_change.decided`

### Signature

HMAC-SHA256 is computed over:

`<unix_timestamp>.<raw_request_body>`

Headers:

- `x-aurumvault-timestamp`
- `x-aurumvault-signature: v1=<hex hmac>`

Verification uses constant-time comparison and a default 5-minute timestamp tolerance to reduce replay risk. Signing secrets must come from a server-side secret store. The database endpoint registry stores only a secret reference/fingerprint.

### Delivery reliability

Maximum automatic attempts: **6**.

Backoff schedule: immediate, 1 minute, 5 minutes, 15 minutes, 1 hour, 6 hours.

Delivery states include `PENDING`, `RETRY_SCHEDULED`, `DELIVERED`, `DEAD_LETTER`. Non-2xx responses/network failures are classified; retryable attempts receive `next_attempt_at`. Exhausted deliveries enter dead letter.

Manual replay:

- requires OWNER/ADMIN authority
- requires a reason
- only applies to a dead-letter delivery
- creates a new delivery linked to the source
- schema enforces a single replay record per source dead letter

Worker result updates use an optimistic attempt-count claim so two workers cannot both record the same attempt. Endpoint failure counters are incremented through an atomic service-role-only database function.

## Security boundary

- No anonymous governance policies.
- API credential hashes and rate windows are not client-readable.
- Service-role access remains server-only.
- The Action Gate API does not execute the external action.
- Webhook signing secrets are not stored in client-readable tables.
- Delivery logs store status/evidence metadata rather than sensitive request/response bodies.
- Audit exports omit API credentials, key hashes, webhook secrets and raw sensitive payloads.
