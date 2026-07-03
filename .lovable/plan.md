# Dynamic Color Transition System

Ship a single source of truth for accent colors that swaps smoothly on every route, category, hero slide, and dashboard step — with a 300ms transition on the elements that consume it.

## 1. Theme source of truth

- New file `src/theme/routeThemes.ts` exporting:
  - `ROUTE_THEMES` map (exact keys from the spec, including `/products?category=...` variants).
  - `DASHBOARD_STEP_THEMES` (steps 1–4 → emerald / purple / amber / gold).
  - `HERO_SLIDE_THEMES` (3 slides).
  - `CATEGORY_THEMES` derived from the `?category=` entries, so category pills and product-detail pages resolve the same colors.
  - `DEFAULT_THEME` = gold/navy.
  - `resolveTheme(pathname, search)` helper that matches exact `path+category` first, then pathname, then default.

## 2. ThemeProvider + context

- New `src/theme/ThemeContext.tsx`:
  - `activeTheme: { accentColor, gradientStart, gradientEnd, tabName }`.
  - `setThemeOverride(theme | null)` for imperative overrides (hero carousel, dashboard steps, product detail, category pills that pre-empt navigation).
  - Effect that reads `useRouterState({ select: s => s.location })` (TanStack Router equivalent of `useLocation`), computes the route theme, and — unless an override is active — writes the four CSS custom properties on `document.documentElement`.
  - The provider mounts in `src/routes/__root.tsx` inside the existing shell (does not touch the SSR html/head/body structure).

## 3. Global CSS

- Edit `src/styles.css`:
  - Add `--accent-color`, `--gradient-start`, `--gradient-end` to `:root` with the defaults from the spec.
  - Add `body { background: linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%); transition: background 300ms ease; }` — scoped so it does not fight existing surface tokens.
  - Add utility classes: `.nav-tab-active`, `.btn-primary-accent`, `.card-border-accent`, `.accent-text`, `.section-header-accent`, `.accent-bg`, all with 300ms transitions on the relevant property.
  - Add `.page-fade-in` keyframe (opacity 0 → 1 over 200ms) used by the root outlet wrapper, keyed on `location.pathname + search`.

## 4. Bottom navigation

- Update the bottom-nav component (whichever file currently renders the tab bar — will locate via `rg`):
  - Active icon/text color → `var(--accent-color)` with 300ms transition.
  - Inactive icons → `#6B7280`.
  - Bar background stays `#0F1E35`.
  - Animated underline: absolutely positioned bar under the tab row, translated with CSS transform to the active tab's index (measured via refs), 300ms ease.

## 5. Category pills

- On the products page, tapping a pill:
  - Calls `setThemeOverride(CATEGORY_THEMES[cat])` synchronously so the color updates before navigation settles.
  - Also updates the URL to `/products?category=<cat>` so the route-driven theme matches after navigation, then clears the override.
  - Selected pill uses `.accent-bg`; unselected pills use existing muted style.
- Section-header left borders on that page use `.section-header-accent`.

## 6. Hero carousel

- Auto-advance every 5s (existing behavior kept or added).
- On slide change, call `setThemeOverride(HERO_SLIDE_THEMES[i])`. On unmount / leaving the home route, clear the override so route themes resume.
- Dot indicators: active dot uses `var(--accent-color)`, others muted, 300ms transition.

## 7. Product detail

- Read the product's category, call `setThemeOverride(CATEGORY_THEMES[category])` on mount, clear on unmount.
- Add-to-cart button uses `.btn-primary-accent`; price, star ratings, and section headers use `.accent-text` / `.section-header-accent`.

## 8. Dashboard publish steps

- Wherever the multi-step publish flow lives (dashboard/new), call `setThemeOverride(DASHBOARD_STEP_THEMES[step])` whenever the step changes; clear on unmount.

## 9. Page entry animation

- Wrap `<Outlet />` in `__root.tsx` with a keyed div (`key={location.pathname + location.searchStr}`) that applies `.page-fade-in`. This gives the 200ms fade combined with the 300ms background shift.

## 10. Accent audit

- `rg -n "#B8860B|#b8860b"` across `src/`; replace hardcoded accent uses in components (buttons, badges, section headers, card borders, dots, pill backgrounds) with the new utility classes or `var(--accent-color)`. Leave base navy `#0F1E35` and cream `#F5F0E8` untouched.

## Technical notes

- TanStack Router, not React Router: use `useRouterState({ select: s => s.location })` in place of `useLocation()`. Category comes from `location.search.category`.
- CSS variables are written on `document.documentElement` (`:root`) only in a `useEffect`, so SSR is safe.
- Overrides use a small stack (`useRef<string | null>` per source) so hero → product-detail nested overrides unwind cleanly; last-set wins, cleared on unmount.
- No changes to tokens in `src/index.css` / theme; the new variables are additive so dark-mode semantic tokens are untouched.
- Verification: `bun run build:dev`, then Playwright script that navigates `/ → /products?category=Courses → /products?category=Templates → /wishlist` and reads `getComputedStyle(document.documentElement).getPropertyValue('--accent-color')` at each step, plus a screenshot of the bottom nav underline.

## Files touched (approx.)

```text
new  src/theme/routeThemes.ts
new  src/theme/ThemeContext.tsx
edit src/routes/__root.tsx           (mount provider, keyed outlet)
edit src/styles.css                  (vars, body bg, utility classes, fade keyframe)
edit src/components/**/BottomNav*    (accent + underline)
edit src/components/**/CategoryPills* or products route
edit src/components/**/HeroCarousel*
edit src/routes/products.$id.tsx (or equivalent product detail)
edit dashboard new-listing step component
edit misc components flagged by the #B8860B audit
```
