"""
Price consistency + formatting check.

Verifies every published product renders the same formatted money string
(currency symbol, decimals, rounding) across:
  - Homepage (/)
  - Browse page (/products)
  - Product detail page (/products/:id)

Canonical format: `$X.XX` (USD symbol, always 2 decimals, no trailing
rounding drift). Also checks compare-at prices when present.

Usage:
  PRICE_CHECK_BASE_URL=http://localhost:8080 python3 tests/integration/price-consistency.spec.py
"""
import asyncio
import os
import re
import sys
import urllib.request
import json

from playwright.async_api import async_playwright

BASE_URL = os.environ.get("PRICE_CHECK_BASE_URL", "https://www.aurumvault.store").rstrip("/")
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
SUPABASE_KEY = (
    os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    or os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
)


def fetch_products():
    assert SUPABASE_URL and SUPABASE_KEY, "Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY"
    url = (
        f"{SUPABASE_URL}/rest/v1/marketplace_products"
        "?select=id,title,price_cents,compare_at_price_cents"
        "&published=eq.true&status=eq.approved"
    )
    req = urllib.request.Request(
        url,
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())


def canonical(cents: int) -> str:
    """Canonical formatted money: $X.XX with 2 decimals, banker-safe rounding."""
    # round half to even isn't critical here — cents are already integers
    dollars = cents / 100
    return f"${dollars:,.2f}"


# Matches $1, $1.5, $1.50, $1,234, $1,234.5, $1,234.56 — i.e. any USD-looking token.
MONEY_RE = re.compile(r"\$\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?")


def parse_money_to_cents(token: str) -> int | None:
    try:
        n = float(token.replace("$", "").replace(",", ""))
    except ValueError:
        return None
    return round(n * 100)


def find_renderings(text: str, cents: int) -> list[str]:
    """All distinct money tokens in `text` whose value equals `cents`."""
    seen: list[str] = []
    for tok in MONEY_RE.findall(text):
        if parse_money_to_cents(tok) == cents and tok not in seen:
            seen.append(tok)
    return seen


async def page_text(page, path: str) -> str:
    await page.goto(f"{BASE_URL}{path}", wait_until="networkidle")
    try:
        await page.wait_for_load_state("networkidle", timeout=5000)
    except Exception:
        pass
    return await page.locator("body").inner_text()


async def main() -> int:
    products = fetch_products()
    if not products:
        print("No published products found", file=sys.stderr)
        return 1

    failures: list[str] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()

        home_text = await page_text(page, "/")
        browse_text = await page_text(page, "/products")

        for prod in products:
            cents = prod["price_cents"]
            compare_cents = prod.get("compare_at_price_cents")
            title = prod["title"]
            expected = canonical(cents)
            compare_expected = (
                canonical(compare_cents)
                if compare_cents and compare_cents > cents
                else None
            )

            pdp_text = await page_text(page, f"/products/{prod['id']}")

            scopes = {
                "PDP": (pdp_text, True),
                "Browse": (browse_text, title in browse_text),
                "Home": (home_text, title in home_text),
            }

            # Sale price
            sale_renderings: dict[str, list[str]] = {}
            for scope, (text, should_appear) in scopes.items():
                if not should_appear:
                    continue
                renders = find_renderings(text, cents)
                if not renders:
                    failures.append(f"{scope} '{title}': missing price (expected {expected})")
                    continue
                sale_renderings[scope] = renders
                # Strict format check: every rendering must be canonical $X.XX
                bad = [r for r in renders if r != expected]
                if bad:
                    failures.append(
                        f"{scope} '{title}': format drift {bad} — expected {expected}"
                    )

            # Cross-page consistency: same formatted string everywhere it appears
            formats = {scope: rs[0] for scope, rs in sale_renderings.items()}
            if len(set(formats.values())) > 1:
                failures.append(
                    f"'{title}': sale price format differs across pages {formats}"
                )

            # Compare-at price
            if compare_expected:
                compare_renderings: dict[str, str] = {}
                for scope, (text, should_appear) in scopes.items():
                    if not should_appear:
                        continue
                    renders = find_renderings(text, compare_cents)
                    if not renders:
                        failures.append(
                            f"{scope} '{title}': missing compare-at (expected {compare_expected})"
                        )
                        continue
                    compare_renderings[scope] = renders[0]
                    bad = [r for r in renders if r != compare_expected]
                    if bad:
                        failures.append(
                            f"{scope} '{title}': compare-at format drift {bad} — expected {compare_expected}"
                        )
                if len(set(compare_renderings.values())) > 1:
                    failures.append(
                        f"'{title}': compare-at format differs across pages {compare_renderings}"
                    )

            label = expected + (f" (was {compare_expected})" if compare_expected else "")
            print(f"checked {title} ({label})")

        await browser.close()

    if failures:
        print("\n❌ Price/format issues:")
        for f in failures:
            print(f"  - {f}")
        return 1

    print(f"\n✅ All {len(products)} products: consistent formatted prices across pages.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
