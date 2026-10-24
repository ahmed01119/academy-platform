#!/usr/bin/env bash
# ==============================================================================
# Academy Platform — Automated Always-On VPS Production Deployment Script
# Target: Ubuntu 22.04 / 24.04 LTS (x86_64 or ARM64 / Oracle Ampere A1)
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===================================================================${NC}"
echo -e "${BLUE}  ACADEMY PLATFORM — PRODUCTION ALWAYS-ON DEPLOYMENT ENGINE        ${NC}"
echo -e "${BLUE}===================================================================${NC}"

# 1. Root Check
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}[ERROR] This script must be run as root (use sudo).${NC}" 
   exit 1
fi

DEPLOY_DIR="/opt/academy-platform"
BRANCH="feat/production-live-deployment-pwa"
REPO_URL="https://github.com/ahmed01119/academy-platform.git"

# 2. System Prerequisites & Docker Installation
echo -e "\n${YELLOW}[1/7] Installing System Prerequisites & Docker Engine...${NC}"
apt-get update -qq
apt-get install -qq -y curl git ufw fail2ban ca-certificates apt-transport-https openssl

if ! command -v docker &> /dev/null; then
  echo -e "${YELLOW}Installing Docker CE from official repository...${NC}"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -qq
  apt-get install -qq -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  echo -e "${GREEN}Docker is already installed: $(docker --version)${NC}"
fi

# 3. Firewall Configuration
echo -e "\n${YELLOW}[2/7] Configuring UFW Firewall (SSH, HTTP, HTTPS)...${NC}"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 4. Repository Synchronization
echo -e "\n${YELLOW}[3/7] Syncing Repository to ${DEPLOY_DIR}...${NC}"
if [ -d "$DEPLOY_DIR/.git" ]; then
  cd "$DEPLOY_DIR"
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
else
  git clone -b "$BRANCH" "$REPO_URL" "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"
fi

# 5. Production Environment Configuration
echo -e "\n${YELLOW}[4/7] Securing Production Environment Variables...${NC}"
ENV_FILE="$DEPLOY_DIR/.env.production"

if [ ! -f "$ENV_FILE" ]; then
  echo -e "${YELLOW}Creating fresh .env.production with secure random tokens...${NC}"
  cp .env.production.example "$ENV_FILE"

  # Generate cryptographically secure tokens
  RAND_JWT=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 48)
  RAND_PG_PWD=$(openssl rand -hex 24)
  RAND_PG_RUNTIME_PWD=$(openssl rand -hex 24)

  sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${RAND_PG_PWD}|g" "$ENV_FILE"
  sed -i "s|POSTGRES_RUNTIME_PASSWORD=.*|POSTGRES_RUNTIME_PASSWORD=${RAND_PG_RUNTIME_PWD}|g" "$ENV_FILE"
  sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://academy_runtime:${RAND_PG_RUNTIME_PWD}@postgres:5432/academy?schema=public|g" "$ENV_FILE"
  sed -i "s|DATABASE_ADMIN_URL=.*|DATABASE_ADMIN_URL=postgresql://academy:${RAND_PG_PWD}@postgres:5432/academy?schema=public|g" "$ENV_FILE"
  sed -i "s|JWT_SECRET=.*|JWT_SECRET=${RAND_JWT}|g" "$ENV_FILE"
  sed -i "s|NEXT_PUBLIC_API_BASE_URL=.*|NEXT_PUBLIC_API_BASE_URL=/v1|g" "$ENV_FILE"
  sed -i "s|INTERNAL_API_URL=.*|INTERNAL_API_URL=http://api:3001|g" "$ENV_FILE"
  
  chmod 600 "$ENV_FILE"
  echo -e "${GREEN}Secure .env.production created and permissions restricted (600).${NC}"
else
  echo -e "${GREEN}Existing .env.production retained.${NC}"
fi

# 6. systemd Supervision for Auto-Healing on Boot
echo -e "\n${YELLOW}[5/7] Installing systemd Service (Auto-Start on Boot & Crash Recovery)...${NC}"
tee /etc/systemd/system/academy-platform.service > /dev/null <<EOF
[Unit]
Description=Academy Platform Multi-Tenant SaaS
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${DEPLOY_DIR}
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml --env-file .env.production up -d --remove-orphans
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml --env-file .env.production down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable academy-platform.service

# 7. Build & Launch Containers
echo -e "\n${YELLOW}[6/7] Building and Launching Production Docker Containers...${NC}"
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Wait for database readiness
echo -e "${YELLOW}Waiting for PostgreSQL to accept connections...${NC}"
until docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres pg_isready -U academy -d academy; do
  sleep 2
done

# Run migrations
echo -e "${YELLOW}Deploying Prisma migrations...${NC}"
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T api \
  pnpm --filter @academy/database migrate:deploy

# 8. Setup Automated Daily Backup Cron
echo -e "\n${YELLOW}[7/7] Scheduling Automated Daily Database Backup Cron...${NC}"
chmod +x "${DEPLOY_DIR}/infrastructure/backup/backup-postgres.sh"
(crontab -l 2>/dev/null | grep -v "backup-postgres.sh"; echo "0 3 * * * ${DEPLOY_DIR}/infrastructure/backup/backup-postgres.sh >> /var/log/academy-backup.log 2>&1") | crontab -

echo -e "\n${GREEN}===================================================================${NC}"
echo -e "${GREEN}  ACADEMY PLATFORM IS SUCCESSFULLY DEPLOYED & ALWAYS-ON!          ${NC}"
echo -e "${GREEN}===================================================================${NC}"
echo -e "Public Services:"
echo -e "  - Frontend Web:      http://$(curl -s ifconfig.me):3000 (or configured domain)"
echo -e "  - Backend API:       http://$(curl -s ifconfig.me):3001/v1"
echo -e "  - Health Check:      http://$(curl -s ifconfig.me):3001/v1/health/ready"
echo -e "\nProcess Status:"
docker compose -f docker-compose.prod.yml --env-file .env.production ps
