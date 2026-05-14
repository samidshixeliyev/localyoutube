#!/bin/bash
set -e

SSH_KEY="${SSH_KEY:-/tmp/ssh_deploy.pem}"
SERVER="${SERVER:-ubuntu@51.20.12.6}"
REMOTE_DIR="${REMOTE_DIR:-~/localyoutube}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "${CYAN}[deploy]${NC} $*"; }
ok()   { echo -e "${GREEN}  ✓${NC} $*"; }
warn() { echo -e "${YELLOW}  !${NC} $*"; }
fail() { echo -e "${RED}  ✗${NC} $*"; exit 1; }

log "LocalTube — Remote Deploy to $SERVER"

# ── Preflight ─────────────────────────────────────────────────────────────────
[ -f "$SSH_KEY" ] || fail "SSH key not found: $SSH_KEY"
chmod 600 "$SSH_KEY"

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$SERVER" "echo connected" > /dev/null 2>&1 \
  || fail "Cannot connect to $SERVER"
ok "SSH connection OK"

# ── Sync project files ────────────────────────────────────────────────────────
log "Syncing project to $SERVER:$REMOTE_DIR ..."
rsync -az --progress \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='build' \
  --exclude='.gradle' \
  --exclude='*.class' \
  --exclude='localtube/src/test' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
  "$(dirname "$(realpath "$0")")/" \
  "$SERVER:$REMOTE_DIR/"
ok "Files synced"

# ── Remote build & start ──────────────────────────────────────────────────────
log "Building and starting containers on remote..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER" bash << 'REMOTE'
set -e
cd ~/localyoutube

# Stop old localyoutube container if running
docker compose down --remove-orphans 2>/dev/null || true

# Build and start
docker compose up --build -d

echo ""
echo "Container status:"
docker compose ps
REMOTE

ok "Deployment complete"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         LocalTube is Live!                   ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  App:     http://51.20.12.6:8080             ║${NC}"
echo -e "${GREEN}║  Grafana: http://51.20.12.6:3000             ║${NC}"
echo -e "${GREEN}║           admin / admin                      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo "Logs:  ssh -i $SSH_KEY $SERVER 'cd ~/localyoutube && docker compose logs -f'"
echo "Stop:  ssh -i $SSH_KEY $SERVER 'cd ~/localyoutube && docker compose down'"
