# Video Meetings — SFU (LiveKit) "Meeting Runners"  ✅ IMPLEMENTED

> Status: **shipped 2026-06-18.** Video meetings moved off full-mesh WebRTC onto a
> LiveKit SFU. Each registered "runner" is a LiveKit server; meetings are balanced
> across the enabled runners. This fixes the 8+ participant latency / lag wall —
> every client now uploads **one** stream instead of N−1.

## Why the old mesh choked

Full mesh: each of N participants opened a direct `RTCPeerConnection` to every
other one, **encoding + uploading its camera N−1 times** and decoding N−1 streams.
Browsers melt around 4–6; adaptive bitrate pushed it to ~8–12 but no further.
An SFU forwards selectively, so the client uploads once and the server fans out
(with simulcast). 30–50 participants is routine.

## Architecture (the "GitLab runner" model)

- **Runners are registered in the DB**, managed in the app: **Admin → Görüş
  Serverləri** (`/admin/meeting-runners`). Each = `{name, wsUrl, apiKey, apiSecret,
  enabled}`. (Table `meeting_runners`, migration `V13`.)
- On the first token request for a LIVE meeting, the backend **picks the enabled
  runner with the fewest live meetings** and binds the meeting to it
  (`video_meetings.runner_id`) so every participant lands on the same server.
- **Tokens** are minted in `LiveKitTokenService` as plain JWTs signed with the
  runner's API secret (`iss` = API key, `video` grant claim) — no LiveKit Java SDK
  needed. Endpoint: `GET /api/meetings/{id}/token` → `{url, token, identity}`.
- **Media** (audio/video/screen) → LiveKit (`livekit-client` in `MeetingRoom.jsx`,
  `Room.connect(url, token)`, simulcast + dynacast).
- **Chat / attachments / history / moderation** stay on the existing lightweight
  WebSocket (`MeetingSignalingHandler`) — now routed by **email** (LiveKit identity)
  instead of WS session id. Capacity (`room-full`), `meeting-ended`, `kicked`,
  `force-mute`, `force-cam` still travel over this channel.
- The modtube image **no longer bundles coturn**; it's just frontend + backend +
  PostgreSQL. The SFU is a separate stack.

## Deploy

### 1. Start the SFU (separate stack)
Edit `livekit.yaml` — set a strong `keys:` pair (API key + secret ≥ 32 chars) and,
if NOT using host networking, `rtc.node_ip`. Then:
```bash
docker compose -f docker-compose.livekit.yml up -d
```
Offline LAN: pull + save the image once where there's internet, load on the target:
```bash
docker pull livekit/livekit-server:latest
docker save livekit/livekit-server:latest -o livekit-latest.tar   # copy + docker load -i
```

### 2. Start the app (no coturn anymore)
```bash
docker compose -f docker-compose.minio.yml up -d   # storage
docker compose up -d                                # app
```

### 3. Register the runner in the UI
Admin → **Görüş Serverləri** → **Yeni server**:
- **URL**  `ws://<sfu-host-LAN-IP>:7880`  (use `wss://…` if the app is served over HTTPS — schemes must match or the browser blocks mixed content)
- **API key / secret** — exactly the values from `livekit.yaml`

Add several runners to scale horizontally; meetings auto-distribute to the least
loaded. The page shows live health (reachable?) and active-meeting load per runner.

## Notes / limits
- **TLS / mixed content:** an HTTPS app page can only connect to a `wss://` runner.
  For LAN-over-HTTP use `ws://`. Put TLS in front of LiveKit (or your nginx) for `wss`.
- **Kick** is cooperative (the kicked client disconnects on the WS signal), matching
  the prior trust model. Server-enforced removal via LiveKit's RoomService is a
  possible future hardening.
- Single LiveKit node per room (no Redis cluster) — fine for this scale. For very
  large multi-node single rooms, run LiveKit in distributed mode with Redis.
