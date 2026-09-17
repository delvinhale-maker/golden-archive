# AurumVault Schema Parity Evidence — 2026-09-17

## Compared environments

**Production source (read-only):** Lovable project `622409bb-9a09-4d0a-94c0-f5a8640d5c80`, Supabase ref `rymruqkxmbxobrkkekoc`.

**Independent staging:** `aurumvault-staging`, Supabase ref `ypelutaddlibqvpaekyq`.

Production was not mutated during this analysis.

## Table coverage

- Production public tables: **114**
- Staging public tables: **127**
- Production table names present in staging: **114 / 114**
- Staging-only tables: **13**

The staging-only set is expected independent work, primarily Canva/Creator Studio infrastructure:

- `canva_design_products`
- `creator_studio_assets`
- `creator_studio_billing_state`
- `creator_studio_entitlements`
- `creator_studio_events`
- `creator_studio_extra_video_credits`
- `creator_studio_project_assets`
- `creator_studio_projects`
- `creator_studio_provider_state`
- `creator_studio_render_jobs`
- `creator_studio_runtime_control`
- `creator_studio_stripe_events`
- `creator_studio_usage_reservations`

## Columns

Production has **1,400** columns across the 114 production tables. Staging has **1,401** columns when restricted to those same tables.

After ignoring column ordinal order and comparing semantic column properties, the meaningful deltas are:

1. `integration_connections.refresh_version bigint NOT NULL DEFAULT 0` exists only in staging. It supports independent integration refresh/version handling and should not be removed simply to force byte parity.
2. `marketplace_products.slug` default differs. Production uses an empty-string default; staging uses a generated `draft-<uuid-fragment>` style default. This is a staging hardening delta and must be validated against application behavior before any convergence decision.

Other apparent differences inspected in `orders`, `product_reviews`, and `subscribers` were ordering differences rather than schema loss.

## Indexes

When staging is restricted to the 114 production tables:

- Production indexes: **248**
- Staging indexes: **248**
- Exact definition fingerprint: `abbc6c6f5b1b8ec431d4a9ec021e1675`

**Result: exact index parity on the production table set.**

## Enums

- Production enum types: **8**
- Production enum labels: **43**
- Staging enum types: **8**
- Staging enum labels: **43**
- Exact enum fingerprint: `fa9c94e653cefc7e627d21a11d2cf0a5`

**Result: exact enum parity.**

## Constraints

Production contains **388** public-table constraints. Staging initially contained **387** on the production table set.

The missing constraint was identified as:

`marketplace_products_primary_bundle_file_fk`

linking:

`marketplace_products.primary_bundle_file_id -> product_download_files.id ON DELETE SET NULL`

Staging was checked before repair: no invalid references existed. The missing FK was then added on staging only through migration `aurumvault_schema_parity_fk_and_referral_stats`.

Staging now contains **388** constraints on the production table set.

The total count now matches production, but definition-level fingerprint equivalence remains a certification item; do not equate matching counts with exact constraint parity.

## Triggers

- Production non-internal public triggers: **102**
- Staging triggers on the production table set: **102**

Known intentional differences:

1. Production contains two duplicate guard triggers on `affiliate_commissions` that invoke the same guard behavior. Staging retains one guard trigger rather than recreating the duplicate.
2. Staging has an additional `integration_connections_refresh_version` trigger associated with the staging-only `refresh_version` column.

The equal count therefore does not mean byte-identical trigger definitions; these differences are intentional unless later application evidence disproves them.

## RLS policies

- Production public-table policies: **267**
- Staging policies on production tables: **265**

Known differences:

1. Production `integration_connections` has owner SELECT and owner DELETE policies; staging currently has owner SELECT only. Before restoring DELETE, confirm the independent disconnect path and whether deletes should be server-mediated.
2. Production `user_roles` contains a redundant duplicate self-read policy. Staging keeps the cleaned set and should not re-add a redundant policy merely to match policy count.

Policy semantics remain a launch-gate item.

## Functions

Production has **66 application-owned public functions** after excluding extension-owned functions. Staging contains the recovered production functions plus additional independent-staging functions.

The only production application functions intentionally not copied are:

- `email_queue_dispatch()`
- `email_queue_wake()`

Both are coupled to the Lovable email/runtime path. They are **quarantined** until an independent email provider and scheduler/worker endpoint replace them. Copying them would recreate the dependency being removed.

`get_creator_referral_stats()` was also identified during parity review. The recovered production definition references `order_items.unit_price_cents` and `quantity`, but the recovered production schema actually exposes `unit_amount_cents` and no `quantity`. Staging now carries a corrected implementation based on `unit_amount_cents`; the correction is persisted in the migration branch.

## Supabase advisor evidence

Security advisor was run after the DDL reconciliation. No advisor finding was auto-fixed during this parity pass.

Key findings requiring deliberate review:

- Seven RLS-enabled tables have no policies. Several are internal/server-only Creator Studio state tables; `license_wallet_billing_events` and `product_slug_redirects` also require explicit intent review.
- The advisor warns about anonymous/signed-in access to several `SECURITY DEFINER` RPCs. Some are deliberately public flows such as subscriber confirmation, public Q&A listing, follower count, and abandoned-cart RPCs; each still requires explicit threat-model confirmation rather than blanket revocation.
- Leaked-password protection is disabled in staging Auth.
- Performance advisor reports unindexed foreign keys, RLS init-plan opportunities, multiple permissive policies, and unused indexes. These are hardening/performance items and should not be mass-modified during source-parity recovery.

Reference remediation guidance:
- Security/RLS-no-policy: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Public SECURITY DEFINER: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- Authenticated SECURITY DEFINER: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Leaked-password protection: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Unindexed foreign keys: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys
- RLS init-plan: https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan

## Current certification decision

**Table coverage:** GREEN  
**Index parity:** GREEN  
**Enum parity:** GREEN  
**Constraint count:** GREEN; exact-definition certification pending  
**Column parity:** GREEN with two documented intentional deltas requiring application validation  
**Trigger parity:** GREEN with documented intentional divergence  
**RLS/policy parity:** YELLOW; intentional differences require workflow/security validation  
**Function parity:** YELLOW; Lovable email functions intentionally quarantined, reconstructed function semantics still require targeted tests  
**Production data parity:** NOT STARTED  
**Auth parity:** NOT STARTED  
**Storage object parity:** NOT STARTED

## Gate

**Production promotion remains NO-GO.**

The next controlled phase is production data/Auth/Storage export planning plus replacement of Lovable runtime dependencies in independent staging, followed by functional and security certification. No DNS, live Stripe, or production backend changes are authorized by this report.
