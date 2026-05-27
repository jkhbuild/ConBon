"use client";

import { createContext, useContext } from "react";

// Shared "now" for time-sensitive board renders.
//
// Why this exists: Card / SwimLane / Board's sort all call `new Date()`
// during render to compute the priority chip, aging row, urgent/overdue
// counts, and the within-column priority-desc sort. SSR resolves `now`
// at one instant; the client's first render (hydration) resolves at a
// later instant. If a card sits at an integer-day boundary relative to
// its assignmentDate during that window, `effectivePriority` returns a
// different level on each side and React fires "text content didn't
// match" (#418) for the priority chip's `{level}` text node, the aging
// row's "{daysLeft}d left", or the SwimLane's `{urgentCount}` strong.
//
// The fix is to seed `now` from a server-computed timestamp passed as a
// prop, share it via context, and let an effect tick it forward on the
// client. SSR and the client's first render then agree on the same
// instant; subsequent ticks update the UI through normal re-renders
// (not hydration), so they can't mismatch.
//
// Provider lives at the <Board> root in components/board/Board.tsx —
// having Board own the state lets the same useMemo that does the sort
// also depend on `now` cleanly. Consumers call useBoardClock().

export const BoardClockContext = createContext<Date | null>(null);

export function useBoardClock(): Date {
  const ctx = useContext(BoardClockContext);
  // Fallback for the rare case a consumer renders outside the provider
  // (DragOverlay floater clones happen inside the provider, so this is
  // mostly defensive). Returning `new Date()` reintroduces the SSR/
  // hydration drift risk for that one consumer; logging it would be
  // noisy, so we just fall through.
  if (ctx == null) return new Date();
  return ctx;
}
