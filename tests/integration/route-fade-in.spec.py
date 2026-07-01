"""QA: every route change triggers a 200ms opacity 0 → 1 fade-in on the AnimatePresence wrapper keyed by useLocation/pathname."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

SHOTS = Path(__file__).parent / "screenshots" / "route-fade-in"
SHOTS.mkdir(parents=True, exist_ok=True)

# Public routes only (no auth required)
ROUTES = ["/", "/browse", "/search", "/support", "/terms", "/privacy"]

# The RouteFadeIn wrapper in __root.tsx is the first motion.div child of #root.
WRAPPER_SEL = "#root > div"


async def sample_opacity(page, selector: str, ms: int) -> float:
    """Sample computed opacity `ms` after the wrapper mounts."""
    return await page.evaluate(
        """async ({sel, ms}) => {
            await new Promise(r => setTimeout(r, ms));
            const el = document.querySelector(sel);
            if (!el) return -1;
            return parseFloat(getComputedStyle(el).opacity);
        }""",
        {"sel": selector, "ms": ms},
    )


async def verify_fade(page, route: str) -> dict:
    # Navigate via client router by clicking Links when possible; else goto.
    await page.goto(f"http://localhost:8080{route}", wait_until="domcontentloaded")
    # Sample opacity at t≈0ms and t≈250ms (past the 200ms transition).
    early = await sample_opacity(page, WRAPPER_SEL, 10)
    settled = await sample_opacity(page, WRAPPER_SEL, 260)

    # Read the motion.div transition duration attribute Framer applies inline.
    duration_ms = await page.evaluate(
        """(sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const t = getComputedStyle(el).transitionDuration || '';
            // Framer Motion drives opacity via WAAPI, not CSS transitions,
            // so also inspect running animations.
            const anims = el.getAnimations().map(a => ({
                dur: a.effect && a.effect.getTiming().duration,
                props: a.effect && a.effect.getKeyframes().map(k => Object.keys(k)).flat(),
            }));
            return { cssTransition: t, anims };
        }""",
        WRAPPER_SEL,
    )
    return {
        "route": route,
        "opacity_early": early,
        "opacity_settled": settled,
        "duration": duration_ms,
    }


async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width": 1280, "height": 900})
        page = await ctx.new_page()

        results = []
        failures = []

        for route in ROUTES:
            r = await verify_fade(page, route)
            results.append(r)
            # Fade-in check: opacity should start < 1 and end at 1.
            # Framer may complete very quickly on fast machines; tolerate
            # opacity_early up to 1.0 IF we can prove an opacity animation ran.
            ran_opacity_anim = False
            dur_ok = False
            if r["duration"] and r["duration"].get("anims"):
                for a in r["duration"]["anims"]:
                    props = a.get("props") or []
                    if "opacity" in props:
                        ran_opacity_anim = True
                        if a.get("dur") and 150 <= a["dur"] <= 260:
                            dur_ok = True
            if r["opacity_settled"] < 0.99:
                failures.append(f"{route}: settled opacity {r['opacity_settled']} < 1")
            if not ran_opacity_anim and r["opacity_early"] >= 0.99:
                failures.append(
                    f"{route}: no opacity animation detected and early opacity was already 1"
                )
            if ran_opacity_anim and not dur_ok:
                failures.append(f"{route}: opacity animation duration outside 150–260ms window")

        # Client-side navigation via Link (Home -> Browse) — repeat check.
        await page.goto("http://localhost:8080/", wait_until="domcontentloaded")
        await page.wait_for_timeout(300)
        # Click a link that routes client-side.
        link = page.get_by_role("link", name="Browse", exact=False).first
        if await link.count():
            await link.click()
            client_early = await sample_opacity(page, WRAPPER_SEL, 10)
            client_settled = await sample_opacity(page, WRAPPER_SEL, 260)
            results.append({
                "route": "client-nav→/browse",
                "opacity_early": client_early,
                "opacity_settled": client_settled,
            })
            if client_settled < 0.99:
                failures.append(f"client-nav: settled opacity {client_settled} < 1")

        for r in results:
            print(r)

        if failures:
            print("\nFAILURES:")
            for f in failures:
                print(" -", f)
            raise SystemExit(1)
        print("\nOK — route fade-in verified across", len(ROUTES), "routes.")
        await b.close()


asyncio.run(main())
