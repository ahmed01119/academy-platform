# Handover (deployment branch)

## Git

- Branch: `feat/production-pwa-continuous-delivery` (do not merge to `main` without approval)
- Hosting: GitHub `ahmed01119/academy-platform`

## What is live vs not live

| Item | Status |
|------|--------|
| Staging URL | Not provisioned — needs owner host/VPS |
| Production URL | Not provisioned |
| Frontend | Next.js PWA in `apps/web`; serve via Caddy in Compose |
| API | NestJS in `apps/api` |
| Database / Redis | Self-hosted Postgres 16 + Redis 7 in `docker-compose.prod.yml` |
| Monthly software subscription | **$0 mandatory** |
| Unavoidable costs | Electricity, connectivity, hardware or VPS, optional domain, backup media |

## Environment variables

See `.env.production.example`. Never commit values. Production refuses default JWT, wildcard CORS, privileged DB users, and missing Redis.

## PWA install (after a public HTTPS origin exists)

- **Android Chrome:** browser menu → Add to Home screen / Install app
- **iOS Safari:** Share → Add to Home Screen (no WebAPK; Safari home-screen)
- **Windows/macOS Chrome or Edge:** install icon in the address bar

Updates: existing sessions get a banner when a new service worker waits. Refresh is skipped while a form is focused or `data-academy-busy=true`. Offline devices are not force-updated.

## Backups

`infrastructure/backup/backup-postgres.sh` — 14-dump retention. Restore: `docs/operations/restore.md`.

## Monitoring

- Liveness: `GET /v1/health`
- Readiness (Postgres + Redis): `GET /v1/health/ready`
- Super Admin `systemHealth` uses readiness, not a hardcoded 100% uptime string
