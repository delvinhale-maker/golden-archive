"""
Mobile upload-zone smoke test for the publish flow (`/dashboard/new`).

Verifies, at an iPhone-class viewport, that:
  1. The Manuscript dropzone and Cover dropzone are both tappable.
  2. Tapping each zone wires through to a hidden <input type="file"> that
     opens the native file picker.
  3. The Manuscript input only advertises .pdf/.epub/.docx in its accept
     attribute, and rejects an .exe selection client-side.
  4. The Cover input only advertises .jpg/.jpeg/.png in its accept
     attribute, and rejects a .gif selection client-side.

Run with:
    python3 tests/mobile/upload-zones.spec.py

Requires the dev server to be running on http://localhost:8080 and the
LOVABLE_BROWSER_SUPABASE_* env vars to be injected (managed Supabase
session) so the authenticated `/dashboard/new` route is reachable.
"""

import asyncio
import json
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright, expect

BASE = "http://localhost:8080"
SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

MANUSCRIPT_ACCEPT_REQUIRED = {".pdf", ".epub", ".docx"}
COVER_ACCEPT_REQUIRED = {".jpg", ".jpeg", ".png"}


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def ok(msg: str) -> None:
    print(f"PASS: {msg}")


async def restore_supabase_session(page) -> None:
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    await page.goto(BASE, wait_until="domcontentloaded")
    if not storage_key or not session_json:
        print(
            "WARN: no managed Supabase session injected — "
            "authenticated route will redirect to /auth."
        )
        return
    await page.evaluate(
        f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
    )


async def expect_picker_opens(page, dropzone_selector: str, label: str) -> None:
    """Tap the dropzone and assert the file chooser opens."""
    # Playwright resolves expect_file_chooser when the picker is requested
    # (synchronously or via input.click()), even though no real OS dialog
    # is shown in headless mode.
    async with page.expect_file_chooser(timeout=4000) as fc_info:
        await page.locator(dropzone_selector).first.tap()
    chooser = await fc_info.value
    if chooser is None:
        fail(f"{label}: file picker did not open on tap")
    ok(f"{label}: file picker opened on tap")


async def check_accept_attr(
    page, input_selector: str, required: set[str], label: str
) -> None:
    accept = await page.locator(input_selector).first.get_attribute("accept")
    if not accept:
        fail(f"{label}: input has no accept attribute")
    advertised = {a.strip().lower() for a in accept.split(",") if a.strip().startswith(".")}
    missing = required - advertised
    if missing:
        fail(
            f"{label}: accept is missing required extensions {sorted(missing)} "
            f"(got {sorted(advertised)})"
        )
    # And make sure nothing dangerous is advertised.
    bad = {".exe", ".sh", ".gif"} & advertised
    if bad:
        fail(f"{label}: accept advertises disallowed extensions {sorted(bad)}")
    ok(f"{label}: accept attribute restricts to {sorted(advertised)}")


async def expect_client_rejects(
    page,
    input_selector: str,
    filename: str,
    mime: str,
    error_substring: str,
    label: str,
) -> None:
    """Programmatically set a disallowed file on the input and confirm the
    client-side validation surfaces an error before any upload starts."""
    await page.locator(input_selector).first.set_input_files(
        {"name": filename, "mimeType": mime, "buffer": b"\x00\x01\x02\x03"}
    )
    # The component renders the error inside a [role="alert"] / red banner.
    error = page.get_by_text(error_substring, exact=False)
    try:
        await expect(error.first).to_be_visible(timeout=3000)
    except Exception:
        fail(f"{label}: expected client-side rejection for {filename}")
    ok(f"{label}: client rejected {filename}")


async def main() -> None:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        # iPhone 13-ish viewport with touch.
        context = await browser.new_context(
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
        page = await context.new_page()

        await restore_supabase_session(page)
        await page.goto(f"{BASE}/dashboard/new", wait_until="domcontentloaded")
        # Wait for the publish flow to settle.
        await page.wait_for_load_state("networkidle")

        if "/auth" in page.url:
            fail(
                "Redirected to /auth — no authenticated session. "
                "Sign in via the Lovable preview, then re-run."
            )

        # Step 1 requires title, author (prefilled), and a description of
        # at least 50 characters. Fill the required fields, then advance to
        # Step 2 where the dropzones live.
        title_input = page.locator('input.inp').first
        await title_input.tap()
        await title_input.fill("Mobile Upload Zone Test Title")

        desc = page.locator("textarea.inp").first
        await desc.tap()
        await desc.fill(
            "This is a deliberately verbose description used solely to "
            "satisfy the minimum length validation in the publish flow."
        )

        # Continue to Step 2.
        for _ in range(3):
            zone = page.locator('button[aria-label="Upload manuscript file"]')
            if await zone.count() > 0:
                break
            cont = page.get_by_role("button", name="Continue")
            if await cont.count() == 0:
                break
            await cont.first.tap()
            await page.wait_for_timeout(400)


        await page.screenshot(path=str(SCREENSHOTS / "step2_mobile.png"))

        manuscript_zone = 'button[aria-label="Upload manuscript file"]'
        cover_zone = 'button[aria-label="Upload cover image"]'
        manuscript_input = f'{manuscript_zone} ~ input[type="file"], input[type="file"][accept*="pdf"]'
        cover_input = 'input[type="file"][accept*="png"]'

        if await page.locator(manuscript_zone).count() == 0:
            fail("Manuscript dropzone not found on Step 2 — UI regression.")
        if await page.locator(cover_zone).count() == 0:
            fail("Cover dropzone not found on Step 2 — UI regression.")

        # 1 + 2: tapping each dropzone opens the picker.
        await expect_picker_opens(page, manuscript_zone, "Manuscript zone tap")
        await expect_picker_opens(page, cover_zone, "Cover zone tap")

        # 3: accept attributes restrict to the documented extensions.
        await check_accept_attr(
            page, 'input[type="file"][accept*="pdf"]',
            MANUSCRIPT_ACCEPT_REQUIRED, "Manuscript accept",
        )
        await check_accept_attr(
            page, 'input[type="file"][accept*="png"]',
            COVER_ACCEPT_REQUIRED, "Cover accept",
        )

        # 4: client-side validation rejects the wrong type even if the OS
        # picker were bypassed.
        await expect_client_rejects(
            page, 'input[type="file"][accept*="pdf"]',
            "malware.exe", "application/octet-stream",
            "Unsupported", "Manuscript reject .exe",
        )
        await expect_client_rejects(
            page, 'input[type="file"][accept*="png"]',
            "anim.gif", "image/gif",
            "JPG or PNG", "Cover reject .gif",
        )

        await page.screenshot(path=str(SCREENSHOTS / "after_validation.png"))
        await browser.close()
        print("\nAll upload-zone mobile checks passed.")


if __name__ == "__main__":
    asyncio.run(main())
