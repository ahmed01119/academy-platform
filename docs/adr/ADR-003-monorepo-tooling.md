# ADR-003: pnpm Workspaces + Turborepo

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Architecture

## Context

We need a single repository for web, API, shared libraries, Prisma, and docs, with reliable CI caching and strict package boundaries.

## Decision

Adopt:

- **pnpm workspaces** for dependency isolation and `workspace:` protocol.
- **Turborepo** for task orchestration (`build`, `lint`, `typecheck`, `test`).
- Shared **TypeScript** and **ESLint** packages under `packages/`.

## Consequences

### Positive

- Consistent toolchain across apps.
- Cached CI pipelines and clear package graphs.

### Negative / Risks

- Developers must use pnpm (not npm/yarn) to avoid lockfile drift.

### Follow-ups

- Keep `packageManager` pinned in root `package.json`.
- Add `engines` enforcement in CI.

## Alternatives Considered

| Option | Why not chosen |
|--------|----------------|
| Nx | Heavier default surface for current team size |
| npm workspaces | Weaker linking/isolation than pnpm |
