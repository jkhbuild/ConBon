# ConBon

Internal project-controls Kanban board for a commercial-construction team.

Real-time multi-user sync, audit trail, role-based access, self-hosted on a single VPS. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the stack, data model, real-time approach, auth model, deployment, and cost.

## Quick start

```bash
npm install
cp .env.example .env
npm run db:up         # starts the local Postgres 16 container
npm run db:migrate    # applies migrations
npm run db:seed       # seeds 4 people, 4 contracts, 15 cards (dev only)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run format` | Prettier write |
| `npm run db:up` / `db:down` | Start / stop the local Postgres container |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:reset` | Drop, re-migrate, re-seed |
| `npm run db:seed` | Run the dev seed |
| `npm run db:studio` | Open Prisma Studio |

## Repo layout

```
.
├── ARCHITECTURE.md            ← stack + data model + real-time + auth + deployment
├── README.md
├── app/                       ← Next.js App Router
├── server/routers/            ← tRPC procedures
├── lib/
│   ├── db.ts                  ← Prisma client singleton (PrismaPg adapter)
│   ├── trpc/                  ← tRPC client + types + Provider
│   ├── realtime/              ← LISTEN/NOTIFY + useRealtimeSync
│   ├── audit/                 ← Prisma extension writing to AuditLog
│   ├── auth/                  ← NextAuth helpers
│   └── hooks/
├── components/
│   ├── shell/                 ← Header, ThemeProvider, MobileSplash
│   ├── board/                 ← Board, Card compound, modals
│   ├── audit/                 ← History modal
│   └── notifications/         ← Bell, Toast
├── stores/                    ← Zustand UI store
├── prisma/                    ← schema, migrations, seed
├── scripts/                   ← backup, deploy
├── e2e/                       ← Playwright
├── .github/workflows/         ← CI + deploy
├── reference/prototype/       ← original React-in-browser design prototype
│   └── README.md              ← design tokens + system spec
├── docker-compose.dev.yml
└── package.json, tsconfig.json, next.config.ts, eslint.config.mjs, .prettierrc
```

The design prototype in `reference/prototype/` is the visual + behavioral source of truth; the production app recreates it against the architecture in `ARCHITECTURE.md`.
