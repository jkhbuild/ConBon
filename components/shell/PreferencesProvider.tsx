"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { trpc } from "@/lib/trpc/client";

// PreferencesProvider — single owner of theme + layout for the whole app.
//
// Two modes, selected by whether the server passed `initial`:
//   - signed-in (initial != null): state is initialized from the DB row
//     via getServerCaller().prefs.get() in root layout. Toggles update
//     state, write through to DOM + localStorage, and debounce-write to
//     UserPreference via trpc.prefs.set.
//   - signed-out (initial == null): state is initialized from the
//     localStorage cache. Toggles update state and write through to DOM
//     + localStorage only — no DB writes. This is the /signin path.
//
// Why everything in one provider, owned at root, instead of a separate
// ThemeProvider (localStorage) + Bridge (DB reconciliation) split:
// the split version hit a React 19 effect-ordering trap where the
// write-back useEffect from render 1 fired with the stale ThemeProvider-
// default theme value before the useLayoutEffect-triggered re-render
// landed, propagating a spurious DB write that overwrote the DB with
// the default state. Unifying ownership in one component means the
// state initializer runs once with the authoritative value and there
// is no reconciliation race to coordinate.
//
// SSR + the pre-paint script: the inline script in <head> sets
// data-theme synchronously from localStorage so we don't flash on
// reload. State initializer here picks up `initial.theme` on the server
// for signed-in users (so React state matches what we want post-paint).
// If localStorage and DB disagree, the post-hydration useEffect that
// writes data-theme corrects the DOM within one frame — a one-frame
// flicker, which is the floor for "DB is authoritative across devices".

export type Theme = "soft" | "bold";
export type BoardLayout = "columns" | "swimlanes";

// Exported so the root layout's pre-paint script can target the same
// storage key. Centralizing it here keeps the cache invariant in one
// file with the state owner.
export const THEME_STORAGE_KEY = "conbon:theme";
const DEFAULT_THEME: Theme = "soft";
const DEFAULT_LAYOUT: BoardLayout = "columns";

const WRITE_DEBOUNCE_MS = 500;

export type InitialPreferences = {
  theme: Theme;
  layout: BoardLayout;
};

type ContextValue = {
  theme: Theme;
  layout: BoardLayout;
  setTheme: (next: Theme) => void;
  toggleTheme: () => void;
  setLayout: (next: BoardLayout) => void;
};

const PreferencesContext = createContext<ContextValue | null>(null);

type Props = {
  // null when no signed-in viewer — the provider falls back to
  // localStorage-only mode. Caller decides; see app/layout.tsx.
  initial: InitialPreferences | null;
  children: ReactNode;
};

export function PreferencesProvider({ initial, children }: Props) {
  // Initialize state from the server-provided DB value (signed-in) or
  // the schema defaults (signed-out — localStorage hydration happens in
  // an effect below since localStorage isn't readable during SSR).
  const [theme, setThemeState] = useState<Theme>(() => initial?.theme ?? DEFAULT_THEME);
  const [layout, setLayoutState] = useState<BoardLayout>(
    () => initial?.layout ?? DEFAULT_LAYOUT,
  );

  // Signed-out hydration: pick up the localStorage cache once on mount
  // so the toggle reflects whatever the pre-paint script applied. Gated
  // on `initial` so signed-in users aren't second-guessed by their own
  // device's cache.
  useEffect(() => {
    if (initial) return;
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "soft" || stored === "bold") setThemeState(stored);
    } catch {
      /* private mode / quota — ignore */
    }
  }, [initial]);

  // Reflect theme to DOM + localStorage on every change. data-theme is
  // what globals.css keys off; localStorage is the pre-paint cache.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  // Debounced DB write. Pending patches merge so a theme-then-layout
  // sequence inside the window posts as one mutation.
  const setMutation = trpc.prefs.set.useMutation();
  const setMutationRef = useRef(setMutation);
  setMutationRef.current = setMutation;

  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ theme?: Theme; layout?: BoardLayout }>({});

  const queueWrite = useCallback(
    (patch: { theme?: Theme; layout?: BoardLayout }) => {
      pendingRef.current = { ...pendingRef.current, ...patch };
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
      writeTimerRef.current = setTimeout(() => {
        const payload = pendingRef.current;
        pendingRef.current = {};
        writeTimerRef.current = null;
        if (payload.theme === undefined && payload.layout === undefined) return;
        setMutationRef.current.mutate(payload);
      }, WRITE_DEBOUNCE_MS);
    },
    [],
  );

  // Track the last value we either received from the DB or wrote to it.
  // Skip the write-back when the in-memory state equals it — covers
  // both "we just wrote this" and "this is the initial DB value".
  const lastSyncedThemeRef = useRef<Theme>(initial?.theme ?? DEFAULT_THEME);
  const lastSyncedLayoutRef = useRef<BoardLayout>(initial?.layout ?? DEFAULT_LAYOUT);

  // Write-back: theme. Only active when signed-in (initial provided).
  useEffect(() => {
    if (!initial) return;
    if (theme === lastSyncedThemeRef.current) return;
    lastSyncedThemeRef.current = theme;
    queueWrite({ theme });
  }, [theme, queueWrite, initial]);

  // Write-back: layout. Same shape.
  useEffect(() => {
    if (!initial) return;
    if (layout === lastSyncedLayoutRef.current) return;
    lastSyncedLayoutRef.current = layout;
    queueWrite({ layout });
  }, [layout, queueWrite, initial]);

  // Flush pending writes on unmount (sign-out / navigation). The
  // mutation is fire-and-forget — if it 401s post-sign-out, React Query
  // swallows it.
  useEffect(() => {
    return () => {
      if (writeTimerRef.current) {
        clearTimeout(writeTimerRef.current);
        writeTimerRef.current = null;
        const payload = pendingRef.current;
        pendingRef.current = {};
        if (payload.theme !== undefined || payload.layout !== undefined) {
          setMutationRef.current.mutate(payload);
        }
      }
    };
  }, []);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = useCallback(
    () => setThemeState((t) => (t === "soft" ? "bold" : "soft")),
    [],
  );
  const setLayout = useCallback((next: BoardLayout) => setLayoutState(next), []);

  const value = useMemo<ContextValue>(
    () => ({ theme, layout, setTheme, toggleTheme, setLayout }),
    [theme, layout, setTheme, toggleTheme, setLayout],
  );

  return (
    <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
  );
}

// Primitive selectors. Components import these instead of a single
// "useAll" hook so re-render bailout works at the value granularity
// each consumer actually depends on. Matches the uiStore selector
// pattern (useDraggingCardId etc.).

export function useTheme(): {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
} {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("useTheme must be used inside <PreferencesProvider>");
  return { theme: ctx.theme, setTheme: ctx.setTheme, toggle: ctx.toggleTheme };
}

export function useBoardLayout(): BoardLayout {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("useBoardLayout must be used inside <PreferencesProvider>");
  return ctx.layout;
}

export function useSetBoardLayout(): (next: BoardLayout) => void {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("useSetBoardLayout must be used inside <PreferencesProvider>");
  return ctx.setLayout;
}

// Inline pre-paint script injected into <head> by the root layout.
// Reads localStorage and sets data-theme synchronously before first
// paint so we don't flash the wrong palette on reload.
export const themeInitScript = `
(function () {
  try {
    var k = '${THEME_STORAGE_KEY}';
    var v = localStorage.getItem(k);
    var t = v === 'bold' ? 'bold' : 'soft';
    document.documentElement.dataset.theme = t;
  } catch (e) {
    document.documentElement.dataset.theme = '${DEFAULT_THEME}';
  }
})();
`.trim();
