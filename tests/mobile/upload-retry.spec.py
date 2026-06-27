"""
Upload-failure retry test for the publish flow (`/dashboard/new`).

Verifies that BOTH upload zones surface a retryable error UI when the
underlying Supabase Storage upload fails — once as a hard network
interruption (route.abort) and once as a server-side rejection (HTTP 500):

  Scenario A — Cover network interruption
    Intercept POSTs to `/storage/v1/object/product-covers/**` and abort
    them. Trigger the upload via "Save Progress". Confirm:
      - `[data-testid="cover-upload-error"]` banner appears
      - `[data-testid="cover-retry-upload"]` button is visible/enabled
      - Clicking Retry fires another upload attempt
      - Banner persists because the retry also fails

  Scenario B — Manuscript server rejection
    Allow cover uploads through, intercept POSTs to
    `/storage/v1/object/product-files/**` and respond 500. Trigger the
    upload via "Save Progress". Confirm:
      - `[data-testid="manuscript-upload-error"]` banner appears
      - `[data-testid="manuscript-retry-upload"]` button is visible/enabled
      - Clicking Retry fires another upload attempt
      - Banner persists because the retry also fails

Run with:
    python3 tests/mobile/upload-retry.spec.py

Requires the dev server on http://localhost:8080 and the
LOVABLE_BROWSER_SUPABASE_* env vars (managed Supabase session).
"""

import asyncio
import json
import os
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image
from playwright.async_api import async_playwright, expect

BASE = "http://localhost:8080"
SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def ok(msg: str) -> None:
    print(f"PASS: {msg}")


def make_cover_bytes() -> bytes:
    img = Image.new("RGB", (1600, 2560), (12, 26, 51))
    buf = BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


COVER_BYTES = make_cover_bytes()
MANUSCRIPT_BYTES = b"%PDF-1.4\n%fake manuscript bytes for retry test\n%%EOF\n"


async def restore_session(page) -> None:
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    await page.goto(BASE, wait_until="domcontentloaded")
    if not storage_key or not session_json:
        fail(
            "no LOVABLE_BROWSER_SUPABASE_* session injected — "
            "sign in via the Lovable preview and rerun."
        )
    await page.evaluate(
        f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
    )


async def go_to_step2(page) -> None:
    await page.goto(f"{BASE}/dashboard/new", wait_until="domcontentloaded")
    await page.wait_for_load_state("networkidle")
    if "/auth" in page.url:
        fail("Redirected to /auth — no authenticated session.")

    # Dismiss the resume-draft banner if present so we always start fresh.
    fresh_btn = page.get_by_role("button", name="Start Fresh")
    if await fresh_btn.count() > 0:
        try:
            await fresh_btn.first.tap(timeout=1000)
        except Exception:
            pass

    await page.locator("input.inp").first.fill("Retryable Upload Error Test")
    await page.locator("textarea.inp").first.fill(
        "A description long enough to clear the minimum length validation "
        "enforced by the publish flow on Step 1 before continuing."
    )
    await page.get_by_role("button", name="Continue").first.tap()
    await page.wait_for_selector(
        'button[aria-label="Upload manuscript file"]', timeout=5000
    )


async def attach_valid_files(page) -> None:
    await page.locator('input[type="file"][accept*="pdf"]').first.set_input_files(
        {"name": "manuscript.pdf", "mimeType": "application/pdf", "buffer": MANUSCRIPT_BYTES}
    )
    await page.locator('input[type="file"][accept*="png"]').first.set_input_files(
        {"name": "cover.png", "mimeType": "image/png", "buffer": COVER_BYTES}
    )
    # Allow the client-side cover dimension check to resolve.
    await page.wait_for_timeout(1200)


async def run_scenario(
    label: str,
    cover_mode: str,    # "abort" | "500" | "pass"
    file_mode: str,     # "abort" | "500" | "pass"
    error_testid: str,
    retry_testid: str,
    counter_key: str,   # "cover" | "file"
    failure_description: str,
) -> None:
    print(f"\n--- Scenario: {label} ({failure_description}) ---")
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=3,
            is_mobile=True,
            has_touch=True,
        )
        page = await context.new_page()

        counters = {"cover": 0, "file": 0}

        def handler_for(mode: str, key: str):
            async def handler(route):
                # Only count the actual upload POST, not signed-url helpers.
                if route.request.method == "POST":
                    counters[key] += 1
                if mode == "abort":
                    await route.abort("connectionfailed")
                elif mode == "500":
                    await route.fulfill(
                        status=500,
                        content_type="application/json",
                        body=json.dumps({
                            "statusCode": "500",
                            "error": "InternalError",
                            "message": "Simulated storage server rejection.",
                        }),
                    )
                else:
                    await route.continue_()
            return handler

        await page.route(
            "**/storage/v1/object/product-covers/**", handler_for(cover_mode, "cover")
        )
        await page.route(
            "**/storage/v1/object/product-files/**", handler_for(file_mode, "file")
        )

        await restore_session(page)
        await go_to_step2(page)
        await attach_valid_files(page)

        # Trigger uploadAndSave(false) via Save Progress (visible on Step 2).
        await page.get_by_role("button", name="Save Progress").first.tap()

        banner = page.locator(f'[data-testid="{error_testid}"]')
        try:
            await expect(banner).to_be_visible(timeout=10000)
        except Exception:
            await page.screenshot(path=str(SCREENSHOTS / f"fail_{label}_no_banner.png"))
            fail(f"{label}: expected [data-testid='{error_testid}'] retry banner")
        ok(f"{label}: retry banner visible")

        retry_btn = page.locator(f'[data-testid="{retry_testid}"]')
        await expect(retry_btn).to_be_visible(timeout=3000)
        await expect(retry_btn).to_be_enabled(timeout=8000)
        ok(f"{label}: Retry button is enabled")

        attempts_before = counters[counter_key]
        await retry_btn.tap()
        # Give the retry attempt a moment to fire its upload request.
        await page.wait_for_timeout(2500)
        attempts_after = counters[counter_key]
        if attempts_after <= attempts_before:
            await page.screenshot(path=str(SCREENSHOTS / f"fail_{label}_no_retry.png"))
            fail(
                f"{label}: Retry did not trigger another upload attempt "
                f"(before={attempts_before}, after={attempts_after})"
            )
        ok(
            f"{label}: Retry triggered another upload attempt "
            f"({attempts_before} -> {attempts_after})"
        )

        # The intercept is still in place, so the retry also fails and the
        # banner must remain visible (i.e. it really is retryable, not a
        # one-shot toast).
        await expect(banner).to_be_visible(timeout=8000)
        ok(f"{label}: banner persists after failed retry")

        await page.screenshot(path=str(SCREENSHOTS / f"{label}.png"))
        await browser.close()


async def main() -> None:
    # A: cover upload hit by a network interruption.
    await run_scenario(
        label="cover_network_interruption",
        cover_mode="abort",
        file_mode="abort",  # never reached; cover throws first
        error_testid="cover-upload-error",
        retry_testid="cover-retry-upload",
        counter_key="cover",
        failure_description="network interruption (route.abort)",
    )
    # B: manuscript upload hit by a server-side 500. Cover succeeds so the
    # flow reaches the manuscript upload.
    await run_scenario(
        label="manuscript_server_rejection",
        cover_mode="pass",
        file_mode="500",
        error_testid="manuscript-upload-error",
        retry_testid="manuscript-retry-upload",
        counter_key="file",
        failure_description="server rejection (HTTP 500)",
    )
    print("\nAll retryable upload-error checks passed.")


if __name__ == "__main__":
    asyncio.run(main())
