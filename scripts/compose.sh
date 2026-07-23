#!/usr/bin/env bash
set -euo pipefail

# Runs docker compose for one isolated client instance (database + backend + frontend).
# The client name is used as the Compose project name (-p), so every client's
# containers, volumes, and networks stay isolated from every other client on the
# same host, even though they all build from the same monorepo code.
#
# Usage:
#   ./scripts/compose.sh <client-name> <env-file> <docker-compose-args...>
#
# Examples:
#   ./scripts/compose.sh acme clients/acme.env up -d --build
#   ./scripts/compose.sh acme clients/acme.env exec backend npx prisma migrate deploy
#   ./scripts/compose.sh acme clients/acme.env exec backend npm run seed
#   ./scripts/compose.sh acme clients/acme.env logs -f backend
#   ./scripts/compose.sh acme clients/acme.env down

CLIENT_NAME="${1:?Usage: $0 <client-name> <env-file> <docker-compose-args...>}"
ENV_FILE="${2:?Usage: $0 <client-name> <env-file> <docker-compose-args...>}"
shift 2

if [ ! -f "$ENV_FILE" ]; then
  echo "Env file not found: $ENV_FILE" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

docker compose \
  -p "$CLIENT_NAME" \
  -f "$ROOT_DIR/database/docker-compose.yml" \
  -f "$ROOT_DIR/backend/docker-compose.yml" \
  -f "$ROOT_DIR/frontend/docker-compose.yml" \
  --env-file "$ENV_FILE" \
  "$@"
