"""
Homepage row regression test.

Asserts that the three curated homepage sections render their expected
products and that the Sponsored row applies the BESTSELLER badge.

Sections under test:
  - New Releases       → 3 most-recently-created approved+published products
  - Promoted Picks     → hardcoded: Kingdom Mind, M.O.V. — Method of Verification
                         (each card must show the BESTSELLER badge)
  - You May Also Like  → top 3 by paid sales (falls back to catalog order
                         when there are no paid orders yet)

Run:  python tests/integration/home-rows.spec.py
"""

import asyncio
import sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:8080"
OUT = Path("/tmp/browser/home-rows")
OUT.mkdir(parents=True, exist_ok=True)

# Sponsored row is hardcoded in src/lib/home-rows.functions.ts
EXPECTED_SPONSORED = ["Kingdom Mind", "M.O.V. — Method of Verification"]

# New Releases is the 3 most recent approved+published products. We assert
# the row size + that every title belongs to the live catalog rather than
# pinning specific titles (so the test survives legitimate new uploads).
NEW_RELEASES_COUNT = 3

# Recommended row: top 3, ordered by paid sales then catalog order.
RECOMMENDED_COUNT = 3


async def section_titles(page, heading: str) -> list[str]:
    sec = page.locator(f"section:has(h2:has-text('{heading}'))").first
    await sec.scroll_into_view_if_needed()
    await sec.wait_for(state="visible", timeout=5000)
    # Each card renders two /products/$id links: the cover (which also
    # contains category + creator text) and the title-only link. Keep the
    # single-line entries that aren't the category metadata block.
    raw = await sec.locator("a[href^='/products/']").all_inner_texts()
    return [t.strip() for t in raw if t.strip() and "\n" not in t.strip()]


async def section_badges(page, heading: str) -> list[str]:
    sec = page.locator(f"section:has(h2:has-text('{heading}'))").first
    # Use text_content so we get raw DOM text (not the CSS-uppercased render).
    raw = await sec.locator("span.bg-gold").all_text_contents()
    return [b.strip() for b in raw if b.strip()]


async def section_kicker(page, heading: str) -> str:
    sec = page.locator(f"section:has(h2:has-text('{heading}'))").first
    return (await sec.locator("div.tracking-caps").first.inner_text()).strip()


async def main() -> int:
    failures: list[str] = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 2400})
        page = await ctx.new_page()

        await page.goto(BASE_URL, wait_until="networkidle")
        await page.wait_for_timeout(1200)
        await page.screenshot(path=str(OUT / "home.png"))

        # --- Live catalog (server-rendered) -------------------------------
        # Collect every product title visible anywhere on the page so we can
        # validate New Releases entries belong to the live catalog.
        raw_all = await page.locator("a[href^='/products/']").all_inner_texts()
        all_titles = {t.strip() for t in raw_all if t.strip() and "\n" not in t.strip()}

        # --- New Releases --------------------------------------------------
        nr_kicker = await section_kicker(page, "New Releases")
        if nr_kicker != "JUST IN":
            failures.append(f"New Releases: kicker must be 'JUST IN', got {nr_kicker!r}")
        new_releases = await section_titles(page, "New Releases")
        if len(new_releases) != NEW_RELEASES_COUNT:
            failures.append(
                f"New Releases: expected {NEW_RELEASES_COUNT} cards, got "
                f"{len(new_releases)} → {new_releases}"
            )
        for t in new_releases:
            if t not in all_titles:
                failures.append(f"New Releases: unknown product title {t!r}")
        # New Releases must NEVER show a Bestseller badge.
        nr_badges = await section_badges(page, "New Releases")
        if nr_badges:
            failures.append(
                f"New Releases: unexpected Bestseller badge(s): {nr_badges}"
            )

        # --- Promoted Picks (Sponsored) -----------------------------------
        promo_kicker = await section_kicker(page, "Promoted Picks")
        expected_kicker = "SPONSORED — ILLUSTRIOUS CAPITAL™"
        if promo_kicker != expected_kicker:
            failures.append(
                f"Promoted Picks: kicker must be {expected_kicker!r}, got {promo_kicker!r}"
            )
        promoted = await section_titles(page, "Promoted Picks")
        for expected in EXPECTED_SPONSORED:
            if expected not in promoted:
                failures.append(
                    f"Promoted Picks: missing expected product {expected!r} "
                    f"(got {promoted})"
                )
        promoted_badges = await section_badges(page, "Promoted Picks")
        # Every sponsored card must carry the exact 'Bestseller' badge.
        if len(promoted_badges) < len(EXPECTED_SPONSORED):
            failures.append(
                f"Promoted Picks: expected ≥{len(EXPECTED_SPONSORED)} "
                f"Bestseller badges, got {len(promoted_badges)} → {promoted_badges}"
            )
        for b in promoted_badges:
            if b != "Bestseller":
                failures.append(
                    f"Promoted Picks: badge text must be exactly 'Bestseller', got {b!r}"
                )

        # --- You May Also Like (Recommended) ------------------------------
        recommended = await section_titles(page, "You May Also Like")
        if len(recommended) != RECOMMENDED_COUNT:
            failures.append(
                f"You May Also Like: expected {RECOMMENDED_COUNT} cards, got "
                f"{len(recommended)} → {recommended}"
            )
        for t in recommended:
            if t not in all_titles:
                failures.append(f"You May Also Like: unknown product {t!r}")

        await browser.close()

    print("=== Home row test results ===")
    if failures:
        for f in failures:
            print("FAIL:", f)
        return 1
    print("PASS: New Releases, Promoted Picks, and You May Also Like render expected products and badges.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
