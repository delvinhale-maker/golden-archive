"""Authenticated Agent Authority Passport browser suite.

Runs against a dedicated isolated Agent Authority staging backend only.
The suite creates synthetic governance data and never executes external provider actions.

Required:
  BASE_URL (defaults http://localhost:8080)
  LOVABLE_BROWSER_SUPABASE_STORAGE_KEY
  LOVABLE_BROWSER_SUPABASE_SESSION_JSON
Optional deep Action Gate/Approval exercise:
  AGENT_AUTHORITY_E2E_API_KEY
  AGENT_AUTHORITY_E2E_PASSPORT_ID
"""

import asyncio
import json
import os
import sys
import time
from pathlib import Path
from playwright.async_api import async_playwright, expect

BASE = os.environ.get("BASE_URL", "http://localhost:8080").rstrip("/")
ARTIFACTS = Path(__file__).parent / "artifacts"
ARTIFACTS.mkdir(parents=True, exist_ok=True)


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise AssertionError(message)


def ok(message: str) -> None:
    print(f"PASS: {message}")


async def select_option_containing(select, needle: str) -> None:
    options = select.locator("option")
    for index in range(await options.count()):
        option = options.nth(index)
        text = (await option.text_content()) or ""
        if needle in text:
            value = await option.get_attribute("value")
            if value is None:
                fail(f"Option containing {needle!r} has no value")
            await select.select_option(value=value)
            return
    fail(f"No select option contained {needle!r}")


async def restore_session(page) -> None:
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
    if not storage_key or not session_json:
        fail("Missing managed authenticated Supabase browser session")
    if cookies_json:
        cookies = json.loads(cookies_json)
        for cookie in cookies:
            cookie["url"] = BASE
        await page.context.add_cookies(cookies)
    await page.goto(BASE, wait_until="domcontentloaded")
    await page.evaluate(
        "([key, value]) => localStorage.setItem(key, value)",
        [storage_key, session_json],
    )


async def ensure_workspace(page) -> None:
    await page.goto(f"{BASE}/agent-authority", wait_until="domcontentloaded")
    await page.wait_for_load_state("networkidle")
    if "/auth" in page.url:
        fail("Agent Authority route redirected to auth")
    if await page.get_by_role("button", name="Create governance workspace").count():
        name = f"AA E2E {int(time.time())}"
        await page.get_by_label("Business or workspace name").fill(name)
        await page.get_by_role("button", name="Create governance workspace").click()
        await expect(page.get_by_role("button", name="Register Agent").first).to_be_visible(timeout=15000)
        ok("Created isolated synthetic governance workspace")
    else:
        await expect(page.get_by_role("button", name="Register Agent").first).to_be_visible(timeout=15000)
        await expect(page.get_by_test_id("agent-authority-workspace-select")).to_be_visible(timeout=15000)
        ok("Loaded existing test governance workspace")


async def register_passport(page) -> str:
    agent_name = f"E2E Sales Agent {int(time.time())}"
    await page.get_by_role("button", name="Register Agent").first.click()
    await expect(page.get_by_role("heading", name="Register AI Agent")).to_be_visible()
    await page.get_by_placeholder("Agent name").fill(agent_name)
    await page.get_by_placeholder("Human sponsor").fill("Agent Authority E2E Sponsor")
    await page.get_by_placeholder("Provider").fill("test-provider")
    await page.get_by_placeholder("Model").fill("test-model")

    matrix = page.get_by_role("heading", name="2 · Authority Matrix™")
    await expect(matrix).to_be_visible()
    decision_selects = page.locator("section").filter(has_text="Authority Matrix").locator("select")
    if await decision_selects.count() < 1:
        fail("Authority Matrix did not expose explicit decision controls")
    options = await decision_selects.first.locator("option").all_text_contents()
    for required in ["ALLOW", "APPROVAL REQUIRED", "BLOCK"]:
        if required not in options:
            fail(f"Authority Matrix missing {required}")
    await decision_selects.first.select_option("APPROVAL_REQUIRED")
    ok("Authority Matrix exposes all three deterministic states")

    await page.get_by_role("button", name="Create & Authorize").click()
    await expect(page.get_by_text(agent_name, exact=True)).to_be_visible(timeout=20000)
    await expect(page.get_by_text("AUTHORIZED", exact=True).first).to_be_visible()
    ok("Passport creation + authorization rendered in Agent Registry")
    return agent_name


async def exercise_shadow_action_gate(page, agent_name: str) -> None:
    await page.get_by_role("button", name="Simulations").click()
    await expect(page.get_by_role("heading", name="Shadow Mode / Simulation")).to_be_visible()
    passport_select = page.locator("section").filter(has_text="Shadow Mode / Simulation").locator("select").first
    await select_option_containing(passport_select, agent_name)
    await page.get_by_placeholder("action_key").fill("unknown.e2e.action")
    await page.get_by_role("button", name="Simulate only").click()
    await expect(page.get_by_text("NON-EXECUTABLE", exact=True)).to_be_visible(timeout=15000)
    await expect(page.get_by_text("BLOCK", exact=True).first).to_be_visible(timeout=15000)
    ok("Shadow Action Gate fails closed and remains non-executable")


