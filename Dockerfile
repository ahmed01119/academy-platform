# Sportexus SaaS — Production Multi-Stage Dockerfile
# Two-role model:
#   DATABASE_ADMIN_URL → used only during prisma migrate deploy at startup
#   DATABASE_URL       → runtime role (sportexus_app) for all application queries
FROM node:22-alpine AS builder
WORKDIR /app

# Enable Corepack and activate pnpm
RUN corepack enable && corepack prepare pnpm@11.13.0 --activate

# Copy root manifest and workspace definition
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/web/package.json ./apps/web/package.json

# Install dependencies using frozen lockfile
RUN pnpm install --frozen-lockfile

# Generate Prisma Client and compile packages in explicit dependency order:
# 1. Clean any stale build info
# 2. Generate Prisma Client (@academy/database)
# 3. Compile shared contracts (@academy/shared)
# 4. Compile database client and transactions (@academy/database)
# 5. Compile API application with Nest CLI (@academy/api)
RUN find . -name "*.tsbuildinfo" -delete 2>/dev/null || true && \
    pnpm --filter @academy/database run generate && \
    pnpm --filter @academy/shared build && \
    pnpm --filter @academy/database build && \
    pnpm --filter @academy/api build

# --- Runtime Stage ---
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy compiled artifacts and modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-3001}/v1/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
