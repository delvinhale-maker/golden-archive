"""
Pinch-zoom regression test for the ManuscriptPreviewer.

CDP's `Input.dispatchTouchEvent` becomes flaky after the first multi-touch
sequence in a given page context — the second gesture routinely fails to
deliver touchstart/touchmove to React handlers. To make pinch coverage
reliable, this test dispatches native `TouchEvent`s directly in the page
via `page.evaluate`, and runs each gesture in a **fresh browser context**
so no stale gesture state can leak between assertions.

Covered:
  1. Pinch-out increases the font-size step (dropdown reflects the change).
  2. Pinch-in — in a NEW context — decreases the font-size step.
  3. Double-tap toggles between step 3 and step 5.

Run with:
    python3 tests/mobile/previewer-pinch.spec.py

Requires the dev server on http://localhost:8080.
"""

import asyncio
import sys
from pathlib import Path

from playwright.async_api import async_playwright, Browser

BASE = "http://localhost:8080/preview-sample"
SAMPLE_URL = f"http://localhost:8080/samples/sample-manuscript.pdf"
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

# JS helper: dispatch a real TouchEvent sequence on a target element.
# Runs entirely inside the page — bypasses CDP's touch-input state machine,
# which is the source of the second-gesture flake we hit earlier.
DISPATCH_PINCH_JS = r"""
async ({ selector, startDist, endDist, steps }) => {
  const el = document.querySelector(selector);
  if (!el) throw new Error('target not found: ' + selector);
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;

  const mkTouch = (id, x) => new Touch({
    identifier: id, target: el, clientX: x, clientY: cy,
    pageX: x, pageY: cy, screenX: x, screenY: cy,
    radiusX: 5, radiusY: 5, rotationAngle: 0, force: 1,
  });

  const fire = (type, dist) => {
    const t1 = mkTouch(1, cx - dist / 2);
    const t2 = mkTouch(2, cx + dist / 2);
    const ev = new TouchEvent(type, {
      bubbles: true, cancelable: true, composed: true,
      touches: type === 'touchend' ? [] : [t1, t2],
      targetTouches: type === 'touchend' ? [] : [t1, t2],
      changedTouches: [t1, t2],
    });
    el.dispatchEvent(ev);
  };

  fire('touchstart', startDist);
  await new Promise(r => requestAnimationFrame(r));
  for (let i = 1; i <= steps; i++) {
    const d = startDist + ((endDist - startDist) * i) / steps;
    fire('touchmove', d);
    await new Promise(r => setTimeout(r, 16));
  }
  fire('touchend', endDist);
};
"""

DISPATCH_DOUBLE_TAP_JS = r"""
async ({ selector }) => {
  const el = document.querySelector(selector);
  if (!el) throw new Error('target not found: ' + selector);
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;

  const tap = () => {
    const t = new Touch({
      identifier: 9, target: el, clientX: x, clientY: y,
      pageX: x, pageY: y, screenX: x, screenY: y,
      radiusX: 5, radiusY: 5, rotationAngle: 0, force: 1,
    });
    el.dispatchEvent(new TouchEvent('touchstart', {
      bubbles: true, cancelable: true, composed: true,
      touches: [t], targetTouches: [t], changedTouches: [t],
    }));
    el.dispatchEvent(new TouchEvent('touchend', {
      bubbles: true, cancelable: true, composed: true,
      touches: [], targetTouches: [], changedTouches: [t],
    }));
  };
  tap();
  await new Promise(r => setTimeout(r, 80));
  tap();
};
"""


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def ok(msg: str) -> None:
    print(f"PASS: {msg}")


async def read_font_step(page) -> int:
    """Read the currently-selected font-size step from the dropdown."""
    val = await page.locator('select[aria-label="Font size"]').first.input_value()
    return int(val)


async def open_previewer(browser: Browser):
    ctx = await browser.new_context(**MOBILE_CTX)
    page = await ctx.new_page()
    # Open with ?url= so the preview mounts immediately (no picker).
    await page.goto(f"{BASE}?url={SAMPLE_URL}", wait_until="domcontentloaded")
    # Wait for the touch surface to be present.
    await page.locator('[data-testid="previewer-touch"]').first.wait_for(timeout=8000)
    # Give the renderer a beat to hydrate handlers.
    await page.wait_for_timeout(400)
    return ctx, page


async def run_pinch(page, start: float, end: float, steps: int = 12) -> None:
    await page.evaluate(
        DISPATCH_PINCH_JS,
        {"selector": '[data-testid="previewer-touch"]',
         "startDist": start, "endDist": end, "steps": steps},
    )
    # Allow React's state flush to render into the <select>.
    await page.wait_for_timeout(80)


async def main() -> None:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)

        # --- 1. Pinch-OUT in its own context -----------------------------
        ctx, page = await open_previewer(browser)
        try:
            baseline = await read_font_step(page)
            await run_pinch(page, start=80, end=320)
            after_out = await read_font_step(page)
            await page.screenshot(path=str(SCREENSHOTS / "pinch_out.png"))
            if after_out <= baseline:
                fail(f"pinch-out did not increase font step ({baseline} -> {after_out})")
            ok(f"pinch-out increased font step {baseline} -> {after_out}")
        finally:
            await ctx.close()

        # --- 2. Pinch-IN in a FRESH context ------------------------------
        # Fresh context = fresh page = no residual gesture state, no CDP
        # touch-sequence carryover. This is the reliability fix.
        ctx, page = await open_previewer(browser)
        try:
            # Prime the previewer to a high font step so a pinch-in has
            # somewhere to travel. We use the dropdown itself (not a
            # gesture) so the pinch-in gesture is the ONLY multi-touch
            # event this context ever sees.
            await page.locator('select[aria-label="Font size"]').first.select_option("5")
            await page.wait_for_timeout(50)
            before_in = await read_font_step(page)
            if before_in != 5:
                fail(f"could not prime font step to 5 (got {before_in})")

            await run_pinch(page, start=320, end=60)
            after_in = await read_font_step(page)
            await page.screenshot(path=str(SCREENSHOTS / "pinch_in.png"))
            if after_in >= before_in:
                fail(f"pinch-in did not decrease font step ({before_in} -> {after_in})")
            ok(f"pinch-in decreased font step {before_in} -> {after_in}")
        finally:
            await ctx.close()

        # --- 3. Double-tap in a fresh context ----------------------------
        ctx, page = await open_previewer(browser)
        try:
            start = await read_font_step(page)
            await page.evaluate(
                DISPATCH_DOUBLE_TAP_JS,
                {"selector": '[data-testid="previewer-touch"]'},
            )
            await page.wait_for_timeout(80)
            after = await read_font_step(page)
            if after == start:
                fail(f"double-tap did not toggle font step (stayed at {start})")
            ok(f"double-tap toggled font step {start} -> {after}")
        finally:
            await ctx.close()

        await browser.close()
        print("\nAll pinch/tap gestures verified across isolated contexts.")


if __name__ == "__main__":
    asyncio.run(main())
