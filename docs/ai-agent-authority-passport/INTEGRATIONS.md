# Agent Authority Integration Architecture

Status: **governance foundation only — no live connector execution is enabled by this PR.**

Every connector must pass through the same control chain before an external action can ever be attempted:

`Authenticated caller → Passport → Action Gate → optional human approval → connector adapter → execution evidence → Authorization Receipt`

## Non-negotiable connector rules

1. OAuth/API credentials live only in a server-side secret store. Database rows may retain a secret reference/fingerprint, never plaintext credentials.
2. Connector adapters never decide authority. They receive an already-authorized action request/approval context from the deterministic Action Gate boundary.
3. The adapter must re-check Passport status/version immediately before execution. Suspended, expired, revoked, reauthorization-pending, or policy-version mismatch means no execution.
4. Every write/financial/destructive operation requires an idempotency key appropriate to the provider.
5. Provider responses are reduced to evidence identifiers/status metadata; raw email bodies, access tokens, card data, customer secrets, and broad provider payloads must not enter the Evidence Ledger.
6. Execution verification requires a provider-confirmed identifier/status. A local assertion remains DECLARED/APPROVAL_VERIFIED.
7. Each adapter starts in `FOUNDATION_ONLY`. Enabling a provider requires isolated staging, scoped credentials, tenant/RLS validation, negative authorization tests, and an explicit release-gate change.

## Provider roadmap

| Provider | Auth boundary | Initial governed capabilities | Default high-risk posture | Evidence anchor |
| --- | --- | --- | --- | --- |
| Gmail | OAuth 2 | read, draft, send, delete | send=approval; delete=block | message/draft id + history id |
| Google Drive | OAuth 2 | read, create, share, delete | share=approval; delete=block | file/revision/permission id |
| Slack | OAuth 2 | read, send, delete | send=approval; delete=block | channel + message timestamp |
| HubSpot | OAuth 2 | contact/deal read/update/delete | update=approval; delete=block | CRM object id + updatedAt |
| QuickBooks | OAuth 2 | invoice read/create, payment create | invoice=approval; payment=block | entity id + SyncToken |
| Stripe | server API key | customer read, invoice/refund/payment actions | financial writes blocked until separately released | object id + Stripe request id |
| n8n | server API key | trigger workflow, modify workflow | trigger=approval; modify=block | execution/workflow version id |
| Make | server API key | run/modify scenario | run=approval; modify=block | execution/scenario version id |
| Zapier | OAuth 2 | invoke action, modify automation | invoke=approval; modify=block | run/action/workflow id |

The code catalog lives in `src/lib/agent-authority/integrations/catalog.ts` and intentionally contains no OAuth exchanges, API calls, live secrets, or provider SDK execution paths.

## Adapter contract for a future release

A live adapter should expose only a narrow internal interface similar to:

```ts
type GovernedExecution = {
  workspaceId: string;
  passportId: string;
  passportVersion: number;
  actionRequestId: string;
  actionKey: string;
  idempotencyKey: string;
  approvalDecisionId?: string;
  normalizedInput: Record<string, unknown>;
}

type ExecutionEvidence = {
  executed: boolean;
  sourceSystem: string;
  externalReference: string;
  occurredAt: string;
  providerStatus?: string;
}
```

The normalized input must be capability-specific and schema validated. Arbitrary provider payload passthrough is prohibited.

## Release sequence

Recommended order remains: Gmail → Google Drive → Slack → HubSpot → QuickBooks → Stripe → n8n → Make → Zapier. Financial connectors stay BLOCK-by-default until the isolated staging concurrency/limits/approval suite passes.
