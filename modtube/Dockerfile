# ═══════════════════════════════════════════════════════════════════════════════
# ModTube Backend Dockerfile
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
RUN groupadd -r modtube && useradd -r -g modtube modtube

WORKDIR /app

# Create directories
RUN mkdir -p /data/uploads /data/hls /data/temp /data/thumbnails && \
    chown -R modtube:modtube /data

# Copy jar
COPY --from=builder /app/build/libs/*.jar app.jar
RUN chown modtube:modtube app.jar

USER modtube

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:4000/actuator/health || exit 1

ENTRYPOINT ["java", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]
