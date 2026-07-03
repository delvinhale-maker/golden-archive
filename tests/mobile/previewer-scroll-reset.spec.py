"""
Regression test: the ManuscriptPreviewer's device-frame page area
(the element tagged `data-testid="previewer-scroll"`) must reset its
scrollTop to 0 on EVERY location change — next arrow, previous arrow,
or the Location input — and MUST NOT scroll on unrelated re-renders
(font-size change, device change).

Approach: install a spy on Element.prototype.scrollTo that captures
`(element, top, testid)` for every call, drive the previewer through
scripted navigation, then assert:

  * every page change produces at least one call whose target is the
    previewer-scroll element AND whose `top === 0` (strict equality,
    not truthiness) — smooth-scroll options objects are unpacked
  * font-size and any other non-navigation re-render produces zero
    scroll calls on that element

This works whether or not the current PDF render actually overflows
the frame; the reset contract is what we lock in.

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

# Stable selectors — tests never key off className.
FRAME_TESTID = "previewer-scroll"
TOUCH_TESTID = "previewer-touch"

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

# Records every Element.prototype.scrollTo call. Behavior-preserving:
# always delegates to the original implementation. Filters by
# data-testid at read time — tests never rely on className.
INSTALL_SPY_JS = r"""
() => {
  if (window.__scrollSpyInstalled) { window.__scrollCalls = []; return; }
  window.__scrollSpyInstalled = true;
  window.__scrollCalls = [];
  const origEl = Element.prototype.scrollTo;
  Element.prototype.scrollTo = function(...args) {
    let top;
    let hasTop = false;
    if (args.length === 1 && args[0] && typeof args[0] === 'object') {
      if ('top' in args[0]) { top = args[0].top; hasTop = true; }
    } else if (args.length >= 2) {
      top = args[1];
      hasTop = true;
    }
    window.__scrollCalls.push({
      top,
      hasTop,
      testid: this.getAttribute && this.getAttribute('data-testid'),
      tag: this.tagName,
      at: performance.now(),
    });
    return origEl.apply(this, args);
  };
}
"""


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def ok(msg: str) -> None:
    print(f"PASS: {msg}")


async def open_previewer(browser):
    ctx = await browser.new_context(**MOBILE_CTX)
    page = await ctx.new_page()
    # Install BEFORE any React effect can fire (each new document runs
    # init scripts before user code).
    await page.add_init_script(f"({INSTALL_SPY_JS})()")
    await page.goto(BASE, wait_until="networkidle")
    await page.get_by_role("button", name="PDF", exact=True).first.tap()
    await page.locator('select[aria-label="Font size"]').first.wait_for(timeout=20000)
    await page.locator(f'[data-testid="{TOUCH_TESTID}"]').first.wait_for(
        state="attached", timeout=20000,
    )
    await page.locator(f'[data-testid="{FRAME_TESTID}"]').first.wait_for(
        state="attached", timeout=20000,
    )
    return ctx, page


async def clear_spy(page) -> None:
    await page.evaluate("() => { window.__scrollCalls = []; }")


async def frame_calls(page) -> list:
    return await page.evaluate(
        "(id) => (window.__scrollCalls || []).filter(c => c.testid === id)",
        FRAME_TESTID,
    )


async def all_calls(page) -> list:
    return await page.evaluate("() => window.__scrollCalls || []")


async def assert_navigation_reset(page, label: str) -> None:
    """A page change MUST produce ≥1 scrollTo({top:0}) on the frame."""
    calls = await frame_calls(page)
    if not calls:
        fail(f"{label}: no scrollTo recorded on [data-testid={FRAME_TESTID!r}]")
    # Strict `=== 0`: reject `undefined`, `null`, `{}`-with-no-top,
    # or any non-zero value. This is the tightening the spec asks for.
    zero_calls = [c for c in calls if c.get("hasTop") and c.get("top") == 0]
    if not zero_calls:
        fail(
            f"{label}: frame received scrollTo but never with top===0 "
            f"(calls: {calls})"
        )
    ok(
        f"{label}: frame reset with top===0 "
        f"({len(zero_calls)}/{len(calls)} qualifying calls)"
    )


async def assert_no_frame_scroll(page, label: str) -> None:
    """A non-navigation re-render MUST NOT scroll the frame."""
    calls = await frame_calls(page)
    if calls:
        fail(
            f"{label}: expected zero scrollTo calls on the frame, got "
            f"{len(calls)} — reset must be scoped to location changes "
            f"(calls: {calls})"
        )
    ok(f"{label}: no frame scrollTo fired (correctly scoped)")


async def main() -> None:
    print(f"Scroll-reset checks on {BROWSER}")
    async with async_playwright() as pw:
        engine = getattr(pw, BROWSER)
        browser = await engine.launch(headless=True)
        ctx, page = await open_previewer(browser)
        try:
            # 1. Next arrow → reset.
            await clear_spy(page)
            await page.get_by_role("button", name="Next page").first.click()
            await page.wait_for_timeout(400)
            await assert_navigation_reset(page, "Next arrow (1 -> 2)")
            await page.screenshot(path=str(SCREENSHOTS / f"scroll_reset_next_{BROWSER}.png"))

            # 2. Previous arrow → reset.
            await clear_spy(page)
            await page.get_by_role("button", name="Previous page").first.click()
            await page.wait_for_timeout(400)
            await assert_navigation_reset(page, "Prev arrow (2 -> 1)")
            await page.screenshot(path=str(SCREENSHOTS / f"scroll_reset_prev_{BROWSER}.png"))

            # 3. Location-input jump → reset.
            await clear_spy(page)
            inp = page.locator('input[aria-label="Current location"]').first
            await inp.fill("3")
            await inp.press("Enter")
            await page.wait_for_timeout(500)
            await assert_navigation_reset(page, "Location input (1 -> 3)")

            # 4. Font-size change is NOT a navigation → NO frame scroll.
            await clear_spy(page)
            await page.locator('select[aria-label="Font size"]').first.select_option("4")
            await page.wait_for_timeout(400)
            await assert_no_frame_scroll(page, "font-size 3 -> 4")

            # 5. Device switch remounts the frame → NO scrollTo needed on
            #    the old element (freshly mounted elements have scrollTop 0).
            await clear_spy(page)
            sel = page.locator('select[aria-label="Device"]').first
            await sel.scroll_into_view_if_needed()
            await sel.select_option("tablet", force=True)
            await page.wait_for_timeout(800)
            await assert_no_frame_scroll(page, "device Phone -> Tablet")

            # 6. Same-location "navigation" MUST NOT re-scroll: setting
            #    Location to its current value is a no-op and shouldn't
            #    fire the effect.
            await clear_spy(page)
            inp = page.locator('input[aria-label="Current location"]').first
            current = await inp.input_value()
            await inp.fill(current)
            await inp.press("Enter")
            await page.wait_for_timeout(400)
            await assert_no_frame_scroll(page, f"re-enter same location ({current})")

            # 7. Final sanity: the frame's live scrollTop is 0.
            top = await page.evaluate(
                "(id) => document.querySelector(`[data-testid=\"${id}\"]`)?.scrollTop ?? -1",
                FRAME_TESTID,
            )
            if top != 0:
                fail(f"final scrollTop is {top}, expected 0")
            ok(f"final scrollTop is {top}")

        finally:
            await ctx.close()
            await browser.close()

        print("\nAll scroll-reset scenarios verified.")


if __name__ == "__main__":
    asyncio.run(main())
