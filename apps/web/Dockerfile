FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.13.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc* ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages ./packages
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/v1
ARG NEXT_PUBLIC_APP_NAME=Academy Platform
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @academy/shared build && pnpm --filter @academy/web build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@11.13.0 --activate
COPY --from=build /app /app
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=5s --retries=5 CMD wget -qO- http://127.0.0.1:3000/ || exit 1
CMD ["pnpm", "--filter", "@academy/web", "start"]
