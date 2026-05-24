# Handoff: ConBon — Project Controls Kanban Board

## Overview

**ConBon** is an internal single-page web app for a commercial team's change-management function across multiple construction contracts. Commercial Managers create tasks (estimates, schedules, change orders, etc.) on a single shared Kanban board and assign them to Estimators and Schedulers. The board has two views (column-per-person and per-person swimlanes), supports drag-and-drop reassignment, automatic priority escalation as tasks age, manual priority overrides, inline blocker notes, and a separate Admin role with employee performance metrics.

The app persists state in `localStorage` in the prototype; in production this should be backed by a real database with multi-user auth (out of scope for the prototype but addressed below).

**Audience:** ~3–6 concurrent users today (1 Commercial Manager, 4 production employees), growing to ~10. Real-time sync between users is required.

## About the Design Files

The files in `prototype/` are **design references created in HTML** — a React + Babel prototype that demonstrates the intended look, behavior, and interactions. They are **not** production code to copy verbatim. Your task is to **recreate these designs in the target codebase's existing environment** (React, Vue, SwiftUI, native, etc.), using the project's established patterns, libraries, state management, and component conventions.

If no production codebase exists yet, choose an appropriate stack. Suggested:

- **Frontend:** React + TypeScript + Vite, TanStack Query for data fetching, React DnD or `@dnd-kit` for drag-and-drop, Zustand or Redux Toolkit for client state.
- **Backend:** Node + Express/Fastify or Python + FastAPI; Postgres for persistence; WebSockets (or SSE) for real-time sync; simple email/password or SSO auth.
- **Styling:** the prototype uses plain CSS with CSS custom properties — Tailwind, vanilla-extract, or CSS Modules would all map cleanly.

## Fidelity

**High-fidelity.** Colors, spacing, typography, interaction patterns, and component structure should be recreated as closely as possible, adapted to the target codebase's primitives. Exact hex values, typography, and spacing are documented below.

---

## Roles & Permissions

Two roles in the prototype, switched via a segmented control in the top bar:

| Role | Sees | Can do |
| --- | --- | --- |
| **Commercial Manager** | Kanban board with all contracts | Create / edit / delete / complete tasks, override priority, assign tasks, add/edit blocker notes |
| **Admin** | Employee metrics dashboard | Read-only metrics (in v1) |
| **Estimator / Scheduler** (production employees) | Same Kanban board as Manager (in v1) | Edit blocker notes on their own cards; drag their cards between people if needed; everything else is read-only/visual |

In production, separate the **Estimator/Scheduler** role from **Commercial Manager** with proper permissions — production employees should only be able to edit blocker notes on their own cards by default. The prototype shows the Manager view to all roles for design demonstration.

---

## Screens / Views

### 1. Top Bar (persistent)

- **Layout:** horizontal flex, full-width, 14px top/bottom padding, 22px left/right.
- **Border:** 1px bottom border in `var(--line)`.
- **Background:** `var(--bg)`.

Components left to right:
- **Brand mark:** 22×22px rounded-6px square with a linear-gradient from `--p1` (green) → `--p3` (yellow) → `--p5` (red), 135deg. 1px inset border.
- **Wordmark:** "ConBon" in Inter Tight 600 / 15px / -0.01em letter-spacing.
- **Separator:** middle-dot character, `--ink-3`.
- **Subtitle:** "Project Controls Kanban Board" in Inter Tight 400 / 15px / `--ink-2`.
- **Spacer:** flex: 1.
- **Open-task counter:** 12px, `--ink-3`: `"{N} open tasks"`.
- **Role switcher:** pill segmented control. Two buttons — "Commercial Manager" / "Admin". Active button has `--ink` background, `--bg` text. Inactive: transparent, `--ink-2` text. 13px / 500 weight / 6px·14px padding / 999px radius.
- **Theme toggle:** 38×38 circular button with 1px border in `--line`. Renders a moon icon in soft mode and a sun icon in bold mode. Clicking toggles `--theme`.

### 2. Filter Bar (manager view only)

- **Layout:** horizontal flex-wrap, 12px top/bottom · 22px left/right padding, 10px gap.
- **Background:** `var(--bg)`, 1px bottom border in `--line`.

