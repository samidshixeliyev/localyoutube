# ModTube — Offline / LAN Deployment Guide

Deploying on a computer with **no internet**, serving other PCs over the LAN.

## What you need to copy to the offline server

From your `Downloads/tars/` folder, copy these image tars onto the offline machine:

| File | What it is | Needed? |
|---|---|---|
| `modtube-latest.tar` | The app — Spring Boot + React + Postgres + Prometheus + **bundled coturn (STUN/TURN)** | **Yes** |
| `minio-latest.tar` | Object storage for videos/thumbnails | **Yes** |

> The TURN server for meetings is now **baked into the modtube image** — no
> separate coturn container or tar needed.

Plus these files from the repo (the `localyoutube/` folder):
- `docker-compose.yml` (the app, incl. bundled TURN ports)
- `docker-compose.minio.yml` (storage)
- `.env.offline.example` → rename to `.env` and edit

> The offline machine needs **Docker + Docker Compose** already installed (Linux).

---

## Step 1 — Load the images (offline machine)

```bash
docker load -i modtube-latest.tar
docker load -i minio-latest.tar
docker images                          # confirm they're listed
```

## Step 2 — Configure `.env`

```bash
cp .env.offline.example .env
nano .env
```
Replace **`SERVER_LAN_IP`** everywhere with this machine's fixed LAN IP
(e.g. `192.168.1.10`), and change the secrets (`JWT_SECRET`, `ADMIN_PASSWORD`,
`MINIO_SECRET_KEY`, `TURN_PASSWORD`).

> Find the LAN IP with `ip addr` (Linux). Give the server a **static** IP so the
> URL/cert don't change.

## Step 3 — Create the data directory

```bash
mkdir -p /opt/modtube/data
chmod -R 777 /opt/modtube/data
```
(or set `DATA_ROOT` in `.env` to any path you prefer)

## Step 4 — Start everything (in this order)

```bash
# 1) storage first
docker compose -f docker-compose.minio.yml up -d

# 2) the app (TURN is bundled inside this image)
docker compose up -d
```

Check health:
```bash
docker ps
curl -k https://localhost:8443        # should return the app HTML
```

## Step 5 — Open from other LAN computers

In a browser on any LAN PC:
```
https://SERVER_LAN_IP:8443
```
- The TLS cert is **self-signed**, so each PC must click **Advanced → Proceed**
  once. This is required — cameras/microphones only work over HTTPS.
- Log in with the admin account from `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

---

## Ports to allow on the server firewall (LAN only)

| Port | Proto | For |
|---|---|---|
| 8443 | TCP | App (HTTPS) — what users open |
| 8080 | TCP | App (HTTP redirect) — optional |
| 9000 / 9001 | TCP | MinIO API / console (internal; console optional) |
| 3478 | TCP+UDP | TURN/STUN (meetings) |
| 49152–49200 | UDP | TURN media relay (meetings) |

```bash
# example (ufw)
sudo ufw allow 8443/tcp
sudo ufw allow 3478
sudo ufw allow 49152:49200/udp
```

---

## TURN / STUN (meetings)

coturn is **bundled inside the modtube image** and started automatically. The app
auto-points clients at `turn:APP_HOST:3478`, so meetings work offline.

- **All PCs on one flat subnet:** calls also work via direct host candidates;
  TURN is just a safety net.
- **Multiple subnets / VLANs:** the bundled TURN relays the media so calls still
  connect — make sure ports `3478` and `49152–49200/udp` are open on the server.
- Credentials and ICE URLs can be changed live in the admin
  **Settings → Görüş Parametrləri** page (no restart).

## Meeting size

Without an SFU, keep meetings small (`WEBRTC_MAX_PARTICIPANTS=12`, default).
For genuine 30-person meetings you'd add a LiveKit SFU container — see
`MEETINGS_SFU_PLAN.md`.

## Updating later

Rebuild the image on an online machine, `docker save` a new `modtube-latest.tar`,
copy it over, then:
```bash
docker load -i modtube-latest.tar
docker compose up -d --force-recreate
```
Your data in `/opt/modtube/data` is preserved.
