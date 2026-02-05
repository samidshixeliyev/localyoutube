#!/bin/bash
#═══════════════════════════════════════════════════════════════════════════════
# LocalTube - Complete Deployment Script
# Builds and runs the entire stack with Docker
#═══════════════════════════════════════════════════════════════════════════════
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "═══════════════════════════════════════════════════════════════════"
echo "  LocalTube - Video Streaming Platform Deployment"
echo "═══════════════════════════════════════════════════════════════════"
echo -e "${NC}"

#───────────────────────────────────────────────────────────────────────────────
# Step 1: Check prerequisites
#───────────────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}[1/6] Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose found${NC}"

#───────────────────────────────────────────────────────────────────────────────
# Step 2: Create .env file if not exists
#───────────────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}[2/6] Setting up environment...${NC}"

if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
# ═══════════════════════════════════════════════════════════════════════════════
# LocalTube Environment Configuration
# These match application.yml environment variables exactly
# ═══════════════════════════════════════════════════════════════════════════════

# Server
SERVER_PORT=8080

# Database (Spring Datasource)
SPRING_DATASOURCE_URL=jdbc:sqlserver://host.docker.internal:65388;instanceName=SQLEXPRESS;databaseName=test_portal;encrypt=true;trustServerCertificate=true
SPRING_DATASOURCE_USERNAME=sa
SPRING_DATASOURCE_PASSWORD=123

# JWT
JWT_SECRET=4gTduyxJahQatgIkxwGErvADeIjfdulxI98B8bAGUOKStnBVTyngXfU5jM1rMbVR

# Storage Paths (inside container)
UPLOAD_DIR=/data/uploads
HLS_DIR=/data/hls
TEMP_DIR=/data/temp
THUMBNAIL_DIR=/data/thumbnails

# Elasticsearch
ELASTICSEARCH_HOST=elasticsearch
ELASTICSEARCH_PORT=9200
ELASTICSEARCH_SCHEME=http
ELASTICSEARCH_USERNAME=
ELASTICSEARCH_PASSWORD=
ELASTICSEARCH_INDEX=videos

# Grafana
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin123
EOF
    echo -e "${GREEN}✓ Created .env file - please review and update settings${NC}"
else
    echo -e "${GREEN}✓ Using existing .env file${NC}"
fi

# Load environment
source .env

#───────────────────────────────────────────────────────────────────────────────
# Step 3: Create docker-compose.yml
#───────────────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}[3/6] Creating Docker configuration...${NC}"

cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  # ═══════════════════════════════════════════════════════════════════════════
  # Elasticsearch
  # ═══════════════════════════════════════════════════════════════════════════
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    container_name: localtube-elasticsearch
    environment:
      - node.name=elasticsearch
      - cluster.name=localtube-cluster
      - discovery.type=single-node
      - bootstrap.memory_lock=true
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
      - xpack.security.enabled=false
    ulimits:
      memlock:
        soft: -1
        hard: -1
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"
    networks:
      - localtube-network
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9200/_cluster/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s

  # ═══════════════════════════════════════════════════════════════════════════
  # Kibana
  # ═══════════════════════════════════════════════════════════════════════════
  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    container_name: localtube-kibana
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
      - xpack.security.enabled=false
      - xpack.encryptedSavedObjects.encryptionKey=min-32-byte-long-strong-encryption-key-here
    ports:
      - "5601:5601"
    networks:
      - localtube-network
    depends_on:
      elasticsearch:
        condition: service_healthy

  # ═══════════════════════════════════════════════════════════════════════════
  # Prometheus
  # ═══════════════════════════════════════════════════════════════════════════
  prometheus:
    image: prom/prometheus:v2.48.0
    container_name: localtube-prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - localtube-network

  # ═══════════════════════════════════════════════════════════════════════════
  # Grafana
  # ═══════════════════════════════════════════════════════════════════════════
  grafana:
    image: grafana/grafana:10.2.2
    container_name: localtube-grafana
    environment:
      - GF_SECURITY_ADMIN_USER=${GRAFANA_ADMIN_USER:-admin}
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:-admin123}
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./datasources.yml:/etc/grafana/provisioning/datasources/datasources.yml:ro
    ports:
      - "3000:3000"
    networks:
      - localtube-network
    depends_on:
      - prometheus

  # ═══════════════════════════════════════════════════════════════════════════
  # LocalTube Backend
  # ═══════════════════════════════════════════════════════════════════════════
  localtube-backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: localtube-backend
    env_file:
      - .env
    ports:
      - "${SERVER_PORT:-8080}:8080"
    volumes:
      - video_uploads:/data/uploads
      - video_hls:/data/hls
      - video_temp:/data/temp
      - video_thumbnails:/data/thumbnails
    networks:
      - localtube-network
    depends_on:
      elasticsearch:
        condition: service_healthy
    extra_hosts:
      - "host.docker.internal:host-gateway"
    restart: unless-stopped

