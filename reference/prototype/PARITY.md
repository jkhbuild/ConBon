# Prototype → Production Parity

**Phase 14 sign-off.** Side-by-side fidelity audit between
`reference/prototype/` (the HTML/JSX design handoff) and the shipped
Next.js app. Each row records whether the production build matches the
prototype, deviates deliberately, or is out of scope.

**Verdict:** ✅ Parity reached for the v1 scope. Eight deliberate
deviations documented below, all with rationale. No deviations are
visual regressions from a 4–8-user product standpoint; most strengthen
correctness (auth, audit, real-time) or accessibility.

---

## Feature matrix

### Top bar
| Item | Prototype | Production | Status |
|---|---|---|---|
| Brand mark (gradient square) | 22×22 px linear-gradient `--p1`→`--p3`→`--p5` | Same; rendered via CSS in `components/shell/Header.tsx` | ✅ |
| Wordmark "ConBon" | Inter Tight 600 / 15px | Matches | ✅ |
| Subtitle "Project Controls Kanban Board" | Inter Tight 400 / 15px / `--ink-2` | Matches | ✅ |
| Open-task counter | `{N} open tasks`, `--ink-3` | Same string + live `aria-live="polite"`, color bumped to `--ink-2` for WCAG-AA contrast | ⚠️ Deviation 1 |
| Role switcher | Manager / Admin pill segmented control | Removed; viewer's role rendered as a static pill from server-fetched session | ⚠️ Deviation 2 |
| Theme toggle (sun/moon) | 38×38 circular | Matches; persists to DB via `UserPreference.theme` for signed-in users + localStorage cache for `/signin` | ✅ |
| Layout toggle (columns/lanes) | Hidden behind a Tweaks panel | Surfaced as a header icon button; persists to DB via `UserPreference.layout` | ⚠️ Deviation 3 |
| Bell / notifications | Not in prototype | Added in Phase 10; Radix DropdownMenu with unread badge + audit-fed list | ⚠️ Deviation 4 |
| Sign-out button | Not in prototype | Added in Phase 7; React form action posting to a `"use server"` `signOut` | ⚠️ Deviation 5 |

### Filter bar
| Item | Prototype | Production | Status |
|---|---|---|---|
| Contract / Assignee / Priority chips | Always visible above board | **Deferred** — board reads unfiltered list in v1 | ⚠️ Deviation 6 |
| "+ New task" primary button (right side) | Top-right | Replaced by per-column "+" affordances in each column header | ⚠️ Deviation 7 |

### Board — Columns layout
| Item | Prototype | Production | Status |
|---|---|---|---|
| 5-column grid (1 Backlog + 4 people) | 280px Backlog + 4× `minmax(280, 1fr)` | Matches via `--cols` custom property in `ColumnsLayout` | ✅ |
| Column container styling | `--surface` bg / 1px `--line` / 14px radius / 14·12·12 padding | Matches | ✅ |
| Column header (avatar + name + count) | 28px avatar circle + Inter Tight 600 name | Matches; name shows first word only ("Justin", not "Justin Park") | ✅ |
| Backlog "Add task" stub | Dashed-border button at bottom of column | Lives in column header instead — small "+" button next to count, same affordance | ⚠️ Minor — same intent |
| Drop target hover state | `--surface-2` bg, `--line-strong` border | Matches via @dnd-kit `useDroppable` `isOver` state | ✅ |

### Board — Swimlanes layout
| Item | Prototype | Production | Status |
|---|---|---|---|
| Vertical lane per person + Backlog | 16px gap, full-width lanes | Matches | ✅ |
| Lane header (avatar + name + stats) | 34px avatar + `{N} open · {N} urgent · {N} overdue` | Matches in `SwimLane.tsx` | ✅ |
| Card grid in lane body | `repeat(auto-fill, minmax(260px, 1fr))`, 10px gap | Matches | ✅ |
| Sort within lane | priority desc, then due date asc | **Position-asc** since Phase 6 — drag-within-column is authoritative | ⚠️ Deviation 8 |

