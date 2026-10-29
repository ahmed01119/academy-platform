#!/bin/sh
# =============================================================================
# SPORTEXUS — Docker Production Entrypoint
# =============================================================================
# Runs Prisma migrations using DATABASE_ADMIN_URL (if provided),
# then launches the NestJS API with DATABASE_URL (runtime role).
# =============================================================================

set -e

echo "[entrypoint] Sportexus Production Container Starting..."
echo "[entrypoint] NODE_ENV=${NODE_ENV:-production}"
echo "[entrypoint] PORT=${PORT:-3001}"

# Verify runtime DATABASE_URL is present
if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] ERROR: DATABASE_URL environment variable is required." >&2
  exit 1
fi

# Run migrations if DATABASE_ADMIN_URL is configured
if [ -n "$DATABASE_ADMIN_URL" ]; then
  echo "[entrypoint] Running database migrations using administrative role..."
  DATABASE_URL="$DATABASE_ADMIN_URL" /app/packages/database/node_modules/.bin/prisma migrate deploy \
    --schema=/app/packages/database/prisma/schema.prisma || {
      echo "[entrypoint] Fallback to npx prisma migrate deploy..."
      DATABASE_URL="$DATABASE_ADMIN_URL" npx prisma migrate deploy \
        --schema=/app/packages/database/prisma/schema.prisma
    }
  echo "[entrypoint] Database migrations applied successfully."
else
  echo "[entrypoint] DATABASE_ADMIN_URL not provided. Skipping automatic migrations."
  echo "[entrypoint] Ensure migrations were applied out-of-band via CI/CD or SQL console."
fi

# Hand off to the NestJS production server using unprivileged runtime credentials in DATABASE_URL
echo "[entrypoint] Starting NestJS API application..."
exec node --max-old-space-size=384 /app/apps/api/dist/main.js
