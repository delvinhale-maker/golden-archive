# AurumVault AI Agent Authority Passport™ — V1 + Governance Hardening

**Product promise:** Know what every AI agent is allowed to do, who approved it, what it actually did, and whether its current authority remains justified.

**Positioning:** AI employee governance for businesses without an IT department.

## Core governance chain

`Identity → Authority → Decision → Approval → Execution → Evidence → Review`

The deterministic Action Gate returns exactly one of:

- `ALLOW`
- `APPROVAL_REQUIRED`
- `BLOCK`

The system is fail-closed. Unknown actions, invalid/expired/suspended/revoked Passports, prohibited data classifications, disallowed systems, hard policy prohibitions and exceeded hard limits block authority.

## V1 foundation

- Agent Registry and versioned Agent Passport™
- Passport creation and reauthorization
- Authority Matrix™ with editable ALLOW / APPROVAL_REQUIRED / BLOCK controls
- Authority Limits™ for money, systems, external communication, financial actions and sensitive data
- Action Gate™ deterministic decision engine
- Approval Center™ with attributable human approval/rejection and expiry
- Authorization Receipts™ with SHA-256 integrity and explicit evidence levels
- Evidence Ledger™ with append-only evidence records
- Authority reviews, recertification, reauthorization, suspension, revocation and expiration
- Emergency suspension/reinstatement
- CSV/PDF audit export
- Hash-only scoped API credentials
- Action Gate and evidence-report API routes
- HMAC webhook foundation and delivery ledger
- Ten editable SMB agent templates
- Authenticated AurumVault command-center UI

## Governance hardening implemented

### Policy Versioning + Diff
Every Passport version can be compared against its predecessor. The diff classifies each change as an authority `INCREASE`, `DECREASE`, or `LATERAL` change across:

- action decisions
- approval thresholds
- monetary hard limits
- system allow/block scope
- global communication/financial/sensitive-data rules
- per-action and Passport-wide data-classification rules
- sponsor, purpose, provider/model/platform/environment material identity attributes

Any material authority increase creates a Policy Change Approval request. The new version stays subject to reauthorization and cannot activate until the change request is approved. When another OWNER/ADMIN is available, the requester may not approve their own increase. A sole-admin fallback requires an explicit decision note.

### Least-Privilege Analyzer
The deterministic analyzer flags:

- unused executable permissions
- stale permissions
- direct destructive/admin actions
- autonomous financial authority
- actions repeatedly evaluated but never executed
- absent or unusually broad system allowlists
- autonomous CONFIDENTIAL/RESTRICTED data access

Every finding includes severity, explanation, recommendation and a suggested narrower decision when applicable.

### Explainable Agent Risk Score
Risk is deterministic and capped at 100 points. It does not use an LLM. The score is composed from:

- financial authority — 20
- destructive/admin permissions — 15
- sensitive-data authority — 15
- external communications — 10
- system scope — 10
- execution autonomy — 20
- stale/overdue review — 10

Bands: `LOW`, `MODERATE`, `HIGH`, `CRITICAL`.

### Shadow Mode / Simulation
Shadow Mode uses the production Action Gate evaluator but always returns `executable: false`. Simulations never create an approval, receipt, execution instruction or external side effect. Results can be stored as append-only governance evidence.

### Incident Response Center
Incident lifecycle:

`OPEN → CONTAINED / INVESTIGATING → REMEDIATING → RESOLVED → CLOSED`

Invalid state jumps are rejected. Incidents include severity, owner, summary, containment, root cause, corrective actions and an append-only event history. Containment can invoke Emergency Suspension for the affected Passport.

### Delegation / Chain of Authority
Approval delegation supports:

- human delegator and delegate
- documented purpose
- action-key scope
- maximum approval amount
- start/end dates
- optional re-delegation
- revocation and history

Re-delegation can only narrow the parent delegation's action scope, amount and expiration. Delegated authority is checked before any approval decision is written, and the original delegator must still hold the required workspace authority.

### Policy Change Approval
Authority increases cannot silently activate. A change request records the old/new version, explainable diff, requester, expiry, human decision and decision note. Independent approval is enforced when another OWNER/ADMIN exists.

### Receipt Verification
Authorization Receipts can be recomputed and classified as:

- `VALID`
- `TAMPERED`
- `INCOMPLETE`

The verifier reconstructs the canonical receipt, enforces evidence-level completeness and recomputes the SHA-256 integrity hash.

