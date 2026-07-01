"""QA: route changes trigger a ~200ms opacity 0 → 1 fade-in.

Framer Motion's AnimatePresence in __root.tsx wraps <Outlet /> keyed by
pathname; `initial={false}` skips the very first mount, but every
subsequent navigation should run an exit (opacity 1→0) followed by an
enter (opacity 0→1) on the wrapper `motion.div`.

We verify by monkey-patching `Element.prototype.animate` before navigation
so every WAAPI animation Framer schedules is recorded with its duration
and animated properties, then trigger client-side route changes and
assert an opacity animation of ~200ms fires each time.
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

SHOTS = Path(__file__).parent / "screenshots" / "route-fade-in"
SHOTS.mkdir(parents=True, exist_ok=True)

INSTRUMENT = r"""
() => {
  window.__anims = [];
  const orig = Element.prototype.animate;
  Element.prototype.animate = function (keyframes, options) {
    try {
      const kf = Array.isArray(keyframes) ? keyframes : [keyframes || {}];
      const props = Array.from(new Set(kf.flatMap(k => Object.keys(k || {}))));
      const duration =
        typeof options === 'number'
          ? options
          : (options && options.duration) || null;
      window.__anims.push({ props, duration, at: performance.now() });
    } catch {}
    return orig.apply(this, arguments);
  };
}
"""

# (label, href to click) — target hrefs that exist on the homepage.
NAV_STEPS = [
    ("products", "/products"),
    ("sell", "/sell"),
    ("kingdom-picks", "/kingdom-picks"),
    ("home", "/"),
]


async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width": 1280, "height": 900})
        page = await ctx.new_page()

        await page.goto("http://localhost:8080/", wait_until="domcontentloaded")
        await page.wait_for_timeout(400)
        await page.evaluate(INSTRUMENT)

        failures = []
        results = []

        for label, href in NAV_STEPS:
            # (Re-)instrument in case a full navigation reset the page.
            has_hook = await page.evaluate("!!window.__anims")
            if not has_hook:
                await page.evaluate(INSTRUMENT)
            before = await page.evaluate("window.__anims.length")
            link = page.locator(f'a[href="{href}"]').first
            if not await link.count():
                failures.append(f"{label}: no <a href=\"{href}\"> on page")
                continue
            await link.click()
            await page.wait_for_url(f"**{href}", timeout=5000)
            await page.wait_for_timeout(500)  # past 200ms fade + buffer
            new_anims = await page.evaluate(
                "(n) => (window.__anims || []).slice(n)", before
            )
            opacity_anims = [
                a for a in new_anims if "opacity" in (a.get("props") or [])
            ]
            results.append({"nav": label, "opacity_anims": opacity_anims[:4]})

            if not opacity_anims:
                failures.append(f"{label}: no opacity animation fired on route change")
                continue
            # Expect at least one ~200ms opacity animation (Framer may run
            # both exit and enter; both are 200ms per our transition config).
            in_window = [
                a for a in opacity_anims
                if a.get("duration") and 150 <= a["duration"] <= 260
            ]
            if not in_window:
                failures.append(
                    f"{label}: opacity animation durations {[a.get('duration') for a in opacity_anims]} outside 150–260ms"
                )

        for r in results:
            print(r)

        if failures:
            print("\nFAILURES:")
            for f in failures:
                print(" -", f)
            raise SystemExit(1)
        print(f"\nOK — fade-in verified across {len(NAV_STEPS)} client-side route changes.")
        await b.close()


asyncio.run(main())
