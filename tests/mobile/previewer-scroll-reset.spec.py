"""
Regression test: the ManuscriptPreviewer's device-frame page area
(`.device-frame-inner`) must reset its scrollTop to 0 whenever the
location changes — via next arrow, previous arrow, or the Location
input. Users read to the bottom of a page, tap next, and expect to
start at the top of the new page, not wherever they left off.

Run with:
    python3 tests/mobile/previewer-scroll-reset.spec.py

Requires the dev server on http://localhost:8080.
"""

import asyncio
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BROWSER = os.environ.get("BROWSER", "chromium").lower()
if BROWSER not in {"chromium", "webkit", "firefox"}:
    raise SystemExit(f"unsupported BROWSER={BROWSER}")

BASE = "http://localhost:8080/preview-sample"
SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

MOBILE_CTX = dict(
    viewport={"width": 390, "height": 844},
    device_scale_factor=3,
    is_mobile=True,
    has_touch=True,
    user_agent=(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 "
        "Mobile/15E148 Safari/604.1"
    ),
)

SCROLL_SELECTOR = ".device-frame-inner"


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def ok(msg: str) -> None:
    print(f"PASS: {msg}")


async def open_previewer(browser):
    ctx = await browser.new_context(**MOBILE_CTX)
    page = await ctx.new_page()
    await page.goto(BASE, wait_until="networkidle")
    await page.get_by_role("button", name="PDF", exact=True).first.tap()
    await page.locator('select[aria-label="Font size"]').first.wait_for(timeout=20000)
    await page.locator('[data-testid="previewer-touch"]').first.wait_for(
        state="attached", timeout=20000,
    )
    # Zoom in so page content overflows the frame and there's real
    # scroll travel to test. Font step 5 = 1.8× — well past fit.
    await page.locator('select[aria-label="Font size"]').first.select_option("5")
    await page.wait_for_timeout(400)
    return ctx, page


async def goto_location(page, loc: int) -> None:
    inp = page.locator('input[aria-label="Current location"]').first
    await inp.fill(str(loc))
    await inp.press("Enter")
    await page.wait_for_timeout(600)


async def read_scroll_top(page) -> float:
    return await page.evaluate(
        "(sel) => document.querySelector(sel)?.scrollTop ?? -1",
        SCROLL_SELECTOR,
    )


async def read_scroll_height(page) -> float:
    return await page.evaluate(
        "(sel) => { const el = document.querySelector(sel); "
        "return el ? el.scrollHeight - el.clientHeight : -1; }",
        SCROLL_SELECTOR,
    )


async def scroll_to_bottom(page) -> float:
    """Scroll the device frame to the bottom and return the resulting scrollTop."""
    return await page.evaluate(
        "(sel) => { const el = document.querySelector(sel); "
        "if (!el) return -1; el.scrollTop = el.scrollHeight; return el.scrollTop; }",
        SCROLL_SELECTOR,
    )


async def click_arrow(page, label: str) -> None:
    await page.get_by_role("button", name=label).first.click()
    await page.wait_for_timeout(600)


async def assert_scroll_reset(page, label: str) -> None:
    top = await read_scroll_top(page)
    if top > 1.0:
        fail(f"{label}: expected scrollTop ~0 after page change, got {top:.2f}")
    ok(f"{label}: scrollTop reset to {top:.2f}")


async def main() -> None:
    print(f"Scroll-reset checks on {BROWSER}")
    async with async_playwright() as pw:
        engine = getattr(pw, BROWSER)
        browser = await engine.launch(headless=True)
        ctx, page = await open_previewer(browser)
        try:
            # Land on a text page (loc 2) so there's rendered content.
            await goto_location(page, 2)

            # 1. Next arrow resets scroll.
            travel = await read_scroll_height(page)
            if travel <= 0:
                fail(
                    f"page 2 at zoom step 5 has no scroll travel "
                    f"(scrollHeight - clientHeight = {travel}); "
                    f"the test can't prove reset without overflow"
                )
            bottom = await scroll_to_bottom(page)
            if bottom < 1.0:
                fail(f"could not scroll page 2 to bottom (got scrollTop={bottom:.2f})")
            await click_arrow(page, "Next page")
            await assert_scroll_reset(page, "after Next arrow (2 -> 3)")
            await page.screenshot(path=str(SCREENSHOTS / f"scroll_reset_next_{BROWSER}.png"))

            # 2. Back arrow resets scroll.
            await scroll_to_bottom(page)
            after_scroll = await read_scroll_top(page)
            if after_scroll < 1.0:
                fail(f"could not scroll page 3 to bottom (got scrollTop={after_scroll:.2f})")
            await click_arrow(page, "Previous page")
            await assert_scroll_reset(page, "after Prev arrow (3 -> 2)")
            await page.screenshot(path=str(SCREENSHOTS / f"scroll_reset_prev_{BROWSER}.png"))

            # 3. Direct Location-input jump resets scroll.
            await scroll_to_bottom(page)
            after_scroll = await read_scroll_top(page)
            if after_scroll < 1.0:
                fail(f"could not scroll page 2 to bottom before jump (got {after_scroll:.2f})")
            await goto_location(page, 5)
            await assert_scroll_reset(page, "after Location input (2 -> 5)")

            # 4. Re-render via device switch keeps content anchored at top too.
            await scroll_to_bottom(page)
            sel = page.locator('select[aria-label="Device"]').first
            await sel.scroll_into_view_if_needed()
            await sel.select_option("tablet", force=True)
            await page.wait_for_timeout(800)
            # After device change the frame remounts; a fresh element exists
            # so scrollTop is naturally 0. Verify.
            await assert_scroll_reset(page, "after Device change (Phone -> Tablet)")

        finally:
            await ctx.close()
            await browser.close()

        print("\nAll scroll-reset scenarios verified.")


if __name__ == "__main__":
    asyncio.run(main())