async def deep_action_gate_and_approval(page) -> None:
    api_key = os.environ.get("AGENT_AUTHORITY_E2E_API_KEY")
    passport_id = os.environ.get("AGENT_AUTHORITY_E2E_PASSPORT_ID")
    if not api_key or not passport_id:
        print("SKIP: deep Action Gate/Approval flow requires dedicated staging API key + seeded Passport id")
        return
    response = await page.request.post(
        f"{BASE}/api/agent-authority/action",
        headers={"authorization": f"Bearer {api_key}", "content-type": "application/json"},
        data={
            "passportId": passport_id,
            "actionKey": "email.send",
            "target": "synthetic-e2e@example.invalid",
            "system": "Gmail",
            "externalCommunication": True,
            "idempotencyKey": f"e2e-approval-{int(time.time() * 1000)}",
        },
    )
    if response.status != 200:
        fail(f"Action Gate request failed: HTTP {response.status} {await response.text()}")
    body = await response.json()
    decision = body.get("decision", {}).get("decision") or body.get("decision")
    if decision != "APPROVAL_REQUIRED":
        fail(f"Seeded approval action returned {decision}, expected APPROVAL_REQUIRED")
    await page.get_by_role("button", name="Approvals").click()
    await expect(page.get_by_role("heading", name="Approval Center™")).to_be_visible()
    await expect(page.get_by_text("email.send", exact=True).first).to_be_visible(timeout=15000)
    ok("Real Action Gate created a human approval request")


async def exercise_governance_surfaces(page) -> None:
    for tab, heading in [
        ("Approvals", "Approval Center™"),
        ("Receipts", "AUTHORIZATION RECEIPT™"),
        ("Reviews", "Authority Reviews"),
        ("Policies", "Policy Versioning + Diff"),
        ("Data", "Data Classification"),
        ("Integrations", "API Hardening"),
    ]:
        await page.get_by_role("button", name=tab).click()
        if tab == "Receipts":
            # A fresh workspace may have no receipts; the empty-state text is valid.
            receipt_or_empty = page.get_by_text("Receipts appear after", exact=False)
            if await page.get_by_text(heading, exact=True).count() == 0:
                await expect(receipt_or_empty).to_be_visible()
        else:
            await expect(page.get_by_role("heading", name=heading)).to_be_visible()
    ok("Approval, Receipt, Review, Policy, Data and Integration surfaces render")


async def exercise_exports(page) -> None:
    await page.get_by_role("button", name="Reports").click()
    await expect(page.get_by_role("heading", name="Audit Reports")).to_be_visible()
    async with page.expect_download(timeout=20000) as csv_info:
        await page.get_by_role("button", name="Export CSV").click()
    csv = await csv_info.value
    if not csv.suggested_filename.endswith(".csv"):
        fail("CSV export did not produce a .csv download")
    async with page.expect_download(timeout=20000) as pdf_info:
        await page.get_by_role("button", name="Export PDF").click()
    pdf = await pdf_info.value
    if not pdf.suggested_filename.endswith(".pdf"):
        fail("PDF export did not produce a .pdf download")
    ok("CSV and PDF audit export controls produced downloads")


async def exercise_emergency_suspension(page, agent_name: str) -> None:
    await page.get_by_role("button", name="Agents").click()
    row = page.locator("tr").filter(has_text=agent_name)
    await expect(row).to_be_visible()
    await row.get_by_role("button", name="Suspend").click()
    await expect(page.get_by_role("heading", name="Emergency Suspension")).to_be_visible()
    await page.get_by_placeholder("Mandatory reason").fill("E2E emergency suspension verification")
    await page.get_by_role("button", name="Suspend Agent Authority").click()
    await expect(row.get_by_text("SUSPENDED", exact=True)).to_be_visible(timeout=15000)
    ok("Emergency suspension updates Passport state")


async def main() -> None:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 1100}, accept_downloads=True)
        page = await context.new_page()
        try:
            await restore_session(page)
            await ensure_workspace(page)
            agent_name = await register_passport(page)
            await exercise_shadow_action_gate(page, agent_name)
            await deep_action_gate_and_approval(page)
            await exercise_governance_surfaces(page)
            await exercise_exports(page)
            await exercise_emergency_suspension(page, agent_name)
            await page.screenshot(path=str(ARTIFACTS / "agent-authority-final.png"), full_page=True)
            print("PASS: Agent Authority authenticated browser suite completed")
        except Exception:
            await page.screenshot(path=str(ARTIFACTS / "agent-authority-failure.png"), full_page=True)
            raise
        finally:
            await browser.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:
        print(f"FAIL: {exc}")
        sys.exit(1)
