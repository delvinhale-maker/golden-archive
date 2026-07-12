"""
Mobile regression (iPhone viewport): uploading a PDF from the Digital Journal
section must keep the user on the live edit flow (dashboard/new Step 2) and
render the uploaded success state with the filename.

This is the same scenario as upload-pdf-journal-stays-in-edit.spec.py but
exercises a different mobile viewport (iPhone 12 Pro / iOS Safari).

Run:
    python3 tests/mobile/upload-pdf-journal-stays-in-edit-iphone.spec.py
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

IPHONE_SAFARI_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
)

PDF_MIME = "application/pdf"


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def ok(msg: str) -> None:
    print(f"PASS: {msg}")


def build_minimal_pdf() -> bytes:
    """Return a tiny but structurally valid PDF byte stream."""
    body = (
        "%PDF-1.4\n"
        "1 0 obj\n"
        "<< /Type /Catalog /Pages 2 0 R >>\n"
        "endobj\n"
        "2 0 obj\n"
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n"
        "endobj\n"
        "3 0 obj\n"
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\n"
        "endobj\n"
        "4 0 obj\n"
        "<< /Length 44 >>\n"
        "stream\n"
        "BT\n"
        "/F1 12 Tf\n"
        "100 700 Td\n"
        "(Prompt pack PDF fixture on iPhone.) Tj\n"
        "ET\n"
        "endstream\n"
        "endobj\n"
        "xref\n"
        "0 5\n"
        "0000000000 65535 f \n"
        "0000000009 00000 n \n"
        "0000000058 00000 n \n"
        "0000000115 00000 n \n"
        "0000000214 00000 n \n"
        "trailer\n"
        "<< /Size 5 /Root 1 0 R >>\n"
        "startxref\n"
        "308\n"
        "%%EOF\n"
    )
    return body.encode("latin-1")


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
    await title_input.fill("Journal Stays-In-Edit PDF iPhone")

    desc = page.locator("textarea.inp").first
    await desc.tap()
    await desc.fill(
        "Deliberately verbose journal description used to satisfy the "
        "Step 1 minimum-length validation so this iPhone mobile regression "
        "test can advance to the manuscript upload step."
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
            viewport={"width": 390, "height": 844},
            device_scale_factor=3,
            is_mobile=True,
            has_touch=True,
            user_agent=IPHONE_SAFARI_UA,
        )
        page = await context.new_page()

        await restore_supabase_session(page)
        await page.goto(
            f"{BASE}/dashboard/new?type=printable_journal",
            wait_until="domcontentloaded",
        )
        await page.wait_for_load_state("networkidle")

        if "/auth" in page.url:
            fail(
                "Redirected to /auth — no authenticated session. "
                "Sign in via the Lovable preview, then re-run."
            )

        edit_url_before = page.url
        await advance_to_step_two(page)
        await page.screenshot(path=str(SCREENSHOTS / "journal_pdf_iphone_step2.png"))

        manuscript_input = 'input[type="file"][accept*="pdf"]'
        if await page.locator(manuscript_input).count() == 0:
            fail("Manuscript file input (accept*='pdf') not found on Step 2.")

        pdf_bytes = build_minimal_pdf()
        filename = "journal-stays-in-edit-iphone.pdf"

        await page.locator(manuscript_input).first.set_input_files(
            {
                "name": filename,
                "mimeType": PDF_MIME,
                "buffer": pdf_bytes,
            }
        )

        await page.wait_for_timeout(1000)

        if "/dashboard/new" not in page.url:
            fail(
                f"After upload the URL left the live edit flow: {page.url!r} "
                f"(was {edit_url_before!r} before Step 2)."
            )
        ok("URL stayed on /dashboard/new after PDF upload on iPhone viewport")

        unsupported = page.get_by_text("Unsupported", exact=False)
        try:
            await expect(unsupported.first).to_be_hidden(timeout=1500)
        except Exception:
            if await unsupported.count() > 0 and await unsupported.first.is_visible():
                fail("PDF was rejected as Unsupported on iPhone Safari.")
        ok("No 'Unsupported' client-side rejection on iPhone viewport")

        success = page.get_by_text(filename, exact=False)
        try:
            await expect(success.first).to_be_visible(timeout=8000)
        except Exception:
            await page.screenshot(path=str(SCREENSHOTS / "journal_pdf_iphone_fail.png"))
            fail(
                "UploadSuccess did not render with the PDF filename on iPhone viewport — "
                "the file was not accepted into the journal flow."
            )
        ok("UploadSuccess renders with the PDF filename on iPhone viewport")

        remaining = await page.locator(
            'button[aria-label="Upload manuscript file"]'
        ).count()
        if remaining > 0:
            fail(
                "Manuscript dropzone is still visible after upload on iPhone viewport — "
                "success state did not swap in."
            )
        ok("Manuscript dropzone swapped to success state on iPhone viewport")

        await page.screenshot(path=str(SCREENSHOTS / "journal_pdf_iphone_success.png"))
        await browser.close()
        print("\nJournal PDF stays-in-edit iPhone regression: all checks passed.")


if __name__ == "__main__":
    asyncio.run(main())
