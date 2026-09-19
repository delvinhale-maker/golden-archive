"""
Rendered dark-surface regression for the public homepage.

This test verifies the actual computed background color of each major homepage
section in a browser. Product covers and artwork are intentionally excluded
from the luminance calculation: a light book cover must not make a dark
marketplace section fail its surface contract.
"""

import asyncio
import re
import sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:8080"
OUT = Path("/tmp/browser/home-pixel-darkness")
OUT.mkdir(parents=True, exist_ok=True)

# Dark surface budget. #1C1A20 is ~27; navy #0F1E35 is ~29.
MAX_BACKGROUND_LUMINANCE = 110

SECTION_HEADINGS = [
    "New Releases",
    "Promoted Picks",
    "You May Also Like",
    "Featured Products",
    "Shop by Category",
]


def rgb_luminance(css_color: str) -> float:
    match = re.match(
        r"rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)",
        css_color,
    )
    if not match:
        raise ValueError(f"Unsupported computed background color: {css_color!r}")
    r, g, b = (float(v) for v in match.groups())
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


async def section_background(page, heading: str):
    sec = page.locator(f"section:has(h2:has-text('{heading}'))").first
    if await sec.count() == 0:
        return None
    await sec.scroll_into_view_if_needed()
    await page.wait_for_timeout(150)
    shot = await sec.screenshot()
    safe = heading.lower().replace(" ", "-")
    (OUT / f"{safe}.png").write_bytes(shot)
    color = await sec.evaluate("(el) => getComputedStyle(el).backgroundColor")
    return color, rgb_luminance(color)


async def main() -> int:
    failures: list[str] = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        await page.goto(BASE_URL, wait_until="networkidle")
        await page.wait_for_timeout(800)

        for heading in SECTION_HEADINGS:
            result = await section_background(page, heading)
            if result is None:
                print(f"SKIP: section {heading!r} not on current homepage")
                continue
            color, lum = result
            status = "OK" if lum <= MAX_BACKGROUND_LUMINANCE else "FAIL"
            print(
                f"{status}: {heading!r} background={color} "
                f"luminance={lum:.1f} (threshold {MAX_BACKGROUND_LUMINANCE})"
            )
            if lum > MAX_BACKGROUND_LUMINANCE:
                failures.append(
                    f"Section {heading!r} uses a light dominant background "
                    f"({color}, luminance {lum:.1f})."
                )

        await browser.close()

    print("\n=== Homepage surface darkness results ===")
    if failures:
        for failure in failures:
            print("FAIL:", failure)
        return 1
    print("PASS: all rendered current homepage sections use dark surfaces.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
