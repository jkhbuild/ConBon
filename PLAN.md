# ConBon — Phased Implementation Plan

> Each phase below is **self-contained**: a fresh Claude Code session
> pointed at this file with "execute Phase N" should have everything it
> needs to ship that phase, with no other context required.

## How to use this document

In a fresh Claude Code session, paste a prompt like:

> Read `/PLAN.md` and execute Phase N. Stop after the "Done when"
> conditions are met. Commit your work to branch `claude/sweet-maxwell-7Njj1`
> and push.

Every phase declares:
- **Upstream** — commits / files / env vars that must exist before starting
- **Skills** — slash-commands to invoke at session start (each is user-invocable)
- **Read first** — the file paths to load into context before writing code
- **Build** — what to create + skill-derived refinements to apply
- **Contracts produced** — file paths, exports, schema, scripts that later phases will depend on
- **Done when** — concrete, verifiable success conditions
- **Complexity** — S / M / L (rough agent-hour budget)
- **Risks** — known pitfalls + mitigations (when relevant)

---

## Status

**Planning complete.** No code yet. Phase 1 ready to start.

| Phase | Name | Status |
|---|---|---|
| 1 | Repo scaffolding & prototype preservation | Not started |
| 2 | Database, Prisma, data model | Not started |
| 3 | tRPC backbone (read-only) | Not started |
| 4 | Design system port, CSS, shell | Not started |
| 5 | Board read-only with @dnd-kit | Not started |
| 6 | Card mutations | Not started |
| 7 | Auth: NextAuth + Google + allowlist + RBAC | Not started |
| 8 | Real-time sync via LISTEN/NOTIFY → SSE | Not started |
| 9 | Admin CRUD UIs (parallel with 8) | Not started |
| 10 | Audit log + History + notifications | Not started |
| 11 | Per-user preferences (parallel with 9/10) | Not started |
| 12 | Production Docker + Compose | Not started |
| 13 | CI/CD: GitHub Actions deploy | Not started |
| 14 | Playwright smoke tests + polish | Not started |

---

# Common preamble

**Every phase reads this section before its own.**

## Context

ConBon is an internal kanban for a 4–8 person commercial-construction team
(1 Commercial Manager, ~4 production employees, 1 Admin, headroom for growth).
The front-end design is a React-in-the-browser prototype preserved at
`/reference/prototype/`. Phases ship that prototype as a real production
web app — real database, auth, multi-user real-time sync, audit trail,
managed reference data — on a self-hosted Hetzner VPS.

## Hard constraints

- 4–8 concurrent users max.
- Front-end design (look, interactions, tokens, DnD feel) is locked — recreate fidelity against `/reference/prototype/`.
- Real-time sync between users required.
- Audit trail required (change-management compliance).
- Desktop-only in v1 (mobile splash below 1024px).

## Locked architectural decisions

**Stack**
- Next.js 15 (App Router) + TypeScript + React 19
- Postgres (self-hosted in Docker Compose on the same VPS) + Prisma
- tRPC for the API layer
- React Query (inside tRPC) for server state cache
- Zustand for transient client UI state (drag preview, modal open, toast queue)
- Plain CSS / CSS Modules (port prototype design system, preserve custom properties)
- @dnd-kit for drag-and-drop
- Radix UI primitives: Dialog, DropdownMenu, ContextMenu, Toast (styled with our CSS)
- Playwright for E2E smoke tests

**Hosting**
- Hetzner VPS (CX22 class) running Docker Compose: app + Postgres + Caddy (TLS)
- GitHub Actions: build image → push to GHCR → SSH-deploy to VPS

**Real-time** — Postgres `LISTEN/NOTIFY` → server-sent events (SSE).
Optimistic updates on the client.

**Auth** — NextAuth (Auth.js v5) + Google OAuth + manager-managed allowlist
(`allowed_users` table). Sign-in callback rejects emails not in the list.

**Roles (strict ownership)**
- **Employee** — see all cards, create cards, edit/move/archive only cards assigned to them
- **Admin** — Employee + edit/move/archive any card + people/contracts CRUD
- **Manager** — Admin + allowlist CRUD + promote/demote users

**Notifications** — In-app only: Radix Toast on real-time events affecting
the current user, bell-icon badge in the header with unread dropdown.

**Audit log** — `audit_log` Postgres table written from a Prisma middleware
on every mutation. Surfaced via per-card History modal. Retention: forever.

**Reference data** — People + Contracts in Postgres, Manager-editable via
Admin UI.

**Production seed** — Empty database on first deploy. One bootstrap manager
email baked in via env var; that user logs in and populates everything.

**Tweaks panel** — Stripped entirely from production builds. Theme + layout
become per-user DB preferences. Default dark color is the brown/charcoal
matching the prototype's `html` background.

## Pre-flight items the user supplies at the relevant phase

- **Domain name + DNS** — needed at Phase 12 (Caddy TLS).
- **Google OAuth client ID/secret** (dev + prod) — needed at Phase 7.
- **`BOOTSTRAP_MANAGER_EMAIL`** for production bootstrap — needed at Phase 7.

## Prototype source

Lives at `/reference/prototype/`. Currently in the repo:

- `README.md` — design tokens, color palette, layout specs, role behavior, full design system documentation (24 KB — read this first for any styling work)
- `app.jsx` — main shell, modals, context menu, filters, theme toggle, EDITMODE markers for tweaks
- `board.jsx` — swim-lane / columns board, DnD logic
- `card.jsx` — card UI, priority pip, context menu
- `admin.jsx` — admin metrics view

**Files referenced by the prototype but NOT yet in the repo** (must be
added by user before phases that touch styles or seed data):

