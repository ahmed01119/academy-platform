# ADR-001: Modular Monolith over Microservices

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Architecture

## Context

We are building a multi-tenant Sports Academy SaaS with web (Next.js), API (NestJS), PostgreSQL, Redis/BullMQ, and a future Flutter client. Early microservice splits increase operational cost and obscure domain boundaries before the domain is stable.

## Decision

Ship a **modular monolith**:

- One NestJS deployable (`apps/api`) with explicit domain modules.
- Shared contracts in `packages/shared`.
- Persistence in `packages/database` (Prisma).
- No network boundaries between domains until a measured need (scale, isolation, or independent release cadence) exists.

## Consequences

### Positive

- Faster iteration and simpler local/CI topology.
- Easier transactional consistency for financial and enrollment flows.
- Clear path to extract modules later if boundaries prove stable.

### Negative / Risks

- Requires discipline: modules must not import each other's internals.
- A poorly modularized monolith becomes a big ball of mud.

### Follow-ups

- Document module dependency rules in `docs/architecture/modular-boundaries.md`.
- Add lint/architecture tests when module count grows.

## Alternatives Considered

| Option                               | Why not chosen                                    |
| ------------------------------------ | ------------------------------------------------- |
| Microservices from day one           | Premature complexity for Egypt launch             |
| Backend-for-frontend only in Next.js | Weakens shared API for Flutter and future clients |
