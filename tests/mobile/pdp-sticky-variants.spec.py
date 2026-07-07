"""
Regression: on the mobile PDP the sticky Add-to-Cart bar's label and
price must react to variant selection, and the CTA must add the
correct item to the cart (non-variant products) or open the checkout
modal with the selected option (variant products).

Discovery: opens /products and walks up to MAX_SCAN product tiles until
it finds one that renders VariantPicker. If none exists in the current
project, the variant assertions are skipped (exit 0) with a clear log
so CI still passes on a fresh DB.

Also runs a non-variant assertion path that verifies the sticky CTA
writes the expected CartItem to localStorage on tap.

Run:
    python3 tests/mobile/pdp-sticky-variants.spec.py

Requires the dev server on http://localhost:8080.
"""

import asyncio
import json
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
MOBILE = {"width": 390, "height": 844}
SHOTS = Path("/tmp/browser/pdp-sticky-variants")
SHOTS.mkdir(parents=True, exist_ok=True)
MAX_SCAN = 10

STICKY_BAR = "[data-testid='pdp-mobile-sticky']"
STICKY_LABEL = "[data-testid='pdp-mobile-sticky-label']"
STICKY_PRICE = "[data-testid='pdp-mobile-sticky-price']"
STICKY_CTA = "[data-testid='pdp-mobile-sticky-cta']"
VARIANT_OPTION = "button:has(span.font-display):has-text('$')"


async def collect_product_links(page):
    """Return a list of unique /products/<id> hrefs from /products."""
    await page.goto(f"{BASE}/products", wait_until="networkidle")
    await page.wait_for_timeout(1500)
    hrefs = await page.eval_on_selector_all(
        "a[href^='/products/']",
        "els => Array.from(new Set(els.map(e => e.getAttribute('href'))))",
    )
    # Filter out pagination / category tabs like /products?category=...
    return [h for h in hrefs if h.startswith("/products/") and len(h) > len("/products/")]


async def find_variant_pdp(page, links):
    """Visit product pages until one exposes the variant picker."""
    for href in links[:MAX_SCAN]:
        await page.goto(f"{BASE}{href}", wait_until="networkidle")
        await page.wait_for_selector(STICKY_BAR, timeout=8000)
        # VariantPicker uses this heading text.
        picker = page.get_by_text("Choose a version", exact=True)
        if await picker.count():
            return href
    return None


async def test_variant_flow(page, href):
    print(f"[variant] using {href}")
    await page.goto(f"{BASE}{href}", wait_until="networkidle")
    await page.wait_for_selector(STICKY_BAR)
    await page.wait_for_selector("text=Choose a version")

    # Snapshot initial sticky state (defaults to first variant).
    initial_label = (await page.locator(STICKY_LABEL).inner_text()).strip()
    initial_price = (await page.locator(STICKY_PRICE).inner_text()).strip()
    initial_cta = (await page.locator(STICKY_CTA).inner_text()).strip()

    # Enumerate variant option buttons within the picker section.
    picker_root = page.locator("div", has=page.get_by_text("Choose a version", exact=True)).first
    options = picker_root.locator(VARIANT_OPTION)
    n = await options.count()
    assert n >= 2, f"[variant] product only has {n} option(s); need >= 2"

    # Click the second (non-default) variant.
    await options.nth(1).scroll_into_view_if_needed()
    variant_name = (await options.nth(1).locator("span.font-display").first.inner_text()).strip()
    variant_price_str = (await options.nth(1).locator("span.font-display").nth(1).inner_text()).strip()
    await options.nth(1).click()
    await page.wait_for_timeout(400)
    await page.screenshot(path=str(SHOTS / "variant_after_switch.png"))

    new_label = (await page.locator(STICKY_LABEL).inner_text()).strip()
    new_price = (await page.locator(STICKY_PRICE).inner_text()).strip()
    new_cta = (await page.locator(STICKY_CTA).inner_text()).strip()

    print(f"[variant] label: {initial_label!r} -> {new_label!r}")
    print(f"[variant] price: {initial_price!r} -> {new_price!r}")
    print(f"[variant] cta:   {initial_cta!r} -> {new_cta!r}")

    assert new_label == variant_name, (
        f"[variant] sticky label did not match selected variant: "
        f"expected {variant_name!r}, got {new_label!r}"
    )
    # Sticky price must match the variant's displayed price (fixed-price
    # variants) or start from its minimum (PWYW: "From $X.XX").
    expected_price = variant_price_str.replace("From ", "")
    assert new_price == expected_price, (
        f"[variant] sticky price mismatch: expected {expected_price!r}, got {new_price!r}"
    )
    assert new_price in new_cta, (
        f"[variant] CTA text should reflect new price {new_price!r}, got {new_cta!r}"
    )

    # For variant products the CTA opens the checkout modal (does NOT
    # write to localStorage). Verify the modal appears.
    await page.locator(STICKY_CTA).click()
    await page.wait_for_timeout(600)
    modal = page.locator("[aria-label='Close checkout']")
    assert await modal.count(), "[variant] checkout modal did not open on sticky tap"
    await page.screenshot(path=str(SHOTS / "variant_checkout_open.png"))
    print("[variant] checkout modal opened OK")


