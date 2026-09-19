# AurumVault Independent Staging Runtime Configuration — 2026-09-18

Target application branch: `migration/aurumvault-lovable-exit`

Target backend: `aurumvault-staging` / `ypelutaddlibqvpaekyq`

Target external runtime: Vercel staging, once a dedicated AurumVault Vercel project is created.

## Boundary

This configuration is staging-only.

Do not point `aurumvault.store` or `www.aurumvault.store` at this environment.
Do not configure the live Stripe webhook against this environment.
Do not bind the application to the Lovable-managed production Supabase project.

## Backend binding

The staging environment contract requires:

- `APP_ENV=staging`
- `SUPABASE_PROJECT_REF=ypelutaddlibqvpaekyq`
- `SUPABASE_URL=https://ypelutaddlibqvpaekyq.supabase.co`
- matching browser `VITE_SUPABASE_URL`
- independent staging publishable key
- server-only staging service-role key

`scripts/validate-staging-env.mjs` fails closed if the Supabase URL is not the independent staging project or if an environment value contains a Lovable runtime hostname.

## Independent integrations

### Authentication

The application now uses native Supabase Auth directly.

Required provider configuration before Auth certification:

- staging Site URL = the final Vercel staging origin
- staging redirect allow-list includes the Vercel staging `/auth` callback
- Google provider enabled in the independent Supabase staging project
- Google OAuth client configured with the independent staging redirect URL

Provider-console credentials must be entered through the provider's secret/configuration UI. They must not be committed to Git.

### Stripe

Staging uses direct Stripe API access and test mode only.

Required server variables:

- `STRIPE_SANDBOX_SECRET_KEY`
- `PAYMENTS_SANDBOX_WEBHOOK_SECRET`

The test webhook must be created only after the final external staging URL exists. The live Stripe webhook remains unchanged.

### Email

Independent email transport is Resend-compatible.

Required server variables:

- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `EMAIL_PREVIEW_TOKEN`

The staging suppression webhook target is:

`/api/email/suppression`

Transactional queue processing is:

`/api/email/queue/process`

No Lovable email sender or Lovable webhook verifier is required.

### AI

Product-review AI uses an independent OpenAI-compatible adapter.

Required:

- `OPENAI_API_KEY` or `AI_GATEWAY_API_KEY`
- optional `AI_GATEWAY_BASE_URL`
- optional `AI_REVIEW_MODEL`

Audiobook/other direct-provider features may additionally require their existing server-only model credentials such as `ANTHROPIC_API_KEY`.

### Canva

Required:

- `CANVA_CLIENT_ID`
- `CANVA_CLIENT_SECRET`
- `CANVA_REDIRECT_URI=https://<staging-host>/api/public/integrations/canva/callback`

### TikTok Shop

Required:

- `TIKTOK_SHOP_APP_KEY`
- `TIKTOK_SHOP_APP_SECRET`
- `TIKTOK_SHOP_SERVICE_ID`
- `TIKTOK_SHOP_REDIRECT_URI=https://<staging-host>/api/public/integrations/tiktok-shop/callback`

Production remains pinned to the canonical `www.aurumvault.store` callback. Non-production code accepts only an HTTPS `*.vercel.app` host at the exact callback path.

### Integration-token encryption

At least one server-only key is required:

- `INTEGRATION_TOKEN_ENCRYPTION_KEY`

Rotation slots remain available as V2/V3/V4.

## Health proof

`GET /api/health` now proves:

- deployment environment
- exact Git SHA
- actual Supabase project ref
- expected-vs-actual project match
- live Supabase Auth health reachability

The health endpoint returns non-200 when the backend is misconfigured/unreachable or when the deployed SHA cannot be identified.

## Current gate

Code/environment contract: **READY**

Provider binding: **PENDING**

External Vercel project: **PENDING**

Google staging OAuth configuration: **PENDING**

Stripe test webhook binding: **PENDING**

Resend staging secret/webhook binding: **PENDING**

Canva/TikTok staging callback registration: **PENDING**

Therefore independent staging configuration remains **NO-GO for runtime certification** until the external staging origin exists and the provider-side secret/callback bindings are completed.
