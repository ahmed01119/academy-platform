# Sportexus SaaS — Production Multi-Stage Dockerfile for DockHosting & Container Platforms
FROM node:22-alpine AS builder
WORKDIR /app

# Enable Corepack and activate pnpm
RUN corepack enable && corepack prepare pnpm@11.13.1 --activate

# Copy root manifest and workspace definition
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/web/package.json ./apps/web/package.json

# Install dependencies using frozen lockfile
RUN pnpm install --frozen-lockfile

# Generate Prisma Client and compile packages
RUN pnpm --filter @academy/database run generate && \
    pnpm turbo run build --filter=@academy/api...

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

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-3001}/v1/health || exit 1

CMD ["node", "--max-old-space-size=384", "apps/api/dist/main.js"]