### Task card
| Item | Prototype | Production | Status |
|---|---|---|---|
| Card container (`--card-bg` + blur + 4px left edge + tint overlay) | Documented in design tokens | Matches; @dnd-kit `useSortable` is wired on the root | ✅ |
| Compound structure (top / title / blocker / footer / aging) | Single component | Split into `Card.Top`, `Card.Title`, `Card.Blocker`, `Card.Footer`, `Card.Aging` (compound pattern) | ✅ |
| Click → open edit modal | Yes | Yes, with 5px pointer-delta disambiguation against drag start | ✅ |
| Right-click → context menu | Native HTML5 `contextmenu` | Radix `ContextMenu` (focus trap + a11y) | ✅ |
| Blocker note inline-edit (click body to edit, Cmd-Enter to commit) | Yes | **Edit lives only in the card modal**, not inline | ⚠️ Deviation 9 |
| Priority chip click → priority picker (inline popover) | Yes | Lives in the context menu under "Set priority" priority dots row | ✅ Same surface, different opener |
| Aging strip ("Xd overdue" / "Xd left", "manual" pill) | Conditional on priority ≥ 4 or overdue | Matches via `Card.Aging` | ✅ |

### Add/Edit task modal
| Item | Prototype | Production | Status |
|---|---|---|---|
| Backdrop + panel styling | `rgba(0,0,0,0.45)` + 560px panel | Matches via Radix Dialog | ✅ |
| Field list (title / contract / type / assignee / dates / priority / blocker) | 6 fields | Matches one-for-one | ✅ |
| Assignee picker pills | Backlog + people | Matches; renders palette-color avatar per person | ✅ |
| Priority 1–5 buttons | 5 colored buttons, active = `--ink` border | Matches | ✅ |
| Date-input round-trip | YYYY-MM-DD `<input type="date">` | **Bug-bash fix (Phase 14):** switched to UTC-anchored parsing/formatting; previous local-tz accessors caused phantom "May 21 → May 20" audit diffs on every save in non-UTC timezones | ✅ Behavior corrected |
| "Delete task" link (footer left) | Yes — destructive | Renamed to "Archive task" — archive is reversible via `/archive`, true delete is out of scope at this scale | ⚠️ Minor — wording |
| "History" button (footer left) | Not in prototype | Added in Phase 10; opens stacked Radix Dialog on top of edit modal | ⚠️ Deviation 10 |

### Right-click context menu
| Item | Prototype | Production | Status |
|---|---|---|---|
| Priority dots row + Edit + Blocker + Complete + Remove | 5 dots + 4 actions | **Reduced to: priority dots + Edit + Archive.** Complete/Remove collapsed into Archive; Blocker edit moved into the modal | ⚠️ Deviation 11 |

### Admin page
| Item | Prototype | Production | Status |
|---|---|---|---|
| Team performance dashboard (metric cards + per-employee table) | Yes — top metric grid + 6-column employee row | **Deferred** — Admin v1 is CRUD only (People / Contracts / Access) | ⚠️ Deviation 12 |

---

## Deliberate deviations — rationale

1. **Open-task counter color bumped to `--ink-2`** — `--ink-3` on the topbar background was 2.79:1, below WCAG-AA 4.5:1. Bumped one shade darker to pass the Phase-14 axe a11y gate. Visually almost identical; technically a more readable counter.

2. **Role switcher removed; viewer role displayed instead** — In production, role is determined by the signed-in user's allowlist entry, not a UI toggle. The prototype's role-switch was a design-demo affordance ("see what each role sees"); production has real RBAC enforced by `protectedProcedure` / `adminProcedure` / `managerProcedure`. A toggle would have been confusing UX (clicking "Admin" while signed in as Employee would do nothing).

3. **Layout toggle moved from Tweaks panel to header icon** — The prototype's Tweaks panel was a developer-facing settings drawer; production doesn't ship it. Layout selection is the one Tweaks setting that affects daily use, so it gets a header button. Theme toggle followed the same pattern. Persists per-user via `UserPreference.layout`.