def _price_cents(txt: str) -> int:
    """Parse '$12.34' / 'From $12.34' → 1234 cents (integer, no float drift)."""
    clean = txt.replace("From ", "").replace("$", "").replace(",", "").strip()
    dollars, _, frac = clean.partition(".")
    frac = (frac + "00")[:2] if frac else "00"
    return int(dollars) * 100 + int(frac)


async def test_non_variant_flow(page, href):
    print(f"[cart] using {href}")
    await page.goto(f"{BASE}{href}", wait_until="networkidle")
    await page.wait_for_selector(STICKY_BAR)
    # Clear cart before the test.
    await page.evaluate("window.localStorage.removeItem('av:cart:v2')")

    product_id = href.rsplit("/", 1)[-1]

    # Snapshot the sticky displayPrice immediately before the click, in
    # integer cents to avoid float rounding. The CTA text must also
    # embed the same price so label + price + CTA agree.
    sticky_price_txt = (await page.locator(STICKY_PRICE).inner_text()).strip()
    sticky_cents = _price_cents(sticky_price_txt)

    cta = page.locator(STICKY_CTA)
    await cta.scroll_into_view_if_needed()
    await cta.click(force=True)
    await page.wait_for_function(
        "() => !!window.localStorage.getItem('av:cart:v2')",
        timeout=5000,
    )
    await page.screenshot(path=str(SHOTS / "nonvariant_after_click.png"))

    # Sticky price must not drift as a result of the add.
    after_price_txt = (await page.locator(STICKY_PRICE).inner_text()).strip()
    assert _price_cents(after_price_txt) == sticky_cents, (
        f"[cart] sticky price changed after add: "
        f"{sticky_price_txt!r} -> {after_price_txt!r}"
    )

    raw = await page.evaluate("window.localStorage.getItem('av:cart:v2')")
    assert raw, "[cart] localStorage av:cart:v2 is empty after sticky tap"
    items = json.loads(raw)
    assert isinstance(items, list) and items, f"[cart] unexpected cart payload: {raw!r}"
    match = next((i for i in items if i.get("id") == product_id), None)
    assert match, f"[cart] product {product_id} not found in cart items {items!r}"

    stored_cents = int(round(float(match["price"]) * 100))
    assert stored_cents == sticky_cents, (
        f"[cart] stored CartItem price ({stored_cents}¢) does not equal "
        f"sticky displayPrice ({sticky_cents}¢ from {sticky_price_txt!r})"
    )
    assert match.get("qty", 0) == 1, f"[cart] expected qty=1 after first add, got {match!r}"

    # Bump quantity via the cart drawer (opened by the first add). The
    # unit price stored in the cart must still equal the sticky
    # displayPrice — qty scales, price-per-unit does not.
    increase = page.get_by_role("button", name="Increase").first
    await increase.wait_for(timeout=5000)
    await increase.click()
    await page.wait_for_function(
        "(pid) => { const raw = window.localStorage.getItem('av:cart:v2');"
        "  if (!raw) return false;"
        "  const it = JSON.parse(raw).find(i => i.id === pid);"
        "  return !!it && it.qty >= 2; }",
        arg=product_id,
        timeout=5000,
    )
    raw2 = await page.evaluate("window.localStorage.getItem('av:cart:v2')")
    match2 = next(i for i in json.loads(raw2) if i.get("id") == product_id)
    stored_cents2 = int(round(float(match2["price"]) * 100))
    assert stored_cents2 == sticky_cents, (
        f"[cart] after qty bump, stored unit price ({stored_cents2}¢) "
        f"drifted from sticky displayPrice ({sticky_cents}¢)"
    )
    assert match2["qty"] == 2, f"[cart] expected qty=2 after second add, got {match2!r}"
    print(
        f"[cart] OK — {match2['title']!r} unit=${match2['price']:.2f} "
        f"qty={match2['qty']} matches sticky {sticky_price_txt}"
    )


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport=MOBILE)
        page = await ctx.new_page()

        links = await collect_product_links(page)
        if not links:
            print("SKIP: no /products/<id> links discovered")
            await browser.close()
            return 0

        variant_href = await find_variant_pdp(page, links)
        if variant_href:
            await test_variant_flow(page, variant_href)
        else:
            print(
                f"SKIP variant assertions: no product with a VariantPicker "
                f"found in first {MAX_SCAN} tiles. Seed at least one product "
                f"with >=2 rows in product_variants to enable this path."
            )

        # Non-variant sticky→cart assertion. Skip the discovered variant
        # product; fall back to the first link that has no picker.
        cart_href = None
        for href in links[:MAX_SCAN]:
            if href == variant_href:
                continue
            await page.goto(f"{BASE}{href}", wait_until="networkidle")
            await page.wait_for_selector(STICKY_BAR, timeout=8000)
            if not await page.get_by_text("Choose a version", exact=True).count():
                cart_href = href
                break
        if cart_href:
            await test_non_variant_flow(page, cart_href)
        else:
            print("SKIP cart assertions: no non-variant product available")

        await browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
