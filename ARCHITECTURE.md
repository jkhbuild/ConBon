# ConBon — Architecture

Internal project-controls Kanban board for a commercial-construction team. Real-time multi-user sync, audit trail, role-based access, self-hosted on a single VPS.

## What it is

A single shared Kanban board where a Commercial Manager creates tasks (estimates, schedules, change orders) and assigns them to Estimators and Schedulers across multiple contracts. Two layouts (column-per-person and per-person swimlanes), drag-and-drop reassignment, automatic priority escalation as tasks age, manual priority overrides, inline blocker notes, and an Admin role with employee performance metrics.

Audience: ~3–6 concurrent users today (1 Commercial Manager, 4 production employees), growing to ~10. Real-time sync between users is required for shared situational awareness.

## Constraints that shaped the design

- **4–8 concurrent users max.** Capacity targets are modest. Avoids the need for serverless, edge, multi-region, or anything that bills per request.
- **Real-time sync between users.** When one user moves a card, everyone else sees it within a second or two.
- **Audit trail.** Required for change-management compliance. Every priority override, reassignment, status change, and blocker edit logs who, when, and what changed.
- **One VPS, low monthly cost.** Self-hosted on a Hetzner CX22 (~$5/month). All infrastructure (database, real-time, TLS, container registry) is either bundled or free.
- **Desktop-only v1.** Below 1024px we show a "use desktop" splash. Mobile is post-v1.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Web framework | Next.js 16 (App Router) + React 19 + TypeScript strict | Server + client in one Node process, which is required because SSE needs a long-lived process holding the Postgres LISTEN connection. The Prisma → tRPC → React Query type pipe is half the value of the stack. |
| Database | PostgreSQL 16 + Prisma 7 | Picked for `LISTEN/NOTIFY` (the entire basis of real-time). Prisma's client extensions are how every mutation auto-writes to the audit log. |
| API | tRPC v11 | End-to-end types with zero codegen; procedures map 1:1 onto RBAC middleware. Carries React Query inside it. |
| Client state | Zustand (transient) + React Query (server cache) | Different jobs, two tools. React Query owns server state (cards, people, contracts). Zustand owns drag preview, modal open, toast queue. Picking one means either prop-drilling or stuffing UI state into the server cache. |
| Drag and drop | @dnd-kit | Headless, a11y-first, actively maintained. Native HTML5 DnD has no keyboard support or screen-reader story. |
| Modals and menus | Radix UI | Focus traps, ARIA, scroll lock, return-focus on Dialog / ContextMenu / DropdownMenu / Toast. Days of a11y work for free. |
| Styling | Plain CSS / CSS Modules | The design prototype is already a complete design system in CSS custom properties; porting verbatim preserves fidelity. |
| Auth | NextAuth (Auth.js v5) + Google + email allowlist | The allowlist check goes in the `signIn` callback. Session cookie carries through to SSE. |
| Real-time | Postgres LISTEN/NOTIFY → server-sent events | Zero new infrastructure, browser auto-reconnects natively. Server→client only, which matches our model (writes go through tRPC). Single-process limit is fine for 4–8 users. |
| Hosting | Hetzner CX22 + Docker Compose + Caddy | SSE needs a long-lived process; serverless kills it. €5/mo for predictable cost, one VPS to debug. Caddy auto-provisions Let's Encrypt. |
| CI/CD | GitHub Actions → GHCR → SSH deploy | Most boring CD that works. |
| E2E tests | Playwright | The bugs that matter are interaction bugs (drag, modal, auth, sync); unit tests on UI components churn with design tweaks. |

One thread runs through every choice: pick the boring option, fit it in one head, run it on one VPS, debug it with `docker compose logs`.

## Data model

Six entities in [`prisma/schema.prisma`](prisma/schema.prisma):

- **Person** — name, optional email (for NextAuth matching), role (`EMPLOYEE` / `ADMIN` / `MANAGER`), accent color, active flag.
- **Contract** — code (e.g. `N36054`), name, optional color, active flag.
- **Card** — title, type (`ESTIMATE` / `SCHEDULE` / `OTHER`), assignmentDate, dueDate, optional priorityOverride, optional blockerNote, position (ordering within the assignee column), archivedAt (null = on the board), FKs to Person (nullable: Backlog) and Contract.
- **AllowedUser** — email + role; gates Google sign-in.
- **UserPreference** — theme + layout, one row per person.
- **AuditLog** — entityType + entityId + actorId + action + JSONB before/after.

