# Always-On Hosting, Production Architecture & Self-Healing Runbook

## 1. Executive Summary & Infrastructure Topology

Academy Platform is engineered as a modular multi-tenant SaaS. For external, round-the-clock availability that does **not** depend on a developer's personal laptop, terminal session, or IDE remaining open, the application must run on dedicated persistent compute infrastructure with automatic restart, process supervision, persistent block storage, and automated TLS certificates.

### Production Stack Topology

```mermaid
graph TD
    Client["Client Browsers / Installed PWAs\n(iOS Safari, Android Chrome, Windows/macOS)"]
    DNS["Public DNS (A Record)\nacademy.example.com"]
    Caddy["Caddy Reverse Proxy (Port 80/443)\n- Automatic Let's Encrypt / ZeroSSL TLS\n- HTTP/2 & HTTP/3\n- Gzip / Zstandard Compression"]
    NextWeb["Next.js Web Frontend (Port 3000)\n- Single-Origin /v1 API Proxy\n- Static Asset Caching\n- PWA Manifest & Service Worker"]
    NestAPI["NestJS Backend API (Port 3001)\n- Tenant RLS Enforcement\n- Argon2id Authentication\n- Session Revocation\n- Audit Trail & Metrics"]
    Postgres[("PostgreSQL 16 (Port 5432 Internal)\n- Persistent Docker Volume (postgres_data)\n- Safe Prisma Migrations\n- Tenant RLS Isolation")]
    Redis[("Redis 7 (Port 6379 Internal)\n- Distributed Rate Limiting\n- Session Tokens & Invalidation")]
    Systemd["systemd (Linux Process Supervisor)\n- academy-platform.service\n- Auto-restart on reboot / crash"]

    Client -->|HTTPS 443| DNS
    DNS --> Caddy
    Caddy -->|/ and UI routes| NextWeb
    Caddy -->|/v1/* API routes| NestAPI
    NextWeb -->|Internal SSR / API Proxy| NestAPI
    NestAPI --> Postgres
    NestAPI --> Redis
    Systemd -.->|Manages Lifecycle| Caddy
    Systemd -.->|Manages Lifecycle| NextWeb
    Systemd -.->|Manages Lifecycle| NestAPI
    Systemd -.->|Manages Lifecycle| Postgres
    Systemd -.->|Manages Lifecycle| Redis
```

---

## 2. Why Ephemeral Tunnels Are NOT Production

Development tunnels (such as `localhost.run`, `pinggy.io`, `localtunnel`, or standard `ngrok` free tiers) are designed exclusively for quick developer previews. They suffer from the following fundamental limitations:

1. **Host Dependency**: The moment the developer's laptop goes to sleep, closes its lid, changes Wi-Fi networks, or terminates Cursor/VS Code, the public URL immediately returns `502 Bad Gateway` or `Connection Refused`.
2. **Idle Timeouts**: Free SSH tunnels automatically disconnect after 20–30 minutes of inactivity (`tunnel activity timeout`).
3. **Subdomain Churn**: Reconnecting produces a brand new random subdomain, invalidating bookmarks, PWA home screen icons, and user authentication sessions.
4. **Bandwidth & Rate Caps**: Public tunnels throttle sustained traffic, distorting latency metrics.

---

## 3. Zero-Subscription & Low-Cost Hosting Architecture

The owner's requirement is to maintain an always-on public application with **zero mandatory software subscriptions**.

### Provider Options Comparison & Honest Quota Realities

| Provider                                              | Model                   | Resources                                                                                            | Monthly Cost                              | Operational Realities & Quotas                                                                                                                                                                                                                                         |
| :---------------------------------------------------- | :---------------------- | :--------------------------------------------------------------------------------------------------- | :---------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Oracle Cloud Infrastructure (OCI)** _(Recommended)_ | Always Free Tier        | 4 OCPU (Ampere A1 ARM), 24 GB RAM, 200 GB NVMe Storage, 1 Static Public IPv4, 10 TB/mo outbound data | **$0.00 / month**                         | **Genuine $0 long-term**. Requires credit card verification during registration. Regions can occasionally have capacity waitlists for Ampere ARM instances. Instances with <20% utilization for 7 days may be flagged as idle unless running active Docker containers. |
| **Hetzner Cloud (CX22 / CAX11)**                      | Low-Cost Bare Metal VPS | 2–4 vCPU, 4–8 GB RAM, 40–80 GB NVMe, 20 TB traffic, 1 IPv4                                           | **~€3.79 – €5.90 / mo**                   | Guaranteed instant provisioning, high European/US network speed, independent of Oracle capacity limits.                                                                                                                                                                |
| **Local Dedicated Mini-PC / Home Server**             | Self-Hosted Bare Metal  | Any Intel N100 / refurbished PC, 8–16 GB RAM, 256 GB SSD                                             | **$0 software fees** (Hardware ownership) | Requires static IP or Cloudflare Tunnel (zero fee), uninterruptible power supply (UPS), and domestic ISP reliability.                                                                                                                                                  |

> [!IMPORTANT]
> **Engineering Truth & SLA Disclaimer**:
> No free-tier or budget single-node VPS provides a guaranteed 100% uptime SLA. A single VPS will experience brief downtime during OS kernel security reboots, host hardware maintenance, or upstream ISP connectivity blips. However, with `systemd` and Docker `restart: unless-stopped`, the platform automatically recovers in seconds without manual intervention.

---

## 4. Production Deployment & Self-Healing Runbook

### Step 1: Server Preparation (Ubuntu 22.04 / 24.04 LTS)

Connect to the server via SSH and install Docker Engine with Compose:

```bash
# 1. Update OS packages
sudo apt update && sudo apt upgrade -y

# 2. Install prerequisites
sudo apt install -y curl git ufw fail2ban ca-certificates apt-transport-https

# 3. Install Docker official repository
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 4. Enable firewall (allow SSH, HTTP, HTTPS only)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Step 2: Clone Repository & Configure Environment

```bash
sudo git clone https://github.com/ahmed01119/academy-platform.git /opt/academy-platform
cd /opt/academy-platform

# Generate secure production environment file
sudo cp .env.production.example .env.production

# Edit secrets with cryptographically random tokens
# Generate 64-char JWT secret: openssl rand -base64 48
# Generate strong Postgres password: openssl rand -hex 24
sudo nano .env.production
```

Ensure `.env.production` contains:

```ini
NODE_ENV=production
APP_ENV=production

# Database (Internal Docker network only)
DATABASE_URL=postgresql://academy_prod:YOUR_STRONG_PASSWORD@postgres:5432/academy_prod?schema=public

# Redis
REDIS_URL=redis://redis:6379

# Single-Origin API URL (Never references localhost)
NEXT_PUBLIC_API_BASE_URL=/v1
INTERNAL_API_URL=http://api:3001/v1

# Security & Sessions
JWT_SECRET=YOUR_64_CHAR_HEX_SECRET
COOKIE_SECURE=true
CORS_ORIGIN=https://academy.yourdomain.com
```

### Step 3: Self-Healing systemd Service

To ensure the Academy Platform automatically starts when the server boots, and automatically restarts if Docker or a process crashes, create `/etc/systemd/system/academy-platform.service`:

```bash
sudo tee /etc/systemd/system/academy-platform.service > /dev/null <<'EOF'
[Unit]
Description=Academy Platform Multi-Tenant SaaS
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/academy-platform
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml --env-file .env.production up -d --remove-orphans
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml --env-file .env.production down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable academy-platform.service
sudo systemctl start academy-platform.service
```

### Step 4: Run Initial Production Migrations

```bash
sudo docker compose -f docker-compose.prod.yml --env-file .env.production exec api \
  pnpm --filter @academy/database migrate:deploy
```

Verify database migration status:

```bash
sudo docker compose -f docker-compose.prod.yml --env-file .env.production exec api \
  pnpm --filter @academy/database migrate:status
```

---

## 5. Automated Backups & Disaster Recovery

### Automated Daily Backup Cron

Academy Platform includes a hardened Postgres backup script in `infrastructure/backup/backup-postgres.sh`. Configure a daily backup cron:

```bash
# Add cron job to run every morning at 03:00 UTC
(sudo crontab -l 2>/dev/null; echo "0 3 * * * /opt/academy-platform/infrastructure/backup/backup-postgres.sh >> /var/log/academy-backup.log 2>&1") | sudo crontab -
```

### Backup Script Verification

The script executes:

1. `pg_dump` with custom compressed archive format (`-Fc`).
2. Generates SHA256 checksums alongside every dump.
3. Automatically prunes backups older than 14 days to prevent disk exhaustion.
4. Alerts on failure.

### Disaster Recovery Procedure

To restore data onto a clean database instance:

```bash
# 1. Stop web and api to prevent write conflicts
docker compose -f docker-compose.prod.yml stop web api