Three filter groups, separated by 1px·18px vertical dividers:
1. **Contract** (multi-select): chips showing contract code (`N36054`, `B41207`, `H29183`, `V52461`).
2. **Assignee** (multi-select): chips with a colored dot (each person's accent color) + first name.
3. **Priority** (multi-select): chips with a colored dot (priority color) + level number (1–5).

Chip styling:
- Inactive: `var(--chip-bg)` background, 1px `var(--line)` border, `--ink-2` text, 12.5px / 999px radius, 5px·11px padding.
- Active: `--ink` background, `--bg` text.

Right-aligned:
- "Clear" ghost button when any filter is active.
- **+ New task** primary button (pill, `--ink` bg, `--bg` text).

### 3. Kanban Board — Layout A: Columns

The default layout. Used when `layout === "columns"` in Tweaks.

- **Container:** `display: grid; grid-template-columns: 280px repeat(4, minmax(280px, 1fr)); gap: 16px;` — 5 columns total (1 Backlog + 4 people).
- **Padding:** 18px 22px 32px.
- **Overflow:** horizontal scroll on narrow viewports, vertical otherwise.

**Column** (`<div class="col">`):
- Background: `var(--surface)`, 1px border in `--line`, 14px radius, 14px·12px·12px padding.
- Min-height: 200px.
- Header row: 28px avatar circle (person's color, white initials) + name (Inter Tight 600 / 14px) + role subtitle (11px / `--ink-3`) + task count pill on the right.
- Body: vertical flex, 10px gap. Cards drop in here.
- Drop target state: `--surface-2` background, `--line-strong` border.
- Backlog column has an "+ Add task" dashed-border stub at the bottom.

**Column order (left to right):** Backlog · Justin · Swati · Michael · Francisco.

### 4. Kanban Board — Layout B: Swimlanes

Activated via Tweaks panel.

- **Container:** vertical flex, 16px gap.
- One lane per person + a top Backlog lane.

**Lane** (`<div class="lane">`):
- Background: `--surface`, 1px `--line`, 14px radius, 14px·16px padding.
- Header: 34px avatar + name (Inter Tight 600 / 15px) + role · "In Progress" subtitle + stats on the right (`{N} open · {N} urgent · {N} overdue`).
- Body: `grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px;` — cards flow in a responsive grid.
- Cards in each lane sorted by effective priority desc, then due date asc.

### 5. Task Card

The central component. Same markup in both layouts.

- **Container:** 
  - `background: var(--card-bg)` (translucent — see Design Tokens), `backdrop-filter: blur(8px)`.
  - 1px border in `--card-border`.
  - **4px solid left edge** in the priority color (`var(--p-color)` set as inline style).
  - 10px border-radius.
  - 12px·13px·11px·14px padding.
  - Subtle `--card-shadow`.
  - `cursor: grab`, `draggable="true"`.
- **Priority tint overlay:** `::before` absolute, full inset, background = `--p-tint` (semi-transparent priority color).

**Top row** (8px margin-bottom):
- Contract code: 11px / uppercase / 0.06em tracking / `--ink-2` / 500.
- Type chip (right-aligned): `Estimate` / `Schedule` / `Other`, 10.5px uppercase pill with `--chip-bg`, 1px `--line` border.

**Title:** Inter Tight 600 / 15px / -0.005em / line-height 1.3 / `text-wrap: pretty`. 10px margin-bottom.

**Blocker block (conditional):** appears when `blocker` is set or being edited.
- Background: `--chip-bg`, 2px left border in `--p4` (warning amber/brick), 4px radius, 7px·9px padding.
- Label: "Blocker" — 10px uppercase 0.08em tracking, `--p4` color, 600 weight.
- Body: 12.5px italic `--ink-2`. Click to edit inline as a `<textarea>`. Commit on blur or `Cmd/Ctrl+Enter`; Escape cancels.

**Bottom row** (flex, 8px gap, wrap):
- **Priority chip:** background = priority color, white text with 1px-2px text-shadow, 11px / 600 / 0.02em tracking, pill shape. Click opens the priority override picker. Inside the chip: a circular dot showing the priority number (1–5), then the label ("Low" / "Light" / "Medium" / "High" / "Urgent").
- **Dates:** "Mon DD → Mon DD" in 11.5px `--ink-3`.
- **"+ blocker"** ghost link (only when no blocker exists), 11px `--ink-3` with dotted underline.
- **Avatar:** 24px circle with person's color, 11px white initials, 2px ring in `--card-bg`.

**Aging strip** (only when priority ≥ 4 or task is overdue):
- 8px margin-top, flex row.
- "Xd overdue" or "Xd left" pill in 10.5px, `--p-tint` background.
- "manual" pill if `priorityOverride` is set.

### 6. Add/Edit Task Modal

- **Backdrop:** `rgba(0,0,0,0.45)` with `backdrop-filter: blur(2px)`, centered.
- **Panel:** 560px max-width, `--surface` background, 1px `--line` border, 18px radius, max-height 90vh with internal scroll, large shadow.

Fields top-to-bottom:
1. Title (text)
2. Contract (select) + Type (select) — 2-column row
3. Assignee picker: pill buttons for Backlog + 4 people; active = `--ink` border, `--chip-bg` background.
4. Assignment date + Due date — 2-column row, `<input type="date">`
5. Priority (1–5): 5 flex-equal buttons colored by priority. Active button gets `--ink` border. Below: "Clear override → use auto-aging" link if override is set.
6. Blocker note (textarea, optional, min-height 60px)

Footer (top border):
- "Delete task" ghost link (red, far left) — only when editing existing task.
- "Cancel" ghost.
- "Create task" / "Save changes" primary button (disabled when title empty).

### 7. Right-click Context Menu

Triggered on `contextmenu` event on any card OR by clicking the priority chip.

- **Container:** position: fixed, clamped to viewport. `--surface-2` background, 1px `--line-strong` border, 10px radius, 5px padding, min-width 200px, large shadow.
- **Section header:** "Set priority" — 10px uppercase 0.08em `--ink-3`, 6px·10px padding.
- **Priority dots row:** 5 circular 22px buttons, one per priority level, colored. Active level has a 2px `--ink` border ring.
- **Clear override** item (if override is set): "↺ Clear manual override".
- Separator (1px `--line`).
- **Edit task…** (✎)
- **Edit/Add blocker note** (⚑)
- Separator.
- **Mark as complete** (✓) — removes from board, sets `completedAt`.
- **Remove from board** (🗑, danger color) — confirms then deletes.

Items: 7px·10px padding, 6px radius, 13px text. Hover: `--ink` background, `--bg` text. Danger items invert to a red bg on hover.

### 8. Admin Page

Replaces the board when role === "admin".

- **Padding:** 24px·32px·40px.
- **Page header:**
  - H1 "Team performance" — Inter Tight 600 / 28px.
  - Subtitle "Employee metrics across all contracts · resets at end of month" — `--ink-2`.

**Top metric grid** (4 cards, auto-fit minmax(220px, 1fr), 14px gap):
1. **Tasks completed (all-time)** — large value, `+{N} this month` in `--p1` green sub.
2. **Current workload** — open task count.
3. **Tasks past due** — count, in `--p5` if > 0.
4. **Avg time-to-completion** — days, computed across all completed tasks.

Each card: `--surface` bg, 1px `--line`, 14px radius, 18px padding. Value in Inter Tight 600 / 32px / -0.02em.

**Per-employee table** (`.employees`):
- Header row: "Employee · Completed · Open · Past due · Avg cycle · Last 6 months" — 11px uppercase 0.08em `--ink-3`, on `--surface-2` background.
- Body rows: 6-column CSS grid `2fr 1fr 1fr 1fr 1fr 1.5fr`, 18px·22px padding, 1px bottom border between rows.
- Employee cell: 38px colored avatar + name (Inter Tight 600) + role (12px `--ink-3`).
- Numeric cells: Inter Tight 600 / 18px value with a small qualifier (e.g. `+3 mo`, `days`).
- Completed cell also has a horizontal bar showing share-of-team-max in the person's accent color.
- "Past due" value turns `--p5` red when > 0.
- "Last 6 months" cell shows a tiny bar chart: 6 vertical bars in the person's color, scaled to the person's max month, with month labels below.

---

## Interactions & Behavior

### Drag and drop
- Cards are `draggable="true"` and set `text/plain` data to the task id.
- Drop targets: column body (Layout A) or lane body (Layout B). Drop changes `assignee` to that column/lane's owner (or `null` for Backlog).
- Drop targets show a hover state (`--surface-2` background, dashed outline in Layout B).
- Dragged card itself dims to 0.4 opacity.

### Right click
- `contextmenu` on a card opens the context menu at the cursor position, clamped to viewport edges.
- Closes on outside click or Escape.

### Click card body
- Opens the Edit Task modal pre-populated with the task.

### Click priority chip
- Opens the context menu (same as right-click) — shortcut to override priority.

### Inline blocker editing
- Tap the blocker block to focus a textarea inside the card.
- Commit: blur or `Cmd/Ctrl+Enter`. Cancel: Escape.
- When no blocker exists, a "+ blocker" affordance appears in the card bottom row.

### Filtering
- Multi-select filter chips: clicking toggles inclusion.
- Filters compose with AND across categories, OR within a category. (e.g. "contracts: A or B" AND "priority: 4 or 5".)
- Filters are not persisted across reloads in the prototype; consider persisting in production.

### Mark complete
- Right-click → "Mark as complete" sets `completed: true`, `completedAt: Date.now()`.
- Completed tasks are filtered out of the board view immediately.
- They remain in the data store and feed the Admin metrics.

### Delete
- Right-click → "Remove from board", or "Delete task" from the modal — both `confirm()` then drop from the store entirely.

### Theme toggle
- Top-right moon/sun button toggles `data-theme="soft"` ⇆ `data-theme="bold"` on `<html>`.
- Transitions: `background 0.35s, color 0.35s` on `<body>`.

### Tweaks panel
- Floating bottom-right panel (300px-ish). Drag header to reposition.
- Controls:
  - Color theme (Soft / Bold)
  - Dark variant (only shown when bold is active): Charcoal / Noir / Forest
  - Board layout (Columns / Swimlanes)
  - "Reset to seed data" button
- This panel is **for design exploration only** — should be removed entirely in the production build, OR kept behind a feature flag for internal QA.

---

## Aging logic (CORE BUSINESS RULE)

Priority is derived **automatically** from how long a task has been assigned, on a 14-day cycle. The rule (matches the prototype's `autoPriority` function exactly):

```ts
const CYCLE_DAYS = 14;
function autoPriority(assignmentDate: Date, now = new Date()): 1|2|3|4|5 {
  const daysElapsed = Math.max(0, Math.floor((now.getTime() - assignmentDate.getTime()) / 86_400_000));
  const ratio = Math.min(1, daysElapsed / CYCLE_DAYS);
  const lvl = Math.min(5, Math.max(1, Math.ceil(ratio * 5) || 1));
  return lvl as 1|2|3|4|5;
}
```

- Day 0 of assignment: level 1 (Low / green).
- Each ~2.8 days the level climbs by one.
- Day 11.2+ : level 5 (Urgent / red).

If `task.priorityOverride` is non-null, it **wins**; the auto-aging is ignored until the override is cleared.

In production, recompute on every render that depends on the level, OR re-evaluate periodically server-side (e.g. nightly batch + on-read). The prototype re-renders every 60 seconds via a tick interval to keep aging visible without a refresh.

---

## State Management

### Data model

```ts
type Task = {
  id: string;                    // "t-xxxxxxx"
  title: string;
  contract: 'northgate' | 'bayfront' | 'hartwell' | 'verdant';  // FK
  assignee: 'justin' | 'swati' | 'michael' | 'francisco' | null;  // null = Backlog
  type: 'Estimate' | 'Schedule' | 'Other';
  assignmentDate: string;        // ISO date (YYYY-MM-DD)
  dueDate: string;               // ISO date
  priorityOverride: 1|2|3|4|5 | null;  // null = auto
  blocker: string;               // empty string when none
  completed: boolean;
  createdAt: number;             // ms timestamp
  completedAt: number | null;    // ms timestamp
};

type Person = {
  id: string;
  name: string;
  role: 'Estimator' | 'Scheduler';
  color: string;                 // hex accent
};

type Contract = {
  id: string;
  name: string;
  code: string;                  // 1 letter + 5 digits, e.g. "N36054"
};
```

### Prototype seed data

Four people (Justin, Swati, Michael, Francisco), four contracts, ~15 active seed tasks across a range of ages so the priority scale is visible at first load, plus ~40 historical completed tasks to populate the Admin charts. The production app should seed an empty database and let the team build up the board organically.

### Production state model (recommended)

- **Server is the source of truth.** WebSocket or SSE broadcast for live updates between clients.
- **Tasks endpoint:** standard REST CRUD or GraphQL — `GET /tasks?contract=X&assignee=Y`, `POST /tasks`, `PATCH /tasks/:id`, `DELETE /tasks/:id`.
- **Audit log** on the server for every priority override, assignment change, blocker edit, complete/delete — required for change-management compliance.
- **Conflict resolution:** last-write-wins is fine for blocker notes; optimistic UI with rollback on server reject is fine for assignments and priorities.

---

## Design Tokens

All tokens are defined in `prototype/styles.css` as CSS custom properties on `:root`, `[data-theme="soft"]`, `[data-theme="bold"]`, and the dark-variant overrides. Copy these exactly.

### Soft theme (default — "light mode")

| Token | Value | Notes |
| --- | --- | --- |
| `--bg` | `#EBDEC0` | Fennel — page background |
| `--bg-2` | `#e2d4b0` | slightly deeper |
| `--surface` | `#f4ead5` | columns / panels |
| `--surface-2` | `#f9f2e0` | raised / drop-target / context menu |
| `--ink` | `#2f3a31` | primary text — deep fern-ink |
| `--ink-2` | `#5a665b` | secondary text |
| `--ink-3` | `#8a8472` | tertiary / meta text |
| `--line` | `rgba(47, 58, 49, 0.14)` | hairline borders |
| `--line-strong` | `rgba(47, 58, 49, 0.28)` | hover / strong borders |
| `--accent` | `#768E78` | Fern — primary accent |
| `--accent-ink` | `#ffffff` | text on accent |
| `--card-bg` | `rgba(255, 252, 244, 0.72)` | translucent card |
| `--card-border` | `rgba(47, 58, 49, 0.14)` |  |
| `--chip-bg` | `rgba(255, 255, 255, 0.55)` |  |

**Priority scale (soft):**

| Level | Label | Color | Tint |
| --- | --- | --- | --- |
| 1 | Low | `#768E78` (Fern) | `rgba(118, 142, 120, 0.18)` |
| 2 | Light | `#C6C09C` (Pistachio) | `rgba(198, 192, 156, 0.22)` |
| 3 | Medium | `#FCC88A` (Honey) | `rgba(252, 200, 138, 0.22)` |
| 4 | High | `#FCAC83` (Peach) | `rgba(252, 172, 131, 0.24)` |
| 5 | Urgent | `#E79897` (Peony) | `rgba(231, 152, 151, 0.28)` |

### Bold theme (default dark variant: charcoal)

| Token | Value | Notes |
| --- | --- | --- |
| `--bg` | `#1a1714` | warm charcoal |
| `--bg-2` | `#14110e` |  |
| `--surface` | `#25201c` |  |
| `--surface-2` | `#2f2924` |  |
| `--ink` | `#fffff4` | Petal cream |
| `--ink-2` | `#d9c7b8` |  |
| `--ink-3` | `#968578` |  |
| `--line` | `rgba(255, 255, 244, 0.10)` |  |
| `--line-strong` | `rgba(255, 255, 244, 0.28)` |  |
| `--accent` | `#d9dd93` | Sage |
| `--accent-ink` | `#1a0000` |  |
| `--card-bg` | `rgba(48, 42, 36, 0.62)` |  |
| `--chip-bg` | `rgba(255, 255, 244, 0.08)` |  |

**Priority scale (bold):**

| Level | Label | Color | Tint |
| --- | --- | --- | --- |
| 1 | Low | `#7fa342` (Arbor, brightened) | `rgba(127, 163, 66, 0.22)` |
| 2 | Light | `#c5d162` (Sage-Arbor blend) | `rgba(197, 209, 98, 0.20)` |
| 3 | Medium | `#e6c049` (mustard) | `rgba(230, 192, 73, 0.22)` |
| 4 | High | `#d2685a` (light brick) | `rgba(210, 104, 90, 0.26)` |
| 5 | Urgent | `#b21420` (Crimson, brightened) | `rgba(178, 20, 32, 0.36)` |

### Bold theme — alternate dark variants

Applied via `[data-theme="bold"][data-dark="..."]`:

- **`noir`** — original deep red-maroon: `--bg: #370000`, `--surface: #4a1414`, `--p5: #d12028`, `--card-bg: rgba(74, 20, 20, 0.55)`.
- **`forest`** — arbor-green-tinted: `--bg: #161c17`, `--surface: #1f2820`, `--card-bg: rgba(40, 51, 42, 0.55)`.

### People accent colors

| Person | Role | Color |
| --- | --- | --- |
| Justin Park | Estimator | `#d68aa6` (pink) |
| Swati Iyer | Estimator | `#8b6f4d` (brown) |
| Michael Brennan | Scheduler | `#7e9bb8` (blue) |
| Francisco Aguilar | Scheduler | `#7ea687` (green) |

### Contracts

| Id | Name | Code |
| --- | --- | --- |
| northgate | Northgate Tower | `N36054` |
| bayfront | Bayfront Refit | `B41207` |
| hartwell | Hartwell Logistics | `H29183` |
| verdant | Verdant Phase II | `V52461` |

Contract codes are **1 uppercase letter + 5 digits** by convention.

### Typography

- **Headings & display:** `Inter Tight`, weights 400/500/600/700. `-0.01em` letter-spacing on h1–h3, `-0.005em` on body display.
- **Body:** `IBM Plex Sans`, weights 400/500/600. 14px / 1.45 line-height base.
- Both via Google Fonts:
  ```
  https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap
  ```

### Spacing & radius

- 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 22 / 24 / 32 px scale (no formal token system in the prototype — values used directly).
- Border radii: 4 (small chips), 6 (menu items), 8 (form fields), 10 (cards), 14 (panels), 18 (modal), 999 (pills).

### Shadows

- Card: `0 1px 0 rgba(255,255,255,0.5) inset, 0 6px 18px -10px rgba(47,58,49,0.25)` (soft).
- Card hover: `0 1px 0 rgba(255,255,255,0.5) inset, 0 10px 24px -10px rgba(47,58,49,0.30)`.
- Modal: `0 24px 60px -20px rgba(0,0,0,0.5)`.
- Context menu: `0 12px 36px -8px rgba(0,0,0,0.4)`.

---

## Assets

No bitmap or vector assets are required. Icons in the prototype are inline SVG (moon/sun for theme toggle) or simple Unicode glyphs (✎, ⚑, ✓, 🗑, ↺, ✕). Replace these with the target codebase's icon library (Lucide, Heroicons, etc.) for consistency in production.

Avatars are rendered as colored circles with initials — no profile photos. If photos become available later, swap the `<div>` for an `<img>` and keep the same dimensions / `border-radius: 999px`.

---

## Production Considerations (out of scope for the prototype)

These are things a Claude Code dev should plan for but the prototype intentionally skips:

1. **Auth & multi-tenancy.** Each user logs in, their role is known server-side, permissions enforced.
2. **Real-time sync.** When one user moves a card, everyone sees it. Use WebSockets / Pusher / Supabase Realtime / whatever's idiomatic.
3. **Audit trail.** Required for change-management compliance. Every priority override, reassignment, status change, and blocker edit should be logged with `actor_id`, `timestamp`, `old_value`, `new_value`.
4. **Notifications.** Optional but likely wanted: ping the assignee when a card is assigned to them; ping the Commercial Manager when a blocker is added.
5. **Search.** A search bar over titles and blocker notes would help once the board grows.
6. **Archive view.** Completed tasks currently feed metrics only. Consider a dedicated archive view filterable by date / assignee / contract.
7. **Mobile.** The prototype is designed for desktop. The column layout horizontally scrolls on narrow viewports; the swimlanes layout adapts better. A mobile-first redesign is recommended if mobile usage is anticipated.
8. **Time-travel / demo mode** for the aging behavior — useful for QA and for new-employee onboarding.
9. **Per-employee personal accent override** — the user mentioned wanting employees to be able to pick their own accent color that tints their cards. Not built in the prototype; would slot into the Person model as a nullable `accent_override` field, applied via inline style on the card's `--p-color` when set.
10. **Strip out the Tweaks panel** before production — it's a design-iteration tool, not a user-facing setting.

---

## Files

```
design_handoff_conbon_kanban/
├── README.md                    ← this file
└── prototype/
    ├── Kanban Board.html        ← entry point — open in a browser
    ├── styles.css               ← all design tokens + component styles
    ├── data.jsx                 ← data model, mock seed, aging logic
    ├── card.jsx                 ← TaskCard, PriorityChip, Avatar, AddCardStub
    ├── board.jsx                ← BoardColumns (Layout A) + BoardLanes (Layout B)
    ├── admin.jsx                ← Admin metrics page
    ├── app.jsx                  ← App shell, top bar, filter bar, modal, context menu, Tweaks wiring
    └── tweaks-panel.jsx         ← Design-iteration panel (REMOVE in production)
```

Open `Kanban Board.html` directly in any modern browser — no build step. The prototype is React + Babel-in-the-browser purely for fast iteration; do **not** ship this pattern.
