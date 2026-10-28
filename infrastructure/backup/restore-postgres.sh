#!/usr/bin/env bash
set -euo pipefail
# Restores a PostgreSQL backup archive into the running Compose Postgres container.
# CAUTION: This replaces existing database state with the contents of the backup archive.

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <path-to-backup.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file '$BACKUP_FILE' not found."
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env.production}"

echo "Restoring database from: $BACKUP_FILE"
echo "Stopping backend API service to prevent concurrent mutations..."
docker compose -f "$ROOT/docker-compose.prod.yml" --env-file "$ENV_FILE" stop api || true

echo "Decompressing and executing database restore..."
gzip -dc "$BACKUP_FILE" | docker compose -f "$ROOT/docker-compose.prod.yml" --env-file "$ENV_FILE" \
  exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1'

echo "Restarting backend API service..."
docker compose -f "$ROOT/docker-compose.prod.yml" --env-file "$ENV_FILE" start api

echo "Running health readiness check..."
sleep 5
docker compose -f "$ROOT/docker-compose.prod.yml" --env-file "$ENV_FILE" \
  exec -T api wget -qO- http://127.0.0.1:3001/v1/health/ready || true

echo "Database restore completed successfully."