### API hardening
- cryptographically random 256-bit API secrets
- SHA-256 hash-only persistence; plaintext returned once
- explicit scopes
- expiration and revocation
- key rotation that revokes the predecessor
- last-used tracking
- database-atomic per-key/per-minute rate limits
- structured JSON error codes and HTTP statuses
- mandatory Action Gate idempotency keys
- rate-limit response headers

### Webhook reliability
- HMAC-SHA256 signatures over `timestamp.body`
- constant-time signature verification
- replay-window timestamp validation
- six-attempt exponential backoff
- retry and dead-letter states
- authorized manual replay
- one replay record per dead-letter delivery
- endpoint health: HEALTHY / DEGRADED / FAILING / DISABLED
- database-atomic endpoint failure counters
- optimistic delivery-attempt claim to prevent duplicate workers from recording the same attempt

Signing secrets remain server-side. The registry stores only references/fingerprints.

### Data Classification
Resources support:

- `PUBLIC`
- `INTERNAL`
- `CONFIDENTIAL`
- `RESTRICTED`

Classification is resolved by resource key and fed directly into the Action Gate. Default policy is deliberately conservative: PUBLIC/INTERNAL may be allowed; CONFIDENTIAL/RESTRICTED fail closed unless explicitly configured. Per-action classification rules can further narrow the Passport default.

### Governance Readiness Dashboard
Readiness is a deterministic 0–100 score derived from live governance debt:

- overdue reviews
- expired agents
- HIGH/CRITICAL-risk Passports
- unused permissions
- pending approvals
- open/critical incidents
- webhook failures/dead letters
- receipts without execution-verified evidence

Bands: `READY`, `ATTENTION`, `AT_RISK`, `CRITICAL`.

## Evidence levels

- `DECLARED` — recorded assertion; execution is not independently confirmed
- `APPROVAL_VERIFIED` — attributable human approval exists
- `EXECUTION_VERIFIED` — a reporting/connected source confirms execution
- `SIGNED_EVIDENCE` — confirmed execution plus signed evidence

A Receipt cannot claim `EXECUTION_VERIFIED` or `SIGNED_EVIDENCE` unless the required evidence fields exist.

## Security model

- All 26 schema tables have RLS enabled.
- All defined client-readable policies explicitly target `authenticated` and apply workspace-membership predicates.
- No anonymous governance policies are defined.
- API key records and API rate-window records intentionally have no authenticated SELECT policy.
- Privileged API rate-limit and webhook-health RPCs are `SECURITY INVOKER`, revoked from public/anon/authenticated and granted only to `service_role`.
- Core decision/evidence records and Phase 1.5 simulation/history/analysis records have append-only database triggers.
- Governance writes are designed to flow through authenticated server functions or scoped API-key server routes.
- API-originated requests are attributed to the API key rather than falsely to a human requester.
- Raw credentials, access tokens and unnecessary sensitive payload bodies are excluded from the modeled evidence/export paths.

## Verified in this detached build

- detached TypeScript integration compile: PASS
- original foundation regression checks: **14/14 PASS**
- governance-hardening checks: **24/24 PASS**
- combined behavior/security checks: **38/38 PASS**
- schema tables with RLS: **26/26**
- policies with explicit authenticated role: PASS
- missing-table RLS: **0**
- client SELECT policy on API-key table: **none**
- core/Phase 1.5 append-only trigger static checks: PASS
- service-role-only rate-limit and webhook-health RPC static checks: PASS

## Not yet production-verified

This source package is intentionally not deployed. Production-readiness still requires:

1. Attach the package to a dedicated feature/staging branch.
2. Convert `schema.sql` into a repository-standard Supabase migration after reviewing migration order against the target branch.
3. Use a dedicated isolated Agent Authority staging backend. Do not reuse production or the existing Digital Rights Passport validation backend.
4. Apply schema in staging and regenerate Supabase TypeScript types.
5. Regenerate TanStack `routeTree.gen.ts` through normal tooling; do not hand-edit it.
6. Run two-user workspace isolation, role and delegated-approval tests against the live staging database.
7. Run database-backed idempotency/concurrency tests for Action Gate, API rate limits, webhook workers and replay uniqueness.
8. Run the full repository typecheck/build/unit/E2E suite.
9. Verify PDF/CSV downloads, one-time API-key display, incident containment and receipt verification in a real browser session.
10. Configure server-side webhook secret storage and a delivery worker before enabling outbound webhooks.

Do not label the package production-ready until these environment-dependent gates pass.
