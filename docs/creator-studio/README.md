# AurumVault Creator Studio™ — Architecture & Operations (CS1–CS5)

Status: **code complete, not deployed**. Nothing in this document has been applied to any Supabase project. See "Known caveat: staging schema drift" below before any staging rollout.

## 1. Feature flags

Three fail-closed flags, defined in `src/lib/creator-studio/feature-flags.ts`:

| Flag | Default | Gates |
|---|---|---|
| `CREATOR_STUDIO_ENABLED` | off | The whole feature — routes, wizard, project/asset CRUD. |
| `CREATOR_STUDIO_RENDERING_ENABLED` | off (implies the master switch) | Calling the Shotstack adapter at all. |
| `CREATOR_STUDIO_PAID_PLANS_ENABLED` | off (implies the master switch) | Stripe checkout (subscriptions + extra credits). |

An absent or misspelled value is always treated as OFF (`parseFlag` only accepts the literal strings `"true"` / `"1"`). `VITE_CREATOR_STUDIO_ENABLED` is a client-only mirror of the master switch used purely to hide/show the nav entry — it is never a security boundary; every server function re-checks the real flag via `requireCreatorStudioEnabled` / `requireCreatorStudioRenderingEnabled` / `requireCreatorStudioPaidPlansEnabled`, placed first in each function's middleware array (before auth).

Recommended staging rollout sequence:

1. `CREATOR_STUDIO_ENABLED=true`, the other two `false` — wizard, projects, assets, library all work; nothing renders or charges anything.
2. `+ CREATOR_STUDIO_RENDERING_ENABLED=true` — real Shotstack submissions, still no billing.
3. `+ CREATOR_STUDIO_PAID_PLANS_ENABLED=true` — Stripe checkout live.

Production should not flip any of these until the corresponding staging gate above has actually passed.

## 2. Provider adapter (Shotstack)

`src/lib/creator-studio/providers/shotstack.server.ts` is the **only** file that knows Shotstack's JSON shape or calls its API. It exposes:

- `buildShotstackEditRequest(composition, sourceUrls, callbackUrl)` — pure, unit-tested JSON mapping.
- `submitRender(...)` / `getRenderStatus(...)` — the only two network calls, both with a 30s timeout.
- `normalizeProviderError(err)` — maps any failure to a stable `errorCode` + the exact customer-safe message, never raw provider JSON/keys/stack traces.

No SDK is used — plain typed `fetch`. Required environment variable **names** (no values ever committed):

- `SHOTSTACK_SANDBOX_API_KEY`, `SHOTSTACK_PRODUCTION_API_KEY`
- `SHOTSTACK_ENV` (`"sandbox"` unless explicitly `"production"` — fails toward sandbox)
- `SHOTSTACK_WEBHOOK_SECRET` (defense-in-depth; see §5)

## 3. Render lifecycle

```
DRAFT → READY → GENERATING → COMPLETE
                     ↘ FAILED
```

