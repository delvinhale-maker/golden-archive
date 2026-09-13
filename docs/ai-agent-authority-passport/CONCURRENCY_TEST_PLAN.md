# Agent Authority Database Concurrency Gate

This gate is intentionally **database-backed** and must run only against an isolated Agent Authority staging/local Supabase instance after migrations. It is not a production test.

## Shared rules

- Use at least two independent database/client connections.
- Synchronize starts with a barrier so requests race rather than run sequentially.
- Repeat each scenario at least 25 times; financial-limit scenarios at least 100 times.
- Assert row counts and final state directly in PostgreSQL after every round.
- Any contradictory immutable rows, duplicate execution receipts, or cross-tenant visibility is a release blocker.

## C1 — Action idempotency

Submit 20 concurrent Action Gate requests in one workspace with the same `idempotency_key`.

Expected:
- exactly 1 `action_requests` row
- exactly 1 `action_decisions` row
- every caller resolves to the same logical action request/decision or receives the documented retryable 409 while the winner is finalizing
- 0 duplicate approval requests/receipts

Repeat with the same key in a second workspace. Expected: one independent record is permitted there; keys are workspace-scoped.

## C2 — Conflicting human approvals

Create one unexpired `PENDING` approval and race two authorized approvers: one APPROVED, one REJECTED.

Expected with `resolve_agent_authority_approval_atomic`:
- exactly 1 immutable `approval_decisions` row
- `approval_requests.status` equals that winning row
- losing transaction returns the existing terminal state; it never writes a contradictory decision
- `resolved_by/resolved_at` match the immutable decision
- at most one terminal rejection receipt

Also race two identical APPROVED submissions. Expected: one row; subsequent response is already-resolved/idempotent, not a second decision.

## C3 — Execution receipt uniqueness

For one ALLOW request, race 10 execution-report calls.

Expected:
- unique `(action_request_id, receipt_kind='EXECUTION')` permits exactly one execution receipt
- all losers are handled as a conflict/idempotent replay, never as duplicate evidence
- evidence level cannot exceed what the winning provider confirmation supports

Repeat for APPROVAL_REQUIRED with no approval. Expected: 0 execution receipts.

## C4 — Suspension/revocation cutover

Race emergency suspension against repeated Action Gate submissions.

Expected:
- no request evaluated after the committed suspension/revocation timestamp may return ALLOW/APPROVAL_REQUIRED
- pre-cutover decisions remain immutable historical evidence
- reinstatement does not revive a REVOKED Passport

This scenario should use database timestamps/commit ordering when classifying pre/post cutover results.

## C5 — Daily financial-limit oversubscription

Set `max_daily_spend = 100 USD`; race two 60 USD purchase authorizations.

Required release behavior:
- the system must not produce executable authority totaling more than the cap for the UTC day.

**Current staging acceptance:** this test is a mandatory launch gate because simple read-then-evaluate spend aggregation can oversubscribe under concurrency. If this scenario fails, implement transactional spend reservation/serialization before enabling financial connector execution. Do not waive the test by relying on UI sequencing.

Also test 60 + 40 (may both fit), currency mismatch, failed/cancelled execution, and reservation/release behavior once transactional reservation is introduced.

## C6 — Webhook worker claim

Create one RETRY_SCHEDULED delivery and race 10 workers.

Expected:
- exactly one worker wins the optimistic attempt-count/state claim
- attempt_count increments once per actual delivery attempt
- endpoint failure counters increment once
- one successful delivery resets consecutive failure state without losing lifetime failure count

## C7 — Dead-letter replay

Race two administrators replaying the same dead-letter delivery.

Expected:
- unique replay-source constraint allows one replay record only
- replay retains source linkage and required reason/audit evidence
- replay does not mutate the original dead-letter record

## C8 — Cross-workspace concurrency

Run C1/C2/C6 simultaneously in two workspaces with overlapping synthetic external references/idempotency strings.

Expected:
- no foreign workspace row is read, updated, counted, approved or returned
- RLS and every server query remain workspace-qualified

## Evidence to retain

For every staging run record:
- migration versions
- Postgres/Supabase version
- test run id
- connection count
- iterations
- invariant failures
- final row-count assertions
- sanitized query/error evidence

Never store real API keys, OAuth tokens, email bodies, financial account data, or customer PII in concurrency-test artifacts.
