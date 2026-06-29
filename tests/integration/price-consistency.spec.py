"""
Price consistency check.

Verifies every published product renders the same price across:
  - Homepage (/)
  - Browse page (/products)
  - Product detail page (/products/:id)

Usage:
  PRICE_CHECK_BASE_URL=http://localhost:8080 python3 tests/integration/price-consistency.spec.py
  # defaults to https://www.aurumvault.store

Exits non-zero on any mismatch and prints a per-product report.
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


def price_variants(cents: int) -> list[str]:
    dollars = cents / 100
    out = [f"${dollars:.2f}"]
    if dollars == int(dollars):
        out.append(f"${int(dollars)}")
    return out


async def page_text(page, path: str) -> str:
    await page.goto(f"{BASE_URL}{path}", wait_until="networkidle")
    # small settle for any client-side fetch
    try:
        await page.wait_for_load_state("networkidle", timeout=5000)
    except Exception:
        pass
    return await page.locator("body").inner_text()


def price_present(text: str, cents: int) -> bool:
    return any(v in text for v in price_variants(cents))


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
            title = prod["title"]
            expected = price_variants(cents)[0]

            pdp_text = await page_text(page, f"/products/{prod['id']}")
            if not price_present(pdp_text, cents):
                failures.append(f"PDP '{title}': expected {expected}")

            if not price_present(browse_text, cents):
                failures.append(f"Browse '{title}': expected {expected}")

            if title in home_text and not price_present(home_text, cents):
                failures.append(f"Home '{title}': expected {expected}")

            print(f"checked {title} ({expected})")

        await browser.close()

    if failures:
        print("\n❌ Price mismatches:")
        for f in failures:
            print(f"  - {f}")
        return 1

    print(f"\n✅ All {len(products)} products have consistent prices.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
