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
├── README.md
├── app/                         ← Next.js App Router
│   ├── layout.tsx, page.tsx     ← Phase 1 (done)
│   ├── (app)/                   ← Phase 4 fills shell + nested routes
│   │   ├── active/              ← Phase 5 (board)
│   │   ├── archive/             ← Phase 6
│   │   └── admin/{people,contracts,access}/  ← Phase 9
│   ├── api/
│   │   ├── trpc/[trpc]/         ← Phase 3
│   │   ├── auth/[...nextauth]/  ← Phase 7
│   │   └── events/              ← Phase 8 (SSE)
│   ├── signin/                  ← Phase 7
│   └── dev/data-dump/           ← Phase 3 (throwaway)
├── server/
│   └── routers/                 ← Phase 3 (tRPC procedures)
├── lib/
│   ├── db.ts                    ← Phase 2 (Prisma client singleton)
│   ├── auth/                    ← Phase 7
│   ├── trpc/                    ← Phase 3 (client + types + Provider)
│   ├── realtime/                ← Phase 8 (LISTEN/NOTIFY + useRealtimeSync)
│   ├── hooks/                   ← Phase 6 (useOptimisticMutation)
│   └── audit/                   ← Phase 10
├── components/
│   ├── shell/                   ← Phase 4 (Header, ThemeProvider, MobileSplash)
│   ├── board/                   ← Phase 5–6 (Board, Card compound, modals)
│   ├── audit/                   ← Phase 10 (History modal)
│   └── notifications/           ← Phase 10 (Bell, Toast)
├── stores/                      ← Phase 5 (Zustand uiStore)
├── prisma/                      ← Phase 2 (schema + seed)
├── scripts/                     ← Phase 12–13 (backup, deploy)
├── e2e/                         ← Phase 14 (Playwright)
├── .github/workflows/           ← Phase 13 (ci.yml, deploy.yml)
├── reference/prototype/         ← original design prototype (read-only)
│   ├── README.md                ← design tokens + system spec (24 KB)
│   ├── app.jsx, board.jsx, card.jsx, admin.jsx
│   └── (data.jsx, styles.css, Kanban Board.html, tweaks-panel.jsx — add locally)
├── package.json, package-lock.json, tsconfig.json, next.config.ts
├── eslint.config.mjs, .prettierrc
└── .gitignore, .dockerignore
```

Directories show empty `.gitkeep` placeholders. Each phase replaces its placeholders with real files.

## Implementation status

Per `PLAN.md`, the project ships in 14 phases. Current status:

- ✅ **Phase 1** — Repo scaffolding & prototype preservation
- ⏳ **Phase 2** — Database, Prisma, data model (next)
- ⬜ Phases 3–14 — see `PLAN.md`

## Local reference materials

The design handoff folder (`design_handoff_conbon_kanban/` if you keep it locally) is gitignored. The files required by later phases live at `reference/prototype/` and are tracked.