### Key index choice

The dominant board query is "fetch active cards grouped by assignee, ordered by position". A partial B-tree index on `(assigneeId, position) WHERE archivedAt IS NULL` keeps that query tight regardless of how many archived cards accumulate. Prisma's `@@index` can't express a `WHERE` clause, so the partial index is appended as raw SQL in the init migration.

### Column model

The Kanban "columns" are people plus a Backlog bucket (`assigneeId IS NULL`). There is no separate column-state enum; the assignee is the column dimension. Drag-and-drop within or across columns is a single update to `assigneeId` + `position`.

### "Archive" vs "complete"

Cards have a single `archivedAt` timestamp; setting it removes the card from the active board and surfaces it in the Archive view. Admin metrics derive cycle time from `createdAt → archivedAt`. No separate "completed" state in v1; distinguishing later requires only adding a reason enum.

## Real-time

Every write to `Card`, `Person`, or `Contract` fires a Postgres trigger that emits a small `pg_notify('conbon_events', json_build_object(...))` with id + table + op. A single `pg` client per Node process holds a `LISTEN conbon_events` connection and fans events out to a `Set` of connected SSE subscribers.

Clients subscribe via `EventSource('/api/events')`; the handler reads the NextAuth session, rejects unauthenticated, and streams events as `text/event-stream` with a 25-second heartbeat. Receiving an event invalidates the relevant React Query key. Exponential backoff handles reconnects.

Single-process by design (LISTEN is per-connection). Multi-process would need a Redis pubsub layer; not relevant for 4–8 users.

## Auth and RBAC

- **NextAuth (Auth.js v5)** + Google OAuth. The `signIn` callback rejects any email not in the `AllowedUser` table.
- **Three roles, strictly ordered:**
  - `EMPLOYEE` — sees all cards, creates cards, edits/moves/archives only cards assigned to them.
  - `ADMIN` — Employee + edits/moves/archives any card + manages People and Contracts.
  - `MANAGER` — Admin + manages the allowlist + promotes/demotes users.
- tRPC procedures are exposed via `protectedProcedure` / `adminProcedure` / `managerProcedure` middleware. Strict-ownership checks live inside `cards.move` / `update` / `archive` / `restore`.
- One bootstrap manager email baked in via env var (`BOOTSTRAP_MANAGER_EMAIL`); that user signs in and populates everything.

## Audit trail

A Prisma client extension wraps every mutation, capturing `{ actorId, entityType, entityId, action, before, after }` into `AuditLog` within the same transaction as the underlying write. Surfaced per-card via a History modal; aggregated per-user as a notifications feed. Retention: forever.

## Deployment

Three containers via Docker Compose on the VPS: `app` (Next.js standalone build), `postgres:16-alpine` (named volume), `caddy:2-alpine` (mounts a Caddyfile, automatic Let's Encrypt). Caddy proxies `/api/events` with no buffering (`flush_interval -1` for SSE). Nightly `pg_dump` to a host-mounted volume.

CI: GitHub Actions runs lint + typecheck + build + Playwright on every push; on merge to `main`, builds the image, pushes to GHCR, SSHes to the VPS, and runs `docker compose pull && up -d && prisma migrate deploy`.

## Cost

Recurring monthly cost at 4–8 users:

| Line item | Cost |
|---|---|
| Hetzner CX22 VPS (2 vCPU, 4 GB RAM, 40 GB SSD, 20 TB egress) | €4.51 (~$5) |
| Hetzner Cloud Backups (optional, 7-day) | €0.90 (~$1) |
| Domain (amortized) | ~$1 |
| Postgres / TLS / SSE / OAuth / CI / GHCR | $0 (self-hosted or free tier) |
| **Total** | **~$7/mo** (€6.40) |

Headroom: CPX21 (3 vCPU AMD, 4 GB, 80 GB) is €5.39/mo; CPX31 (4 vCPU AMD, 8 GB, 160 GB) is €10.59/mo and supports ~20 users.

## The prototype

The starting point is in [`reference/prototype/`](reference/prototype/) — a React-in-the-browser prototype that demonstrates the intended look, behavior, and interactions, plus the full design system spec in [`reference/prototype/README.md`](reference/prototype/README.md). The production app recreates that prototype against the stack above.
