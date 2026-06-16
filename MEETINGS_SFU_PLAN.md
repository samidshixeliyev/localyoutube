# Video Meetings — Scaling to 30+ Participants (SFU Migration Plan)

## Why the current mesh can't do 30

The meeting feature uses a **full mesh**: every participant opens a direct
`RTCPeerConnection` to every other participant. For `N` people, each browser:

- maintains `N − 1` peer connections,
- **encodes and uploads its camera `N − 1` times**,
- decodes `N − 1` incoming streams.

| Participants | Conns/client | Uplink streams/client | Total room conns |
|---|---|---|---|
| 6  | 5  | 5  | 15  |
| 12 | 11 | 11 | 66  |
| 30 | 29 | 29 | **435** |

At 30, each browser is running ~29 encoders + ~29 decoders and pushing tens of
Mbps upstream. Browsers choke around **4–6 participants**; 30 is far beyond the
ceiling regardless of network. The **signaling server scales fine** — it's a
stateless JSON relay — the wall is the per-client media load in the mesh.

### What we already did to push the mesh as far as it goes
- **Adaptive per-peer quality** (`MeetingRoom.jsx` → `applyAdaptiveQuality`):
  camera bitrate/resolution shrinks as the room grows (1.2 Mbps @ ≤4 →
  150 kbps + ⅓ resolution @ >16). This roughly doubles the usable headcount.
- **Configurable hard cap** (`WEBRTC_MAX_PARTICIPANTS`, default 12) enforced in
  `MeetingSignalingHandler` so a room can't silently melt down.

These make ~8–12 usable, but **true 30+ needs an SFU** (Selective Forwarding
Unit): each client uploads **one** stream to a server that forwards it
selectively. With simulcast, 30–50 participants is routine.

---

## Recommended: LiveKit (self-hosted)

LiveKit is the lowest-effort path: a single Go binary / Docker image, a mature
JS client SDK, a Java server SDK for token minting, and built-in simulcast +
active-speaker detection.

### 1. Infrastructure
Add a LiveKit service (its own compose file, mirroring `docker-compose.minio.yml`):

```yaml
# docker-compose.livekit.yml
services:
  livekit:
    image: livekit/livekit-server:latest
    container_name: modtube-livekit
    restart: unless-stopped
    command: --config /etc/livekit.yaml
    ports:
      - "7880:7880"      # WS/HTTP signaling
      - "7881:7881"      # TCP fallback
      - "50000-50100:50000-50100/udp"   # RTP media
    volumes:
      - ./livekit.yaml:/etc/livekit.yaml
```

`livekit.yaml` holds an API key/secret pair and a TURN section. **A TURN/UDP
path is mandatory for real cross-network meetings** — the current STUN-only
setup only works same-LAN.

New env vars (extend `.env.example` + `docker-compose.yml`):
```
LIVEKIT_URL=ws://host.docker.internal:7880
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

### 2. Backend
- Add `io.livekit:livekit-server:<ver>` (Java SDK) to `build.gradle`.
- New `LiveKitTokenService`: mint a join token (room = `roomCode`, identity =
  user email, name = display name, grants from `canAccessMeeting`).
- New endpoint `GET /api/meetings/{id}/token` → `{ url, token }`. Reuse the
  existing `canAccessMeeting` / `manage-meetings` access rules verbatim.
- **Keep** `VideoMeeting` entity, the meetings CRUD, permissions, and access
  control — only the *media transport* changes.
- The raw-WebSocket signaling (`MeetingSignalingHandler`,
  `MeetingHandshakeInterceptor`, `WebSocketConfig`) can be **removed** once the
  room UI is on LiveKit, *unless* you keep the in-meeting chat there (LiveKit
  has its own data channels, so chat can move too).
- Enforce capacity with LiveKit's `maxParticipants` room option instead of the
  manual cap.

### 3. Frontend
- Add `livekit-client` (and optionally `@livekit/components-react`).
- Rewrite `MeetingRoom.jsx` to: fetch `{url, token}`, `room.connect(url, token)`,
  publish camera/mic, and render `room.remoteParticipants`. Enable **simulcast**
  on publish so the SFU can drop to low layers for big rooms.
- Mic/camera/screen-share toggles, host "end meeting", and chat all map to
  LiveKit APIs (`setMicrophoneEnabled`, `setScreenShareEnabled`,
  `room.disconnect`, data messages).
- `VideoMeetings.jsx` list/create/manage page is **unchanged**.

### 4. Effort & risk
- ~2–3 days. The room UI is a full rewrite; everything else (CRUD, perms,
  notifications, access rules) is reused.
- Needs real testing with many clients — cannot be validated in this dev
  environment. Stage it behind the existing meetings feature flag and roll out.

### Alternatives
- **mediasoup** — most powerful/flexible, but you write the SFU orchestration
  yourself (Node). Highest effort.
- **Janus / ion-sfu** — capable, heavier ops, smaller JS ergonomics than LiveKit.

**Bottom line:** keep the mesh for small calls (now capped + adaptive), and add
LiveKit when meetings genuinely need >~10 participants. The data model and
permission system already in place carry straight over.
