# AurumVault × Shopify Partner Distribution Plan

## Objective

Add Shopify as an optional external distribution channel for eligible AurumVault creators without replacing AurumVault marketplace listings, checkout, creator payouts, canonical product URLs, or existing commerce flows.

## Commercial model

Shopify's partner earning terms effective August 10, 2026 reward qualifying Launch Partners with 20% of the merchant's base subscription/platform fee plus 0.1% of eligible online GMV for four years. Qualifying Plus referrals/upgrades can also earn a one-time $2,500 payout under Shopify's current rules.

AurumVault should pursue the Launch Partner path only where it actually performs the qualifying build/transfer or other Shopify-defined launch work. Attribution must never be claimed without meeting Shopify's program requirements.

## Product direction

The preferred AurumVault experience is a guided `Sell on Shopify` distribution flow inside Creator Studio / creator tooling:

1. Creator chooses an existing AurumVault product.
2. Creator connects or creates a Shopify store through an approved Shopify flow.
3. AurumVault validates product readiness for Shopify.
4. Creator reviews title, description, media, price and fulfillment/delivery configuration.
5. Creator explicitly approves publication.
6. AurumVault creates or updates the Shopify product through server-side APIs.
7. AurumVault stores only the minimum required connection and sync metadata.
8. AurumVault shows sync state, last successful publish time and actionable errors.

## Non-negotiable boundaries

- Shopify credentials and access tokens are server-side only.
- No production secrets are committed to Git.
- No automatic publication without explicit creator approval.
- No replacement or mutation of canonical AurumVault product URLs.
- No change to AurumVault checkout or payout logic as part of the initial integration.
- No duplicate product records in AurumVault merely to represent Shopify copies; use mapping/sync metadata.
- OAuth state must be cryptographically protected and short-lived.
- Webhook signatures must be verified before processing.
- Token revocation/uninstall must be handled cleanly.
- Logs must not expose Shopify access tokens or customer PII.

## Phase 1 — Partner and app readiness

Manual prerequisites in Shopify Partner Dashboard:

- Join/confirm Shopify Partner Program account.
- Create the AurumVault app/integration under the correct partner organization.
- Configure allowed redirect URL(s) for staging first.
- Request only the minimum Admin API scopes required for the first workflow.
- Record Partner organization/app identifiers outside source control.
- Establish a Shopify development/client-transfer store for testing where permitted.

Do not start production OAuth until a staging callback URL and secret storage location are confirmed.

## Phase 2 — Integration foundation

Planned code boundaries:

- `src/integrations/shopify/` for typed Shopify client, OAuth helpers, signature verification and product mapping utilities.
- Server-only OAuth start/callback handlers.
- Server-only product publish/update actions.
- Webhook endpoint for uninstall and relevant product/store lifecycle events.
- Database migration for creator/store connection and product sync mapping records, reusing existing tables where an appropriate integration table already exists.
- Tests for OAuth state validation, webhook HMAC validation, scope enforcement, revoked credentials and idempotent product synchronization.

## Phase 3 — Creator UX

Add a premium, guided distribution surface rather than a generic integration settings page:

- `Sell on Shopify` entry point on an eligible creator product.
- Connection status and store identity.
- Product readiness checklist.
- Review-before-publish step.
- Publish/sync status with clear remediation actions.
- Disconnect control that revokes local credentials and stops sync.

## Phase 4 — Launch Partner attribution safeguards

AurumVault should separately track whether a Shopify store is:

- creator-owned/existing and merely connected,
- a store AurumVault helped build but is not eligible for Launch Partner attribution,
- a qualifying client-transfer/launch store,
- a Plus referral/upgrade lead submitted through the Partner Dashboard.

Partner earnings must be treated as program-dependent and never promised to creators or booked as guaranteed revenue.

## Release gates

Before production enablement:

- Typecheck/build green.
- OAuth state replay/reuse rejected.
- Invalid webhook signatures rejected.
- Secrets absent from client bundle and repository.
- Uninstall/revocation tested.
- Duplicate publish requests are idempotent.
- Existing AurumVault product URLs and checkout remain unchanged.
- Staging creator can connect, publish one test product, update it, disconnect and reconnect successfully.
- Production remains feature-flagged off until the above evidence is recorded.

## Recommended first API scope

Start with the narrowest product/catalog scope necessary for product creation and updates. Do not request orders, customers, payments, fulfillment, or broad store-management access until a concrete AurumVault workflow requires them.

## Immediate next gate

The integration can proceed once the Shopify Partner organization and app exist and the staging OAuth client credentials / callback configuration are available in server-side secret storage. No Shopify secret should be pasted into source files or committed to Git.
