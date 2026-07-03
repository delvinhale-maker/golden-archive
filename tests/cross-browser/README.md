# Cross-browser hero accent tests

Validates the 300ms hero-carousel accent sequence on real Safari and Firefox
via BrowserStack, with a free Playwright WebKit + Firefox fallback.

## Activate BrowserStack

Add two **GitHub → Settings → Secrets and variables → Actions → Secrets**:

- `BROWSERSTACK_USERNAME`
- `BROWSERSTACK_ACCESS_KEY`

Both come from https://www.browserstack.com/accounts/settings after signing
in. Without them the BrowserStack job self-skips and the workflow no-ops.

Optional **Variables** (same page, Variables tab) let you tune without editing
the workflow:

- `CROSS_BROWSER_TARGET_URL` — defaults to `https://www.aurumvault.store/`.
- `CROSS_BROWSER_PROVIDER=playwright-only` — force the free fallback job
  (Playwright WebKit + Firefox on `ubuntu-latest`) instead of BrowserStack.

## Trigger

- On every push to `main` that touches the hero/theme/CSS files.
- Daily at 06:15 UTC (regression watch on the live URL).
- On demand via **Actions → Cross-browser hero accent → Run workflow**.

## Run locally

```
bun add -d @playwright/test
bunx playwright install webkit firefox
CROSS_BROWSER_TARGET_URL=https://www.aurumvault.store/ \
  bunx playwright test --config=playwright.cross-browser.config.ts
```

## What it asserts

1. `:root` declares `--accent-color / --gradient-start / --gradient-end` with a
   0.3s transition.
2. Over ~14s of hero auto-advance, `--accent-color` produces at least one
   transient (single-sample) value — proof the interpolation is running, not
   snapping.
3. The active `[data-nav-dot]` has a 300ms `background-color` transition and
   its computed color equals the current `--accent-color`.
