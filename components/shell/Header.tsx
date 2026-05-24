"use client";

import { trpc } from "@/lib/trpc/client";
import { useTheme } from "./ThemeProvider";

// The shell header. Client component so the theme toggle, open-task counter,
// and (later) role pill + bell dropdown can all live in one place. The
// counter reads cards.list via tRPC — the same query the board page uses,
// so the React Query cache serves it without a second roundtrip.

export function Header() {
  const { theme, toggle } = useTheme();
  const { data: cards } = trpc.cards.list.useQuery();
  const openCount = cards?.length ?? 0;

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true" />
        <span>ConBon</span>
        <span className="brand-sep" aria-hidden="true">·</span>
        <span className="brand-sub">Project Controls Kanban Board</span>
      </div>

      <div className="topbar-spacer" />

      <div className="topbar-count" aria-live="polite">
        {openCount} open task{openCount === 1 ? "" : "s"}
      </div>

      {/* Role pill placeholder — Phase 7 swaps this for the real role chip. */}
      <span className="role-pill-placeholder" aria-label="Role (sign-in required)">
        Signed-out
      </span>

      {/* Notifications bell placeholder — Phase 10 wires the dropdown. */}
      <button
        type="button"
        className="icon-btn"
        aria-label="Notifications (not yet available)"
        disabled
        title="Notifications arrive in Phase 10"
      >
        <BellIcon />
      </button>

      <button
        type="button"
        className="icon-btn"
        onClick={toggle}
        aria-label={theme === "soft" ? "Switch to dark theme" : "Switch to light theme"}
        title={theme === "soft" ? "Switch to dark theme" : "Switch to light theme"}
      >
        {theme === "soft" ? <MoonIcon /> : <SunIcon />}
      </button>
    </header>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
