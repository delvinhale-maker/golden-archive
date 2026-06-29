"""
Homepage sparse / empty data regression test.

Stubs the getHomeRows server function response to verify the homepage
degrades gracefully when:
  - Every row is empty (no products approved/published yet)
  - Sponsored has fewer than 2 products (1 only, or none)
  - New Releases has fewer than 3 products (1 or 2 only)

Failure modes this guards against:
  - Orphan "JUST IN" / "SPONSORED — ILLUSTRIOUS CAPITAL™" kickers showing
    above an empty section.
  - A stray "Bestseller" gold badge rendered anywhere on the page when
    no sponsored product exists.
  - New Releases or You May Also Like accidentally inheriting the
    Bestseller badge from the sponsored row.

The stub keeps the real server response envelope (TanStack's devalue-like
{t,i,p,k,v,a} encoding) and only truncates the inner product arrays, so
it survives schema/format tweaks as long as that envelope shape stays.

Run:  python tests/integration/home-rows-empty.spec.py
"""

import asyncio
import json
import sys
from pathlib import Path
from typing import Any
from playwright.async_api import async_playwright, Route, Request

BASE_URL = "http://localhost:8080"
OUT = Path("/tmp/browser/home-rows-empty")
OUT.mkdir(parents=True, exist_ok=True)

SPONSORED_KICKER = "SPONSORED — ILLUSTRIOUS CAPITAL™"
NEW_KICKER = "JUST IN"
RECOMMENDED_HEADING = "You May Also Like"
PROMOTED_HEADING = "Promoted Picks"
NEW_HEADING = "New Releases"

# Identifier baked into the /_serverFn/<base64> URL for getHomeRows.
HOME_ROWS_FN_MARKER = "home-rows.functions"


# --------------------------------------------------------------------------- #
# Response mutation helpers
# --------------------------------------------------------------------------- #
def _find_result_node(envelope: dict) -> dict | None:
    """
    Locate the {newReleases, recommended, sponsored} object inside the
    serialized server-fn payload. Walks the {t,i,p:{k,v}} envelope until it
    finds a node whose keys match the HomeRows shape.
    """
    target = {"newReleases", "recommended", "sponsored"}
    stack: list[Any] = [envelope]
    while stack:
        node = stack.pop()
        if isinstance(node, dict):
            p = node.get("p")
            if isinstance(p, dict) and set(p.get("k", [])) == target:
                return p
            for v in node.values():
                if isinstance(v, (dict, list)):
                    stack.append(v)
        elif isinstance(node, list):
            stack.extend(node)
    return None


def _truncate(body: str, limits: dict[str, int]) -> str:
    """
    Truncate the arrays inside the encoded HomeRows result. `limits` maps
    'newReleases' / 'recommended' / 'sponsored' to a max length (0 = empty).
    Keys not present in `limits` are left untouched.
    """
    envelope = json.loads(body)
    p = _find_result_node(envelope)
    if not p:
        raise RuntimeError("Could not locate HomeRows result node in payload")
    keys: list[str] = p["k"]
    arrays: list[dict] = p["v"]
    for name, n in limits.items():
        idx = keys.index(name)
        arr_node = arrays[idx]
        # arr_node looks like {"t":9,"i":N,"a":[...]} — truncate `a` in place.
        if isinstance(arr_node, dict) and isinstance(arr_node.get("a"), list):
            arr_node["a"] = arr_node["a"][:n]
    return json.dumps(envelope)


async def install_stub(page, limits: dict[str, int]) -> None:
    async def handler(route: Route, request: Request) -> None:
        if HOME_ROWS_FN_MARKER not in request.url and "/_serverFn/" not in request.url:
            await route.continue_()
            return
        # Only intercept the RPC call (POST/GET to /_serverFn/<id>). The
        # marker check above filters out unrelated server fns.
        try:
            response = await route.fetch()
            body = await response.text()
            mutated = _truncate(body, limits)
            await route.fulfill(
                status=response.status,
                headers={
                    "content-type": response.headers.get("content-type", "application/json"),
                },
                body=mutated,
            )
        except Exception as exc:
            print(f"  ! stub failed, passing through: {exc}", file=sys.stderr)
            await route.continue_()

    # Match the home-rows server fn URL — base64 in the path includes the file name.
    await page.route(f"**/_serverFn/**", handler)


# --------------------------------------------------------------------------- #
# DOM probes
# --------------------------------------------------------------------------- #
async def section_exists(page, heading: str) -> bool:
    return await page.locator(f"section:has(h2:has-text('{heading}'))").count() > 0


async def section_card_count(page, heading: str) -> int:
    sec = page.locator(f"section:has(h2:has-text('{heading}'))").first
    if await sec.count() == 0:
        return 0
    # Each card has a /products/$id link; the title-only link is the single
    # line entry. Filter the metadata block (multi-line) out.
    raw = await sec.locator("a[href^='/products/']").all_inner_texts()
    titles = [t.strip() for t in raw if t.strip() and "\n" not in t.strip()]
    return len(titles)


async def page_has_bestseller_badge(page) -> bool:
    # Match the literal DOM text — Bestseller badges render as
    # <span class="bg-gold ...">Bestseller</span>.
    badges = await page.locator("span.bg-gold").all_text_contents()
    return any(b.strip() == "Bestseller" for b in badges)


async def section_has_bestseller_badge(page, heading: str) -> bool:
    sec = page.locator(f"section:has(h2:has-text('{heading}'))").first
    if await sec.count() == 0:
        return False
    badges = await sec.locator("span.bg-gold").all_text_contents()
    return any(b.strip() == "Bestseller" for b in badges)


