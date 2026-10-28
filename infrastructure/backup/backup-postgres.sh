#!/usr/bin/env bash
set -euo pipefail
# Dump the Compose Postgres volume via the running container. Keep dumps off the app disk if possible.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${BACKUP_DIR:-$ROOT/backups}"
mkdir -p "$OUT"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$OUT/academy-$STAMP.sql.gz"
docker compose -f "$ROOT/docker-compose.prod.yml" --env-file "${ENV_FILE:-$ROOT/.env.production}" \
  exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > "$FILE"
echo "Wrote $FILE"
# Retention: 14 dumps
ls -1t "$OUT"/academy-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm --
