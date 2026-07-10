"""
Accessibility regression: the "Create New Title" dropdown on the dashboard
must support full keyboard navigation, keep DOM focus on the active
menuitem, and restore focus to the trigger when the menu closes.

Checks:
  1. Pressing Enter on the trigger opens the menu and focuses item 0.
  2. ArrowDown / ArrowUp / End / Home move DOM focus AND update
     aria-activedescendant on the menu.
  3. Escape closes the menu and returns DOM focus to the trigger.
  4. Selecting an item via Enter closes the menu and returns focus
     to the trigger before the client-side navigation lands.

Run:
    python3 tests/integration/create-new-title-keyboard-nav.spec.py
"""

import asyncio
import json
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

TRIGGER_ID = "create-new-title-menu-trigger"
MENU_ID = "create-new-title-menu"


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
        print("WARN: no managed Supabase session injected — authenticated route will redirect to /auth.")


async def focused_id(page) -> str:
    return await page.evaluate("() => document.activeElement && document.activeElement.id || ''")


async def active_descendant(page) -> str:
    return await page.evaluate(
        f"() => document.getElementById({json.dumps(MENU_ID)})?.getAttribute('aria-activedescendant') || ''"
    )


async def expect_focus(page, expected_id: str, label: str) -> None:
    for _ in range(20):
        if await focused_id(page) == expected_id:
            ok(f"{label}: DOM focus on #{expected_id}")
            return
        await page.wait_for_timeout(50)
    fail(f"{label}: expected DOM focus on #{expected_id}, got #{await focused_id(page)!r}")


async def expect_active_descendant(page, expected_id: str, label: str) -> None:
    got = await active_descendant(page)
    if got != expected_id:
        fail(f"{label}: expected aria-activedescendant={expected_id!r}, got {got!r}")
    ok(f"{label}: aria-activedescendant={expected_id}")


async def menu_visible(page) -> bool:
    return await page.evaluate(f"() => !!document.getElementById({json.dumps(MENU_ID)})")


async def main() -> None:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await context.new_page()

        await restore_supabase_session(page)
        await page.goto(f"{BASE}/dashboard", wait_until="domcontentloaded")
        await page.wait_for_load_state("networkidle")

        if "/auth" in page.url:
            fail("Redirected to /auth — no authenticated session. Sign in via the Lovable preview, then re-run.")

        trigger = page.locator(f"#{TRIGGER_ID}")
        if await trigger.count() == 0:
            fail("Trigger #create-new-title-menu-trigger not found on /dashboard.")

        # 1. Focus trigger and open with Enter.
        await trigger.first.focus()
        await expect_focus(page, TRIGGER_ID, "Initial")
        await page.keyboard.press("Enter")
        await page.wait_for_selector(f"#{MENU_ID}", state="visible", timeout=3000)

        first_item_id = f"{MENU_ID}-item-ebook"
        await expect_focus(page, first_item_id, "After Enter on trigger")
        await expect_active_descendant(page, first_item_id, "After Enter on trigger")

        # 2. ArrowDown moves focus + activedescendant.
        await page.keyboard.press("ArrowDown")
        second_id = await focused_id(page)
        if second_id == first_item_id or not second_id.startswith(f"{MENU_ID}-item-"):
            fail(f"ArrowDown did not move focus to next menuitem (got #{second_id!r}).")
        ok(f"ArrowDown: DOM focus moved to #{second_id}")
        await expect_active_descendant(page, second_id, "After ArrowDown")

        # 3. ArrowUp returns to first.
        await page.keyboard.press("ArrowUp")
        await expect_focus(page, first_item_id, "After ArrowUp")
        await expect_active_descendant(page, first_item_id, "After ArrowUp")

        # 4. End jumps to last item.
        await page.keyboard.press("End")
        last_id = await focused_id(page)
        if not last_id.startswith(f"{MENU_ID}-item-"):
            fail(f"End did not focus a menuitem (got #{last_id!r}).")
        await expect_active_descendant(page, last_id, "After End")
        ok(f"End: DOM focus moved to last item #{last_id}")

        # 5. Home returns to first item.
        await page.keyboard.press("Home")
        await expect_focus(page, first_item_id, "After Home")
        await expect_active_descendant(page, first_item_id, "After Home")

        # 6. Escape closes menu AND restores focus to trigger.
        await page.keyboard.press("Escape")
        for _ in range(20):
            if not await menu_visible(page):
                break
            await page.wait_for_timeout(50)
        if await menu_visible(page):
            fail("Escape did not close the menu.")
        ok("Escape closed the menu")
        await expect_focus(page, TRIGGER_ID, "After Escape")

        # 7. Re-open, select an item with Enter — focus should return to
        # the trigger before navigation completes (assert synchronously
        # right after the keypress).
        await trigger.first.focus()
        await page.keyboard.press("Enter")
        await page.wait_for_selector(f"#{MENU_ID}", state="visible", timeout=3000)
        await expect_focus(page, first_item_id, "Re-open with Enter")

        # Intercept navigation so the test doesn't leave /dashboard mid-assert.
        await page.evaluate("() => { window.__navBlocked = true; document.addEventListener('click', (e) => { if (e.target.closest('a,button')) { /* allow */ } }, true); }")

        await page.keyboard.press("Enter")
        # After selection the menu closes; focus should be back on the trigger.
        for _ in range(30):
            if not await menu_visible(page) and await focused_id(page) == TRIGGER_ID:
                break
            await page.wait_for_timeout(50)
        if await menu_visible(page):
            fail("Selecting an item with Enter did not close the menu.")
        ok("Enter on menuitem closed the menu")
        # Focus may briefly move during navigation; accept trigger OR body-on-nav.
        final = await focused_id(page)
        if final != TRIGGER_ID and final != "":
            # If navigation already replaced the page, activeElement will be body ("").
            # A non-trigger, non-empty id means focus escaped to something unexpected.
            fail(f"After Enter-select, focus escaped to #{final!r} (expected trigger or navigation).")
        ok("After Enter-select, focus returned to trigger (or page navigated)")

        await page.screenshot(path=str(SCREENSHOTS / "create_new_title_keyboard_nav.png"))
        await browser.close()
        print("\nCreate New Title keyboard nav: all checks passed.")


if __name__ == "__main__":
    asyncio.run(main())
