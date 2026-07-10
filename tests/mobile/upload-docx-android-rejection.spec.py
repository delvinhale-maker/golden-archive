"""
Mobile rejection-path regression: the AI Prompt Pack publish flow must
show a clear, user-facing rejection message when the manuscript file is
not one of the accepted types (.pdf, .txt, .json, .docx).

Context: the companion specs
  - upload-docx-android.spec.py
  - upload-docx-android-empty-mime.spec.py
  - upload-docx-ios-safari.spec.py
verify that a .docx is ACCEPTED regardless of the browser-reported MIME
(the whole point of the Android Chrome fix). This spec exercises the
other side of that behavior: an obviously unsupported file — an .exe
served with a bogus MIME — must be rejected client-side with the exact
message the component renders:

    Unsupported .exe. Accepted: .PDF, .TXT, .JSON, .DOCX.

Run:
    python3 tests/mobile/upload-docx-android-rejection.spec.py

Requires the dev server on http://localhost:8080 and the injected
LOVABLE_BROWSER_SUPABASE_* env vars.
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

ANDROID_CHROME_UA = (
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
)

# The exact message rendered by handleFileChange in dashboard.new.tsx:
#   `Unsupported .${ext}. Accepted: ${typeCfg.acceptedHint}.`
# For ai_prompt_pack, acceptedHint = ".PDF, .TXT, .JSON, .DOCX".
EXPECTED_MESSAGE = "Unsupported .exe. Accepted: .PDF, .TXT, .JSON, .DOCX."


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def ok(msg: str) -> None:
    print(f"PASS: {msg}")


async def restore_supabase_session(page) -> None:
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

    if cookies_json:
        cookies = json.loads(cookies_json)
        for c in cookies:
            c["url"] = BASE
        await page.context.add_cookies(cookies)

    await page.goto(BASE, wait_until="domcontentloaded")

    if storage_key and session_json:
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
        )
    else:
        print(
            "WARN: no managed Supabase session injected — "
            "authenticated route will redirect to /auth."
        )


async def advance_to_step_two(page) -> None:
    title_input = page.locator("input.inp").first
    await title_input.tap()
    await title_input.fill("Android Docx Rejection Prompt Pack")

    desc = page.locator("textarea.inp").first
    await desc.tap()
    await desc.fill(
        "This is a deliberately verbose prompt-pack description whose sole "
        "purpose is to satisfy the minimum length validation on Step 1 of "
        "the publish flow so this rejection-message regression test can "
        "proceed to the Step 2 manuscript dropzone."
    )

    for _ in range(4):
        zone = page.locator('button[aria-label="Upload manuscript file"]')
        if await zone.count() > 0:
            return
        cont = page.get_by_role("button", name="Continue")
        if await cont.count() == 0:
            break
        await cont.first.tap()
        await page.wait_for_timeout(500)

    fail("Could not reach Step 2 — Continue button never revealed the manuscript zone.")


async def main() -> None:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 412, "height": 915},
            device_scale_factor=2.625,
            is_mobile=True,
            has_touch=True,
            user_agent=ANDROID_CHROME_UA,
        )
        page = await context.new_page()

        await restore_supabase_session(page)
        await page.goto(
            f"{BASE}/dashboard/new?type=ai_prompt_pack",
            wait_until="domcontentloaded",
        )
        await page.wait_for_load_state("networkidle")

        if "/auth" in page.url:
            fail(
                "Redirected to /auth — no authenticated session. "
                "Sign in via the Lovable preview, then re-run."
            )

        await advance_to_step_two(page)
        await page.screenshot(path=str(SCREENSHOTS / "docx_rejection_step2.png"))

        manuscript_input = 'input[type="file"][accept*="docx"]'
        if await page.locator(manuscript_input).count() == 0:
            fail("Manuscript file input (accept*='docx') not found on Step 2.")

        # Obviously unsupported: .exe extension + a bogus MIME the accept
        # attribute would never allow. We bypass the OS picker by writing
        # directly to the hidden input so we exercise the client-side
        # validator (not the browser's accept filter).
        filename = "definitely-not-a-manuscript.exe"
        await page.locator(manuscript_input).first.set_input_files(
            {
                "name": filename,
                "mimeType": "application/x-msdownload",
                "buffer": b"MZ\x90\x00\x03\x00\x00\x00",  # PE/EXE magic header
            }
        )

        # 1) The exact rejection message renders.
        message = page.get_by_text(EXPECTED_MESSAGE, exact=True)
        try:
            await expect(message.first).to_be_visible(timeout=4000)
        except Exception:
            await page.screenshot(path=str(SCREENSHOTS / "docx_rejection_fail.png"))
            fail(
                f"Expected rejection message not shown. Wanted exactly:\n"
                f"  {EXPECTED_MESSAGE}"
            )
        ok(f"Rejection message rendered: {EXPECTED_MESSAGE!r}")

        # 2) The UploadSuccess block did NOT appear (the file must not be
        #    accepted into the prompt pack flow).
        success = page.get_by_text(filename, exact=False)
        if await success.count() > 0 and await success.first.is_visible():
            fail(
                "UploadSuccess rendered with the .exe filename — rejected "
                "file was incorrectly accepted into the prompt pack flow."
            )
        ok("UploadSuccess did NOT render for the rejected .exe")

        # 3) The dropzone is still visible (upload state didn't advance).
        remaining = await page.locator(
            'button[aria-label="Upload manuscript file"]'
        ).count()
        if remaining == 0:
            fail(
                "Manuscript dropzone disappeared after a rejected upload — "
                "rejection UX regression."
            )
        ok("Manuscript dropzone remains visible after rejection")

        await page.screenshot(path=str(SCREENSHOTS / "docx_rejection_success.png"))
        await browser.close()
        print("\nMobile unsupported-file rejection regression: all checks passed.")


if __name__ == "__main__":
    asyncio.run(main())
