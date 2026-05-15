#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
#  ModTube — offline image exporter
#  Builds the Docker image (if needed) and saves it as a .tar.gz
#  that can be loaded on any offline machine with:
#
#      docker load < modtube.tar.gz
#      docker compose up -d
#
# Usage:
#   ./export-image.sh              # build + export
#   ./export-image.sh --skip-build # export existing image only
# ════════════════════════════════════════════════════════════════

set -euo pipefail

IMAGE_NAME="modtube"
IMAGE_TAG="latest"
OUTPUT_FILE="${IMAGE_NAME}.tar.gz"
COMPOSE_FILE="docker-compose.yml"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║         ModTube — Offline Image Exporter         ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Parse flags ──────────────────────────────────────────────────
SKIP_BUILD=false
for arg in "$@"; do
  [[ "$arg" == "--skip-build" ]] && SKIP_BUILD=true
done

# ── Build ────────────────────────────────────────────────────────
if [[ "$SKIP_BUILD" == false ]]; then
  echo "▶  Building Docker image ${IMAGE_NAME}:${IMAGE_TAG}…"
  docker compose -f "${COMPOSE_FILE}" build
  echo "✓  Build complete"
else
  echo "⚡ Skipping build (--skip-build)"
fi

# ── Verify image exists ──────────────────────────────────────────
if ! docker image inspect "${IMAGE_NAME}:${IMAGE_TAG}" &>/dev/null; then
  echo "✗  Image ${IMAGE_NAME}:${IMAGE_TAG} not found."
  echo "   Run without --skip-build to build it first."
  exit 1
fi

# ── Export ───────────────────────────────────────────────────────
echo ""
echo "▶  Exporting image to ${OUTPUT_FILE}…"
docker save "${IMAGE_NAME}:${IMAGE_TAG}" | gzip -9 > "${OUTPUT_FILE}"

SIZE=$(du -sh "${OUTPUT_FILE}" | cut -f1)
echo "✓  Export complete: ${OUTPUT_FILE}  (${SIZE})"

# ── Print deploy instructions ─────────────────────────────────────
cat <<EOF

════════════════════════════════════════════════════════════════
  OFFLINE DEPLOYMENT INSTRUCTIONS
════════════════════════════════════════════════════════════════

1. Copy these files to the target machine:
     ${OUTPUT_FILE}
     docker-compose.yml
     .env  (if you have one)

2. Load the image:
     docker load < ${OUTPUT_FILE}

3. (Optional) Set the data directory:
     export DATA_ROOT=/opt/modtube/data

4. Start the service:
     docker compose up -d

5. Open in browser:
     http://<server-ip>:4000

════════════════════════════════════════════════════════════════
EOF
