#!/usr/bin/env bash
#
# ConBon — VPS-side deploy script.
#
# Invoked over SSH from .github/workflows/deploy.yml with the commit SHA
# as the first argument. Can also be run manually for rollback:
#
#     bash scripts/deploy.sh <previous-sha>
#
# What it does:
#   1. Pulls the runner + migrator images for IMAGE_TAG from GHCR.
#   2. Brings the compose stack up — `migrate` re-runs (one-shot,
#      gated on postgres health), `app` waits on migrate completing,
#      `caddy` waits on app healthy.
#   3. Prunes dangling images so disk doesn't fill over time.
#
# Assumes the host has Docker Engine + Compose v2, a clone of this repo
# at /opt/conbon (or wherever this script runs from), and a populated
# .env.production sitting next to docker-compose.prod.yml.
#
# Rollback flow:
#   - Find the previous commit SHA you want to deploy (it's the
#     `${{ github.sha }}` value from the prior deploy.yml run).
#   - SSH to the VPS, `cd /opt/conbon`, run `bash scripts/deploy.sh <sha>`.
#   - The GHCR image for that SHA is still there (we never delete tagged
#     images), so `compose pull` succeeds and the stack flips to it.

set -euo pipefail

IMAGE_TAG="${1:-latest}"
export IMAGE_TAG

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE} in ${REPO_ROOT}." >&2
  echo "Copy .env.production.example and fill in the required values before deploying." >&2
  exit 1
fi

echo "==> Deploying IMAGE_TAG=${IMAGE_TAG}"

echo "==> Pulling images from GHCR"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" pull

echo "==> Bringing stack up"
# `up -d --remove-orphans` triggers compose to:
#   - recreate the `migrate` one-shot (it's already exited from the prior
#     deploy; this re-runs migrate deploy against the new schema)
#   - recreate `app` once migrate exits 0
#   - leave postgres + caddy running unless their definitions changed
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --remove-orphans

echo "==> Pruning dangling images"
docker image prune -f >/dev/null

echo "==> Deployed IMAGE_TAG=${IMAGE_TAG}."
