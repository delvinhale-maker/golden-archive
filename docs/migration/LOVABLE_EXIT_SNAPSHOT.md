# AurumVault Lovable Exit — Source Snapshot

**Snapshot date:** 2026-09-15  
**Migration branch:** `migration/aurumvault-lovable-exit`  
**Production branch:** `main` — DO NOT MODIFY FOR THIS MIGRATION UNTIL CERTIFIED  
**Production domain:** `aurumvault.store` — DNS/cutover is out of scope until staging certification passes

## Verified source anchors

- GitHub repository: `delvinhale-maker/golden-archive`
- GitHub `main` anchor at migration start: `7f7ffb9caa65e180f61118d2593d72169d88a659`
- Lovable project: `Aurum Vault Marketplace`
- Lovable project ID: `622409bb-9a09-4d0a-94c0-f5a8640d5c80`
- Exact Lovable source revision to recover: `c78b3ca13b27e0563a6bb01c270bef10407b82db`
- Current Lovable/Supabase backend ref in source: `rymruqkxmbxobrkkekoc`
- Independent Supabase staging project already owned by the account: `ypelutaddlibqvpaekyq` (`aurumvault-staging`), currently inactive at audit time

## Critical finding: source divergence

The exact Lovable source revision `c78b3ca...` is not present in GitHub. GitHub `main` is therefore **not an exact production-source artifact** and must not be promoted as the recovered storefront without reconciliation.

Confirmed examples of source present in Lovable but absent from GitHub `main` include later Audiobook Studio and Digital Rights Passport implementation files. The migration branch exists specifically to reconstruct and certify the exact application without altering production.

## Runtime dependencies that must be removed or replaced

The recovered application currently contains Lovable-specific runtime dependencies. These are migration blockers, not reasons to redesign the product.

| Area | Current dependency | Exit target |
|---|---|---|
| Google OAuth | `@lovable.dev/cloud-auth-js` / Lovable auth broker | Native Supabase OAuth |
| Stripe server API | `connector-gateway.lovable.dev/stripe` + `LOVABLE_API_KEY` | Direct Stripe API with server-side Stripe secret |
| Transactional email dispatch | `@lovable.dev/email-js` | Independent provider such as Resend, preserving current queue/suppression/idempotency model |
| Product AI review | `ai.gateway.lovable.dev` | Direct model provider adapter |
| Vite/TanStack scaffolding | `@lovable.dev/vite-tanstack-config` | Standard TanStack/Vite/Nitro deployment config |
| Preview auth session broker | Lovable preview-domain postMessage broker | Normal browser storage outside Lovable previews |

Direct Supabase database/auth/storage access and direct Anthropic workflows are already substantially portable.

## Production data boundary

Schema migrations are present in source, but migrations alone do **not** preserve production state. Before cutover, the migration must capture or transfer:

- PostgreSQL production data
- Supabase Auth users and identities
- Storage buckets and objects, especially purchased product files/evidence assets
- RLS policies, functions, triggers and extensions not fully represented by migrations
- Stripe webhook configuration and active price/product identifiers used by runtime flows
- Email sender/DNS configuration and queued/suppressed-email state

Read-only database inventory calls against the paused Lovable-managed backend were cancelled during the initial audit. Treat `rymruqkxmbxobrkkekoc` as Lovable-controlled until ownership/access is independently verified.

## Safety rules

1. Do not modify `main` as part of source recovery.
2. Do not change `aurumvault.store` DNS during source recovery.
3. Do not point live Stripe webhooks at migration/staging code.
4. Do not mutate the current Lovable production database during discovery.
5. Do not claim staging or production parity until exact-source, schema, auth, storage, checkout, webhook, delivery and download tests pass.
6. Secrets must never be committed to this public repository.
7. The final production site must remain online even when AI-builder credits are exhausted.

## Recovery sequence

1. Reconstruct the exact `c78b3ca...` source on this migration branch.
2. Inventory all Lovable runtime references and classify each as build-only, preview-only or production-blocking.
3. Restore/prepare independent AurumVault staging.
4. Recreate schema and obtain production-safe data/auth/storage transfer evidence.
5. Replace Lovable OAuth, Stripe, email and AI gateway adapters.
6. Deploy a non-production external staging URL.
7. Run launch gates for storefront, auth, creator/admin roles, checkout, Stripe webhook fulfillment, email, downloads, Audiobook Studio, Rights Passport, Wallet, SEO and mobile.
8. Freeze an exact certified Git SHA.
9. Create/verify independent production infrastructure.
10. Cut over `aurumvault.store` only after the exact deployment passes smoke tests.

## Current release status

**NO-GO for production cutover.**  
**GO for isolated source recovery and staging preparation on `migration/aurumvault-lovable-exit`.**
