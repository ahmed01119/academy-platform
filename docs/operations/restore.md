# Restore procedure

Restore **only** onto a separate database or a dedicated recovery compose project. Never `prisma migrate reset` against production.

1. Provision an empty Postgres instance (new volume).
2. Restore:

```bash
gunzip -c backups/academy-YYYYMMDDTHHMMSSZ.sql.gz | \
  docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

3. Run `prisma migrate status` (not reset).
4. Point a staging API at the restored database and verify login + one tenant.
5. Only then consider swapping production volumes.

Rollback of application images is independent: redeploy the previous image tag. Schema rollback requires a forward-fix migration or a restore.
