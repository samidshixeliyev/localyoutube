# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 – Frontend (React + Vite)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY video-streaming-frontend/video-streaming-frontend/package*.json ./
RUN npm install --silent
COPY video-streaming-frontend/video-streaming-frontend/ ./
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 – Backend (Spring Boot + Gradle)
# ─────────────────────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-jammy AS backend-builder
WORKDIR /app
COPY modtube/ ./
COPY --from=frontend-builder /frontend/dist ./src/main/resources/static/
RUN chmod +x ./gradlew && ./gradlew clean bootJar -x test --no-daemon

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 – Runtime: Ubuntu 24.04 with PostgreSQL 16, FFmpeg, Java 21,
#            Prometheus, node_exporter, supervisord — all in one image
# ─────────────────────────────────────────────────────────────────────────────
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    PGDATA=/var/lib/postgresql/data \
    PGUSER=postgres \
    PGDB=modtube \
    PROMETHEUS_VERSION=2.52.0 \
    NODE_EXPORTER_VERSION=1.8.2 \
    JAVA_HOME=/opt/java \
    PATH="/opt/java/bin:/usr/lib/postgresql/16/bin:$PATH"

# ── System packages ──────────────────────────────────────────────────────────
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl ca-certificates gnupg \
        supervisor \
        ffmpeg \
        postgresql-16 postgresql-client-16 && \
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
        /var/lib/prometheus \
        /etc/prometheus && \
    chown -R postgres:postgres /var/lib/postgresql

# ── Copy app artifacts ────────────────────────────────────────────────────────
COPY --from=backend-builder /app/build/libs/*.jar /app/modtube.jar

# ── Copy configs ──────────────────────────────────────────────────────────────
COPY prometheus.yml              /etc/prometheus/prometheus.yml
COPY supervisord.conf            /etc/supervisor/conf.d/supervisord.conf
COPY docker-entrypoint.sh        /docker-entrypoint.sh
COPY start-spring.sh             /start-spring.sh

RUN chmod +x /docker-entrypoint.sh /start-spring.sh

# ── Ports ─────────────────────────────────────────────────────────────────────
# 4000 — Spring Boot (serves frontend + API)
EXPOSE 4000

VOLUME ["/data", "/var/lib/postgresql/data", "/var/lib/prometheus"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
    CMD curl -f http://localhost:4000/actuator/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
