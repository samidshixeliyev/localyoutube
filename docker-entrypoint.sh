#!/bin/bash
set -e

PGDATA=${PGDATA:-/var/lib/postgresql/data}
PGUSER=${PGUSER:-postgres}
PGDB=${PGDB:-modtube}

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

# ── Grafana directory permissions (Grafana is installed but not started) ──────
chown -R grafana:grafana /var/lib/grafana /var/log/grafana 2>/dev/null || true

# ── Prometheus: clean up stale artifacts from previous container run ──────────
# The bind-mounted /var/lib/prometheus directory survives container
# restarts/rebuilds.  Two things can prevent Prometheus from starting:
#
#   1. lock   — the TSDB lock file from the old process (always stale now)
#   2. wal/   — the Write-Ahead Log can be left in a state Prometheus cannot
#               recover (partial flush, torn write).  Removing it is safe:
#               the actual metric blocks are kept and Prometheus rebuilds a
#               fresh WAL automatically.
#
mkdir -p /var/lib/prometheus
chmod 755 /var/lib/prometheus
echo "[entrypoint] Cleaning stale Prometheus lock + WAL..."
rm -f  /var/lib/prometheus/lock
rm -rf /var/lib/prometheus/wal
rm -rf /var/lib/prometheus/chunks_head

# ── Spring Boot env exports ───────────────────────────────────────────────────
export SPRING_DATASOURCE_URL="${SPRING_DATASOURCE_URL:-jdbc:postgresql://localhost:5432/$PGDB}"
export SPRING_DATASOURCE_USERNAME="${SPRING_DATASOURCE_USERNAME:-$PGUSER}"
export SPRING_DATASOURCE_PASSWORD="${SPRING_DATASOURCE_PASSWORD:-}"

# ── coturn (bundled STUN/TURN for video meetings) ─────────────────────────────
# Clients reach this server at APP_HOST, so the ICE config we hand to browsers
# must use APP_HOST (not localhost). On a flat LAN, calls also work via host
# candidates; coturn guarantees connectivity across subnets.
HOST="${APP_HOST:-localhost}"
export WEBRTC_TURN_USERNAME="${WEBRTC_TURN_USERNAME:-modtube}"
export WEBRTC_TURN_CREDENTIAL="${WEBRTC_TURN_CREDENTIAL:-modtube-turn-secret}"
export WEBRTC_ICE_SERVERS="${WEBRTC_ICE_SERVERS:-stun:${HOST}:3478}"
export WEBRTC_TURN_URL="${WEBRTC_TURN_URL:-turn:${HOST}:3478}"

mkdir -p /etc/coturn
_ext_ip_line=""
if echo "$HOST" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
    _ext_ip_line="external-ip=${HOST}"
fi
cat > /etc/coturn/turnserver.conf <<EOF
listening-port=3478
min-port=49152
max-port=49200
realm=modtube
fingerprint
lt-cred-mech
user=${WEBRTC_TURN_USERNAME}:${WEBRTC_TURN_CREDENTIAL}
no-tls
no-dtls
no-cli
${_ext_ip_line}
EOF
echo "[entrypoint] coturn configured — turn:${HOST}:3478 (user=${WEBRTC_TURN_USERNAME})"

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
