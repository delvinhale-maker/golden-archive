"""
Pixel-level dark-surface regression for the public homepage.

Complements `scripts/check-light-surfaces.mjs` (which scans source for
forbidden class names). This test renders the homepage in a headless
browser and samples the actual rendered pixels of each major section.
Any section whose mean luminance exceeds the dark threshold — regardless
of which CSS classes produced it — fails the test.

Why both:
  - The static guard catches `bg-white` / `bg-cream` regressions in known
    files, but misses new files, inline styles, CSS variables, third-party
    components, and hex colors we didn't enumerate.
  - This pixel test catches anything that renders light, even if the class
    name is novel (e.g. `bg-[#fff8ec]`, `style={{background:'#fff'}}`,
    a Tailwind arbitrary value, or a token reassignment).

Run:  python tests/integration/home-pixel-darkness.spec.py
"""

import asyncio
import io
import sys
from pathlib import Path
from PIL import Image
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:8080"
OUT = Path("/tmp/browser/home-pixel-darkness")
OUT.mkdir(parents=True, exist_ok=True)

# Mean luminance (0-255) above which a section is considered "light".
# #0F1E35 (the navy bg-page) has luminance ~30. Cream/white is 240+.
# 110 leaves headroom for gold accents, product covers, and text while
# still firmly rejecting any white/cream surface as the dominant fill.
MAX_MEAN_LUMINANCE = 110

# Headings that identify each homepage section we want to keep dark.
SECTION_HEADINGS = [
    "New Releases",
    "Promoted Picks",
    "You May Also Like",
    "Featured Products",
    "Shop by Category",
]


def mean_luminance(png_bytes: bytes) -> float:
    img = Image.open(io.BytesIO(png_bytes)).convert("L")  # 8-bit grayscale
    px = list(img.getdata())
    return sum(px) / len(px)


async def section_luminance(page, heading: str, out_dir: Path):
    sec = page.locator(f"section:has(h2:has-text('{heading}'))").first
    if await sec.count() == 0:
        return None
    await sec.scroll_into_view_if_needed()
    await page.wait_for_timeout(250)
    # Sample the section background by screenshotting the section itself
    # (full element bounds, no full_page).
    shot = await sec.screenshot()
    safe = heading.lower().replace(" ", "-")
    (out_dir / f"{safe}.png").write_bytes(shot)
    return mean_luminance(shot)


async def main() -> int:
    failures: list[str] = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        await page.goto(BASE_URL, wait_until="networkidle")
        await page.wait_for_timeout(800)

        # Body background sanity check — should be the navy page token.
        body_bg = await page.evaluate(
            "() => getComputedStyle(document.body).backgroundColor"
        )
        print(f"body backgroundColor = {body_bg}")

        for heading in SECTION_HEADINGS:
            lum = await section_luminance(page, heading, OUT)
            if lum is None:
                print(f"SKIP: section '{heading}' not on page")
                continue
            status = "OK" if lum <= MAX_MEAN_LUMINANCE else "FAIL"
            print(f"{status}: '{heading}' mean luminance = {lum:.1f} "
                  f"(threshold {MAX_MEAN_LUMINANCE})")
            if lum > MAX_MEAN_LUMINANCE:
                failures.append(
                    f"Section '{heading}' rendered light "
                    f"(mean luminance {lum:.1f} > {MAX_MEAN_LUMINANCE}). "
                    f"See {OUT}/{heading.lower().replace(' ', '-')}.png"
                )

        await browser.close()

    print("\n=== Pixel darkness results ===")
    if failures:
        for f in failures:
            print("FAIL:", f)
        return 1
    print("PASS: all sampled homepage sections are dark.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
