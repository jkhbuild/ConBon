"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type Theme = "soft" | "bold";

const STORAGE_KEY = "conbon:theme";
const DEFAULT_THEME: Theme = "soft";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  // On mount, hydrate from localStorage (the pre-paint script in <head>
  // has already set data-theme to the right value, so this just syncs
  // React state with the DOM and avoids re-rendering with a wrong theme).
  useEffect(() => {
    const stored = readStoredTheme();
    if (stored) setThemeState(stored);
  }, []);

  // Reflect changes to the DOM + localStorage.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* private mode / quota — ignore */
    }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggle = useCallback(
    () => setThemeState((t) => (t === "soft" ? "bold" : "soft")),
    [],
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

function readStoredTheme(): Theme | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "soft" || v === "bold" ? v : null;
  } catch {
    return null;
  }
}

// Inline script injected into <head> by app/layout.tsx so the data-theme
// attribute is set before first paint. Reading localStorage from a blocking
// script eliminates the dark/light flash on reload.
export const themeInitScript = `
(function () {
  try {
    var k = '${STORAGE_KEY}';
    var v = localStorage.getItem(k);
    var t = v === 'bold' ? 'bold' : 'soft';
    document.documentElement.dataset.theme = t;
  } catch (e) {
    document.documentElement.dataset.theme = '${DEFAULT_THEME}';
  }
})();
`.trim();
