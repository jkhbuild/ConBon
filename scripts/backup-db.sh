#!/usr/bin/env bash
# ConBon — Postgres backup.
#
# Runs pg_dump inside the prod postgres compose service, gzips the output,
# and writes it to a host directory (BACKUP_DIR; default ./backups). Retains
# the last RETAIN backups; older ones are pruned.
#
# Usage from the repo root on the VPS:
#
#   ./scripts/backup-db.sh
#
# Cron snippet (host crontab; user must be able to talk to docker):
#
#   30 2 * * * cd /opt/conbon && ./scripts/backup-db.sh >> backups/backup.log 2>&1
#
# Restore (destructive — uses --clean so existing objects are dropped):
#
#   gunzip -c backups/conbon-<timestamp>.sql.gz \
#     | docker compose -f docker-compose.prod.yml exec -T postgres \
#         psql -U conbon -d conbon

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." &>/dev/null && pwd)"

BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
RETAIN="${RETAIN:-14}"
POSTGRES_USER="${POSTGRES_USER:-conbon}"
POSTGRES_DB="${POSTGRES_DB:-conbon}"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_ROOT/docker-compose.prod.yml}"

mkdir -p "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
outfile="$BACKUP_DIR/conbon-${timestamp}.sql.gz"

echo "[backup-db] dumping $POSTGRES_DB → $outfile"

docker compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        --no-owner --clean --if-exists \
    | gzip -9 > "$outfile"

# Retention. `ls -1tr` sorts ascending by mtime; `head -n -N` (GNU coreutils,
# present on Debian/Ubuntu — the Hetzner default) trims the newest N from
# the list, leaving the older ones to delete.
if [ "$RETAIN" -gt 0 ]; then
    pruned="$(ls -1tr "$BACKUP_DIR"/conbon-*.sql.gz 2>/dev/null | head -n "-$RETAIN" || true)"
    if [ -n "$pruned" ]; then
        echo "[backup-db] pruning:"
        printf '  %s\n' $pruned
        printf '%s\n' $pruned | xargs -r rm --
    fi
fi

echo "[backup-db] done ($(du -h "$outfile" | cut -f1))"