1. User clicks **Create Video** (`submitRenderFn`). This: runs the abuse guardrails, loads the project + attached assets, runs the deterministic scene planner (`scene-planner.ts`) to build a `CreatorVideoComposition`, validates it with Zod (`composition.schema.ts`), **reserves one video credit**, inserts a `creator_studio_render_jobs` row (`QUEUED`), mints short-lived signed source URLs, and calls `submitRender`.
2. On success: job → `SUBMITTED`, project → `GENERATING`.
3. Shotstack posts to `/api/public/creator-studio/shotstack-webhook?job=<id>&token=<idempotency_key>` when done. The webhook resolves the job strictly by `job` id and verifies `token` against the stored `idempotency_key` — Shotstack does not sign its callbacks the way Stripe does, so this per-job unguessable token plus strict server-side ownership resolution is the strongest available authenticity check (see the adapter's header comment).
4. On `SUCCEEDED`: the finished video (and poster) are copied into the AurumVault-controlled `creator-studio-renders` bucket, recorded as `creator_studio_assets` rows, the job → `SUCCEEDED`, project → `COMPLETE`, and the reservation is **finalized** (credit stays spent).
5. On `FAILED` (provider error, timeout, output fetch/store failure): job → `FAILED` with a safe error code/message, project → `FAILED`, and the reservation is **released** (credit refunded). The customer sees exactly: *"We couldn't finish this video. Your video credit was not consumed."*
6. A bounded-backoff client poll (`getLatestRenderJobForProjectFn`, 4s then 10s) covers the case where the webhook hasn't landed yet.

## 4. Entitlement lifecycle

Schema: `creator_studio_entitlements` (one row/user) + `creator_studio_usage_ledger` (append-only). All mutation happens inside three `SECURITY DEFINER` Postgres functions — no table grants let a client change its own counters:

- `creator_studio_reserve_video_credit(user, project, idempotencyKey)` — takes a row lock on the user's entitlements row (serializing concurrent requests from the *same* user; different users never contend), then spends from FREE preview → included quota → extra credits, in that order. Idempotent: a repeated call with the same key returns the original result instead of reserving twice.
- `creator_studio_finalize_consumption(user, reserveKey)` — marks a reservation permanently spent. No counter change (the credit was already spent at reserve time).
- `creator_studio_release_reservation(user, reserveKey)` — refunds the reservation's exact source, but refuses if it was already finalized (a successful render can never be "un-consumed" by a late duplicate failure signal).
- `creator_studio_apply_stripe_fulfillment(...)` — applies a paid Stripe event (extra credit, subscription activation/renewal/cancellation), idempotent on the Stripe event/session id, `service_role`-only.

There is **no pre-existing entitlement/subscription system anywhere else in this codebase** (verified: no `entitlement` hits in any applied migration or `src/`, and every other Stripe checkout in `src/lib/payments.functions.ts` uses `mode:"payment"` only). This migration is therefore the first entitlement system in this repo, built as a self-contained, additive extension — not a parallel Stripe identity model — reusing the exact same `createStripeClient` / tax-mode helpers / webhook file as every existing checkout.

## 5. Cost model

`estimated_provider_cost_cents` is written on every render job at submission time (`estimateRenderCostCents`, a conservative flat per-second placeholder — Shotstack's status API does not return actual per-render cost, so `final_provider_cost_cents` stays unset until an operator reconciles it against a real invoice; this is stated honestly rather than fabricated). `getCreatorStudioCostSummaryFn` (admin-only, `has_role(admin)` checked explicitly) aggregates renders/successes/failures/total cost/average cost per video/cost by plan for internal margin tracking. **Customers never see cost** — `getMyEntitlementsFn` only ever returns plan/quota/renewal language.

## 6. Abuse guardrails (`abuse-guardrails.ts`)

Plan-independent hard ceilings, enforced regardless of remaining quota: max source asset size (15MB), max screenshots per project (10), max concurrent in-flight renders per user (2), max render submissions per user per 24h (20). Combined with a DB-level partial unique index allowing at most one in-flight `render_jobs` row per project, and a 30s provider timeout on every Shotstack call.

## 7. Failure handling

Every provider/adapter failure is normalized (`normalizeProviderError`) to a stable internal `error_code` plus the single customer-safe message above — never raw JSON, SQL, stack traces, API keys, or provider account data. Every failure path also releases the entitlement reservation, so a provider outage never costs the customer a video.

## 8. Staging setup (names only)

Required environment variable **names** for an isolated staging deployment — no values are recorded anywhere in this repo:

`CREATOR_STUDIO_ENABLED`, `CREATOR_STUDIO_RENDERING_ENABLED`, `CREATOR_STUDIO_PAID_PLANS_ENABLED`, `SHOTSTACK_SANDBOX_API_KEY`, `SHOTSTACK_PRODUCTION_API_KEY`, `SHOTSTACK_ENV`, `SHOTSTACK_WEBHOOK_SECRET`, `CREATOR_STUDIO_PRICE_PRO_SANDBOX`, `CREATOR_STUDIO_PRICE_PRO_LIVE`, `CREATOR_STUDIO_PRICE_BUSINESS_SANDBOX`, `CREATOR_STUDIO_PRICE_BUSINESS_LIVE`, `CREATOR_STUDIO_PRICE_EXTRA_CREDIT_SANDBOX`, `CREATOR_STUDIO_PRICE_EXTRA_CREDIT_LIVE`.

### Known caveat: staging schema drift (read before any staging apply)

A read-only inspection of the `aurumvault-staging` Supabase project (id `ypelutaddlibqvpaekyq`) during this implementation found that it **already has** a live `creator_studio_*` schema — but it is a different design from this branch's proposed migration, and it does not appear anywhere in this repository's git history (not in `supabase/migrations/`, not on any branch's `docs/proposed-migrations/`). It uses different table names (`creator_studio_events`, `creator_studio_provider_state`, `creator_studio_runtime_control`, `creator_studio_billing_state`, `creator_studio_extra_video_credits`, `creator_studio_usage_reservations`, `creator_studio_stripe_events`) and, for the table names that do overlap (`creator_studio_projects`, `creator_studio_assets`, `creator_studio_project_assets`, `creator_studio_render_jobs`, `creator_studio_entitlements`), different columns entirely (e.g. `style_key`/`hook`/`wizard_step`/`price_cents` instead of this branch's `style_preset`/`headline` fields/`price_text`).

**This branch's migration was not applied to that project, and no writes were made there during this implementation** — the two schemas are incompatible, and applying this branch's `CREATE TABLE` statements there would fail outright on the already-existing table names. Before any staging rollout, a human needs to decide which schema is authoritative (this branch's, the one already live on `aurumvault-staging`, or a reconciliation of both) — this is exactly the kind of decision the CS5 "discover current staging state before backend writes" instruction is meant to surface, not paper over.

## 9. Production gate

Do not enable any of the three flags in production, do not point production at a Shotstack production key, and do not apply this branch's migration anywhere until: (a) the schema-drift caveat above is resolved, (b) the staging sequence in §1 has been run end-to-end with real (sandbox) Shotstack credentials, and (c) two-user isolation has been verified against real rows in whichever schema is chosen as authoritative.