# 2. Run restoration script with designated backup file
./infrastructure/backup/restore-postgres.sh /opt/academy-platform/backups/academy_prod_20261024_030000.dump

# 3. Restart application stack
docker compose -f docker-compose.prod.yml start
```

---

## 6. Public Demo Credentials & Security Governance

### Production Security Invariants

1. **No Static SuperAdmin in Production**: The database seed script (`packages/database/scripts/seed-local-demo.js`) is strictly protected against execution in `NODE_ENV=production`. If emergency administrative bootstrapping is required, `SUPERADMIN_INITIAL_PASSWORD` must be explicitly passed in the environment.
2. **Platform Owner Isolation**: The Platform Super Admin role possesses sovereign platform authority (tenant creation, tenant suspension, plan limits, security policy modification). Demo environments MUST NOT provide unrestricted Platform Owner credentials to anonymous public visitors.
3. **Sandboxed Demo Tenant**: Public demonstrations should only provide scoped access to a dedicated demo academy (`stars-academy`) using:
   - **Academy Owner**: `admin@academy.sa` (Scoped strictly to `stars-academy` tenant RLS boundary).
   - **Head Coach**: `coach.ahmed@academy.sa` (Assigned training groups only).
   - **Player**: `player.omar@academy.sa` (Player self-service portal).
   - **Guardian**: `guardian.khalid@academy.sa` (Parent/child linked accounts only).
4. **Minor Protection**: No real names, phone numbers, or national identification numbers of actual minors are stored in demo seeds.

---

## 7. Universal PWA Installation Guide

Academy Platform complies fully with the Web App Manifest Specification (`apps/web/public/manifest.webmanifest`) and Service Worker standards (`apps/web/public/sw.js`).

### Device Installation Instructions

#### Android (Google Chrome & Samsung Internet)

1. Open the platform URL in Chrome.
2. Tap the **Install App** banner at the bottom of the screen, or tap the three dots `⋮` in the top right and select **Add to Home screen** / **Install app**.
3. Confirm **Install**. The app icon is added to your app drawer and home screen.
4. The application opens full-screen in standalone mode with its own dedicated task in the Android app switcher.

#### Apple iOS (iPhone & iPad Safari)

1. Open the platform URL in Safari (_Note: Apple requires Safari for PWA installation_).
2. Tap the **Share** button (box with an upward arrow) in the bottom navigation bar.
3. Scroll down and tap **Add to Home Screen** (إضافة إلى الصفحة الرئيسية).
4. Tap **Add** in the top right.
5. The application launches full-screen with native iOS status-bar theming and zero browser address bar chrome.

#### Windows 10/11 (Google Chrome & Microsoft Edge)

1. Navigate to the platform URL.
2. Look at the right side of the address bar for the **App available. Install Academy Platform** icon (computer monitor with downward arrow).
3. Click **Install**.
4. The platform launches as an isolated desktop application window with taskbar pinning support.

#### macOS (Chrome, Edge & Safari on Sonoma+)

1. In Safari Sonoma+: File -> **Add to Dock...**
2. In Chrome / Edge: Settings menu -> Save and Share -> **Install Academy Platform**.
3. Pin to Dock and launch directly from Launchpad or Spotlight.

---

## 8. Safe Updates & Cache Invalidation

When an updated version of Academy Platform is deployed:

1. **Service Worker Detection**: The registered service worker (`sw.js`) compares bytecode headers and downloads the updated worker script in the background.
2. **User Notification**: A non-intrusive update badge appears in the bottom status bar (`SyncStatus.tsx`), informing the user that a new version is available.
3. **Preservation of In-Flight Operations**: The application **never** forces an abrupt window reload while a user is actively typing, scanning a QR code, or processing a cash receipt.
4. **Offline Queue Safety**: All pending offline IndexedDB attendance records and draft evaluations survive service worker updates unharmed. When the user transitions between versions, IndexedDB object stores remain completely intact.
