"""
Deterministic release smoke test for the Trust / Taxonomy / Homepage update.

This test intentionally does NOT depend on live Supabase catalog data. GitHub
Actions can therefore verify the marketing release even when production DB
secrets are not configured in CI.

It covers only the release gates changed by marketing/trust-taxonomy-homepage:
  - upgraded homepage positioning / semantic H1
  - rendered homepage SEO metadata
  - Business Systems / Creator Business Tools / Film-TV navigation
  - Trust Center official @aurumvault.store guidance
  - desktop route smoke + 390px page-overflow smoke

Run: python tests/integration/marketing-homepage-smoke.spec.py
"""

import asyncio
import sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:8080"
OUT = Path("/tmp/browser/marketing-homepage-smoke")
OUT.mkdir(parents=True, exist_ok=True)

EXPECTED_TITLE = "AurumVault | Professional Digital Systems, Creator Tools & Digital Resources"
EXPECTED_POSITIONING = "Professional Digital Systems, Creator Tools & Specialized Resources"
EXPECTED_DESCRIPTION = (
    "Discover professional digital systems, creator tools, film and production resources, "
    "business solutions, ebooks, planners and specialized digital products from AurumVault."
)
EXPECTED_CANONICAL = "https://www.aurumvault.store/"


def normalize(text: str) -> str:
    return " ".join(text.split())


async def route_status(page, path: str) -> int | None:
    response = await page.goto(f"{BASE_URL}{path}", wait_until="networkidle")
    await page.wait_for_timeout(300)
    return response.status if response else None


async def assert_no_page_overflow(page, label: str, failures: list[str]) -> None:
    metrics = await page.evaluate(
        """() => ({
          viewport: window.innerWidth,
          document: document.documentElement.scrollWidth,
          body: document.body ? document.body.scrollWidth : 0,
        })"""
    )
    widest = max(metrics["document"], metrics["body"])
    if widest > metrics["viewport"] + 1:
        failures.append(
            f"{label}: horizontal page overflow ({widest}px content vs "
            f"{metrics['viewport']}px viewport)"
        )


async def main() -> int:
    failures: list[str] = []
    page_errors: list[str] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        page.on("pageerror", lambda exc: page_errors.append(str(exc)))

        # Homepage / desktop release contract.
        status = await route_status(page, "/")
        if status is not None and status >= 400:
            failures.append(f"Homepage returned HTTP {status}")

        await page.screenshot(path=str(OUT / "desktop-home.png"), full_page=True)

        title = await page.title()
        if title != EXPECTED_TITLE:
            failures.append(f"Homepage title mismatch: {title!r}")

        h1s = page.locator("h1")
        h1_count = await h1s.count()
        if h1_count != 1:
            failures.append(f"Homepage must render exactly one h1; got {h1_count}")
        elif EXPECTED_POSITIONING not in normalize(await h1s.first.inner_text()):
            failures.append(
                "Homepage h1 does not contain the professional systems positioning"
            )

        body_text = normalize(await page.locator("body").inner_text())
        if EXPECTED_POSITIONING not in body_text:
            failures.append("Homepage does not visibly render the upgraded positioning")

        description = await page.locator("meta[name='description']").get_attribute("content")
        if description != EXPECTED_DESCRIPTION:
            failures.append(f"Homepage meta description mismatch: {description!r}")

        canonical = await page.locator("link[rel='canonical']").get_attribute("href")
        if canonical != EXPECTED_CANONICAL:
            failures.append(f"Homepage canonical mismatch: {canonical!r}")

        og_title = await page.locator("meta[property='og:title']").get_attribute("content")
        og_desc = await page.locator("meta[property='og:description']").get_attribute("content")
        twitter_title = await page.locator("meta[name='twitter:title']").get_attribute("content")
        twitter_desc = await page.locator("meta[name='twitter:description']").get_attribute("content")
        if og_title != EXPECTED_TITLE:
            failures.append(f"Homepage og:title mismatch: {og_title!r}")
        if og_desc != EXPECTED_DESCRIPTION:
            failures.append(f"Homepage og:description mismatch: {og_desc!r}")
        if twitter_title != EXPECTED_TITLE:
            failures.append(f"Homepage twitter:title mismatch: {twitter_title!r}")
        if twitter_desc != EXPECTED_DESCRIPTION:
            failures.append(f"Homepage twitter:description mismatch: {twitter_desc!r}")

        required_links = {
            "/business-systems": "Business Systems",
            "/creator-business-tools": "Creator Business Tools",
            "/collections/film-tv-creator-production": "Film, TV & Creator Production",
        }
        for href, label in required_links.items():
            if await page.locator(f"a[href='{href}']").count() == 0:
                failures.append(f"Homepage missing visible route to {label} ({href})")

        # Department and trust routes must render even with an empty catalog.
        for path, expected_text in (
            ("/business-systems", "Business Systems"),
            ("/creator-business-tools", "Creator Business Tools"),
        ):
            status = await route_status(page, path)
            if status is not None and status >= 400:
                failures.append(f"{path} returned HTTP {status}")
            if expected_text not in normalize(await page.locator("body").inner_text()):
                failures.append(f"{path} did not render expected label {expected_text!r}")

        status = await route_status(page, "/about/trust")
        if status is not None and status >= 400:
            failures.append(f"Trust Center returned HTTP {status}")
        trust_text = normalize(await page.locator("body").inner_text())
        if "@aurumvault.store" not in trust_text:
            failures.append("Trust Center does not visibly identify @aurumvault.store")

        # Mobile smoke using the same browser/page session.
        await page.set_viewport_size({"width": 390, "height": 844})
        for path, label in (
            ("/", "mobile homepage"),
            ("/business-systems", "mobile Business Systems"),
            ("/creator-business-tools", "mobile Creator Business Tools"),
        ):
            status = await route_status(page, path)
            if status is not None and status >= 400:
                failures.append(f"{label}: HTTP {status}")
                continue
            await assert_no_page_overflow(page, label, failures)

        await page.screenshot(path=str(OUT / "mobile-creator-tools.png"), full_page=True)
        await browser.close()

    # Page-level uncaught exceptions are release blockers. Network/server-function
    # failures that are intentionally caught by the app do not appear here.
    if page_errors:
        failures.extend(f"Uncaught browser error: {err}" for err in page_errors)

    print("=== Marketing release smoke results ===")
    if failures:
        for failure in failures:
            print("FAIL:", failure)
        return 1

    print(
        "PASS: positioning, SEO, department/trust routes, and 390px overflow smoke verified."
    )
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
