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

> Once GitHub Actions secrets are configured (next section), subsequent deploys run automatically on push to `main`. The local `--build` path above stays as a fallback for the very first boot or for offline debugging.

### Continuous deployment

Two workflows under `.github/workflows/`:

- `ci.yml` — runs on pull requests and feature-branch pushes. Installs deps, lints, typechecks, and runs `next build`. ~2 min cold, ~30s warm.
- `deploy.yml` — runs on push to `main` and on manual dispatch. Re-runs the CI checks, builds the runner + migrator images, pushes them to `ghcr.io/jkhbuild/conbon-app` and `ghcr.io/jkhbuild/conbon-migrate` tagged with both the commit SHA and `latest`, then SSHes to the VPS and runs `scripts/deploy.sh <sha>`.

End-to-end deploy time on the merge commit is ~5 min: ~2 min for the checks, ~2 min for the Docker build+push (cached layers shave a chunk off after the first run), ~30s for the SSH + `compose pull` + `up`.

**GitHub repo secrets** (Settings → Secrets and variables → Actions → Repository secrets):

| Name | Value |
|---|---|
| `DEPLOY_HOST` | VPS hostname or IP (e.g. `conbon.example.com`) |
| `DEPLOY_USER` | SSH login user with write access to `/opt/conbon` and Docker (e.g. `deploy`) |
| `DEPLOY_SSH_KEY` | Private key matching a `~/.ssh/authorized_keys` entry for `DEPLOY_USER` on the VPS. Generate fresh: `ssh-keygen -t ed25519 -f conbon-deploy -C "github-actions"` — paste the private key (`conbon-deploy`) here, push the public key (`conbon-deploy.pub`) to the VPS |
| `DEPLOY_FINGERPRINT` | *(strongly recommended)* SHA256 fingerprint of the VPS's SSH host key — pins the connection against MITM. Generate from any workstation that already trusts the host: `ssh-keyscan -t ed25519 <host> \| ssh-keygen -lf - \| awk '{print $2}'`. Leave unset to fall back to `StrictHostKeyChecking=no` (works but MITM-vulnerable) |

**GitHub repo variable** (same screen, "Variables" tab): `DOMAIN` — used as the deploy URL on the workflow's environment page.

The built-in `GITHUB_TOKEN` (provided by Actions) handles GHCR auth via the workflow's `permissions: { packages: write }` block — no PAT to manage.

**One-time VPS prep** before the first CI deploy:

```bash
# As root or sudo
adduser --disabled-password deploy
usermod -aG docker deploy
mkdir -p /opt/conbon && chown deploy:deploy /opt/conbon

# As deploy
git clone https://github.com/jkhbuild/ConBon.git /opt/conbon
cd /opt/conbon
cp .env.production.example .env.production && vi .env.production    # fill it in

# Optionally do the manual first deploy here too so :latest exists on GHCR
# before relying on CI for subsequent pushes.
```

Add the SSH public key to `/home/deploy/.ssh/authorized_keys`. Confirm with `ssh -i conbon-deploy deploy@<host> 'docker ps'` from a workstation; expect zero output and exit code 0.

### Iterating against Let's Encrypt without burning rate limits

LE caps "duplicate certificates" at 5/week. While validating DNS or the Caddyfile, uncomment the staging ACME line in `Caddyfile`:

```
acme_ca https://acme-staging-v02.api.letsencrypt.org/directory
```

Re-comment and `docker compose -f docker-compose.prod.yml restart caddy` once the deploy is stable. Staging certs aren't browser-trusted but prove the handshake works end-to-end.

### Updates

CI handles updates automatically — push to `main` (typically by merging a PR), GitHub Actions runs `deploy.yml`, and the new commit is live in ~5 min.

For a manual update (no CI), SSH to the VPS and run the same script the workflow does:

```bash
cd /opt/conbon
git pull
bash scripts/deploy.sh           # uses :latest from GHCR
# or pin to a specific commit's image:
bash scripts/deploy.sh <commit-sha>
```

`scripts/deploy.sh` pulls the matching images from GHCR, runs `docker compose up -d --remove-orphans` (re-runs `migrate` then restarts `app`), and prunes dangling images. If the images aren't on GHCR yet (offline, GHCR down, or first deploy without CI), fall back to `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build` to build locally — the `build:` stanzas alongside `image:` in `docker-compose.prod.yml` keep that path working.

### Rollback

GHCR keeps every commit-SHA tag, so rollback is a script invocation against the previous image:

```bash
ssh deploy@<host>
cd /opt/conbon
# Find the previous deploy's SHA in GitHub Actions → Deploy workflow runs.
bash scripts/deploy.sh <previous-sha>
```

The `app` container flips to the rolled-back image in seconds. The `migrate` one-shot re-runs against the older schema; `prisma migrate deploy` is a no-op when no migrations are pending, so unless the rollback crosses a migration boundary there's nothing to undo. **For rollbacks across migrations**, restore the database from the most recent `pg_dump` before re-running the script — Prisma has no `migrate down` and forward-only is the safe default. (Test that the rollback path works end-to-end on staging before relying on it in prod.)

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
