#!/bin/bash
set -e

echo "[spring] Waiting for PostgreSQL..."
until /usr/lib/postgresql/16/bin/pg_isready -h localhost -p 5432 -U "${PGUSER:-postgres}" -q; do
    sleep 1
done
echo "[spring] PostgreSQL ready. Starting Spring Boot..."

exec /opt/java/bin/java \
    -Xmx512m \
    -Djava.security.egd=file:/dev/./urandom \
    -jar /app/localtube.jar \
    --spring.config.location=classpath:/config/application.yml
