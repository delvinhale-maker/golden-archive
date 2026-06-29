"""
Price consistency + formatting check.

Uses stable data-testid selectors instead of full-body text scraping so
layout/copy changes don't break the test.

Selectors (must stay in sync with the components):
  Product tiles (home, browse, search, rows):
    [data-testid="product-tile"][data-product-id="<id>"]
      [data-testid="product-price"]
      [data-testid="product-compare-at"]   (optional)
  Product detail page:
    [data-testid="pdp-price-block"]
      [data-testid="pdp-price"]
      [data-testid="pdp-compare-at"]       (optional)

Canonical format: `$X.XX` (USD, always 2 decimals). Verifies the same
formatted string renders on home, browse, and PDP for both sale and
compare-at prices.

Usage:
  PRICE_CHECK_BASE_URL=http://localhost:8080 \\
    python3 tests/integration/price-consistency.spec.py
"""
import asyncio
import os
import sys
import urllib.request
import json

from playwright.async_api import async_playwright, Page

BASE_URL = os.environ.get("PRICE_CHECK_BASE_URL", "https://www.aurumvault.store").rstrip("/")
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
SUPABASE_KEY = (
    os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    or os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
)

TILE = '[data-testid="product-tile"]'
PRICE = '[data-testid="product-price"]'
COMPARE = '[data-testid="product-compare-at"]'
PDP_PRICE = '[data-testid="pdp-price"]'
PDP_COMPARE = '[data-testid="pdp-compare-at"]'


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
    return f"${cents / 100:,.2f}"


async def goto(page: Page, path: str) -> None:
    await page.goto(f"{BASE_URL}{path}", wait_until="networkidle")
    try:
        # Wait for at least one tile / price block to mount on listing pages.
        await page.wait_for_selector(f"{TILE}, {PDP_PRICE}", timeout=8000)
    except Exception:
        pass


async def tile_prices(page: Page, product_id: str) -> tuple[str | None, str | None]:
    """Returns (price_text, compare_text) for the tile matching product_id, or (None, None) if not on page."""
    tile = page.locator(f'{TILE}[data-product-id="{product_id}"]').first
    if await tile.count() == 0:
        return None, None
    try:
        price = (await tile.locator(PRICE).first.inner_text()).strip()
    except Exception:
        price = None
    compare = None
    cmp_loc = tile.locator(COMPARE)
    if await cmp_loc.count() > 0:
        compare = (await cmp_loc.first.inner_text()).strip()
    return price, compare


async def pdp_prices(page: Page) -> tuple[str | None, str | None]:
    price_loc = page.locator(PDP_PRICE).first
    if await price_loc.count() == 0:
        return None, None
    price = (await price_loc.inner_text()).strip()
    compare = None
    cmp_loc = page.locator(PDP_COMPARE)
    if await cmp_loc.count() > 0:
        compare = (await cmp_loc.first.inner_text()).strip()
    return price, compare


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

        # Snapshot listing pages once
        await goto(page, "/")
        home_tiles: dict[str, tuple[str | None, str | None]] = {}
        for prod in products:
            home_tiles[prod["id"]] = await tile_prices(page, prod["id"])

        await goto(page, "/products")
        browse_tiles: dict[str, tuple[str | None, str | None]] = {}
        for prod in products:
            browse_tiles[prod["id"]] = await tile_prices(page, prod["id"])

        for prod in products:
            pid = prod["id"]
            title = prod["title"]
            cents = prod["price_cents"]
            compare_cents = prod.get("compare_at_price_cents")
            expected_price = canonical(cents)
            expected_compare = (
                canonical(compare_cents)
                if compare_cents and compare_cents > cents
                else None
            )

            await goto(page, f"/products/{pid}")
            pdp_price, pdp_compare = await pdp_prices(page)

            scopes: dict[str, tuple[str | None, str | None]] = {
                "PDP": (pdp_price, pdp_compare),
                "Browse": browse_tiles.get(pid, (None, None)),
                "Home": home_tiles.get(pid, (None, None)),
            }

            # Sale price assertions (PDP always required; tiles only if present)
            sale_seen: dict[str, str] = {}
            for scope, (price_text, _) in scopes.items():
                if price_text is None:
                    if scope == "PDP":
                        failures.append(f"{scope} '{title}': price element missing")
                    continue
                sale_seen[scope] = price_text
                if price_text != expected_price:
                    failures.append(
                        f"{scope} '{title}': price '{price_text}' != expected '{expected_price}'"
                    )
            if len(set(sale_seen.values())) > 1:
                failures.append(
                    f"'{title}': sale price differs across pages {sale_seen}"
                )

            # Compare-at assertions (only enforced when DB has one)
            if expected_compare:
                compare_seen: dict[str, str] = {}
                for scope, (_, compare_text) in scopes.items():
                    # Only require compare-at where the tile/PDP is actually rendered
                    if scopes[scope][0] is None:
                        continue
                    if compare_text is None:
                        failures.append(
                            f"{scope} '{title}': compare-at missing (expected {expected_compare})"
                        )
                        continue
                    compare_seen[scope] = compare_text
                    if compare_text != expected_compare:
                        failures.append(
                            f"{scope} '{title}': compare-at '{compare_text}' != expected '{expected_compare}'"
                        )
                if len(set(compare_seen.values())) > 1:
                    failures.append(
                        f"'{title}': compare-at differs across pages {compare_seen}"
                    )

            label = expected_price + (f" (was {expected_compare})" if expected_compare else "")
            print(f"checked {title} ({label})")

        await browser.close()

    if failures:
        print("\n❌ Price/format issues:")
        for f in failures:
            print(f"  - {f}")
        return 1

    print(f"\n✅ All {len(products)} products: consistent formatted prices via stable selectors.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
