# ConBon

Internal project-controls Kanban board for a commercial-construction team.

Real-time multi-user sync, audit trail, role-based access, self-hosted on a single VPS.

## Stack

- Next.js (App Router) + TypeScript + React 19
- PostgreSQL + Prisma
- tRPC + React Query
- Zustand (transient UI state)
- @dnd-kit (drag-and-drop)
- Radix UI primitives
- NextAuth (Auth.js v5) with Google + manager-managed allowlist
- Hetzner VPS + Docker Compose + Caddy
- GitHub Actions → GHCR → SSH deploy

See [`PLAN.md`](./PLAN.md) for the full phased implementation plan and rationale.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint (`eslint .`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run format` | Prettier write |

## Repo layout

```
.
├── PLAN.md                      ← per-phase implementation plan (read first)
├── README.md                    ← this file
├── app/                         ← Next.js App Router
│   ├── layout.tsx
│   └── page.tsx
├── reference/prototype/         ← original design prototype (read-only)
│   ├── README.md                ← design tokens + system spec (24 KB)
│   ├── app.jsx, board.jsx, card.jsx, admin.jsx
│   └── (data.jsx, styles.css, Kanban Board.html, tweaks-panel.jsx — add locally)
├── package.json, tsconfig.json, next.config.ts
├── eslint.config.mjs, .prettierrc
├── .gitignore, .dockerignore
└── (future phases add: prisma/, server/, lib/, components/, stores/, scripts/, …)
```

## Implementation status

Per `PLAN.md`, the project ships in 14 phases. Current status:

- ✅ **Phase 0** — Architecture locked, plan committed, prototype preserved, scaffolding complete
- ⏳ **Phase 1** — Repo scaffolding & prototype preservation (this commit)
- ⬜ Phase 2 — Database, Prisma, data model
- ⬜ Phases 3–14 — see `PLAN.md`

## Local reference materials

The design handoff folder (`design_handoff_conbon_kanban/` if you keep it locally) is gitignored. The files required by later phases live at `reference/prototype/` and are tracked.
