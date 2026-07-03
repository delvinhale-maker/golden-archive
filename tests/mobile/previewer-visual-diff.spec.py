"""
Visual regression: screenshot the ManuscriptPreviewer device frame for
each (device × location) combo and pixel-diff against a baseline PNG
checked into the repo. Fails when the rendered surface drifts beyond
tolerance — the visual counterpart to previewer-canvas-fit's numeric
gutter assertions.

Baselines live under tests/mobile/baselines/<engine>/.
Regenerate them intentionally by running:

    UPDATE_BASELINES=1 python3 tests/mobile/previewer-visual-diff.spec.py
    UPDATE_BASELINES=1 BROWSER=webkit python3 tests/mobile/previewer-visual-diff.spec.py

then commit the updated PNGs.
"""

import asyncio
import os
import sys
from pathlib import Path

from PIL import Image, ImageChops
from playwright.async_api import async_playwright

BROWSER = os.environ.get("BROWSER", "chromium").lower()
if BROWSER not in {"chromium", "webkit", "firefox"}:
    raise SystemExit(f"unsupported BROWSER={BROWSER}")

UPDATE = os.environ.get("UPDATE_BASELINES") == "1"

BASE = "http://localhost:8080/preview-sample"
HERE = Path(__file__).parent
BASELINE_DIR = HERE / "baselines" / BROWSER
DIFF_DIR = HERE / "screenshots" / "diffs" / BROWSER
BASELINE_DIR.mkdir(parents=True, exist_ok=True)
DIFF_DIR.mkdir(parents=True, exist_ok=True)

# Per-pixel channel tolerance (0-255). Anything under this is treated as
# noise (subpixel AA, font hinting, PDF.js rasterisation jitter).
CHANNEL_TOL = 12
# Max fraction of pixels allowed to differ beyond CHANNEL_TOL. 0.5% is
# enough to swallow AA/font-hint drift without hiding a real gutter shift.
MAX_DIFF_RATIO = 0.005

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

DEVICES = [("phone", "Phone"), ("tablet", "Tablet"), ("kindle", "Kindle")]


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
    return ctx, page


async def set_device(page, value: str) -> None:
    sel = page.locator('select[aria-label="Device"]').first
    await sel.scroll_into_view_if_needed()
    await sel.select_option(value, force=True)
    await page.wait_for_timeout(500)


async def goto_location(page, loc: int) -> None:
    inp = page.locator('input[aria-label="Current location"]').first
    await inp.fill(str(loc))
    await inp.press("Enter")
    await page.wait_for_timeout(700)


def diff_ratio(a_path: Path, b_path: Path, out_path: Path) -> float:
    """Fraction of pixels differing by more than CHANNEL_TOL on any channel."""
    a = Image.open(a_path).convert("RGB")
    b = Image.open(b_path).convert("RGB")
    if a.size != b.size:
        # Size drift is itself a regression — persist both for inspection.
        b.save(out_path)
        return 1.0
    delta = ImageChops.difference(a, b)
    # Reduce each pixel to its max channel delta, then threshold.
    px = delta.getdata()
    total = len(px)
    over = sum(1 for r, g, b_ in px if max(r, g, b_) > CHANNEL_TOL)
    if over:
        delta.save(out_path)
    return over / total if total else 0.0


async def snap_frame(page, out_path: Path) -> None:
    frame = page.locator('[data-testid="previewer-touch"]').first
    # Element screenshot — bounded to the device frame, so unrelated
    # chrome (toolbar, header) can't invalidate the diff.
    await frame.screenshot(path=str(out_path))


async def main() -> None:
    print(f"Visual diff on {BROWSER} (update={UPDATE})")
    tmp_dir = HERE / "screenshots" / "current" / BROWSER
    tmp_dir.mkdir(parents=True, exist_ok=True)

    failures: list[str] = []

    async with async_playwright() as pw:
        engine = getattr(pw, BROWSER)
        browser = await engine.launch(headless=True)
        ctx, page = await open_previewer(browser)
        try:
            for value, label in DEVICES:
                await set_device(page, value)
                for loc in (1, 2, 3):
                    await goto_location(page, loc)
                    name = f"{value}_loc{loc}.png"
                    baseline = BASELINE_DIR / name
                    current = tmp_dir / name
                    await snap_frame(page, current)

                    if UPDATE or not baseline.exists():
                        current.replace(baseline)
                        ok(f"{label} · loc {loc}: baseline written → {baseline.relative_to(HERE)}")
                        continue

                    diff_out = DIFF_DIR / name
                    ratio = diff_ratio(baseline, current, diff_out)
                    if ratio > MAX_DIFF_RATIO:
                        failures.append(
                            f"{label} · loc {loc}: {ratio * 100:.2f}% pixels drifted "
                            f"(> {MAX_DIFF_RATIO * 100:.2f}%) — diff at {diff_out.relative_to(HERE)}"
                        )
                        print(f"FAIL: {failures[-1]}")
                    else:
                        ok(
                            f"{label} · loc {loc}: {ratio * 100:.3f}% drift "
                            f"(≤ {MAX_DIFF_RATIO * 100:.2f}%)"
                        )
        finally:
            await ctx.close()
            await browser.close()

    if failures:
        print(f"\n{len(failures)} visual regression(s) on {BROWSER}.")
        sys.exit(1)
    print(f"\nAll device × location screenshots match baseline on {BROWSER}.")


if __name__ == "__main__":
    asyncio.run(main())
