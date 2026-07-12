import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  DEFAULT_THEME,
  resolveThemeForPath,
  type ThemeTokens,
} from "./theme-config";

type ThemeOverride = Partial<ThemeTokens> | null;

type ThemeContextValue = {
  /** The theme currently applied to :root (route theme merged with any override). */
  activeTheme: ThemeTokens;
  /**
   * Direct setter kept for backward-compatibility. Prefer setThemeOverride for
   * component-scoped overrides that should unwind on unmount.
   */
  setActiveTheme: (theme: ThemeTokens) => void;
  /**
   * Push a partial theme override on top of the route theme. Pass null to
   * clear. Overrides are shallow-merged over the route theme so callers only
   * need to specify the tokens they care about (e.g. { accentColor }).
   */
  setThemeOverride: (override: ThemeOverride) => void;
  /** Convenience: clear any override, returning to the route theme. */
  clearThemeOverride: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  activeTheme: DEFAULT_THEME,
  setActiveTheme: () => {},
  setThemeOverride: () => {},
  clearThemeOverride: () => {},
});

function applyThemeToRoot(theme: ThemeTokens) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--accent-color", theme.accentColor);
  root.style.setProperty("--gradient-start", theme.gradientStart);
  root.style.setProperty("--gradient-end", theme.gradientEnd);
  root.style.setProperty(
    "--page-gradient",
    `linear-gradient(135deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%)`,
  );
  root.dataset.tab = theme.tabName;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const location = useRouterState({ select: (s) => s.location });
  const routeTheme = useMemo(
    () => resolveThemeForPath(location.pathname, location.search as Record<string, unknown>),
    [location.pathname, location.search],
  );



  const [override, setOverride] = useState<ThemeOverride>(null);
  // Manual setter path (legacy). When callers use setActiveTheme directly we
  // treat it as a full override so route changes don't immediately overwrite it.
  const [manualTheme, setManualTheme] = useState<ThemeTokens | null>(null);

  // Clear manual/override state whenever the route itself changes — the new
  // route's theme should win unless a component re-installs its override.
  useEffect(() => {
    setManualTheme(null);
    setOverride(null);
  }, [routeTheme]);

  const activeTheme = useMemo<ThemeTokens>(() => {
    if (manualTheme) return manualTheme;
    if (override) return { ...routeTheme, ...override };
    return routeTheme;
  }, [routeTheme, override, manualTheme]);

  useEffect(() => {
    applyThemeToRoot(activeTheme);
  }, [activeTheme]);

  const setActiveTheme = useCallback((theme: ThemeTokens) => {
    setManualTheme(theme);
  }, []);
  const setThemeOverride = useCallback((next: ThemeOverride) => {
    setOverride(next);
  }, []);
  const clearThemeOverride = useCallback(() => setOverride(null), []);

  const value = useMemo<ThemeContextValue>(
    () => ({ activeTheme, setActiveTheme, setThemeOverride, clearThemeOverride }),
    [activeTheme, setActiveTheme, setThemeOverride, clearThemeOverride],
  );

  // Declarative CSS variables via a <style> tag guarantees the vars apply
  // even if the imperative documentElement.style write is clobbered by
  // hydration or router transitions.
  const css = `:root{--accent-color:${activeTheme.accentColor};--gradient-start:${activeTheme.gradientStart};--gradient-end:${activeTheme.gradientEnd};--page-gradient:linear-gradient(135deg,${activeTheme.gradientStart} 0%,${activeTheme.gradientEnd} 100%);}`;

  return (
    <ThemeContext.Provider value={value}>
      {/*
        Route-driven CSS vars. The router may transition (e.g. the
        `_authenticated` gate redirecting /dashboard/new → /auth) before
        React's first client commit, so this <style>'s content can legitimately
        differ from what SSR emitted. Suppress React's hydration text-mismatch
        error on this node — the ThemeProvider re-renders on the next tick and
        applyThemeToRoot() also mirrors the vars onto documentElement.
      */}
      <style data-theme-vars={activeTheme.tabName} suppressHydrationWarning>
        {css}
      </style>
      {children}
    </ThemeContext.Provider>
  );
}


export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Component-scoped theme override. Applies the override on mount / when
 * `override` changes and clears it on unmount so the route theme resumes.
 * Pass `null` to opt out on a given render (e.g. when a category is unknown).
 */
export function useThemeOverride(override: ThemeOverride) {
  const { setThemeOverride, clearThemeOverride } = useContext(ThemeContext);
  const key = override
    ? `${override.accentColor ?? ""}|${override.gradientStart ?? ""}|${override.gradientEnd ?? ""}|${override.tabName ?? ""}`
    : "";
  useEffect(() => {
    if (!override) return;
    setThemeOverride(override);
    return () => clearThemeOverride();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