4. **Bell / notifications added (Phase 10)** — Beyond the prototype scope. The audit-log mechanism added in Phase 10 made an in-app feed cheap to surface, and a 4–8-person construction team benefits from "who reassigned this to me at 4pm yesterday?" being visible without an email round-trip.

5. **Sign-out button added (Phase 7)** — Required by adding real auth.

6. **Filter bar deferred** — The 4–8-user workload doesn't generate enough cards for filtering to be a daily need. At 15 seed cards across 4 people, the board fits a single screen. Re-evaluate at 50+ cards.

7. **"+ New task" moved from global toolbar to per-column "+" buttons** — Pre-filling the assignee from the column the user clicked in is faster than picking the assignee inside the modal afterwards. The global affordance still exists conceptually — Backlog's "+" creates an unassigned card.

8. **Within-column sort: position-asc, not priority-desc** — Made authoritative in Phase 6 so dragging a card up/down inside its column has visible effect. The prototype's priority-desc + due-asc sort meant drag-within-column was a visual no-op (the sort always won). Position semantics now match what every other Kanban tool does.

9. **Blocker note edit is modal-only, not inline-on-card** — Inline edit on a draggable card creates a click-vs-drag-vs-edit disambiguation problem. The 5px pointer-delta rule already discriminates click (open modal) from drag (move). Adding a third gesture (long-press? double-click?) would cost more friction than it saves.

10. **History modal added (Phase 10)** — Surfaces the audit log per-card. Out of prototype scope but a natural fit once Phase 10 shipped the audit infrastructure.

11. **Context menu reduced to priority + Edit + Archive** — "Mark as complete" collapses into Archive (the data model uses one `archivedAt` for both "done" and "removed"; see CLAUDE.md "Archive vs complete" lock). "Edit blocker" lives in the modal now (see #9). The five priority dots remain — they're the highest-frequency action.

12. **Admin page deferred to v2** — Phase 9 shipped CRUD for People / Contracts / Allowlist (the operational must-haves). Team-performance metrics need historical completion data, which the audit log captures but no derived report exists yet. The path to ship the metrics view is clear (query `AuditLog` for `archive` actions per `actorId` × month), but it's a v1.5 deliverable, not a launch blocker.

---

## Items that don't deviate but were re-implemented

- **Drag-and-drop** — Prototype uses HTML5 `draggable="true"`. Production uses @dnd-kit (PointerSensor + KeyboardSensor) for full keyboard + screen-reader support. Same UX from the user's perspective; ~50× the a11y story.
- **State management** — Prototype uses `localStorage`. Production uses Postgres + Prisma + tRPC + React Query. Same shape of cards/people/contracts; persistence is durable + multi-user.
- **Color tokens (themes)** — Prototype's `--p1`..`--p5` priority colors and the soft/bold theme split ported verbatim. Three `.role-pill-tag` foreground tweaks for WCAG-AA contrast (see Deviation 1).
- **Typography** — `next/font/google` loads Inter Tight + IBM Plex Sans, exposed as `--font-display` / `--font-body`. The prototype's font-name fallbacks still chain through.

## Known a11y exemptions

- **`.lane-avatar`** white text on person-color background. Contrast depends on the assignee's chosen palette swatch. Excluded from the axe gate in `e2e/a11y.spec.ts`; switching to dynamic luminance-based text color is a v2 design decision.

## Things genuinely out of scope (not deviations — never planned)

- "Last 6 months" sparkline bars (admin metrics)
- Comment threads on cards
- File attachments
- @-mentions / push notifications outside the app
- Custom contract colors beyond the palette (would let users break the design system)
- Mobile / phone layout (CSS-only `mobile-splash` at <1024px width)

---

## Sign-off

Signed off by the maintainer on Phase 14 close. Production is ready to ship to the 4–8-user team once the Hetzner VPS is provisioned and Phase 13's deploy pipeline runs against real GitHub secrets.
