# Self-hosting runbook (zero mandatory SaaS fees)

This is the supported production path. It uses open-source images you run on hardware you control.

## Unavoidable costs (not software subscriptions)

- A machine that stays on (home NAS/PC **or** a cheap VPS).
- Electricity and internet.
- Optional domain (~annual) — Caddy can use a public hostname for Let's Encrypt.
- Backup media (USB disk, second machine, or object storage you already own).

None of these are billed through this repository.

## Resource budget (single academy, ~200 players)

| Component | Suggested |
|-----------|-----------|
| CPU | 2 vCPU |
| RAM | 4 GB |
| Disk | 40 GB SSD + backup disk |
| Postgres connections | Prisma default pool; do not expose 5432 publicly |

## Bring-up

```bash
cp .env.production.example .env.production
# Edit secrets: JWT_SECRET, POSTGRES passwords, CORS_ORIGIN, domains
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production exec api \
  pnpm --filter @academy/database migrate:deploy
```

Health: `https://<api-host>/v1/health/ready`

## Backups

```bash
./infrastructure/backup/backup-postgres.sh
```

Restore only onto a **separate** database. Never `prisma migrate reset` in production.

Retention default: 14 daily dumps in `./backups/`.

## Rollback

1. Keep previous image tags (`API_IMAGE_TAG`, `WEB_IMAGE_TAG`).
2. `docker compose ... up -d` with the previous tag.
3. Database roll-forward only via new Prisma migrations; restore from dump if a migration is destructive (those must be blocked in review).

## Free-hosting option (not production of record)

| Vendor | Typical free limit | When quota exhausts |
|--------|--------------------|---------------------|
| Railway/Render/Fly trial | Sleeps, hours cap, or card required | App stops; data may be deleted after trial |
| Neon/Supabase free Postgres | Compute suspend + storage cap | Connections fail; not an archive |
| Cloudflare Pages (static) | Cannot run NestJS/Postgres | Unsuitable as the API |

Use free tiers only for demos. Authoritative data stays on the self-hosted Postgres volume and backups.

## Public URL without buying a domain

- Tailscale Funnel / Cloudflare Tunnel (optional, accounts required).
- VPS public IP + Caddy self-signed (browsers will warn) or Let's Encrypt on a hostname.

Do not use `ngrok` as the production database or as the system of record.
