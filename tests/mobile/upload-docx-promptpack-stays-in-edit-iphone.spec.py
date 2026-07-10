"""
Mobile regression (iPhone viewport): uploading a .docx from the AI Prompt Pack
section must keep the user on the live edit flow (dashboard/new Step 2) and
render the uploaded success state with the filename.

This is the same scenario as upload-docx-promptpack-stays-in-edit.spec.py but
exercises a different mobile viewport (iPhone 12 Pro / iOS Safari).

Run:
    python3 tests/mobile/upload-docx-promptpack-stays-in-edit-iphone.spec.py
"""

import asyncio
import io
import json
import os
import sys
import zipfile
from pathlib import Path

from playwright.async_api import async_playwright, expect

BASE = "http://localhost:8080"
SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

IPHONE_SAFARI_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
)

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def ok(msg: str) -> None:
    print(f"PASS: {msg}")


def build_minimal_docx() -> bytes:
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        '</Types>'
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="word/document.xml"/>'
        '</Relationships>'
    )
    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:body><w:p><w:r><w:t>Prompt pack docx stays-in-edit fixture on iPhone.</w:t></w:r></w:p></w:body>'
        '</w:document>'
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("word/document.xml", document)
    return buf.getvalue()


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
    await title_input.fill("Prompt Pack Stays-In-Edit Docx iPhone")

    desc = page.locator("textarea.inp").first
    await desc.tap()
    await desc.fill(
        "Deliberately verbose prompt-pack description used to satisfy the "
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
        await page.screenshot(path=str(SCREENSHOTS / "promptpack_docx_iphone_step2.png"))

        manuscript_input = 'input[type="file"][accept*="docx"]'
        if await page.locator(manuscript_input).count() == 0:
            fail("Manuscript file input (accept*='docx') not found on Step 2.")

        docx_bytes = build_minimal_docx()
        filename = "promptpack-stays-in-edit-iphone.docx"

        await page.locator(manuscript_input).first.set_input_files(
            {
                "name": filename,
                "mimeType": DOCX_MIME,
                "buffer": docx_bytes,
            }
        )

        await page.wait_for_timeout(1000)

        if "/dashboard/new" not in page.url:
            fail(
                f"After upload the URL left the live edit flow: {page.url!r} "
                f"(was {edit_url_before!r} before Step 2)."
            )
        ok("URL stayed on /dashboard/new after .docx upload on iPhone viewport")

        unsupported = page.get_by_text("Unsupported", exact=False)
        try:
            await expect(unsupported.first).to_be_hidden(timeout=1500)
        except Exception:
            if await unsupported.count() > 0 and await unsupported.first.is_visible():
                fail(".docx was rejected as Unsupported on iPhone Safari.")
        ok("No 'Unsupported' client-side rejection on iPhone viewport")

        success = page.get_by_text(filename, exact=False)
        try:
            await expect(success.first).to_be_visible(timeout=8000)
        except Exception:
            await page.screenshot(path=str(SCREENSHOTS / "promptpack_docx_iphone_fail.png"))
            fail(
                "UploadSuccess did not render with the .docx filename on iPhone viewport — "
                "the file was not accepted into the prompt pack flow."
            )
        ok("UploadSuccess renders with the .docx filename on iPhone viewport")

        remaining = await page.locator(
            'button[aria-label="Upload manuscript file"]'
        ).count()
        if remaining > 0:
            fail(
                "Manuscript dropzone is still visible after upload on iPhone viewport — "
                "success state did not swap in."
            )
        ok("Manuscript dropzone swapped to success state on iPhone viewport")

        await page.screenshot(path=str(SCREENSHOTS / "promptpack_docx_iphone_success.png"))
        await browser.close()
        print("\nPrompt Pack .docx stays-in-edit iPhone regression: all checks passed.")


if __name__ == "__main__":
    asyncio.run(main())
