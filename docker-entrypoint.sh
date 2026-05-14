#!/bin/bash
set -e

PGDATA=${PGDATA:-/var/lib/postgresql/data}
PGUSER=${PGUSER:-postgres}
PGDB=${PGDB:-localtube}

# PostgreSQL 16 binaries path
PG_BIN=/usr/lib/postgresql/16/bin
export PATH="$PG_BIN:$PATH"

# ── PostgreSQL init ───────────────────────────────────────────────────────────
if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "[entrypoint] Initializing PostgreSQL..."
    install -d -m 0700 -o postgres -g postgres "$PGDATA"
    su -s /bin/bash postgres -c "$PG_BIN/initdb -D $PGDATA --username=$PGUSER --auth=trust"
fi

su -s /bin/bash postgres -c "$PG_BIN/pg_ctl -D $PGDATA -l /tmp/pg_init.log start -w"
su -s /bin/bash postgres -c \
    "$PG_BIN/psql -U $PGUSER -tc \"SELECT 1 FROM pg_database WHERE datname='$PGDB'\" | grep -q 1 \
     || $PG_BIN/psql -U $PGUSER -c \"CREATE DATABASE $PGDB;\""
su -s /bin/bash postgres -c "$PG_BIN/pg_ctl -D $PGDATA stop -w"
echo "[entrypoint] PostgreSQL ready, database '$PGDB' exists."

# ── Grafana directory permissions ─────────────────────────────────────────────
chown -R grafana:grafana /var/lib/grafana /var/log/grafana 2>/dev/null || true

# ── Prometheus: clean up stale lock file from previous container run ──────────
# When Docker restarts/rebuilds the container the bind-mounted prometheus data
# directory still contains the lock file from the previous run.  Prometheus
# refuses to start if it finds a lock it did not create, so we remove it here
# (it is safe: the process that owned it is long gone).
PROM_LOCK="/var/lib/prometheus/lock"
if [ -f "$PROM_LOCK" ]; then
    echo "[entrypoint] Removing stale Prometheus TSDB lock file..."
    rm -f "$PROM_LOCK"
fi
mkdir -p /var/lib/prometheus
chmod 755 /var/lib/prometheus

# ── Spring Boot env exports ───────────────────────────────────────────────────
export SPRING_DATASOURCE_URL="${SPRING_DATASOURCE_URL:-jdbc:postgresql://localhost:5432/$PGDB}"
export SPRING_DATASOURCE_USERNAME="${SPRING_DATASOURCE_USERNAME:-$PGUSER}"
export SPRING_DATASOURCE_PASSWORD="${SPRING_DATASOURCE_PASSWORD:-}"

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
