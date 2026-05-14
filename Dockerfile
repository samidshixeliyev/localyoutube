# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 – Frontend (React + Vite)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY video-streaming-frontend/video-streaming-frontend/package*.json ./
RUN npm ci --silent
COPY video-streaming-frontend/video-streaming-frontend/ ./
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 – Backend (Spring Boot + Gradle)
# ─────────────────────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-jammy AS backend-builder
WORKDIR /app
COPY localtube/ ./
# Inject built frontend into Spring Boot static resources
COPY --from=frontend-builder /frontend/dist ./src/main/resources/static/
RUN chmod +x ./gradlew && ./gradlew clean bootJar -x test --no-daemon

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 – Runtime: Ubuntu 24.04 with PostgreSQL 16, FFmpeg, Java 21,
#            Prometheus, Grafana, supervisord — all in one image
# ─────────────────────────────────────────────────────────────────────────────
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    PGDATA=/var/lib/postgresql/data \
    PGUSER=postgres \
    PGDB=localtube \
    PROMETHEUS_VERSION=2.52.0 \
    NODE_EXPORTER_VERSION=1.8.2 \
    GF_SECURITY_ADMIN_USER=admin \
    GF_SECURITY_ADMIN_PASSWORD=admin \
    GF_USERS_ALLOW_SIGN_UP=false \
    GF_SERVER_HTTP_PORT=3000 \
    GF_PATHS_DATA=/var/lib/grafana \
    GF_PATHS_LOGS=/var/log/grafana \
    GF_PATHS_PLUGINS=/var/lib/grafana/plugins \
    GF_PATHS_PROVISIONING=/etc/grafana/provisioning \
    JAVA_HOME=/opt/java \
    PATH="/opt/java/bin:/usr/lib/postgresql/16/bin:$PATH"

# ── System packages ──────────────────────────────────────────────────────────
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl ca-certificates gnupg \
        supervisor \
        ffmpeg \
        postgresql-16 postgresql-client-16 && \
    # Grafana
    curl -fsSL https://apt.grafana.com/gpg.key | gpg --dearmor -o /etc/apt/keyrings/grafana.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" \
        > /etc/apt/sources.list.d/grafana.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends grafana && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# ── Java 21 JRE (Eclipse Temurin) ────────────────────────────────────────────
RUN set -eux; \
    ARCH=$(dpkg --print-architecture); \
    case "$ARCH" in \
        amd64)   JRE_ARCH="x64"   ;; \
        arm64)   JRE_ARCH="aarch64" ;; \
        *)       echo "Unsupported arch: $ARCH" && exit 1 ;; \
    esac; \
    JRE_URL="https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.3%2B9/OpenJDK21U-jre_${JRE_ARCH}_linux_hotspot_21.0.3_9.tar.gz"; \
    mkdir -p /opt/java && \
    curl -fsSL "$JRE_URL" | tar xz -C /opt/java --strip-components=1

# ── Prometheus ────────────────────────────────────────────────────────────────
RUN set -eux; \
    ARCH=$(dpkg --print-architecture); \
    case "$ARCH" in \
        amd64)  PROM_ARCH="amd64"  ;; \
        arm64)  PROM_ARCH="arm64"  ;; \
        *)      echo "Unsupported arch: $ARCH" && exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/prometheus-${PROMETHEUS_VERSION}.linux-${PROM_ARCH}.tar.gz" \
        | tar xz -C /tmp && \
    mkdir -p /opt/prometheus && \
    cp /tmp/prometheus-*/prometheus /opt/prometheus/ && \
    cp /tmp/prometheus-*/promtool  /opt/prometheus/ && \
    rm -rf /tmp/prometheus-*

# ── Node Exporter ────────────────────────────────────────────────────────────
RUN set -eux; \
    ARCH=$(dpkg --print-architecture); \
    case "$ARCH" in \
        amd64)  NE_ARCH="amd64" ;; \
        arm64)  NE_ARCH="arm64" ;; \
        *)      echo "Unsupported arch: $ARCH" && exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/node_exporter-${NODE_EXPORTER_VERSION}.linux-${NE_ARCH}.tar.gz" \
        | tar xz -C /tmp && \
    mkdir -p /opt/node_exporter && \
    cp /tmp/node_exporter-*/node_exporter /opt/node_exporter/ && \
    rm -rf /tmp/node_exporter-*

# ── Directory layout ──────────────────────────────────────────────────────────
RUN mkdir -p \
        /app \
        /data/uploads /data/hls /data/thumbnails /data/temp \
        /var/log/supervisor \
        /var/log/grafana \
        /var/lib/grafana/dashboards \
        /var/lib/grafana/plugins \
        /var/lib/prometheus \
        /etc/prometheus \
        /etc/grafana/provisioning/datasources \
        /etc/grafana/provisioning/dashboards && \
    chown -R postgres:postgres /var/lib/postgresql && \
    chown -R grafana:grafana /var/lib/grafana /var/log/grafana 2>/dev/null || true

# ── Copy app artifacts ────────────────────────────────────────────────────────
COPY --from=backend-builder /app/build/libs/*.jar /app/localtube.jar

# ── Dashboard JSON goes to /etc/grafana/dashboards — NOT under the bind-mounted
#    /var/lib/grafana which gets replaced by the host volume at runtime.
RUN mkdir -p /etc/grafana/dashboards
COPY localtube/localtube-dashboard.json /etc/grafana/dashboards/localtube.json

# ── Copy configs ──────────────────────────────────────────────────────────────
COPY prometheus.yml              /etc/prometheus/prometheus.yml
COPY grafana-datasources.yml     /etc/grafana/provisioning/datasources/datasources.yml
COPY grafana-dashboards.yml      /etc/grafana/provisioning/dashboards/dashboards.yml
COPY supervisord.conf            /etc/supervisor/conf.d/supervisord.conf
COPY docker-entrypoint.sh        /docker-entrypoint.sh
COPY start-spring.sh             /start-spring.sh

RUN chmod +x /docker-entrypoint.sh /start-spring.sh

# ── Ports ─────────────────────────────────────────────────────────────────────
# 8080 — Spring Boot (serves frontend + API)
# 3000 — Grafana
EXPOSE 8080 3000

VOLUME ["/data", "/var/lib/postgresql/data", "/var/lib/grafana", "/var/lib/prometheus"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
    CMD curl -f http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
