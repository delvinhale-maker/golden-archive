"""
Android Chrome regression (empty MIME variant): uploading a .docx to the
AI Prompt Pack publish flow must succeed even when the browser reports an
EMPTY string for the file's MIME type.

Some Android Chrome builds — especially when the file is picked from a
downloads / third-party provider — hand the <input type="file"> a File
whose `.type` is "" rather than "application/octet-stream". Both cases
have to be accepted; this spec covers the empty-string case. The generic
octet-stream case is covered by upload-docx-android.spec.py.

Run:
    python3 tests/mobile/upload-docx-android-empty-mime.spec.py

Requires the dev server on http://localhost:8080 and the injected
LOVABLE_BROWSER_SUPABASE_* env vars.
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

ANDROID_CHROME_UA = (
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
)


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def ok(msg: str) -> None:
    print(f"PASS: {msg}")


def build_minimal_docx() -> bytes:
    """Return bytes of a minimal but structurally-valid .docx package."""
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
        '<w:body><w:p><w:r><w:t>Android Chrome empty-mime docx fixture.</w:t></w:r></w:p></w:body>'
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
    await title_input.fill("Android Docx Empty-MIME Prompt Pack")

    desc = page.locator("textarea.inp").first
    await desc.tap()
    await desc.fill(
        "This is a deliberately verbose prompt-pack description whose sole "
        "purpose is to satisfy the minimum length validation on Step 1 of "
        "the publish flow so this empty-MIME regression test can proceed."
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
        await page.screenshot(path=str(SCREENSHOTS / "docx_android_empty_mime_step2.png"))

        manuscript_input = 'input[type="file"][accept*="docx"]'
        if await page.locator(manuscript_input).count() == 0:
            fail("Manuscript file input (accept*='docx') not found on Step 2.")

        docx_bytes = build_minimal_docx()
        filename = "android-empty-mime-fixture.docx"

        # Playwright's set_input_files({...}) forces a MIME string, so to
        # get a real empty File.type we build the DataTransfer/File in the
        # page and dispatch a proper change event on the hidden input.
        await page.evaluate(
            """
            async ({ selector, name, bytesB64 }) => {
              const bin = atob(bytesB64);
              const buf = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
              // Empty-string type — this is the exact Android Chrome case we
              // are regressing against.
              const file = new File([buf], name, { type: "" });
              const input = document.querySelector(selector);
              if (!input) throw new Error("manuscript input not found");
              const dt = new DataTransfer();
              dt.items.add(file);
              input.files = dt.files;
              input.dispatchEvent(new Event("change", { bubbles: true }));
            }
            """,
            {
                "selector": manuscript_input,
                "name": filename,
                "bytesB64": __import__("base64").b64encode(docx_bytes).decode(),
            },
        )

        # 1) No client-side "Unsupported" rejection.
        unsupported = page.get_by_text("Unsupported", exact=False)
        try:
            await expect(unsupported.first).to_be_hidden(timeout=1500)
        except Exception:
            if await unsupported.count() > 0 and await unsupported.first.is_visible():
                fail(
                    ".docx with empty-string MIME was rejected — "
                    "Android Chrome empty-MIME regression is back."
                )
        ok("No 'Unsupported' client-side rejection for empty-MIME .docx")

        # 2) The UploadSuccess block appears with our filename.
        success = page.get_by_text(filename, exact=False)
        try:
            await expect(success.first).to_be_visible(timeout=8000)
        except Exception:
            await page.screenshot(path=str(SCREENSHOTS / "docx_android_empty_mime_fail.png"))
            fail(
                "UploadSuccess did not render with the .docx filename — "
                "empty-MIME .docx was not accepted into the prompt pack flow."
            )
        ok("UploadSuccess renders with the empty-MIME .docx filename")

        # 3) The manuscript zone was swapped out for the success card.
        remaining = await page.locator(
            'button[aria-label="Upload manuscript file"]'
        ).count()
        if remaining > 0:
            fail(
                "Manuscript dropzone is still visible after upload — "
                "success state did not swap in."
            )
        ok("Manuscript dropzone swapped to success state")

        await page.screenshot(path=str(SCREENSHOTS / "docx_android_empty_mime_success.png"))
        await browser.close()
        print("\nAndroid Chrome empty-MIME .docx upload regression: all checks passed.")


if __name__ == "__main__":
    asyncio.run(main())