- `data.jsx` — defines `window.KanbanData = { PEOPLE, CONTRACTS, TASK_TYPES, loadStore, saveStore, defaultStore, effectivePriority, priorityColor, priorityLabel, priorityTint, isoDate, addDays }`. Needed in **Phase 2** (seed data + helpers) and **Phase 5** (autoPriority logic).
- `styles.css` — full design system stylesheet. Needed in **Phase 4** (port to `app/globals.css`).
- `Kanban Board.html` — bootstrap HTML loading React + Babel + JSX files. Needed in **Phase 1** for fidelity reference.
- `tweaks-panel.jsx` — dev-only panel. Optional in **Phase 11** (to confirm what's being removed).

When you locate them locally: `git add reference/prototype/<file>` on the
designated branch and push, then proceed.

## Skills

Skills are **user-invoked at session start**, never auto-triggered. Each
phase lists which slash-commands to run.

**Installed (confirmed):**

| Slug | Source | Phases covered |
|---|---|---|
| `/vercel-react-best-practices` | vercel-labs/agent-skills | 3, 4, 5, 6, 9, 10, 11 |
| `/web-design-guidelines` | vercel-labs/agent-skills | 4, 5, 9, 14 |
| `/vercel-composition-patterns` | vercel-labs/agent-skills | 5, 6, 9 |
| `/supabase-postgres-best-practices` | skills.sh | 2, 6, 7, 8, 10 |
| `/typescript-advanced-types` | wshobson/agents | 3, 6, 10 |

**Rejected** (do not install — explained in the appendix):
- `react-native-guidelines`, `vercel-optimize`, `vercel-deploy-claimable`, `react-view-transitions` (vercel-labs)
- `zustand` (lobehub) — wrong fit; LobeHub-codebase-specific

## Repo conventions

- All work on branch `claude/sweet-maxwell-7Njj1` (per the harness contract).
- Commits: imperative mood, scoped prefix (`feat:`, `fix:`, `chore:`, `docs:`), one phase = one commit if possible (or one commit per logical chunk within the phase).
- TypeScript strict mode. No `any` without an inline justification comment.
- No `console.log` left in committed code.
- Run `npm run lint && npm run build` before committing.

---

# Phase 1 — Repo scaffolding & prototype preservation

**Upstream:** None. First phase. Local prerequisites: Node 22+, npm 10+, Docker, git.

**Skills:** None required. (If a Next.js scaffolding skill is later installed, invoke it.)

**Read first:**
- `/reference/prototype/README.md` — to understand the project at a high level
- `/reference/prototype/app.jsx` — to see the prototype's surface area

**Build:**
- Initialize Next.js 15 + TypeScript app at the repo root:
  - `package.json` — name `conbon`, scripts: `dev`, `build`, `start`, `lint`, `format`, `typecheck`
  - `tsconfig.json` — strict mode, `paths` alias `@/*` → repo root
  - `next.config.ts` — set `output: 'standalone'` (Phase 12 needs this for the Docker image)
  - `.eslintrc.json` (Next.js defaults + `@typescript-eslint`)
  - `.prettierrc`
  - `.gitignore` — Next.js defaults + `.env*`
  - `.dockerignore` — excludes `node_modules`, `.next`, `.git`, `/reference/prototype/`, `*.md`
- Minimal app:
  - `app/layout.tsx` — bare HTML shell, no styling yet
  - `app/page.tsx` — placeholder rendering "ConBon"
- Root `README.md` — project description, repo layout, link to `PLAN.md`, link to `/reference/prototype/README.md`
- Verify `/reference/prototype/` files (already committed) are untouched

**Apply during build:**
- Use `next.config.ts` (not `.js`) for typed config.
- Pin React to 19.x.
- Do not install any UI libraries, ORM, or auth in this phase — those land in their owning phases.

**Contracts produced** (downstream phases depend on these):
- `package.json` with scripts: `dev`, `build`, `start`, `lint`, `format`, `typecheck`
- `tsconfig.json` path alias `@/*`
- `next.config.ts` with `output: 'standalone'`
- `app/layout.tsx` exporting a default React component (Phase 4 will replace its contents)
- `.dockerignore` excluding `/reference/prototype/` (Phase 12 relies on this)
- `/reference/prototype/` preserved untouched

**Done when:**
- `npm install` succeeds
- `npm run dev` serves http://localhost:3000 showing "ConBon"
- `npm run build` succeeds (clean)
- `npm run lint` passes
- `npm run typecheck` (`tsc --noEmit`) passes
- Committed to branch with message like `feat: scaffold Next.js 15 app and preserve prototype`

**Complexity:** S

**Risks:**
- React 19 peer-dep warnings from libraries. Mitigation: use `--legacy-peer-deps` only if a specific package demands it; otherwise pin the most recent compatible versions.

---

# Phase 2 — Database, Prisma, and the data model

**Upstream:**
- Phase 1 committed (scaffolded app, `package.json` with scripts)
- `/reference/prototype/data.jsx` should be in the repo so its seed data can be ported. If missing, see "Prototype source" in the preamble — proceed by hand-keying the seed from `/reference/prototype/README.md` (it documents the People + Contracts).

**Skills:** `/supabase-postgres-best-practices`, (Prisma skill if installed)

**Read first:**
- `/reference/prototype/README.md` — color palette (`--p1`…`--p5` priority colors, person accent colors), contract codes (`N36054`, `B41207`, `H29183`, `V52461`), role definitions
- `/reference/prototype/data.jsx` (if available) — exact seed shapes for `PEOPLE`, `CONTRACTS`, `TASK_TYPES`, plus helpers `effectivePriority`, `priorityColor`, `priorityLabel`, `priorityTint`, `isoDate`, `addDays`

**Build:**
- `docker-compose.dev.yml` with a `postgres:16-alpine` service, volume-mounted under `./.data/postgres`, port `5432:5432`
- `prisma/schema.prisma` covering these entities (minimum fields shown; add what data.jsx + README imply):
  - `Person` — id (uuid), name, email (nullable in v1, used in Phase 7 for matching), role (enum: MANAGER/ADMIN/EMPLOYEE), color (string — constrained to predefined palette), active (bool), createdAt, updatedAt
  - `Contract` — id, code (unique), name, color, active, createdAt, updatedAt
  - `Card` — id, title, columnKey (enum: BACKLOG/IN_PROGRESS/DONE — confirm from prototype), assigneeId (FK Person nullable), contractId (FK Contract), type (string), assignmentDate (date), dueDate (date), priorityOverride (int nullable), blockerNote (text nullable), position (int — for ordering within column), archivedAt (timestamptz nullable), createdAt, updatedAt
  - `AllowedUser` — id, email (unique), role, addedBy (FK Person), createdAt
  - `UserPreference` — userId (FK Person, unique), theme, layout, updatedAt
  - `AuditLog` — id, entityType (text), entityId (uuid), actorId (FK Person nullable), action (text), before (jsonb), after (jsonb), createdAt
- Indexes (apply `/supabase-postgres-best-practices` guidance):
  - `Card`: `(columnKey, position)` for ordered fetches; partial index `WHERE archivedAt IS NULL`
  - `AuditLog`: `(entityType, entityId, createdAt DESC)` for the History query; `(actorId, createdAt DESC)` for notifications
- `prisma/seed.ts` — dev only (gated by `NODE_ENV !== 'production'`). Mirrors data.jsx seed
- `lib/db.ts` — Prisma client singleton (avoids hot-reload connection leaks)
- npm scripts: `db:up`, `db:down`, `db:migrate`, `db:reset`, `db:seed`, `db:studio`
- `.env.example` with `DATABASE_URL=postgresql://conbon:conbon@localhost:5432/conbon`

**Apply during build:**
- Use `cuid()` or `uuid()` for IDs (pick one; Prisma defaults to `cuid()`). Document choice in `schema.prisma` header comment.
- All timestamps `timestamptz` (Prisma default for `DateTime`).
- JSONB for `before` / `after` audit fields, not JSON.
- Don't add a GIN index on the audit JSONB columns in v1 — defer until we have a query that needs it.

**Contracts produced:**
- `prisma/schema.prisma` with all v1 entities
- `prisma/migrations/<timestamp>_init/` (the first migration)
- `lib/db.ts` exporting `db` (the Prisma client singleton)
- npm scripts `db:up`/`db:migrate`/`db:seed` (Phase 3+ rely on these)
- `.env.example` documenting `DATABASE_URL`
- Postgres running locally on port 5432 via `docker-compose.dev.yml`

**Done when:**
- `npm run db:up && npm run db:migrate && npm run db:seed` succeeds on a clean checkout
- `npx prisma studio` shows seeded People + Contracts (and Cards if seed includes them) matching the prototype
- `npm run typecheck` still passes (generated Prisma types compile)
- Committed

**Complexity:** M

**Risks:**
- Column ordering scheme: integer `position` with gaps (e.g., 1000, 2000, …) is the v1 plan. Alternative is `LexoRank`. Stick with integer-with-gaps unless we hit a rebalancing problem.
- Seeding may differ from data.jsx if that file is missing — document deviations in the seed file header.

---

# Phase 3 — tRPC backbone with read-only queries

**Upstream:**
- Phase 2 committed (Prisma schema migrated, seed data present, `lib/db.ts` exporting the client)
- npm scripts from Phase 1 + 2 working

**Skills:** `/vercel-react-best-practices`, `/typescript-advanced-types`, (tRPC v11 skill if installed)

**Read first:**
- `prisma/schema.prisma` — to know what to query
- `lib/db.ts` — the client export shape

**Build:**
- `server/trpc.ts` — initTRPC, error formatter, base `publicProcedure`
- `server/context.ts` — context factory (returns `{ db }` for now; Phase 7 adds `{ session, userId, role }`)
- `server/routers/_app.ts` — root router
- `server/routers/people.ts` — `list` query (active people only by default)
- `server/routers/contracts.ts` — `list` query (active contracts only)
- `server/routers/cards.ts` — `list` query joining Card → Person → Contract, grouped by `columnKey`, sorted by `position`. Filter `archivedAt IS NULL`
- `app/api/trpc/[trpc]/route.ts` — Next.js App Router handler using `fetchRequestHandler`
- `lib/trpc/client.ts` — typed tRPC React client
- `lib/trpc/Provider.tsx` — wraps `app/layout.tsx`'s body with `QueryClientProvider` + tRPC provider
- `app/dev/data-dump/page.tsx` — calls all three queries, dumps JSON. Throwaway; remove or guard with `NODE_ENV !== 'production'`

**Apply during build:**
- From `/vercel-react-best-practices`:
  - Parallelize independent reads with `Promise.all()` in RSC paths
  - Wrap shared per-request fetches with `React.cache()` so a layout + page calling the same query dedupes
  - Minimize RSC→client serialization — return narrow projections (`{ id, name, color }`) not full Prisma models
- From `/typescript-advanced-types`:
  - Define `RouterOutputs = inferRouterOutputs<typeof appRouter>` and `RouterInputs = inferRouterInputs<typeof appRouter>` in `lib/trpc/types.ts`
  - Component prop types reference `RouterOutputs['cards']['list']`, never re-derive from Prisma models

**Contracts produced:**
- `appRouter` exported from `server/routers/_app.ts`
- `RouterInputs` / `RouterOutputs` exported from `lib/trpc/types.ts` (used by every UI component from Phase 5 onward)
- `db` context property (Phase 7 augments this)
- `lib/trpc/Provider.tsx` mounted in `app/layout.tsx` (Phase 4 keeps this)
- Query keys: `people.list`, `contracts.list`, `cards.list` (Phase 8 invalidates these from SSE events)

**Done when:**
- `/dev/data-dump` renders the seeded data as JSON
- `import type { RouterOutputs } from '@/lib/trpc/types'` works from any new file
- `npm run build` succeeds
- Committed

**Complexity:** M

**Risks:**
- tRPC v11 vs v10 syntax differs — confirm v11 throughout (procedure builders, `httpBatchLink`, etc.).

---

# Phase 4 — Design system port: CSS, tokens, shell layout

**Upstream:**
- Phase 1–3 committed (tRPC Provider already in `app/layout.tsx`)
- `/reference/prototype/styles.css` should be in the repo for a verbatim port. If missing, build the design system from the documented tokens in `/reference/prototype/README.md` (it covers every token).

**Skills:** `/web-design-guidelines`, `/vercel-react-best-practices`

**Read first:**
- `/reference/prototype/README.md` — design tokens (priority colors `--p1`…`--p5`, semantic colors `--ink`, `--bg`, `--surface`, `--line`, etc.), typography, spacing, all component specs
- `/reference/prototype/styles.css` (if available)
- `/reference/prototype/app.jsx` — to understand the shell components

**Build:**
- `app/globals.css` — the full design system. Port verbatim from prototype styles.css when available; otherwise build from README tokens
- `components/shell/ThemeProvider.tsx` — sets `data-theme="dark"|"light"` on `<html>`, persists to `localStorage` in v1 (Phase 11 moves it to DB)
- `components/shell/Header.tsx` — top bar with: brand mark (gradient square), wordmark, separator, subtitle, open-task counter, role pill placeholder, theme toggle, bell placeholder
- `components/shell/MobileSplash.tsx` — shown via CSS media query below 1024px
- `app/(app)/layout.tsx` — houses Header + main content area
- Stub routes: `app/(app)/active/page.tsx`, `app/(app)/archive/page.tsx`, `app/(app)/admin/page.tsx` — each renders "Phase X coming soon"
- Update `app/layout.tsx` (root) — import `globals.css`, mount `ThemeProvider`, set `<html lang="en">` and `<meta name="theme-color">`

**Apply during port (from `/web-design-guidelines`):**
- Set `color-scheme: dark` on `<html>` for the dark theme (fixes native scrollbar + input theming)
- Add `<meta name="theme-color">` matching the dark brown background
- Replace any `:focus` rules with `:focus-visible` — never `outline: none` without a replacement
- Honor `prefers-reduced-motion` — wrap animations in a media query that disables them
- Replace any `transition: all` with explicit property lists; animate only `transform`/`opacity`
- Preload critical fonts with `<link rel="preload" as="font">` + `font-display: swap`

**Apply (from `/vercel-react-best-practices`):**
- Header is a client component; everything else server-renders by default

**Contracts produced:**
- `app/globals.css` with all CSS custom properties used by later phases
- `<Header />` component (Phase 5 board page renders inside this shell)
- `data-theme` attribute on `<html>` toggleable (Phase 11 wires this to user prefs)
- `MobileSplash` visible below 1024px (Phase 5 doesn't need to handle mobile)
- Stub routes `/active`, `/archive`, `/admin` exist (Phase 5/6/9 fill them in)

**Done when:**
- Side-by-side with `/reference/prototype/Kanban Board.html` (if available) or the README spec, the header looks identical
- Theme toggle works and persists across reloads
- Resizing below 1024px shows the splash
- Lighthouse a11y score ≥ 95 on `/`
- `npm run build` passes
- Committed

**Complexity:** M

**Risks:**
- If `styles.css` is missing, the port becomes "build from README tokens" which is slower and risks drift from the prototype. Flag this in the commit message if it happens.

---

# Phase 5 — Board read-only with @dnd-kit (no persistence)

**Upstream:**
- Phase 4 committed (design system + shell)
- Phase 3 committed (`cards.list`, `RouterOutputs` available)

**Skills:** `/vercel-react-best-practices`, `/vercel-composition-patterns`, `/web-design-guidelines`, (@dnd-kit skill if installed)

**Read first:**
- `/reference/prototype/board.jsx` — column + swimlane layouts, DnD logic
- `/reference/prototype/card.jsx` — card visual, priority pip, person stripe, contract badge
- `/reference/prototype/data.jsx` (if available) — for `effectivePriority`, `priorityColor`, `autoPriority` aging math
- `/reference/prototype/README.md` — Card section (layout, tint, animations)

**Build:**
- Install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `zustand`
- `lib/priority.ts` — port `effectivePriority`, `priorityColor`, `priorityLabel`, `priorityTint`, age-based escalation. Pure functions, no React.
- `stores/uiStore.ts` — Zustand store: `{ draggingCardId, hoveredColumnKey, openModal, toastQueue, setDragging, setHoveredColumn, openCardModal, closeCardModal }`
- `components/board/Board.tsx` — client component; `DndContext` wrapper; reads `cards.list`; switches between Columns and Swimlanes layout
- `components/board/Column.tsx`
- `components/board/SwimLane.tsx`
- `components/board/Card.tsx` — compound component (see below)
- `components/board/Card.Header.tsx`, `Card.Body.tsx`, `Card.PriorityPip.tsx`, `Card.PersonStripe.tsx`, `Card.ContractBadge.tsx`
- `app/(app)/active/page.tsx` — server component, fetches initial data via tRPC, hands off to `<Board />`

**Apply during build:**
- From `/vercel-react-best-practices`:
  - Zustand selectors return **primitives, not object references** (re-render rule)
  - Module-level component definitions; never inline inside list renderers (`rerender-no-inline-components`)
  - Wrap drag-state updates in `startTransition`
  - Use `next/dynamic` to defer @dnd-kit from non-board routes (`bundle-dynamic-imports`)
  - Passive event listeners for drag-over handlers
- From `/vercel-composition-patterns`:
  - `<Card>` is a compound component — `<Card.Header>`, `<Card.Body>`, `<Card.PriorityPip>`, `<Card.PersonStripe>` — no boolean prop proliferation
- From `/web-design-guidelines`:
  - Apply `inert` to the dragged card
  - Disable text selection during drag (CSS `user-select: none` on `body` while a drag is active)
  - Add `aria-live="polite"` region announcing "Card X moved from Y to Z" for screen readers
  - Keyboard drag support via @dnd-kit's `KeyboardSensor`

**Contracts produced:**
- `<Board />` component (Phase 6 wires mutations into it)
- `uiStore` Zustand instance + its hook (`useUIStore`)
- `lib/priority.ts` exports (Phase 6 uses for "change priority" action)
- Card compound components (Phase 6 adds context menu, edit modal triggers)

**Done when:**
- `/active` renders all seeded cards at prototype fidelity (mouse drag + keyboard drag both work visually)
- Refresh reverts (persistence is Phase 6)
- Board route bundle does not include @dnd-kit on initial RSC payload (verify in Next.js bundle analyzer)
- `npm run build` passes
- Committed

**Complexity:** L

**Risks:**
- @dnd-kit + React 19 strict mode: there have been edge cases historically. Use latest @dnd-kit (≥ 6.3) which targets React 18+; pin if issues arise.

---

# Phase 6 — Card mutations: move, edit, create, archive

**Upstream:**
- Phase 5 committed (board renders, DnD works visually)
- `RouterInputs`/`RouterOutputs` from Phase 3 available

**Skills:** `/vercel-react-best-practices`, `/vercel-composition-patterns`, `/supabase-postgres-best-practices`, `/typescript-advanced-types`, (tRPC, Prisma, Radix skills if installed)

**Read first:**
- `/reference/prototype/card.jsx` — context menu items, edit modal fields
- `/reference/prototype/app.jsx` — `TaskModal` shape, field validation
- `server/routers/cards.ts` (existing — currently only `list`)
- `stores/uiStore.ts`

**Build:**
- Install `@radix-ui/react-dialog`, `@radix-ui/react-context-menu`, `@radix-ui/react-dropdown-menu`
- tRPC mutations in `server/routers/cards.ts`:
  - `move({ id, toColumnKey, toPosition })` — transaction-wrapped; updates `columnKey` + `position`
  - `update({ id, ...fields })`
  - `create({ ...fields })`
  - `archive({ id })` — sets `archivedAt = now()`
  - `restore({ id })` — sets `archivedAt = null`
- `lib/hooks/useOptimisticMutation.ts` — generic `useOptimisticMutation<TInput, TEntity>` helper that captures pre-state, applies optimistic patch, rolls back on error. Keyed by entity type so card / person / contract mutations share one primitive. Use `infer` to extract input/output types from tRPC procedures.
- `components/board/CardEditModal.tsx` — Radix Dialog port of the prototype's `TaskModal`
- `components/board/CardContextMenu.tsx` — Radix ContextMenu — Edit, Archive, Change Priority (cascading submenu)
- `components/board/NewCardButton.tsx` — per-column affordance
- `app/(app)/archive/page.tsx` — lists archived cards with Restore action

**Apply during build:**
- From `/typescript-advanced-types`: `useOptimisticMutation` is generic over `TInput`/`TEntity`; use `infer` against the tRPC procedure types
- From `/vercel-react-best-practices`: `Promise.all()` in any mutation touching multiple entities; `React.cache()` on read-after-write paths
- From `/supabase-postgres-best-practices`: wrap `cards.move` in a Prisma transaction (atomic column + position update); rely on the `(columnKey, position)` index from Phase 2
- All mutations are `protectedProcedure` from Phase 7 — but Phase 7 hasn't shipped yet. Use `publicProcedure` here with a TODO comment; Phase 7 will swap the import

**Contracts produced:**
- Mutations `cards.move`, `cards.update`, `cards.create`, `cards.archive`, `cards.restore` (Phase 7 adds role guards; Phase 8 watches for changes via SSE)
- `useOptimisticMutation` hook (Phase 9 reuses for people/contracts)
- `CardEditModal`, `CardContextMenu`, `NewCardButton` components
- `/archive` route fully functional

**Done when:**
- Drag → refresh → card stays in new column
- Edit fields → refresh → persisted
- Archive → leaves Active, appears in Archive → Restore → returns
- Network tab shows optimistic updates apply immediately; mutation rejection rolls back visibly
- `npm run build` passes
- Committed

**Complexity:** L

**Risks:**
- Optimistic update + Postgres transaction failure: ensure rollback always fires on error. Test by throwing in the mutation server-side and checking the UI reverts.

---

# Phase 7 — Auth: NextAuth + Google + allowlist + RBAC

**Upstream:**
- Phase 6 committed
- User supplies: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BOOTSTRAP_MANAGER_EMAIL`, `NEXTAUTH_SECRET` (random 32-byte hex)

**Skills:** `/supabase-postgres-best-practices`, (NextAuth/Auth.js v5 skill, tRPC skill if installed)

**Read first:**
- `server/context.ts` — to know where to inject session
- `server/routers/*` — to know which procedures to guard

**Build:**
- Install `next-auth@beta` (Auth.js v5), `@auth/prisma-adapter`
- `auth.ts` (root) — NextAuth config: Google provider, Prisma adapter, custom `signIn` callback rejecting emails not in `AllowedUser`, `session` callback augmenting with `role` + `userId`
- `lib/auth/bootstrap.ts` — on server boot, if `AllowedUser` is empty and `BOOTSTRAP_MANAGER_EMAIL` is set, insert the manager
- `middleware.ts` (Next.js) — redirect unauthenticated requests to `/signin` (except `/api/auth/*` and `/signin`)
- `app/signin/page.tsx` — minimal styled sign-in with Google button
- Update `server/context.ts` — read session, attach `userId` + `role`
- `server/trpc.ts` — add `protectedProcedure`, `adminProcedure`, `managerProcedure` middleware
- Apply to existing routers:
  - Public reads: none (everything requires auth)
  - `protectedProcedure`: all `*.list` queries, `cards.create`
  - Strict-ownership check inside `cards.move`/`update`/`archive`/`restore`: Employee → only own; Admin/Manager → any
  - `managerProcedure`: anything from Phase 9 (people/contracts/allowlist mutations)
- Dev bypass: when `AUTH_DEV_USER_EMAIL` env var is set and `NODE_ENV !== 'production'`, the context attaches that user without going through Google. Document this clearly in `.env.example`.

**Apply during build:**
- From `/supabase-postgres-best-practices`: ensure `AllowedUser.email` is `unique` and indexed; case-fold emails on insert (store lowercase)

**Contracts produced:**
- `auth.ts` exporting NextAuth handlers + `auth()` server helper
- `protectedProcedure` / `adminProcedure` / `managerProcedure` in `server/trpc.ts` (Phases 8+ use these)
- `ctx.session`, `ctx.userId`, `ctx.role` (Phases 8, 9, 10 read these)
- `/signin` route, `/api/auth/[...nextauth]/route.ts`
- `.env.example` lists `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `BOOTSTRAP_MANAGER_EMAIL`, `AUTH_DEV_USER_EMAIL` (dev-only)

**Done when:**
- No auth env vars set + visit `/` → redirected to `/signin`
- Google sign-in as `BOOTSTRAP_MANAGER_EMAIL` → board loads
- Sign in as a non-allowlisted email → rejected (stays at `/signin` with error)
- As Employee, attempt `cards.move` on a card not assigned to me → server rejects (UI shows error, optimistic update rolls back)
- Dev bypass works with no Google round-trip
- `npm run build` passes
- Committed

**Complexity:** L

**Risks:**
- NextAuth v5 (`next-auth@beta`) has had breaking changes during beta. Pin the exact version that works.
- Make sure the bootstrap insertion is idempotent (don't insert on every boot if already present).

---

# Phase 8 — Real-time sync via LISTEN/NOTIFY → SSE

**Upstream:**
- Phase 7 committed (session cookie available for SSE auth)
- Phase 6 mutations committed (these are the sources of NOTIFY events)

**Skills:** `/supabase-postgres-best-practices` (triggers + functions guidance), (SSE-in-Next.js skill if found — likely bespoke)

**Read first:**
- `prisma/schema.prisma`
- `server/routers/cards.ts` (and any mutation files from Phase 9 if running after)
- `lib/trpc/Provider.tsx` — query client to invalidate

**Build:**
- New Prisma migration: trigger function `notify_conbon_event()` that emits `pg_notify('conbon_events', json_build_object('type', TG_TABLE_NAME, 'op', TG_OP, 'id', NEW.id))`. Triggers `AFTER INSERT/UPDATE/DELETE` on `Card`, `Person`, `Contract`
- `lib/realtime/listener.ts` — server-side module that opens one `pg` client `LISTEN conbon_events` connection per Node process, fans out to a Set of connected SSE subscribers
- `app/api/events/route.ts` — SSE endpoint. Read session via NextAuth `auth()` helper; reject unauthenticated. Subscribe; flush events as `text/event-stream`. Heartbeat every 25s. Clean up on disconnect.
- `lib/realtime/useRealtimeSync.ts` — client hook: `EventSource('/api/events')`, on message invalidate the relevant React Query key (`['cards', 'list']`, `['people', 'list']`, `['contracts', 'list']`). Exponential backoff on disconnect.
- Mount `useRealtimeSync()` in `app/(app)/layout.tsx`

**Apply during build:**
- From `/supabase-postgres-best-practices`: trigger payloads small (id + op + table); never serialize the full row in `pg_notify` (8 KB limit)
- Single-process constraint documented in `lib/realtime/listener.ts` header — LISTEN is per-connection; multi-process needs Redis pubsub

**Contracts produced:**
- Postgres trigger emitting on `Card`/`Person`/`Contract` writes (Phase 9 mutations automatically participate)
- `/api/events` SSE endpoint
- `useRealtimeSync()` client hook (already mounted in layout — invalidates queries app-wide)

**Done when:**
- Two browsers signed in as different users
- Move a card in browser A → browser B updates within ~1s without manual refresh
- Disconnect (kill the dev server) → browser auto-reconnects when it comes back
- `npm run build` passes
- Committed

**Complexity:** L

**Risks:**
- Hot-reload during dev can leak Postgres LISTEN connections. Mitigation: `globalThis` singleton pattern in `lib/realtime/listener.ts`.
- Vercel-style serverless would kill this — confirm `next.config.ts` is not configured for edge runtime on `/api/events`.

---

# Phase 9 — Admin: people, contracts, allowlist CRUD UIs *(parallel with Phase 8)*

**Upstream:**
- Phase 7 committed (RBAC available, `managerProcedure`/`adminProcedure` exported)
- Phase 6 committed (Radix UI patterns + `useOptimisticMutation` available)
- (Phase 8 not required — this can ship in parallel)

**Skills:** `/vercel-react-best-practices`, `/vercel-composition-patterns`, `/web-design-guidelines`, (tRPC, Prisma, Radix skills if installed)

**Read first:**
- `/reference/prototype/admin.jsx` (scratch — confirm what's worth porting)
- `/reference/prototype/README.md` Admin section
- `server/routers/people.ts`, `contracts.ts`
- Phase 6's `useOptimisticMutation`

**Build:**
- tRPC mutations:
  - `people.create`, `people.update`, `people.deactivate` (adminProcedure)
  - `contracts.create`, `contracts.update`, `contracts.deactivate` (adminProcedure)
  - `allowedUsers.list`, `allowedUsers.add`, `allowedUsers.remove` (managerProcedure)
- Admin pages:
  - `app/(app)/admin/page.tsx` — landing with tab nav
  - `app/(app)/admin/people/page.tsx` — table, edit modal (Radix Dialog), color picker constrained to palette
  - `app/(app)/admin/contracts/page.tsx`
  - `app/(app)/admin/access/page.tsx` — managerProcedure-only (Admin tier sees a 403 message)
- Color picker constrained to the palette stored in `lib/palette.ts` (port from `data.jsx` / README)

**Apply during build:**
- From `/vercel-composition-patterns`: build `<DataTable>` as a compound component (`<DataTable.Header>`, `<DataTable.Row>`, `<DataTable.Empty>`); reuse for people + contracts + allowlist
- From `/web-design-guidelines`: every form input has a `<label>` or `aria-label`; submit buttons have explicit loading state with `aria-busy`

**Contracts produced:**
- Mutations for people/contracts/allowlist (Phase 8 events fire on these automatically)
- `<DataTable>` compound component (reusable in future phases)
- `lib/palette.ts` — exported palette array (Phase 5 should retroactively reference this if not already)

**Done when:**
- Signed in as Manager: create a person → appears in card assignee dropdown
- Add an email to allowlist → that email can sign in via Google
- Deactivate a person → hidden from pickers, historical cards still show the name
- Signed in as Admin: people/contracts work, allowlist returns 403
- Committed

**Complexity:** M

---

# Phase 10 — Audit log + History UI + in-app notifications

**Upstream:**
- Phase 8 committed (real-time pipe is the transport for toasts)
- Phase 6 + 9 committed (mutations exist to be audited)

**Skills:** `/supabase-postgres-best-practices`, `/vercel-react-best-practices`, `/typescript-advanced-types`, (Prisma middleware / Radix Toast skills if installed)

**Read first:**
- `prisma/schema.prisma` — `AuditLog` model
- `lib/db.ts` — to add the Prisma client extension
- All mutation routers (cards, people, contracts, allowedUsers)

**Build:**
- `lib/audit.ts` — Prisma client extension. On any mutation, capture `{ actorId, entityType, entityId, action, before, after }` and write to `AuditLog`. Use `$transaction` so the audit row commits with the mutation atomically
- Update `lib/db.ts` to wire the extension
- tRPC: `audit.listForEntity({ entityType, entityId })` (the History query); `audit.listForUser({ since })` (the notifications feed)
- `components/audit/HistoryButton.tsx` + `HistoryModal.tsx` — Radix Dialog; renders chronological events as a diff
- `lib/audit/diff.ts` — `AuditEvent<TEntity>` generic with `before`/`after` as `Partial<TEntity>` constrained by mapped type over the entity union. Single diff renderer takes `AuditEvent<unknown>` and uses discriminated dispatch to pick per-entity field renderer
- `components/notifications/BellIcon.tsx` — header bell with badge (count of unread events affecting current user)
- `components/notifications/BellDropdown.tsx` — Radix DropdownMenu
- `components/notifications/Toast.tsx` — Radix Toast — triggered by SSE events affecting current user
- `prefs.markRead` mutation; `Person.lastSeenAt` (add via migration)
- Wire `useRealtimeSync` to fire toasts on relevant events

**Apply during build:**
- From `/typescript-advanced-types`: `AuditEvent<TEntity>` generic with `Partial<TEntity>`-constrained before/after; discriminated-union diff renderer
- From `/supabase-postgres-best-practices`: rely on the Phase 2 indexes `(entityType, entityId, createdAt DESC)` and `(actorId, createdAt DESC)`. No JSONB GIN index in v1.

**Contracts produced:**
- Prisma extension writing to `AuditLog` on every mutation (transparent to existing routers)
- `audit.listForEntity` / `audit.listForUser` queries
- `<HistoryButton>` / `<HistoryModal>` (Phase 6's CardEditModal embeds the button)
- `<Toast>` / `<BellIcon>` / `<BellDropdown>` (mounted in Header from Phase 4)

**Done when:**
- User A assigns a card to user B → user B's bell increments → opening it shows the event → opening the card's History shows the assignment with a readable diff
- Audit query for one card's history returns in <50 ms with 10 k log rows seeded
- `npm run build` passes
- Committed

**Complexity:** L

**Risks:**
- Prisma client extensions don't fire on raw `$executeRaw` — document and avoid raw mutations in routers.

---

# Phase 11 — Per-user preferences + tweaks-panel strip *(parallel with Phase 9 or 10)*

**Upstream:**
- Phase 7 committed (need `userId` in context to persist prefs per user)
- Phase 4 committed (theme + layout toggles to wire up)

**Skills:** `/vercel-react-best-practices`

**Read first:**
- `/reference/prototype/tweaks-panel.jsx` (if available) — confirm what's being removed
- `components/shell/ThemeProvider.tsx` from Phase 4
- `prisma/schema.prisma` — `UserPreference` model

**Build:**
- tRPC: `prefs.get`, `prefs.set` (protectedProcedure)
- Update `ThemeProvider.tsx`: on session load, read prefs from DB; on toggle, write to DB (debounced)
- Add layout toggle (columns vs swimlanes) to Header
- `<Board />` reads the layout pref to switch between Columns and SwimLane rendering
- Audit: `grep -ri tweaks app components lib server` returns nothing committed

**Contracts produced:**
- `prefs.get` / `prefs.set` queries (Phase 14 may test these)
- Theme + layout fully DB-backed

**Done when:**
- Set dark + swimlane on desktop A; sign in on desktop B; both preferences carry over
- No tweaks-panel code anywhere in `app/`, `components/`, `server/`, `lib/`
- Committed

**Complexity:** S

---

# Phase 12 — Production Docker image + Compose stack

**Upstream:**
- Phase 1–10 committed
- User supplies: domain name

**Skills:** (Docker multi-stage Node, Caddy, Postgres-in-Docker backup skills if installed)

**Read first:**
- `next.config.ts` — confirm `output: 'standalone'`
- `docker-compose.dev.yml` — base for the prod variant
- `package.json` — to know which scripts are needed at runtime

**Build:**
- `Dockerfile` — multi-stage:
  - `deps`: install with `--frozen-lockfile`
  - `builder`: `prisma generate && next build`
  - `runner`: Node 22 alpine, copy `.next/standalone`, `.next/static`, `public`, `prisma/`. Non-root user. `CMD ["node", "server.js"]`
- `docker-compose.prod.yml`:
  - `app` (built from Dockerfile, depends_on: postgres healthy)
  - `postgres:16-alpine` (named volume, env-driven creds)
  - `caddy:2-alpine` (mounts `Caddyfile`, volumes for certs + sites)
- `Caddyfile` — the user's domain, automatic Let's Encrypt, reverse proxy to `app:3000`, special handling for `/api/events` (no buffering — SSE)
- `.env.production.example` — every env var listed (DATABASE_URL, NEXTAUTH_*, GOOGLE_*, BOOTSTRAP_MANAGER_EMAIL, DOMAIN)
- `scripts/backup-db.sh` — nightly `pg_dump` to a host-mounted volume; cron via `docker compose` `cron` service or host cron
- Healthchecks on all three services
- Update root `README.md` with deployment section

**Apply during build:**
- Caddy must proxy SSE with `flush_interval -1` (no buffering) — verify in the Caddyfile

**Contracts produced:**
- `Dockerfile` building a working image
- `docker-compose.prod.yml` orchestrating app + postgres + caddy
- `Caddyfile` for the domain
- `.env.production.example` listing every required env var (Phase 13 deploy reads these)
- `scripts/backup-db.sh` (cron'd in Phase 13 or here)

**Done when:**
- On a fresh VM (or local with hostnames mapped to 127.0.0.1), `docker compose -f docker-compose.prod.yml up --build` serves the app at `https://<domain>` with a valid Let's Encrypt cert (or staging cert locally)
- Sign-in works, board loads, SSE delivers updates between two browsers
- `pg_dump` backup file lands in the mounted volume after running the script
- Committed

**Complexity:** M

**Risks:**
- Let's Encrypt rate limits in testing — use Caddy's staging issuer (`acme_ca https://acme-staging-v02.api.letsencrypt.org/directory`) while iterating, switch to prod issuer for final.

---

# Phase 13 — CI/CD: GitHub Actions build + deploy

**Upstream:**
- Phase 12 committed (image builds successfully)
- User supplies: SSH key for the VPS, deploy user, server hostname/IP, GitHub Action secrets

**Skills:** (GitHub Actions skill if installed)

**Read first:**
- `Dockerfile`, `docker-compose.prod.yml`
- `package.json` scripts

**Build:**
- `.github/workflows/ci.yml`:
  - On push (any branch) + pull request: install, `lint`, `typecheck`, `build`, run Playwright smoke (against a Postgres service container)
- `.github/workflows/deploy.yml`:
  - On push to `main` only (or the production branch you choose)
  - Build Docker image, tag with commit SHA + `latest`, push to GHCR
  - SSH to VPS, `docker compose pull && docker compose up -d`, run `prisma migrate deploy` against the postgres service, restart app
- `scripts/deploy.sh` on the VPS — orchestrates pull + migrate + restart
- GitHub Action secrets to document in README: `GHCR_TOKEN` (or use built-in `GITHUB_TOKEN`), `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`
- Rollback procedure documented: `ssh + docker tag <prev-sha> latest + docker compose up -d`

**Contracts produced:**
- Two GitHub Actions workflows
- Deploy procedure documented in README
- `latest` tag on GHCR always points to the most recently deployed image

**Done when:**
- Trivial change pushed to `main` → CI green → deploy job → live site shows the change within ~5 min, no manual SSH
- Rolling back by re-tagging the previous image works
- Committed

**Complexity:** M

**Risks:**
- Secrets leak via logs — never `echo` secrets in workflow scripts. Use `${{ secrets.X }}` only inside `env:` blocks.

---

# Phase 14 — Playwright smoke tests + polish pass

**Upstream:**
- Phase 13 committed (CI exists; this phase adds the tests CI runs)
- All other phases committed (we're testing the whole app)

**Skills:** `/web-design-guidelines`, (Playwright skill if installed)

**Read first:**
- All routes / pages built across phases
- `.github/workflows/ci.yml` — to wire Playwright into it

**Build:**
- Install `@playwright/test`
- `playwright.config.ts` — base URL from env; one project Chromium; CI reporter
- `e2e/auth.spec.ts` — dev-bypass sign-in
- `e2e/board.spec.ts` — create card → drag to In-Progress → edit title → archive → open History → restore
- `e2e/admin.spec.ts` — sign in as Manager, add person, add email to allowlist, sign-in as that new email
- Wire Playwright into `ci.yml` (Postgres service container, `db:migrate`, `db:seed`, then `npx playwright test`)
- `/reference/prototype/PARITY.md` — side-by-side fidelity sign-off: documented deviations from the prototype with rationale
- Bug-bash punch-list — worked through during this phase

**Apply during build:**
- From `/web-design-guidelines`: include a Lighthouse a11y assertion in CI on the main board route (target ≥ 95)

**Contracts produced:**
- Three E2E specs, all green in CI
- `PARITY.md` signed off
- Lighthouse a11y ≥ 95 on `/active`

**Done when:**
- `npm run test:e2e` green locally and in CI
- PARITY checklist signed off
- No known critical bugs
- Committed → deployed → production users start using ConBon

**Complexity:** M

---

## Parallelization

| Track | Phases |
|---|---|
| Critical path | 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 10 → 12 → 13 → 14 |
| Parallel branch A (after Phase 7) | Phase 9 |
| Parallel branch B (after Phase 7) | Phase 11 |

Phase 9 and Phase 11 can run in parallel sessions provided the running
phase is on a separate worktree or feature branch off `main`, merging
back when done.

## Verification

Each phase verifies via its **Done when** block. End-to-end verification
of the whole system happens at Phase 14 (Playwright + PARITY) and at
Phase 13's first real production deploy.

---

# Cost — hosting + databases

**Recurring (monthly):**

| Line item | Cost | Notes |
|---|---|---|
| Hetzner CX22 VPS | €4.51 (~$5) | 2 vCPU shared (Intel), 4 GB RAM, 40 GB SSD, 20 TB egress |
| Hetzner Cloud Backups (optional) | €0.90 (~$1) | 20% of server cost — automated nightly snapshots, 7-day retention |
| Domain registration | ~$1 amortized | $10–15/year for a `.com` from Cloudflare/Porkbun |
| Postgres | **$0** | Self-hosted in Docker Compose on the same VPS |
| TLS certificates | **$0** | Caddy auto-provisions Let's Encrypt |
| Real-time / SSE | **$0** | Postgres LISTEN/NOTIFY → SSE, no external service |
| Google OAuth | **$0** | Free tier — well under the limits for 6 users |
| GitHub Actions | **$0** | Private repo = 2,000 min/mo free; our builds use ~5 min/deploy |
| GHCR (container registry) | **$0** | Free under 500 MB for personal account |
| **Total** | **~$7/mo** (€6.40) | ~$84/year |

**One-time:** domain first-year registration ~$12 + setup time on the VPS (one evening).

**If we outgrow CX22:** CPX21 (3 vCPU AMD, 4 GB, 80 GB SSD) is €5.39/mo (~$1 more), CPX31 (4 vCPU AMD, 8 GB, 160 GB SSD) is €10.59/mo for headroom up to ~20 users.

---

# Rationale (appendix)

Every choice answers one question: *what's the smallest, most boring stack
that supports real-time multi-user collaboration, an audit trail, and the
locked design fidelity, for 4–8 users on one VPS?*

**Next.js 15 + TypeScript** — server + client in one Node process, which is required because SSE needs a long-lived process holding the Postgres LISTEN connection. TypeScript is non-negotiable: the Prisma → tRPC → React Query type pipe is half the value of the stack.

**Postgres + Prisma** — picked for `LISTEN/NOTIFY` (the entire basis of the real-time architecture). Prisma's client-extension hook is how every mutation auto-writes to the audit log.

**tRPC** — end-to-end types with zero codegen; procedures map 1:1 onto RBAC middleware. Carries React Query inside it for free.

**Zustand + React Query (both)** — different jobs. React Query owns server state (cards, people, contracts — anything in Postgres). Zustand owns transient UI state (drag preview, modal open, toast queue). Picking one means either prop-drilling everywhere or stuffing UI state into the server cache.

**Plain CSS / CSS Modules** — the prototype is already a complete design system in CSS custom properties. Porting verbatim preserves fidelity for free.

**@dnd-kit** — headless, a11y-first, actively maintained. The prototype's HTML5 DnD has no keyboard support or screen-reader story.

**Radix UI** — Dialog, ContextMenu, DropdownMenu, Toast all need focus traps, ARIA, scroll lock, return-focus. Days of a11y work, free.

**Postgres LISTEN/NOTIFY → SSE** — zero new infrastructure, browser auto-reconnects natively, server→client only matches our model (writes go through tRPC). Tradeoff: single-process. Fine for 4–8 users.

**NextAuth (Auth.js v5)** — hookable signIn callback is where the allowlist check lives. Session cookie carries through to SSE.

**Hetzner VPS + Docker Compose** — SSE needs a long-lived process; Vercel's serverless model kills it. €5/mo for predictable cost, one VPS to debug.

**GitHub Actions → GHCR → SSH** — most boring CD that works.

**Playwright E2E only** — the bugs that matter are interaction bugs (drag, modal, auth, sync); unit tests on UI components churn with design tweaks.

One thread: pick the boring option at every choice. Fit in one head, run on one VPS, debug with `docker compose logs`.

---

# Skills shopping list (gaps to fill before respective phases)

| Need | Phases | Search hint |
|---|---|---|
| Next.js 15 App Router scaffolding | 1 | "next.js app router" / "create-next-app" |
| Prisma — schema, migrations, client extensions, middleware | 2, 6, 9, 10 | "prisma" / "prisma orm" |
| tRPC v11 with Next.js App Router | 3, 6, 7, 9, 10 | "trpc" / "trpc next.js" |
| Generic Zustand (selectors, persist, SSR, testing) | 5, 6 | "zustand" (filter out LobeHub-specific repos) |
| @dnd-kit usage patterns | 5 | "dnd-kit" / "drag and drop react" |
| Radix UI — Dialog, ContextMenu, Toast | 6, 9, 10 | "radix ui" / "radix primitives" |
| NextAuth / Auth.js v5 with Google + signIn callback | 7 | "next-auth" / "auth.js" / "nextauth google" |
| SSE in Next.js route handlers | 8 | "server-sent events next.js" (likely scarce — may stay bespoke) |
| Docker multi-stage Node builds | 12 | "docker node" / "next.js dockerfile standalone" |
| Caddy reverse proxy + Let's Encrypt | 12 | "caddy" / "caddy reverse proxy" |
| Postgres in Docker — volumes, `pg_dump` backups | 12 | "postgres docker backup" |
| GitHub Actions — Docker build + GHCR + SSH deploy | 13 | "github actions docker ghcr" / "ssh deploy" |
| Playwright with Next.js + GitHub Actions service containers | 14 | "playwright next.js" / "playwright ci" |

**Skill commands to run before Phase 1:**

```bash
# Uninstall rejected skills (if currently installed)
npx skills remove vercel-react-native-skills
npx skills remove zustand              # the LobeHub one

# Install the remaining confirmed skills (in addition to vercel-react-best-practices
# and typescript-advanced-types you've already installed)
npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines
npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-composition-patterns
# Install supabase-postgres-best-practices from skills.sh per its install instructions
```

If `npx skills remove` is not the exact verb your CLI uses, try `npx skills uninstall` or delete the skill folder directly from your local `.claude/skills/`.
