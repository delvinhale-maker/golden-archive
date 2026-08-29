# TikTok Shop integration — implementation & review notes (Phase 1: OAuth only)

Internal note supporting TikTok Shop's data security and privacy review.

## App registration intent

- Developer type: **App Developer / ISV**
- Service type: **Public**
- Service category: **eCommerce Management / Multi-Channel Management**
- Target market: **United States**
- Seller type: **Local sellers**
- API access: enabled
- Product goal: multiple independent TikTok Shop sellers authorize AurumVault.

## Callback URL (exact, production only)

```
https://www.aurumvault.store/api/public/integrations/tiktok-shop/callback
```

No trailing slash, no preview/apex host, no other spelling. It is asserted in
source (`TIKTOK_SHOP_CANONICAL_REDIRECT_URI`) and guarded by tests.

## Runtime configuration (secret values stored in the platform secret store only)

| Name | Purpose |
| --- | --- |
| `TIKTOK_SHOP_APP_KEY` | Partner Center app key |
| `TIKTOK_SHOP_APP_SECRET` | Partner Center app secret (server-side only) |
| `TIKTOK_SHOP_SERVICE_ID` | Authorization entry point identifier |
| `TIKTOK_SHOP_REDIRECT_URI` | Must equal the callback URL above |
| `INTEGRATION_TOKEN_ENCRYPTION_KEY` (+ `_V2`/`_V3`/`_V4`) | Existing shared encryption keyring |

No secret is committed to Git, written to `.env`, sent to the browser, or logged.

## Authorization flow

1. Authenticated AurumVault user starts `startTikTokShopConnection`.
2. Server mints opaque 48-hex-character state (24 random bytes), TTL 10 minutes,
   stores it on the user's row in `public.integration_connections`
   (`provider = 'tiktok_shop'`), and returns only the authorization URL.
3. Seller authorizes at
   `https://services.us.tiktokshop.com/open/authorize?service_id=…&state=…`.
4. TikTok redirects to the registered callback with `code` + `state`.
5. Callback validates state format, then claims it **atomically** (single
   conditional UPDATE) — replay and expiry are rejected before token exchange.
6. Token exchange happens **server-side only** against
   `https://auth.tiktok-shops.com/api/v2/token/get`.
7. Access and refresh tokens are envelope-encrypted, then persisted; handshake
   values are cleared. Browser receives only a coarse status flag.

## Requested APIs / scopes

Phase 1 requests only authorization itself; granted scopes are recorded from
TikTok's token response (`granted_scopes`). No product, order, fulfillment,
affiliate, creator, POD or webhook API is called in this phase.

## Data handled

- AurumVault user id (internal), TikTok seller display name, granted scopes,
  connection timestamps, token expiry, coarse error reason.
- Access/refresh tokens — encrypted at rest, never displayed.
- No buyer data, no order data, no payment data, no PII beyond seller display name.

## Token encryption

AES-256-GCM envelope (`{ __enc, kid, iv, data }`) via the shared
`oauth-token-crypto.server.ts` keyring with four rotation slots
(V4 → V3 → V2 → original): newest key encrypts, retired keys decrypt only.

## Deletion / disconnect behavior

`disconnectTikTokShopConnection` (authenticated owner only) wipes the encrypted
access token, refresh token and expiry locally and marks the row `revoked`.
Sellers may additionally de-authorize AurumVault in TikTok Seller Center; TikTok
publishes no ISV token-revocation endpoint, so no remote revocation is claimed.
Deleting the AurumVault account cascades the connection row away
(`ON DELETE CASCADE` on `auth.users`).

## Privacy & security controls

- RLS enabled on `integration_connections`; owner/admin policies only.
- `authenticated` has column-level SELECT on non-secret status columns only;
  encrypted and handshake columns are unreachable from any client session.
- Owner user id derives from verified auth context — never from browser input.
- Owner-reassignment trigger prevents re-pointing a row at another user.
- Redirect origin is fixed from configuration; incoming Host headers are never
  trusted; no open redirects.
- Coarse browser-facing errors; detailed server logs contain no secrets.

## Phase boundary

Connection only. Product and order synchronization, publishing, fulfillment and
webhooks are explicitly **not** implemented in this phase.
