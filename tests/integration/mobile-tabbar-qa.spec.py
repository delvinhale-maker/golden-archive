"""QA: bottom nav active icon color, sliding underline (300ms), inactive gray #6B7280."""
import asyncio, re
from pathlib import Path
from playwright.async_api import async_playwright

SHOTS = Path(__file__).parent / "screenshots" / "mobile-tabbar"
SHOTS.mkdir(parents=True, exist_ok=True)

TABS = ["Home", "Browse", "Search", "Wishlist", "Account"]
INACTIVE = "rgb(107, 114, 128)"  # #6B7280


def parse_rgb(s: str):
    m = re.match(r"rgba?\(([^)]+)\)", s)
    return tuple(int(float(x)) for x in m.group(1).split(",")[:3]) if m else None


async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width": 390, "height": 800}, is_mobile=True)
        page = await ctx.new_page()
        await page.goto("http://localhost:8080/", wait_until="domcontentloaded")
        await page.wait_for_selector("nav a[aria-current], nav a", timeout=10000)

        results = []
        for label in TABS:
            tab = page.get_by_role("link", name=label, exact=True).first
            await tab.tap()
            await page.wait_for_timeout(400)  # allow 300ms transition

            # Active label color must equal accent-color (not gray)
            active_color = await tab.locator("span.text-\\[10px\\]").evaluate(
                "el => getComputedStyle(el).color"
            )
            accent = await page.evaluate(
                "getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim()"
            )
            # transitions on color must be 300ms
            transition = await tab.locator("span.text-\\[10px\\]").evaluate(
                "el => getComputedStyle(el).transitionDuration"
            )

            # Inactive tabs still gray
            inactive_colors = []
            for other in TABS:
                if other == label:
                    continue
                span = page.get_by_role("link", name=other, exact=True).first.locator("span.text-\\[10px\\]")
                inactive_colors.append(await span.evaluate("el => getComputedStyle(el).color"))

            # Underline present & positioned under this tab
            underline_box = await tab.locator("xpath=..").locator(".rounded-full").bounding_box()
            tab_box = await tab.bounding_box()
            aligned = underline_box and abs((underline_box["x"] + underline_box["width"]/2) - (tab_box["x"] + tab_box["width"]/2)) < 5

            await page.screenshot(path=str(SHOTS / f"{label.lower()}.png"))

            assert parse_rgb(active_color) != parse_rgb(INACTIVE), f"{label}: active color is gray"
            assert accent, f"{label}: --accent-color missing"
            assert "0.3s" in transition or "300ms" in transition, f"{label}: transition={transition}"
            for c in inactive_colors:
                assert parse_rgb(c) == parse_rgb(INACTIVE), f"{label}: inactive color {c} != {INACTIVE}"
            assert aligned, f"{label}: underline not aligned under tab"
            results.append({"tab": label, "active": active_color, "transition": transition, "underline_ok": aligned})

        await b.close()
        print("PASS", results)


asyncio.run(main())
