"""
Mobile regression (Android Chrome viewport): uploading a *large* PDF to the
publish flow must

  1. NOT crash / navigate the tab back (the historical mobile OOM bug).
  2. Reach the UploadSuccess state on the same /dashboard/new URL.
  3. Never materialize the whole PDF into a single ArrayBuffer — the
     validator must sniff only the head (%PDF-) and tail (%%EOF) via
     File.slice(...).arrayBuffer().

The third check is the real E2E guard against the mobile OOM regression:
we instrument Blob.prototype.arrayBuffer *before* the file is selected and
record the largest single read. A regression to the old full-file read
path would surface here as a ~50 MB read, even on desktop Chromium where
the tab wouldn't otherwise crash.

Run:
    python3 tests/mobile/upload-pdf-large-slice-guard.spec.py
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

# Large enough that a regression to full-file arrayBuffer() would be
# obvious (50 MB), small enough that Playwright can hand it over via
# set_input_files without stressing the sandbox.
LARGE_PDF_SIZE = 50 * 1024 * 1024

# Anything above this after upload means the validator read the body.
# Legitimate slice reads are 5 bytes (header) + up to 2048 bytes (tail).
MAX_ALLOWED_READ_BYTES = 100 * 1024  # 100 KB — generous ceiling


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def ok(msg: str) -> None:
    print(f"PASS: {msg}")


def build_large_valid_pdf(total_size: int) -> bytes:
    """Return `total_size` bytes that satisfy the validator: starts with
    `%PDF-` and ends with `%%EOF`. The body is a giant PDF comment (%…)
    which is legal PDF syntax and cheap to construct."""
    header = b"%PDF-1.4\n"
    tail = b"\n%%EOF\n"
    padding_len = total_size - len(header) - len(tail)
    if padding_len < 0:
        raise ValueError("total_size too small")
    # A single % line is a legal PDF comment. Newlines every 4KB keep the
    # bytes structurally boring without changing the head/tail markers.
    chunk = (b"%" * 4095) + b"\n"
    reps, rem = divmod(padding_len, len(chunk))
    padding = chunk * reps + (b"%" * rem)
    return header + padding + tail


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


async def install_arraybuffer_probe(page) -> None:
    """Wrap Blob.prototype.arrayBuffer so we can detect a regression to the
    full-file read. File extends Blob, so this covers both."""
    await page.evaluate(
        """
        (() => {
          if (window.__afProbeInstalled) return;
          window.__afMaxRead = 0;
          window.__afCallCount = 0;
          const proto = Blob.prototype;
          const orig = proto.arrayBuffer;
          proto.arrayBuffer = async function () {
            window.__afCallCount += 1;
            if (this && typeof this.size === 'number' && this.size > window.__afMaxRead) {
              window.__afMaxRead = this.size;
            }
            return orig.call(this);
          };
          window.__afProbeInstalled = true;
        })();
        """
    )


async def advance_to_step_two(page) -> None:
    title_input = page.locator("input.inp").first
    await title_input.tap()
    await title_input.fill("Large PDF Slice-Guard Regression")

    desc = page.locator("textarea.inp").first
    await desc.tap()
    await desc.fill(
        "Deliberately verbose prompt-pack description used to satisfy the "
        "Step 1 minimum-length validation so this large-PDF slice-guard "
        "regression test can advance to the manuscript upload step."
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

        # If the tab were to actually crash, the URL leaves /dashboard/new;
        # capture that explicitly for a clearer failure message.
        crashed = {"value": False}
        page.on("crash", lambda _p: crashed.update(value=True))

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
        await install_arraybuffer_probe(page)
        await page.screenshot(path=str(SCREENSHOTS / "large_pdf_step2.png"))

        manuscript_input = 'input[type="file"][accept*="pdf"]'
        if await page.locator(manuscript_input).count() == 0:
            fail("Manuscript file input (accept*='pdf') not found on Step 2.")

        print(f"Building {LARGE_PDF_SIZE // (1024*1024)} MB PDF fixture in memory…")
        pdf_bytes = build_large_valid_pdf(LARGE_PDF_SIZE)
        filename = "large-slice-guard-fixture.pdf"

        await page.locator(manuscript_input).first.set_input_files(
            {
                "name": filename,
                "mimeType": PDF_MIME,
                "buffer": pdf_bytes,
            }
        )

        # Give the validator + upload UI time to react.
        await page.wait_for_timeout(2500)

        # 1) Tab must still be alive and on the edit flow.
        if crashed["value"]:
            fail("The tab crashed after selecting the large PDF (mobile OOM regression).")
        if "/dashboard/new" not in page.url:
            fail(
                f"After large-PDF upload the URL left the live edit flow: "
                f"{page.url!r} (was {edit_url_before!r} before Step 2). "
                "This is the historical 'routes back to Lovable' regression."
            )
        ok("Tab stayed alive on /dashboard/new after large PDF upload")

        # 2) No client-side rejection message.
        for label in ("Unsupported", "truncated", "not a valid PDF"):
            node = page.get_by_text(label, exact=False)
            if await node.count() > 0 and await node.first.is_visible():
                await page.screenshot(path=str(SCREENSHOTS / "large_pdf_rejected.png"))
                fail(f"Large PDF was rejected with visible text: {label!r}")
        ok("No client-side rejection banner for the 50 MB valid PDF")

        # 3) UploadSuccess renders with the filename.
        success = page.get_by_text(filename, exact=False)
        try:
            await expect(success.first).to_be_visible(timeout=15000)
        except Exception:
            await page.screenshot(path=str(SCREENSHOTS / "large_pdf_fail.png"))
            fail(
                "UploadSuccess did not render with the large PDF filename — "
                "the file did not reach the next step."
            )
        ok("UploadSuccess renders with the large PDF filename")

        # Large PDFs should NOT immediately feed the uploaded PDF into pdf.js
        # for thumbnail rendering. That post-upload render path can still OOM
        # mobile browsers even when the validator itself is slice-based.
        loading_thumbs = page.get_by_text("Loading page thumbnails", exact=False)
        if await loading_thumbs.count() > 0 and await loading_thumbs.first.is_visible():
            await page.screenshot(path=str(SCREENSHOTS / "large_pdf_autoload_thumbs.png"))
            fail("Large PDF began loading page thumbnails automatically after upload.")

        try:
            await expect(page.get_by_text("Load thumbnails when needed").first).to_be_visible(timeout=5000)
        except Exception:
            await page.screenshot(path=str(SCREENSHOTS / "large_pdf_missing_manual_thumbs.png"))
            fail("Large PDF did not switch the preview picker into manual thumbnail mode.")
        ok("Large PDF preview thumbnails are manual-only after upload")

        # 4) The mobile OOM guard: the validator must NEVER have materialized
        #    more than a few KB in a single arrayBuffer() call for this file.
        max_read = await page.evaluate("window.__afMaxRead || 0")
        call_count = await page.evaluate("window.__afCallCount || 0")
        print(f"Blob.arrayBuffer() calls: {call_count}, largest read: {max_read} bytes")
        if max_read > MAX_ALLOWED_READ_BYTES:
            fail(
                f"Blob.arrayBuffer() materialized {max_read} bytes in a single "
                f"call (limit {MAX_ALLOWED_READ_BYTES}). The slice-based PDF "
                "validator has regressed — this is the exact call pattern that "
                "OOM-crashes mobile Chrome tabs on large PDFs."
            )
        ok(f"No full-file read: largest Blob.arrayBuffer() was {max_read} bytes")

        await page.screenshot(path=str(SCREENSHOTS / "large_pdf_success.png"))
        await browser.close()
        print("\nLarge PDF slice-guard regression: all checks passed.")


if __name__ == "__main__":
    asyncio.run(main())