networks:
  localtube-network:
    driver: bridge

volumes:
  elasticsearch_data:
  prometheus_data:
  grafana_data:
  video_uploads:
  video_hls:
  video_temp:
  video_thumbnails:
EOF

#───────────────────────────────────────────────────────────────────────────────
# Step 4: Create Prometheus config
#───────────────────────────────────────────────────────────────────────────────
cat > prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'localtube-backend'
    metrics_path: '/actuator/prometheus'
    scrape_interval: 10s
    static_configs:
      - targets: ['localtube-backend:8080']
EOF

#───────────────────────────────────────────────────────────────────────────────
# Step 5: Create Grafana datasources
#───────────────────────────────────────────────────────────────────────────────
cat > datasources.yml << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false

  - name: Elasticsearch
    type: elasticsearch
    access: proxy
    url: http://elasticsearch:9200
    database: "videos"
    jsonData:
      timeField: "uploadedAt"
      esVersion: "8.0.0"
    editable: false
EOF

#───────────────────────────────────────────────────────────────────────────────
# Step 6: Create Dockerfile
#───────────────────────────────────────────────────────────────────────────────
cat > Dockerfile << 'EOF'
# ═══════════════════════════════════════════════════════════════════════════════
# LocalTube Backend Dockerfile
# ═══════════════════════════════════════════════════════════════════════════════

# Stage 1: Build
FROM gradle:8.5-jdk21 AS builder
WORKDIR /app
COPY --chown=gradle:gradle . .
RUN gradle clean bootJar -x test --no-daemon

# Stage 2: Run
FROM eclipse-temurin:21-jre

# Install FFmpeg
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg curl && \
    rm -rf /var/lib/apt/lists/*

# Create app user
RUN groupadd -r localtube && useradd -r -g localtube localtube

WORKDIR /app

# Create directories
RUN mkdir -p /data/uploads /data/hls /data/temp /data/thumbnails && \
    chown -R localtube:localtube /data

# Copy jar
COPY --from=builder /app/build/libs/*.jar app.jar
RUN chown localtube:localtube app.jar

USER localtube

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]
EOF

echo -e "${GREEN}✓ Docker configuration created${NC}"

#───────────────────────────────────────────────────────────────────────────────
# Step 5: Set vm.max_map_count for Elasticsearch
#───────────────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}[4/6] Configuring system...${NC}"

if [ "$(sysctl -n vm.max_map_count 2>/dev/null)" -lt 262144 ] 2>/dev/null; then
    echo "Setting vm.max_map_count=262144 (requires sudo)..."
    sudo sysctl -w vm.max_map_count=262144 2>/dev/null || echo "Warning: Could not set vm.max_map_count"
fi

echo -e "${GREEN}✓ System configured${NC}"

#───────────────────────────────────────────────────────────────────────────────
# Step 6: Build and start services
#───────────────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}[5/6] Building application...${NC}"

docker compose build --no-cache

echo -e "${YELLOW}[6/6] Starting services...${NC}"

docker compose up -d

#───────────────────────────────────────────────────────────────────────────────
# Done!
#───────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}"
echo "═══════════════════════════════════════════════════════════════════"
echo "  ✓ LocalTube Deployed Successfully!"
echo "═══════════════════════════════════════════════════════════════════"
echo -e "${NC}"
echo ""
echo "Services:"
echo "  • Backend:       http://localhost:${SERVER_PORT:-8080}"
echo "  • Elasticsearch: http://localhost:9200"
echo "  • Kibana:        http://localhost:5601"
echo "  • Prometheus:    http://localhost:9090"
echo "  • Grafana:       http://localhost:3000 (${GRAFANA_ADMIN_USER:-admin}/${GRAFANA_ADMIN_PASSWORD:-admin123})"
echo ""
echo "Commands:"
echo "  • View logs:     docker compose logs -f localtube-backend"
echo "  • Stop:          docker compose down"
echo "  • Restart:       docker compose restart"
echo ""
echo -e "${YELLOW}Note: First startup may take 1-2 minutes while Elasticsearch initializes.${NC}"