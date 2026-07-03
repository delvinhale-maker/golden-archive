"""
Regression test: the ManuscriptPreviewer's device-frame page area
(`.device-frame-inner`) must reset its scrollTop to 0 whenever the
location changes — next arrow, previous arrow, or the Location input.
Users read to the bottom of a page, tap next, and expect to start at
the top of the new page.

Approach: install a spy on Element.prototype.scrollTo that records every
(element, top) tuple, drive the previewer through page changes, and
assert the .device-frame-inner element received a scrollTo({top:0}) for
each navigation. This works regardless of whether the current PDF
render actually overflows the frame — the reset contract is what we
lock in, not the presence of overflow.

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

# Install BEFORE any React effect runs — patches Element.prototype.scrollTo
# to record every call into window.__scrollCalls. Keeps the native behavior
# so real UI code isn't affected.
INSTALL_SPY_JS = r"""
() => {
  window.__scrollCalls = [];
  const orig = Element.prototype.scrollTo;
  Element.prototype.scrollTo = function(...args) {
    let top;
    if (args.length === 1 && args[0] && typeof args[0] === 'object') top = args[0].top;
    else if (args.length >= 2) top = args[1];
    const cls = (this.className || '').toString();
    window.__scrollCalls.push({
      top,
      isFrame: cls.includes('device-frame-inner'),
      cls: cls.slice(0, 80),
      at: Date.now(),
    });
    return orig.apply(this, args);
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
    # Install the spy the moment a new document begins, so the initial
    # render's scrollTo (if any) is captured too.
    await page.add_init_script(INSTALL_SPY_JS.strip().lstrip("()").lstrip(" =>").strip())
    # add_init_script needs a function-body-less top-level script; wrap
    # by re-installing right after navigation instead for reliability.
    await page.goto(BASE, wait_until="networkidle")
    await page.evaluate(INSTALL_SPY_JS)
    await page.get_by_role("button", name="PDF", exact=True).first.tap()
    await page.locator('select[aria-label="Font size"]').first.wait_for(timeout=20000)
    await page.locator('[data-testid="previewer-touch"]').first.wait_for(
        state="attached", timeout=20000,
    )
    # Re-install after mount so any subsequent scrollTo we make is spied,
    # then clear whatever the initial mount produced.
    await page.evaluate(INSTALL_SPY_JS)
    return ctx, page


async def clear_spy(page) -> None:
    await page.evaluate("() => { window.__scrollCalls = []; }")


async def frame_scroll_calls(page) -> list:
    return await page.evaluate(
        "() => (window.__scrollCalls || []).filter(c => c.isFrame)"
    )


async def assert_frame_reset_since(page, label: str) -> None:
    calls = await frame_scroll_calls(page)
    if not calls:
        fail(f"{label}: no scrollTo call recorded on .device-frame-inner")
    zero_calls = [c for c in calls if (c.get("top") or 0) == 0]
    if not zero_calls:
        fail(
            f"{label}: frame received scrollTo but never with top=0 "
            f"(calls: {calls})"
        )
    ok(f"{label}: frame reset to top ({len(zero_calls)}/{len(calls)} calls with top=0)")


async def main() -> None:
    print(f"Scroll-reset checks on {BROWSER}")
    async with async_playwright() as pw:
        engine = getattr(pw, BROWSER)
        browser = await engine.launch(headless=True)
        ctx, page = await open_previewer(browser)
        try:
            # 1. Next arrow triggers a frame scrollTo({top:0}).
            await clear_spy(page)
            await page.get_by_role("button", name="Next page").first.click()
            await page.wait_for_timeout(400)
            await assert_frame_reset_since(page, "Next arrow (1 -> 2)")
            await page.screenshot(path=str(SCREENSHOTS / f"scroll_reset_next_{BROWSER}.png"))

            # 2. Prev arrow triggers a frame scrollTo({top:0}).
            await clear_spy(page)
            await page.get_by_role("button", name="Previous page").first.click()
            await page.wait_for_timeout(400)
            await assert_frame_reset_since(page, "Prev arrow (2 -> 1)")
            await page.screenshot(path=str(SCREENSHOTS / f"scroll_reset_prev_{BROWSER}.png"))

            # 3. Direct Location-input jump triggers reset.
            await clear_spy(page)
            inp = page.locator('input[aria-label="Current location"]').first
            await inp.fill("3")
            await inp.press("Enter")
            await page.wait_for_timeout(500)
            await assert_frame_reset_since(page, "Location input (1 -> 3)")

            # 4. After a re-render (font-size change is NOT a location change,
            #    so the reset effect should NOT fire — this locks in that we
            #    only reset on navigation, not on every render).
            await clear_spy(page)
            await page.locator('select[aria-label="Font size"]').first.select_option("4")
            await page.wait_for_timeout(400)
            calls = await frame_scroll_calls(page)
            if calls:
                fail(
                    f"font-size change unexpectedly scrolled the frame "
                    f"(calls: {calls}) — reset must be scoped to location changes"
                )
            ok("font-size change did not scroll the frame (correctly scoped)")

            # 5. Verify the current top is 0 after all the navigation.
            top = await page.evaluate(
                "() => document.querySelector('.device-frame-inner')?.scrollTop ?? -1"
            )
            if top > 1.0:
                fail(f"final .device-frame-inner scrollTop is {top}, expected ~0")
            ok(f"final scrollTop is {top}")

        finally:
            await ctx.close()
            await browser.close()

        print("\nAll scroll-reset scenarios verified.")


if __name__ == "__main__":
    asyncio.run(main())
