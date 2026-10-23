# ADR-004: Zero Mandatory Cloud Subscription and Self-Hosted Production

- **Status:** Accepted
- **Date:** 2026-10-23
- **Deciders:** Architecture, Operations

## Context

The owner requires a publicly usable, installable Academy Platform without mandatory paid cloud subscriptions or vendor lock-in. The existing stack (Next.js, NestJS, PostgreSQL, Prisma, Redis) must stay. Managed Postgres/Redis would reduce ops work but introduce recurring fees and data-residency coupling.

## Decision

1. **Primary production path:** self-hosted Docker Compose (PostgreSQL, Redis, API, web, Caddy TLS).
2. **No paid provisioning** from this repository. Secrets stay in the host `.env` (never committed).
3. **Offline-first client** for attendance and evaluation drafts; finance and admin mutations remain online-only.
4. **Free-tier public hosting** is documented as optional and quota-limited, not as production of record.

## Consequences

### Positive

- Owner retains data and infrastructure.
- Recurring software subscription can be zero.
- Migration to another VPS or later managed services does not require rewriting domain logic.

### Negative / Risks

- Electricity, a public IP or VPS, domain, and backup media still have real costs.
- Self-hosting requires operator discipline (updates, disk, TLS renewal if not using Caddy).
- Free hosting (if used) can sleep, throttle, or delete data when quotas exhaust.

### Follow-ups

- Operator runbook: `docs/operations/self-hosting.md`
- Offline capability matrix: `docs/architecture/offline-capability-matrix.md`

## Alternatives Considered

| Option | Why not chosen as mandatory |
|--------|-----------------------------|
| Managed Neon/Supabase/Upstash | Recurring fees and vendor lock-in |
| SQLite / in-process Redis as production | Breaks RLS, concurrency, and fail-closed rate limits |
| Cloudflare Tunnel as the only public entry | Useful optionally; not a database or source of truth |
