# AurumVault — Search engine / SEO operations

Canonical production host: **https://www.aurumvault.store**
Brand: **AurumVault** (alternate spelling used in search: *Aurum Vault*)

## Where metadata lives

| Concern | Location |
| --- | --- |
| Sitewide defaults, Organization + WebSite + OnlineStore JSON-LD, Google verification meta | `src/routes/__root.tsx` (`head()`) |
| Per-page title / description / OG / Twitter / canonical | each route file's `head()` |
| Homepage brand H1 + entity copy | `src/components/marketplace/BrandIntro.tsx` |
| Robots rules | `public/robots.txt` (single source of truth — the old duplicate `/robots.txt` server route was removed) |
| Sitemap | `src/routes/sitemap[.]xml.ts` (static route list + live products, creator storefronts, Academy categories & articles) |
| IndexNow submission | `src/lib/indexnow.server.ts` + `notifySearchEngines` in `src/lib/sitemap-ping.functions.ts` |

## IndexNow

- **Key:** `a7f3c19d4b8e42f6905c1d7be32a48cd`, exposed at
  `https://www.aurumvault.store/a7f3c19d4b8e42f6905c1d7be32a48cd.txt`
  (`public/a7f3c19d4b8e42f6905c1d7be32a48cd.txt`).
  The key is public by design — search engines fetch it to prove host ownership.
  To rotate: set the `INDEXNOW_KEY` env var **and** add a matching `<key>.txt`
  file in `public/`.
- **Triggers (publish/update events only, never on render):**
  - Academy article published or scheduled — `src/routes/_authenticated/admin.academy.$id.tsx`
  - Product approved / published / unpublished / rejected — `src/routes/_authenticated/admin.products.tsx`
  - Bulk "release stale" product approvals — same file
- **Failure handling:** `submitToIndexNow` never throws. Non-2xx responses are
  logged server-side as `[indexnow] submission failed [status]: body` and the
  result object is returned to the caller. Publishing continues regardless.
- **Testing:**
  1. `curl -I https://www.aurumvault.store/a7f3c19d4b8e42f6905c1d7be32a48cd.txt` → 200.
  2. Publish an Academy article and check the browser console for `[indexnow] { submitted: n, status: 200 }`.
  3. Bing Webmaster Tools → **IndexNow** shows recent submissions.

## Bing Webmaster Tools — manual steps (not done in code)

No Bing verification token exists in the codebase yet. **Do not invent one.**
When you have the real token from Bing Webmaster Tools → *Add site* → *HTML Meta tag*:

Add it to the `meta` array in `src/routes/__root.tsx`, next to the existing
Google verification entry:

```tsx
{ name: "msvalidate.01", content: "<REAL_TOKEN_FROM_BING>" },
```

Alternatively Bing offers "import from Google Search Console", which works
because GSC verification is already in place.

Then, in Bing Webmaster Tools:

1. Verify `https://www.aurumvault.store`.
2. Submit `https://www.aurumvault.store/sitemap.xml`.
3. URL-inspect the homepage.
4. Request indexing after a major deployment.
5. Confirm IndexNow key + recent submissions.
6. Review indexed pages, crawl errors, and search performance.
7. Track the queries `Aurum Vault` and `AurumVault`.

## Google Search Console

Verification is already live via the meta tag in `src/routes/__root.tsx`
(`google-site-verification`). Do not remove it. Sitemap to submit:
`https://www.aurumvault.store/sitemap.xml`.

## Off-site brand authority (manual, legitimate only)

- Consistent "AurumVault — premium digital marketplace for creators and
  businesses" bio + `https://www.aurumvault.store` link on every official
  social profile (X, LinkedIn company page, Facebook, TikTok, YouTube "about"/
  description links).
- Encourage creators to link their own AurumVault storefront (`/store/<slug>`)
  from their bios and content.
- Legitimate press, interviews, podcast appearances, guest educational posts,
  and relevant business-directory listings.
- Add only real, existing profiles to Organization `sameAs` in `__root.tsx`.

Never: paid link farms, PBNs, forum spam, fake reviews, or doorway pages.
