import {
  createContext,
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

type ThemeContextValue = {
  activeTheme: ThemeTokens;
  setActiveTheme: (theme: ThemeTokens) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  activeTheme: DEFAULT_THEME,
  setActiveTheme: () => {},
});

function applyThemeToRoot(theme: ThemeTokens) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--accent-color", theme.accentColor);
  root.style.setProperty("--gradient-start", theme.gradientStart);
  root.style.setProperty("--gradient-end", theme.gradientEnd);
  root.style.setProperty(
    "--page-gradient",
    `linear-gradient(180deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%)`,
  );
  root.dataset.tab = theme.tabName;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  if (typeof window !== "undefined") {
    (window as unknown as { __tpRenders?: number }).__tpRenders =
      ((window as unknown as { __tpRenders?: number }).__tpRenders ?? 0) + 1;
  }
  const location = useRouterState({ select: (s) => s.location });
  const routeTheme = useMemo(
    () => resolveThemeForPath(location.pathname, location.search as Record<string, unknown>),
    [location.pathname, location.search],
  );
  const [activeTheme, setActiveTheme] = useState<ThemeTokens>(routeTheme);




  // Auto-update theme on route or query change
  useEffect(() => {
    setActiveTheme(routeTheme);
  }, [routeTheme]);

  // Apply CSS custom properties whenever the theme changes
  useEffect(() => {
    applyThemeToRoot(activeTheme);
  }, [activeTheme]);



  const value = useMemo(
    () => ({ activeTheme, setActiveTheme }),
    [activeTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
