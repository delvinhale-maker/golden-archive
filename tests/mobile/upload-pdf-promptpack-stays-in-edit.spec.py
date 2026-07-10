"""
Mobile regression: uploading a PDF from the AI Prompt Pack section must
keep the user on the live edit flow (dashboard/new Step 2) and render the
uploaded success state with the filename. This mirrors the .docx stays-in-edit
spec but covers the PDF file type that users also reported failing.

Run:
    python3 tests/mobile/upload-pdf-promptpack-stays-in-edit.spec.py
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
        "(Prompt pack PDF fixture.) Tj\n"
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
    await title_input.fill("Prompt Pack Stays-In-Edit PDF")

    desc = page.locator("textarea.inp").first
    await desc.tap()
    await desc.fill(
        "Deliberately verbose prompt-pack description used to satisfy the "
        "Step 1 minimum-length validation so this mobile regression test "
        "can advance to the manuscript upload step."
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
            viewport={"width": 384, "height": 674},
            device_scale_factor=2.8125,
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

        edit_url_before = page.url
        await advance_to_step_two(page)
        await page.screenshot(path=str(SCREENSHOTS / "promptpack_pdf_stays_step2.png"))

        manuscript_input = 'input[type="file"][accept*="pdf"]'
        if await page.locator(manuscript_input).count() == 0:
            fail("Manuscript file input (accept*='pdf') not found on Step 2.")

        pdf_bytes = build_minimal_pdf()
        filename = "promptpack-stays-in-edit.pdf"

        await page.locator(manuscript_input).first.set_input_files(
            {
                "name": filename,
                "mimeType": PDF_MIME,
                "buffer": pdf_bytes,
            }
        )

        # Let the change handler + any state transitions settle.
        await page.wait_for_timeout(1000)

        # 1) Still on the live edit flow — no silent navigation away.
        if "/dashboard/new" not in page.url:
            fail(
                f"After upload the URL left the live edit flow: {page.url!r} "
                f"(was {edit_url_before!r} before Step 2)."
            )
        ok("URL stayed on /dashboard/new after PDF upload")

        # 2) No client-side "Unsupported" rejection.
        unsupported = page.get_by_text("Unsupported", exact=False)
        try:
            await expect(unsupported.first).to_be_hidden(timeout=1500)
        except Exception:
            if await unsupported.count() > 0 and await unsupported.first.is_visible():
                fail("PDF was rejected as Unsupported on mobile Chrome.")
        ok("No 'Unsupported' client-side rejection")

        # 3) UploadSuccess renders with the filename.
        success = page.get_by_text(filename, exact=False)
        try:
            await expect(success.first).to_be_visible(timeout=8000)
        except Exception:
            await page.screenshot(path=str(SCREENSHOTS / "promptpack_pdf_stays_fail.png"))
            fail(
                "UploadSuccess did not render with the PDF filename — "
                "the file was not accepted into the prompt pack flow."
            )
        ok("UploadSuccess renders with the PDF filename")

        # 4) Manuscript dropzone swapped out for the success card.
        remaining = await page.locator(
            'button[aria-label="Upload manuscript file"]'
        ).count()
        if remaining > 0:
            fail(
                "Manuscript dropzone is still visible after upload — "
                "success state did not swap in."
            )
        ok("Manuscript dropzone swapped to success state")

        await page.screenshot(path=str(SCREENSHOTS / "promptpack_pdf_stays_success.png"))
        await browser.close()
        print("\nPrompt Pack PDF stays-in-edit regression: all checks passed.")


if __name__ == "__main__":
    asyncio.run(main())
