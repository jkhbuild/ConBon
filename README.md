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

## Deploy (production)

Single-VPS Docker Compose stack: Postgres 16 + the Next.js standalone app + Caddy (TLS termination + reverse proxy + HTTP/3). Sized for a 4–8 person team on a €5/month Hetzner CX22.

### Prerequisites

- A Linux VPS with Docker Engine + Compose v2 (e.g. Ubuntu 24.04 on Hetzner CX22)
- A domain pointing at the VPS (A/AAAA records) — Let's Encrypt validates over :80
- A Google OAuth client with `https://<DOMAIN>/api/auth/callback/google` as an authorized redirect URI
- The email of the bootstrap manager (the human who'll seed people / contracts / allowlist via `/admin`)

### First deploy

```bash
git clone https://github.com/jkhbuild/ConBon.git /opt/conbon
cd /opt/conbon
cp .env.production.example .env.production
# Fill in DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD, DATABASE_URL,
# NEXTAUTH_URL, NEXTAUTH_SECRET, GOOGLE_*, BOOTSTRAP_MANAGER_EMAIL.

docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

The first `up` does, in order: build the app + migrator images (~3 min on CX22), start postgres, wait for `pg_isready`, run `prisma migrate deploy` (the `migrate` service exits cleanly), boot the Next.js standalone server, boot Caddy. Caddy negotiates a Let's Encrypt cert on the first request (~10s).

Verify: `docker compose -f docker-compose.prod.yml ps` shows three services running and `migrate` exited 0. Browse to `https://<DOMAIN>`, sign in as the bootstrap manager via Google, populate People + Contracts + AllowedUsers from `/admin`.

### Iterating against Let's Encrypt without burning rate limits

LE caps "duplicate certificates" at 5/week. While validating DNS or the Caddyfile, uncomment the staging ACME line in `Caddyfile`:

```
acme_ca https://acme-staging-v02.api.letsencrypt.org/directory
```

Re-comment and `docker compose -f docker-compose.prod.yml restart caddy` once the deploy is stable. Staging certs aren't browser-trusted but prove the handshake works end-to-end.

### Updates

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Compose rebuilds the migrator + app images; `migrate` re-runs (idempotent), `app` waits on `migrate` completing before restarting.

### Backups

`scripts/backup-db.sh` runs `pg_dump` inside the postgres container, gzips the output to `./backups/conbon-<UTC-timestamp>.sql.gz`, and prunes anything older than the most recent 14 dumps.

```bash
chmod +x scripts/backup-db.sh   # one-time, if git didn't carry the mode bit
./scripts/backup-db.sh
```

Schedule via host cron — 02:30 UTC nightly:

```
30 2 * * * cd /opt/conbon && ./scripts/backup-db.sh >> backups/backup.log 2>&1
```

Restore (destructive — `--clean --if-exists` drops then recreates objects):

```bash
gunzip -c backups/conbon-<UTC-timestamp>.sql.gz \
  | docker compose -f docker-compose.prod.yml exec -T postgres \
      psql -U conbon -d conbon
```

### Operational notes

- **SSE pipe.** Caddy reverse-proxies `/api/events` with `flush_interval -1` and no compression so real-time updates aren't buffered. Don't add `encode` inside the `@sse handle` block.
- **Bootstrap is once.** `BOOTSTRAP_MANAGER_EMAIL` only inserts a row when `AllowedUser` is empty. Once any row exists, subsequent boots no-op — leave the var set or remove it.
- **Postgres isn't published.** Compose deliberately doesn't expose port 5432 to the host; only the in-network `app` + `migrate` services + the backup script (via `docker compose exec`) reach the DB.
- **Caddy data volume.** `caddy_data` holds the ACME account + issued certs. Don't delete casually — losing it forces re-issuance and can trip LE's duplicate-cert rate limit.

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
├── docker-compose.prod.yml      ← postgres + migrate + app + caddy
├── Dockerfile                   ← multi-stage: deps / builder / migrator / runner
├── Caddyfile                    ← reverse proxy + Let's Encrypt + SSE carve-out
├── .env.production.example      ← prod env template
└── package.json, tsconfig.json, next.config.ts, eslint.config.mjs, .prettierrc
```

The design prototype in `reference/prototype/` is the visual + behavioral source of truth; the production app recreates it against the architecture in `ARCHITECTURE.md`.