async def page_contains_text(page, text: str) -> bool:
    return await page.locator(f"text={text}").count() > 0


# --------------------------------------------------------------------------- #
# Scenarios
# --------------------------------------------------------------------------- #
async def scenario_all_empty(page) -> list[str]:
    """All three rows return zero products."""
    fails: list[str] = []
    await install_stub(page, {"newReleases": 0, "recommended": 0, "sponsored": 0})
    await page.goto(BASE_URL, wait_until="networkidle")
    await page.wait_for_timeout(800)
    await page.screenshot(path=str(OUT / "1_all_empty.png"))

    # Sections render `return null` when empty + no `empty` prop, so neither
    # the heading nor the kicker should appear anywhere on the page.
    for heading in (NEW_HEADING, PROMOTED_HEADING, RECOMMENDED_HEADING):
        if await section_exists(page, heading):
            fails.append(f"[all_empty] {heading!r} section should be hidden when empty")
    for kicker in (NEW_KICKER, SPONSORED_KICKER):
        if await page_contains_text(page, kicker):
            fails.append(f"[all_empty] orphan kicker {kicker!r} should not appear")
    if await page_has_bestseller_badge(page):
        fails.append("[all_empty] no Bestseller badge should appear anywhere")
    return fails


async def scenario_sponsored_empty(page) -> list[str]:
    """Sponsored row is empty; new releases + recommended still populated."""
    fails: list[str] = []
    await install_stub(page, {"sponsored": 0})
    await page.goto(BASE_URL, wait_until="networkidle")
    await page.wait_for_timeout(800)
    await page.screenshot(path=str(OUT / "2_sponsored_empty.png"))

    if await section_exists(page, PROMOTED_HEADING):
        fails.append(f"[sponsored_empty] {PROMOTED_HEADING!r} should not render")
    if await page_contains_text(page, SPONSORED_KICKER):
        fails.append(
            f"[sponsored_empty] orphan kicker {SPONSORED_KICKER!r} must not appear"
        )
    if await page_has_bestseller_badge(page):
        fails.append(
            "[sponsored_empty] no Bestseller badge should leak to other rows"
        )
    # Sanity: the other rows still render.
    if not await section_exists(page, NEW_HEADING):
        fails.append(f"[sponsored_empty] {NEW_HEADING!r} should still render")
    return fails


async def scenario_sponsored_single(page) -> list[str]:
    """Sponsored row has 1 product (fewer than the usual 2)."""
    fails: list[str] = []
    await install_stub(page, {"sponsored": 1})
    await page.goto(BASE_URL, wait_until="networkidle")
    await page.wait_for_timeout(800)
    await page.screenshot(path=str(OUT / "3_sponsored_single.png"))

    if not await section_exists(page, PROMOTED_HEADING):
        fails.append(f"[sponsored_single] {PROMOTED_HEADING!r} must still render")
        return fails

    n = await section_card_count(page, PROMOTED_HEADING)
    if n != 1:
        fails.append(
            f"[sponsored_single] expected 1 sponsored card, got {n}"
        )
    # The single sponsored card must still carry the Bestseller badge —
    # exactly once, no phantom badge slots.
    sec = page.locator(f"section:has(h2:has-text('{PROMOTED_HEADING}'))").first
    badges = [
        b.strip()
        for b in await sec.locator("span.bg-gold").all_text_contents()
        if b.strip()
    ]
    if badges != ["Bestseller"]:
        fails.append(
            f"[sponsored_single] expected exactly one 'Bestseller' badge, got {badges}"
        )
    return fails


async def scenario_few_new_releases(page) -> list[str]:
    """New Releases has only 2 products."""
    fails: list[str] = []
    await install_stub(page, {"newReleases": 2})
    await page.goto(BASE_URL, wait_until="networkidle")
    await page.wait_for_timeout(800)
    await page.screenshot(path=str(OUT / "4_new_few.png"))

    if not await section_exists(page, NEW_HEADING):
        fails.append(f"[few_new] {NEW_HEADING!r} must render with sparse data")
        return fails
    n = await section_card_count(page, NEW_HEADING)
    if n != 2:
        fails.append(f"[few_new] expected 2 New Releases cards, got {n}")
    # New Releases must never inherit the Bestseller badge, even when sparse.
    if await section_has_bestseller_badge(page, NEW_HEADING):
        fails.append(f"[few_new] {NEW_HEADING!r} must not show a Bestseller badge")
    # Kicker is still meaningful when populated.
    if not await page_contains_text(page, NEW_KICKER):
        fails.append(f"[few_new] {NEW_KICKER!r} kicker should still render")
    return fails


# --------------------------------------------------------------------------- #
# Driver
# --------------------------------------------------------------------------- #
async def main() -> int:
    failures: list[str] = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            for label, scenario in [
                ("all empty",        scenario_all_empty),
                ("sponsored empty",  scenario_sponsored_empty),
                ("sponsored single", scenario_sponsored_single),
                ("few new releases", scenario_few_new_releases),
            ]:
                # Fresh context per scenario so the route stub and React
                # Query cache start clean.
                ctx = await browser.new_context(viewport={"width": 1280, "height": 2400})
                page = await ctx.new_page()
                print(f"--- scenario: {label} ---")
                try:
                    fails = await scenario(page)
                except Exception as exc:
                    fails = [f"[{label}] crashed: {exc!r}"]
                for f in fails:
                    print("  FAIL:", f)
                failures.extend(fails)
                await ctx.close()
        finally:
            await browser.close()

    print("=== Home row empty-state test ===")
    if failures:
        print(f"{len(failures)} failure(s).")
        return 1
    print("PASS: homepage degrades gracefully with empty / sparse home-row data.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
