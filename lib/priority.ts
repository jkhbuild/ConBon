// Priority + date helpers — pure functions ported from
// reference/prototype/data.jsx. Pure means: no React, no Date.now()
// closures, no module state. Anything time-sensitive accepts `now` as
// an argument so component renders are deterministic and tests can pin
// the clock.
//
// The priority scale is 1 (low) → 5 (urgent). `priorityColor` and
// `priorityTint` return CSS-variable references, not raw hex — themes
// re-bind `--p1`..`--p5` so callers stay theme-agnostic.

export const CYCLE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type PriorityLevel = 1 | 2 | 3 | 4 | 5;

// Floor of (b - a) / 1 day. Negative if b is earlier than a.
export function daysBetween(a: Date | number, b: Date | number): number {
  const ams = typeof a === "number" ? a : a.getTime();
  const bms = typeof b === "number" ? b : b.getTime();
  return Math.floor((bms - ams) / DAY_MS);
}

// Auto-priority from the assignment date: 0 days = 1, 14+ days = 5,
// linear in between with ceil. Matches data.jsx autoPriority.
export function autoPriority(
  assignmentDate: Date,
  now: Date = new Date(),
): PriorityLevel {
  const days = Math.max(0, daysBetween(assignmentDate, now));
  const ratio = Math.min(1, days / CYCLE_DAYS);
  const lvl = Math.min(5, Math.max(1, Math.ceil(ratio * 5) || 1));
  return lvl as PriorityLevel;
}

// Manual override wins over the aging curve. Override is stored as a
// raw integer in Postgres; clamp defensively so a stale 0 or 7 doesn't
// crash priorityColor / priorityLabel below.
export function effectivePriority(
  task: { priorityOverride: number | null; assignmentDate: Date },
  now: Date = new Date(),
): PriorityLevel {
  if (task.priorityOverride != null) {
    const clamped = Math.min(5, Math.max(1, task.priorityOverride));
    return clamped as PriorityLevel;
  }
  return autoPriority(task.assignmentDate, now);
}

export function priorityColor(level: PriorityLevel): string {
  return `var(--p${level})`;
}

export function priorityTint(level: PriorityLevel): string {
  return `var(--p${level}-tint)`;
}

const LABELS = ["Low", "Light", "Medium", "High", "Urgent"] as const;
export function priorityLabel(level: PriorityLevel): string {
  return LABELS[level - 1];
}

// "May 18" style — matches the prototype's `formatShort`. The locale
// is pinned so server-rendered HTML and client hydration produce the
// same string regardless of the user's browser locale.
const SHORT_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
export function formatShort(d: Date): string {
  return SHORT_FMT.format(d);
}
