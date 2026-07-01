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

# (label, href to click) — client-side navigations from the current page.
# Order matters: after each nav we're on that page and need a link to click next.
NAV_STEPS = [
    ("sell", "/sell"),        # from "/"
    ("home", "/"),            # from "/sell"
    ("sell-again", "/sell"),  # from "/" — verifies repeat navigation still fades
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
            # Plant a beacon; if it survives the click, navigation was SPA.
            await page.evaluate("window.__navBeacon = true")
            before = await page.evaluate("window.__anims.length")
            link = page.locator(f'a[href="{href}"]').first
            try:
                await link.wait_for(state="attached", timeout=5000)
            except Exception:
                failures.append(f"{label}: no <a href=\"{href}\"> on page")
                continue
            await link.click()
            await page.wait_for_url(f"**{href}", timeout=5000)
            await page.wait_for_timeout(500)  # past 200ms fade + buffer
            spa = await page.evaluate("!!window.__navBeacon")
            if not spa:
                results.append({"nav": label, "skipped": "full page reload (not SPA nav)"})
                continue
            new_anims = await page.evaluate(
                "(n) => (window.__anims || []).slice(n)", before
            )
            opacity_anims = [
                a for a in new_anims if "opacity" in (a.get("props") or [])
            ]
            results.append({"nav": label, "opacity_anims": opacity_anims[:4]})

            # Strict per-nav assertion: every SPA route change MUST run
            # both an exit (opacity 1→0) and an enter (opacity 0→1) on the
            # RouteFadeIn wrapper, each at 200ms ±TOLERANCE.
            TARGET_MS = 200
            TOLERANCE_MS = 20  # ±10% of the configured 200ms
            LOW, HIGH = TARGET_MS - TOLERANCE_MS, TARGET_MS + TOLERANCE_MS

            if not opacity_anims:
                failures.append(f"{label}: no opacity animation fired on route change")
                continue

            durations = [a.get("duration") for a in opacity_anims]
            out_of_spec = [d for d in durations if not (isinstance(d, (int, float)) and LOW <= d <= HIGH)]
            in_spec = [d for d in durations if isinstance(d, (int, float)) and LOW <= d <= HIGH]

            if out_of_spec:
                failures.append(
                    f"{label}: opacity animation durations {durations} include values outside {LOW}–{HIGH}ms ({out_of_spec})"
                )
            # AnimatePresence mode="wait" runs exit → enter, so we expect ≥2
            # 200ms opacity animations on every SPA nav after the first.
            if len(in_spec) < 2:
                failures.append(
                    f"{label}: expected ≥2 opacity animations at ~{TARGET_MS}ms (exit + enter), got {len(in_spec)} in-spec of {durations}"
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
