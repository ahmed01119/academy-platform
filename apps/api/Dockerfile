FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.13.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages ./packages
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm db:generate && pnpm --filter @academy/shared build && pnpm --filter @academy/database build && pnpm --filter @academy/api build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@11.13.0 --activate
COPY --from=build /app /app
EXPOSE 3001
HEALTHCHECK --interval=20s --timeout=5s --retries=5 CMD wget -qO- http://127.0.0.1:3001/v1/health || exit 1
CMD ["node", "apps/api/dist/main.js"]
