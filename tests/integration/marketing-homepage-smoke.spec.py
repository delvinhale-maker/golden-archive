"""
Deterministic release smoke test for the Trust / Taxonomy / Homepage update.

The homepage/SEO/trust assertions do not depend on live Supabase catalog data.
Department-page render checks are added only when Supabase CI credentials are
present, because those routes intentionally require configured Supabase access.

Run: python tests/integration/marketing-homepage-smoke.spec.py
"""

import asyncio
import os
import sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:8080"
OUT = Path("/tmp/browser/marketing-homepage-smoke")
OUT.mkdir(parents=True, exist_ok=True)
RESULTS = OUT / "results.txt"

EXPECTED_TITLE = "AurumVault | Professional Digital Systems, Creator Tools & Digital Resources"
EXPECTED_POSITIONING = "Professional Digital Systems, Creator Tools & Specialized Resources"
EXPECTED_DESCRIPTION = (
    "Discover professional digital systems, creator tools, film and production resources, "
    "business solutions, ebooks, planners and specialized digital products from AurumVault."
)
EXPECTED_CANONICAL = "https://www.aurumvault.store/"
HAS_SUPABASE_CONFIG = bool(
    os.environ.get("VITE_SUPABASE_URL")
    and os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
)


def normalize(text: str) -> str:
    return " ".join(text.split())


def persist_results(failures: list[str], page_errors: list[str]) -> None:
    lines = [
        "Marketing release smoke diagnostics",
        f"HAS_SUPABASE_CONFIG={HAS_SUPABASE_CONFIG}",
        f"failures={len(failures)}",
        f"page_errors={len(page_errors)}",
        "",
    ]
    if failures:
        lines.extend(f"FAIL: {failure}" for failure in failures)
    else:
        lines.append("PASS: no smoke-test failures")
    if page_errors:
        lines.extend(["", "Raw page errors:"])
        lines.extend(f"PAGEERROR: {error}" for error in page_errors)
    RESULTS.write_text("\n".join(lines) + "\n", encoding="utf-8")


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

        # Trust Center is not catalog-dependent and must always render.
        status = await route_status(page, "/about/trust")
        if status is not None and status >= 400:
            failures.append(f"Trust Center returned HTTP {status}")
        trust_text = normalize(await page.locator("body").inner_text())
        trust_debug = (
            f"status={status}\n"
            f"url={page.url}\n"
            f"title={await page.title()}\n"
            f"body={trust_text[:4000]}\n"
        )
        (OUT / "trust-render.txt").write_text(trust_debug, encoding="utf-8")
        await page.screenshot(path=str(OUT / "trust-center.png"), full_page=True)
        if "@aurumvault.store" not in trust_text:
            failures.append("Trust Center does not visibly identify @aurumvault.store")

        # Department route rendering requires configured Supabase access by design.
        if HAS_SUPABASE_CONFIG:
            for path, expected_text in (
                ("/business-systems", "Business Systems"),
                ("/creator-business-tools", "Creator Business Tools"),
            ):
                status = await route_status(page, path)
                if status is not None and status >= 400:
                    failures.append(f"{path} returned HTTP {status}")
                if expected_text not in normalize(await page.locator("body").inner_text()):
                    failures.append(f"{path} did not render expected label {expected_text!r}")
        else:
            print(
                "SKIP: department render checks require Supabase CI credentials; "
                "homepage links and static taxonomy regression are still verified."
            )

        # Mobile smoke using the same browser/page session.
        await page.set_viewport_size({"width": 390, "height": 844})
        mobile_routes = [("/", "mobile homepage")]
        if HAS_SUPABASE_CONFIG:
            mobile_routes.extend(
                [
                    ("/business-systems", "mobile Business Systems"),
                    ("/creator-business-tools", "mobile Creator Business Tools"),
                ]
            )
        for path, label in mobile_routes:
            status = await route_status(page, path)
            if status is not None and status >= 400:
                failures.append(f"{label}: HTTP {status}")
                continue
            await assert_no_page_overflow(page, label, failures)

        await page.screenshot(path=str(OUT / "mobile-home.png"), full_page=True)
        await browser.close()

    if page_errors:
        failures.extend(f"Uncaught browser error: {err}" for err in page_errors)

    persist_results(failures, page_errors)
    print("=== Marketing release smoke results ===")
    if failures:
        for failure in failures:
            print("FAIL:", failure)
        return 1

    if HAS_SUPABASE_CONFIG:
        print(
            "PASS: positioning, SEO, trust, department routes, and 390px overflow smoke verified."
        )
    else:
        print(
            "PASS: positioning, SEO, trust, homepage department links, and 390px homepage overflow verified; "
            "live department rendering remains credential-gated."
        )
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
