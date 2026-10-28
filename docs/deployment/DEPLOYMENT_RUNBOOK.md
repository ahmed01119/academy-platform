# SPORTEXUS — Production Deployment Runbook & Migration Guide

## 1. Overview

This runbook specifies the exact procedure to deploy Sportexus from the local repository to cloud hosting (e.g. Vercel + Render + Neon or self-hosted VPS), preserving all existing database records and configurations.

---

## 2. Environment Variable Configuration

### 2.1 Backend API (`apps/api/.env`)

```env
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://sportexus.yourdomain.com

# Database (Neon / Supabase / PostgreSQL)
DATABASE_URL="postgres://user:password@ep-host.neon.tech/sportexus?sslmode=require&pgbouncer=true"
DIRECT_URL="postgres://user:password@ep-host.neon.tech/sportexus?sslmode=require"

# Authentication Security (Generate using: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_ACCESS_SECRET="<64-char-hex-random-string>"
JWT_REFRESH_SECRET="<64-char-hex-random-string>"
JWT_CSRF_SECRET="<64-char-hex-random-string>"
JWT_ACCESS_EXPIRES_IN=900
JWT_REFRESH_EXPIRES_IN=604800

# Redis Rate Limiting (Upstash / Redis Cloud)
REDIS_URL="rediss://default:token@global-redis.upstash.io:6379"

# Transactional Email (Resend)
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxx"
EMAIL_FROM="Sportexus <notifications@yourdomain.com>"
```

### 2.2 Frontend Web (`apps/web/.env`)

```env
NODE_ENV=production
NEXT_PUBLIC_API_URL="https://api.sportexus.yourdomain.com/v1"
NEXT_PUBLIC_APP_URL="https://sportexus.yourdomain.com"
```

---

## 3. Database Migration & Baseline Data Restoration

### Step 3.1: Apply Schema Migrations
```bash
# Push Prisma schema to target cloud database
pnpm --filter @academy/database prisma db push
```

### Step 3.2: Restore Baseline Data (Preserving all 902 records)
```bash
# Execute isolated restore script from verified backup
node scripts/db-restore.js backups/sportexus_backup_2026-10-28T00-57-09-057Z.json
```

### Step 3.3: Verify Record Counts
```bash
# Verify all 31 models populated correctly
node scripts/check-cols.js
```

---

## 4. Frontend & Backend Deployment Steps

### 4.1 Deploying API on Render / Railway
1. Connect GitHub repository `ahmed01119/academy-platform`.
2. Set Root Directory: `apps/api`.
3. Set Build Command: `pnpm install --frozen-lockfile && pnpm --filter @academy/shared build && pnpm --filter @academy/api build`.
4. Set Start Command: `node dist/main.js`.
5. Add Environment Variables from Section 2.1.
6. Verify Health Check: `curl https://<render-url>/v1/health/ready`.

### 4.2 Deploying Frontend on Vercel
1. Import repository on Vercel.
2. Set Framework Preset: `Next.js`.
3. Set Root Directory: `apps/web`.
4. Set Environment Variables: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`.
5. Deploy and verify HTTPS root load: `curl -I https://<vercel-url>`.

---

## 5. Post-Deployment Verification Checklist

- [ ] `GET /v1/health/ready` returns HTTP 200 with `{ status: "ok", postgres: "connected" }`.
- [ ] Landing page loads at root `/` with responsive styling in Arabic and English.
- [ ] Primary Platform Owner can log in via `/login`.
- [ ] Academy Dashboard loads metrics and player roster.
- [ ] Quick Attendance (`/attendance/quick`) functions smoothly with offline IndexedDB fallback.
- [ ] Transactional emails deliver correctly without leaking debug tokens.
