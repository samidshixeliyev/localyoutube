# LocalYouTube / ModTube — Project Summary

> ### 2026-06-16 — Meeting fixes sprint + production deploy (modtube.mndev.uk)
> 8 items shipped & deployed. Backend compiles, frontend builds, live at
> https://modtube.mndev.uk (Cloudflare proxy → origin 185.247.118.199, ports 80/443).
> 1. **Participant snapshot** — `GET /api/meetings/{id}/participants` + `MeetingSignalingHandler.getParticipants`; `MeetingRoom` seeds peers on `ws.onopen` (not only join events).
> 2. **Mic/cam graceful** — `enumerateDevices()` before getUserMedia; toggles disabled/labelled when absent; handles NotFound/NotAllowed/Overconstrained.
> 3. **Screen-share to all peers** — `replaceVideoTrack` now `addTrack`+renegotiates peers with no video sender (helper `renegotiate`).
> 4. **Notifications** — already per-recipient (`findTop50ByUserEmail`); added composite index; invite carries signed token in new `data` column.
> 5. **4-digit room code** — `video_meetings.join_pin` (V10), generated on create, shown only to managers; `roomCode`/`joinPin` hidden from non-managers; `POST /api/meetings/{id}/join` validates PIN/invite-token server-side → returns roomCode. `MeetingRoom` shows PIN gate.
> 6. **In-meeting invite** — `POST /api/meetings/{id}/invite` mints `JwtUtil.generateInviteToken` (24h), grants restricted access, sends notification w/ one-click `?invite=` link (bypasses PIN). Invite panel in `MeetingRoom` (managers).
> 7. **Settings cleanup** — removed dead **JWKS URI** field (only `@Value` env-bound in `IdpJwtValidator`, never read from settings store) + its whitelist key.
> 8. **Performance** — V10 indexes (notifications user+created, comments.video_id, video_likes.video_id, room_code, users lower(email)); `@BatchSize(100)` on Video EAGER collections (N+1); health groups + container healthcheck → `/actuator/health/liveness` (no DB hit); `RequestTimingFilter` logs >100ms; `perf.slow-request-ms`.
> **Post-deploy meeting hotfixes (same day):**
> - *Self shown twice* — the new `/participants` snapshot returned the caller's own
>   WS session → client built a remote tile for itself. Fixed: `isSelfEmail()` filter
>   in `peers` / `peer-joined` / snapshot handlers (skip own email).
> - *Refresh kicked you out / re-asked PIN* — in-memory `roomCode` lost on reload.
>   Fixed: cache roomCode in `sessionStorage` (`mt_room_<id>`) so refresh rejoins
>   without the PIN; cleared on Leave/Finish.
> - *Network blip dropped you for good* — `ws.onclose` now auto-reconnects (bumps
>   retryKey, up to 6× / 2.5s) unless leaving/ended/room-full (`leavingRef`/`noReconnectRef`).
> - *Leave vs Finish* — confirmed both exist: "Tərk et" (Leave, everyone) and
>   "Görüşü bitir" (Finish, `isHost` only). Leave keeps the meeting running; only host ends it.
> **DB connection-pool + response-time fixes (later same day):**
> - *Root cause of "Connection is not available" crashes:* `createAndPush`/`createMeetingInvite`
>   were `@Transactional` and called `emitter.send()` (SSE) **inside** the tx — a slow/Cloudflare-buffered
>   client pinned the Hikari connection → pool drained. Fixed: push now fires via
>   `@TransactionalEventListener(AFTER_COMMIT, fallbackExecution=true)` so the DB
>   connection is released before the SSE write. ([[notifications-sse-after-commit]])
> - **THE real killer — Open-Session-In-View.** `spring.jpa.open-in-view` defaulted to
>   TRUE, so every request (incl. each long-lived **SSE notification stream**) held a DB
>   connection for the whole request → ~10 open streams/parallel reqs exhausted the pool
>   ("after 10 parallel it is down"). Fixed: `spring.jpa.open-in-view: false`. Safe — all
>   entity associations are EAGER (`User`@ManyToOne, `Role`@ManyToMany, `Video`@ElementCollection),
>   no lazy access. **Load-tested:** 15 SSE streams + 40 parallel API → DB conns stayed 7–9
>   (pool 12), all 200, healthy. (Before: 15 streams ≈ 15 pinned conns → exhaustion.)
> - *Pool right-sized for 4-core prod* (HikariCP ≈ cores×2): `DB_POOL_MAX=12`, min-idle 4,
>   connection-timeout 10s, leak-detection 15s. (40 was wrong — see [[prod-server-specs]].)
> - *Transcoding no longer starves the API:* FFmpeg runs `nice -n 19` (Unix) and threads
>   no longer oversubscribe (uses cores−1) → response times stay low during uploads.
> - *Camera-less users couldn't see faces:* `createPeerConnection` now adds `recvonly`
>   audio/video transceivers when local mic/cam is absent, so a viewer/no-camera peer
>   still negotiates m-lines to RECEIVE others' media.
> **Screen-share auto-close + moderation + broadcast + notif polling (later same day):**
> - *Screen share died ~1s in:* WS auto-reconnect re-ran the media effect whose
>   `cleanup()` stopped the screen track → `onended` → stopScreen. Fixed: split
>   `teardownConnections()` (ws+pcs only, used on reconnect) from `stopMedia()`
>   (only on leave/end/unmount); reconnect reuses existing camera/screen.
> - *Notifications "pending" via Cloudflare:* replaced SSE EventSource with 15s
>   polling (`NotificationBell`) — CF-friendly, no hanging request, no held conn.
> - *Broadcast/announcements:* `POST /api/notifications/broadcast` (perm
>   `manage-notifications`, V11) → one row per user, pushed after-commit. New admin
>   page `NotificationManagement.jsx` (/admin/notifications), Sidebar "Bildirişlər",
>   bell icons for ANNOUNCEMENT/WARNING/NEW_VIDEO.
> - *Host moderation in meetings:* host can remove a participant (`kick` → server
>   closes their WS → "Görüşdən çıxarıldınız"), force-mute (`force-mute`), and
>   force-camera-off (`force-cam`). Server gates on session `isHost`; RemoteTile
>   hover buttons (host only). No new env vars for any of this.
> **4K / transcoding "error after 100%" + caps at 1080p (2026-06-17):**
> - Evidence: in-container test showed the exact ffprobe returns `3840,2160` and the
>   exact 2160p FFmpeg command exits 0; disk had 62G free. So probe + 4K encode are
>   fine in isolation → failure only under **parallel 4K load**.
> - Root cause: all quality renditions launched on the common ForkJoinPool
>   (≈cores−1 concurrent). On a 4-core box, 3+ FFmpeg each **decoding 4K** → peak RAM
>   exceeds `MEM_LIMIT` (default 3G) → kernel OOM-kills the heavy renditions
>   (1440p/2160p fail → max 1080p) and/or the JVM (container restarts →
>   `recoverStuckTranscodings` marks the ~done video FAILED → "error after 100%").
> - Fix: cap concurrent FFmpeg jobs at **2** via a dedicated `newFixedThreadPool`
>   (was unbounded common pool); thread count now divides cores by `maxParallel`
>   (2), not by quality count (5) → no 1-thread-slow 4K. Recommend `MEM_LIMIT≥6G`
>   for prod 4K transcoding. (Secondary possibility for odd files: cover-art as v:0 —
>   not hit by standard 4K, left as-is.)
> **MinIO chunk-upload "emal zamanı xəta" + storage resilience + custom qualities + detailed errors (2026-06-17):**
> - *Root cause on local machine:* MinIO is a SEPARATE container; if it isn't running
>   (or `host.docker.internal:9000` doesn't resolve on Linux), the transcode finishes
>   but `storageService.uploadDirectory` → `putObject` throws → video FAILED with a
>   generic "emal zamanı xəta". (On the VPS with MinIO up, 720p AND 4K both transcode
>   + upload fine — proven by in-container end-to-end test.)
> - **Fix — storage now resilient:** `StorageService` tries MinIO (putObject retries 3×)
>   and **falls back to local disk** (`media-dir`, default `/data/media`) when MinIO is
>   unreachable; `open(key)` reads MinIO→local; `deletePrefix` clears both;
>   `MediaController` serves via `open()` so it works from either backend. `ensureBucket`
>   no longer blocks startup (6×2s) and sets `minioReady`; if down, logs "using LOCAL
>   DISK fallback" instead of failing. → uploads never fail just because MinIO is absent.
> - **Detailed errors/logs:** real failure reason persisted to `video.processingError`
>   (shown by `/api/upload/status`); per-quality FFmpeg **tail (last 12 lines)** logged +
>   stored in `failureReasons`; if ALL renditions fail → explicit "All renditions failed
>   (… ) — often RAM/OOM, raise MEM_LIMIT" message; partial failures logged, video still
>   READY with the renditions that succeeded.
> - **Custom quality selection (NEW):** runtime setting `upload.qualities` (comma list e.g.
>   `480p,1080p`) → only those renditions built (never upscale; ≥1 always produced).
>   Falls back to `upload.max-quality` cap when the list is empty. Whitelisted in
>   `SystemSettingController`; `IdpSettings.jsx` has a multi-select chip group (and the
>   max-quality picker is disabled while a custom set is chosen).
> - New env: `MEDIA_DIR` (default `/data/media`, persists under the `/data` volume). No
>   other new env. Recommend prod `MEM_LIMIT=6G` for 4K.
> **Same-network fix + MinIO-only (no disk) + keep original (2026-06-17 cont.):**
> - *Real root cause of upload failures:* app and MinIO were on DIFFERENT Docker
>   networks → `minio:9000` didn't resolve. Fix: both `docker-compose.yml` and
>   `docker-compose.minio.yml` now declare a shared fixed-name network `modtube-net`
>   (`networks: {modtube-net: {name: modtube-net}}`); default `MINIO_ENDPOINT` →
>   `http://minio:9000`. Start minio stack first (or app retries). On VPS, deploy
>   recreates BOTH stacks so they share the net.
> - *No data on disk (user req):* reverted the local-disk fallback — `StorageService`
>   is MinIO-only again, with retry(3×) + `requireMinio()`/`pingMinio()` that throws a
>   CLEAR error ("MinIO unreachable at <endpoint> — share a Docker network…") instead of
>   writing to disk. Removed `media-dir`/`MEDIA_DIR`. Scratch dirs still used transiently
>   during transcode, deleted after.
> - *Keep original upload (user req):* after transcode, original is stored in MinIO at
>   `originals/{id}/<filename>`; `video.original_url` (V12) set to `/originals/{id}/<file>`;
>   `MediaController` serves `/originals/**` (Content-Disposition attachment); permitAll;
>   deleted with the video. Exposed `originalUrl` in upload API.
> - User fronts the app with their OWN native nginx → bundled `nginx.conf` left as-is
>   (catch-all `location /` proxies `/originals` & `/thumbnails`; only `/hls` is special).
>   Ensure native nginx proxies `/originals/` to the app.
> **Removed bundled nginx (user has native nginx) (2026-06-17 cont.):**
> - Frontend is built into Spring static resources → app serves API + SPA on **:4000**.
>   Bundled nginx was redundant. Removed: nginx+openssl from Dockerfile, `COPY nginx.conf`,
>   `[program:nginx]` from supervisord, the self-signed TLS cert gen from entrypoint.
>   EXPOSE/compose now publish only `4000` (+ coturn 3478 + relay). Put your OWN nginx
>   in front for TLS and proxy `/`, `/api`, `/ws`, `/hls`, `/thumbnails`, `/originals`,
>   `/api/notifications/stream` → `:4000`. coturn stays bundled.
> - **Transcoding-failed-despite-same-network diagnosis:** VPS end-to-end test PASSES
>   (upload→transcode→HLS+original to MinIO, `/originals/..`=200) on the shared
>   `modtube-net` with MinIO-only. So a still-failing local run is config: almost always
>   **MinIO credential mismatch** (MinIO root user/pass ≠ app `MINIO_ACCESS_KEY/SECRET_KEY`)
>   or wrong bucket/endpoint scheme. The new clear error (persisted to `processingError`,
>   shown by `/api/upload/status`) names the exact cause — check the failed video's error.
> **Logging — show ALL logs via `docker logs` (2026-06-17 cont.):**
> - *Root cause:* supervisord wrote each service's output to separate files in
>   `/var/log/supervisor/*.log`, so `docker logs modtube` only showed supervisord's own
>   "system" lines, not spring/postgres/etc. Fix: every `[program:*]` now uses
>   `stdout_logfile=/dev/fd/1` + `stdout_logfile_maxbytes=0` + `redirect_stderr=true`,
>   and `[supervisord] logfile=/dev/null` → all service logs stream to container stdout.
> - *Levels env-tunable:* `LOG_LEVEL_ROOT` (def INFO), `LOG_LEVEL_APP` (def DEBUG),
>   `LOG_LEVEL_WEB/SECURITY/SQL` (def INFO) in application.yml + docker-compose. Set
>   `LOG_LEVEL_ROOT=DEBUG` for everything; clear console pattern + UTF-8. No rebuild
>   needed to change verbosity (env only).
> **MinIO over HTTPS with custom cert (2026-06-17 cont.):**
> - *Issue:* user's MinIO is served via HTTPS with a self-signed/custom cert → MinIO
>   SDK (OkHttp) failed the TLS handshake → uploads failed.
> - Fix: `StorageService.buildHttpClient()` builds an `OkHttpClient` (okhttp3 is bundled
>   with io.minio) that trusts a custom CA/server PEM from `MINIO_CA_CERT`
>   (`modtube.storage.minio.ca-cert`), or trusts everything when `MINIO_INSECURE=true`
>   (`modtube.storage.minio.insecure`), passed via `MinioClient.builder().httpClient(...)`.
>   Mount the PEM into the container (commented volume hint in docker-compose) and set
>   `MINIO_CA_CERT=/certs/minio-ca.pem`. Logs show `tls=custom CA: ...` / `INSECURE`.
> - New env: `MINIO_CA_CERT`, `MINIO_INSECURE`.
> **Deploy gotchas:** server had a LIVE justmail mail server + stopped meridian — user confirmed wipe of both. `docker` only in WSL here; password SSH via `sshpass` (WSL) / `SSH_ASKPASS_REQUIRE=force setsid`. **MinIO**: `host.docker.internal:9000` was unreachable from the app container on this Linux host — fixed by setting `MINIO_ENDPOINT=http://minio:9000` (both containers share `modtube_default` since same compose project dir). TLS: Cloudflare proxy, origin self-signed works in CF **Full**; for **Full (strict)** install a CF Origin cert into `/etc/nginx/ssl` (`cert.pem`/`key.pem`). Admin seed user `admin@modtube.local` (password generated at deploy time into the server-side `.env`; rotate). `WEBRTC_MAX_PARTICIPANTS=30`, mem limit 8G.

## Stack

| Layer     | Technology                                     |
|-----------|------------------------------------------------|
| Frontend  | React 18, Vite, Tailwind CSS, HLS.js, Recharts |
| Backend   | Spring Boot (Java), Prometheus metrics         |
| Auth      | JWT + PKCE OAuth2 IDP                          |
| Video     | HLS streaming via nginx, thumbnails            |
| Dev proxy | Vite proxies `/api`, `/hls`, `/thumbnails`, `/uploads`, `/ws` → `VITE_BACKEND_URL` (default `localhost:4000`) |

## Directory Layout

```
localyoutube/
├── video-streaming-frontend/video-streaming-frontend/   ← React app
│   ├── src/
│   │   ├── App.jsx                  ← Root router + global providers
│   │   ├── components/
│   │   │   ├── Navbar.jsx           ← Top navigation (search, theme, user)
│   │   │   ├── Sidebar.jsx          ← YouTube-style left sidebar (NEW)
│   │   │   ├── MiniPlayer.jsx       ← Floating PiP video player
│   │   │   ├── VideoPlayer.jsx      ← Full HLS player with quality selector
│   │   │   ├── VideoCard.jsx        ← Grid card
│   │   │   ├── VideoSuggestion.jsx  ← Related video list
│   │   │   └── CommentSection.jsx   ← Comments
│   │   ├── context/
│   │   │   ├── AuthContext.jsx      ← JWT auth, user info, hasPermission()
│   │   │   ├── MiniPlayerContext.jsx← Mini player state
│   │   │   ├── SidebarContext.jsx   ← Sidebar open/closed state (NEW)
│   │   │   ├── ThemeContext.jsx     ← Dark/light mode
│   │   │   └── UploadContext.jsx    ← Upload queue
│   │   └── pages/
│   │       ├── Home.jsx
│   │       ├── VideoDetail.jsx      ← Video player page
│   │       ├── Shorts.jsx
│   │       ├── SearchResults.jsx
│   │       ├── UploadPage.jsx
│   │       ├── MyVideos.jsx
│   │       ├── MyPlaylists.jsx / PlaylistDetail.jsx
│   │       ├── VideoMeetings.jsx    ← Live meeting list/create (NEW)
│   │       ├── MeetingRoom.jsx      ← WebRTC mesh call room (NEW)
│   │       └── admin/
│   │           ├── Metrics.jsx      ← Prometheus metrics dashboard
│   │           ├── UserManagement.jsx
│   │           ├── RoleManagement.jsx
│   │           └── IdpSettings.jsx
│   ├── tailwind.config.js           ← Army/olive green palette (primary-*, army-*, tan-*)
│   ├── .env.example                 ← VITE_BACKEND_URL / VITE_PORT (NEW)
│   └── vite.config.js
└── modtube/                          ← Spring Boot backend
    └── src/main/java/ao/az/modtube/
        ├── controller/
        │   ├── MetricsProxyController.java   ← Proxies Prometheus queries
        │   └── VideoMeetingController.java   ← /api/meetings (NEW)
        ├── service/VideoMeetingService.java  ← (NEW)
        ├── domain/VideoMeeting.java          ← (NEW)
        ├── websocket/MeetingSignalingHandler.java ← WebRTC signaling (NEW)
        └── config/
            ├── WebSocketConfig.java          ← /ws/meetings/* (NEW)
            └── security/
                ├── MeetingHandshakeInterceptor.java ← WS JWT auth (NEW)
                └── ...
```

## Tailwind Custom Colors

- `primary-*` — olive green (buttons, active states)
- `army-*` — dark olive backgrounds
- `tan-*` — sand accent

## Permissions / Roles

| Permission     | Access                                           |
|----------------|--------------------------------------------------|
| (none/public)  | Watch videos, search                             |
| `admin-modtube`| Upload, manage own videos                        |
| `super-admin`  | All admin pages (users, roles, settings, metrics)|
| `view-metrics` | Metrics page (same as super-admin for that page) |
| `video-call`   | Create/join live video meetings (`/meetings`)    |

---

## Session Log

### 2026-05-15 — Initial fixes

#### Problems found & fixed

1. **Mini player never activated**
   - Root cause: `VideoDetail` had no unmount handler to call `activateMiniPlayer`.
   - Fix: Added `useRef` for video data + current time. On unmount, if a READY video was playing (>1 s), calls `activateMiniPlayer`. Also calls `closeMiniPlayer` on mount to close any previous mini player.
   - File: `src/pages/VideoDetail.jsx`

2. **No sidebar navigation**
   - Added YouTube-style collapsible left sidebar (`w-16` collapsed / `w-60` expanded).
   - Sidebar header has hamburger toggle. Shows nav items with icons (+ labels when expanded).
   - Items adapt to user permissions: all users see Home/Shorts; `admin-modtube` sees My Videos/Upload; `super-admin` sees admin section.
   - New files: `src/context/SidebarContext.jsx`, `src/components/Sidebar.jsx`
   - `App.jsx` now uses `SidebarProvider` + `SidebarAwareLayout` which shifts content with `paddingLeft: 64px / 240px`.

3. **VideoDetail — redundant admin tech info**
   - Removed the "Video məlumatı" sidebar panel (Status, File Size, Duration).
   - These were only visible to admins and added clutter. Duration is in the player; status is shown when processing.
   - File: `src/pages/VideoDetail.jsx`

4. **Metrics page — Prometheus unreachable error**
   - The 503 error from `MetricsProxyController` is expected when Prometheus isn't running.
   - Improved error banner to show separate UI for permission errors vs Prometheus-down.
   - StatCards now render greyed-out when `hasError=true` and value is null.
   - File: `src/pages/admin/Metrics.jsx`

#### Known remaining issues

- **Metrics data**: Prometheus must be running inside the Docker container for real data. Run `docker exec modtube supervisorctl status` to check. No frontend workaround possible.
- **Mobile sidebar**: Sidebar is always visible (no mobile hide logic). On small screens the 64px sidebar may compress content — should add `hidden sm:flex` to sidebar and remove the `paddingLeft` on mobile.
- **Sidebar on Embed page**: `/embed/:id` renders inside `SidebarAwareLayout`, which adds left padding. For a clean embed experience, the sidebar/layout should be excluded for that route.

---

### 2026-05-15 — VPS Deployment & Metrics Backend Fix

#### What was done

1. **Deployed all UI changes to VPS via Git**
   - Pushed 2 commits to `master`: `8b6df05` (all UI changes) + `a6990a5` (backend metrics fix)
   - On VPS (`ubuntu@13.61.159.58`, path `projects/modtube/`):
     ```
     git pull origin master
     docker compose build --no-cache
     docker compose up -d --force-recreate
     ```
   - Container came up healthy (`{"status":"UP"}`).

2. **Root cause of Metrics 400 error found and fixed**
   - **Symptom**: Metrics page showed "Prometheus unreachable" for all cards.
   - **Investigation**: Prometheus IS running inside container (port 9090, PID 34). Spring Boot logs showed `400 Bad Request` on PromQL queries.
   - **Root cause**: `RestTemplate.getForObject(String url, Class)` double-encodes already-percent-encoded characters. `%28` → `%2528`. Prometheus decodes once to `%28`, PromQL parser sees `%` as modulo operator with `28` as operand → `bad number or duration syntax: "28"`.
   - **Fix**: Changed `proxy()` to use `URI.create(url)` instead of a raw String URL — prevents RestTemplate from re-encoding. Also changed `enc()` to replace `+` with `%20` for RFC-compliant URI query params.
   - File: `modtube/src/main/java/ao/az/modtube/controller/MetricsProxyController.java`

3. **Verified metrics fix end-to-end on VPS**
   - Simple query (`up`): returns `success` with both targets up (node_exporter + modtube).
   - Complex CPU query with encoded brackets/braces: returns `success` with real value (`~27.9%` CPU usage).
   - Confirmed no more 400 errors.

#### Key gotchas

- `RestTemplate.getForObject(String, Class)` silently re-encodes percent-encoded strings. Always use `URI.create(url)` overload when the URL is already encoded.
- `URLEncoder.encode()` uses `+` for spaces (application/x-www-form-urlencoded), not `%20` (RFC 3986). For URI query params, always `.replace("+", "%20")`.
- `supervisord` socket path may differ from default — `unix:///var/run/supervisor.sock no such file` is a misleading error; check `docker exec modtube bash -c 'ps aux'` to confirm supervisord is PID 1 and all children are running.

#### Known remaining issues (carried forward)

- **Mobile sidebar**: No hide logic on small screens — 64px sidebar compresses content on mobile.
- **Embed page padding**: `/embed/:id` gets `SidebarAwareLayout` padding, which breaks clean embed.
- **Grafana integration**: `/api/config/grafana` endpoint not yet verified on VPS.

---

### 2026-05-15 — Major UI Overhaul Session

#### What was done

1. **Mini player size + timestamp resume**
   - `MiniPlayer.jsx`: width 320 → 400px, updated drag bounds and initial position
   - `VideoPlayer.jsx`: added `startTime` prop; seeks to it in `MANIFEST_PARSED` handler (HLS) and `loadedmetadata` (Safari native)
   - `VideoDetail.jsx`: reads `?t=` query param via `useSearchParams`, passes as `startTime` to `VideoPlayer`
   - `MiniPlayer.handleExpand()` already passes `?t=${time}` — the missing piece was VideoDetail reading it

2. **Sign-out stops mini player**
   - `UserDropdown.jsx`: `handleLogout` now calls `closeMiniPlayer()` before `logout()` — prevents restricted video playing after sign-out

3. **UserDropdown fully Azerbaijani**
   - "My Videos" → "Videolarım", "Upload Video" → "Video Yüklə", "Change Password" → "Şifrəni Dəyiş"
   - "Metrics" → "Metriklər", "Settings" → "Parametrlər", "Manage Users" → "İstifadəçilər"
   - "Manage Roles" → "Rollar", "Sign Out" → "Çıxış"
   - Role badge dark mode added

4. **Login page redesign**
   - `max-w-sm` → `max-w-md`, icons for email/password fields, show/hide password toggle
   - Larger padding, decorative circles in header, bigger "Sistemə Daxil Ol" button

5. **Website icon redesigned**
   - `ModTubeLogo.jsx`: new military shield with play triangle icon
   - `index.html`: inline SVG data-URI favicon (shield shape)

6. **UploadPage — full overhaul**
   - Full Azerbaijani translation of all labels, placeholders, error messages
   - Dark mode classes on all inputs/textareas/containers
   - Shorts toggle (`isShorts` checkbox with "SHORTS" badge)
   - Email autocomplete: fetches users from `adminGetUsers()`, shows dropdown filtered by typed query

7. **VideoDetail — email autocomplete in edit form**
   - Same `adminGetUsers()` autocomplete for restricted section in edit mode
   - Dropdown closes on outside click

8. **ChangePassword — dark mode + Azerbaijani**
   - Full redesign with header strip, dark mode inputs, Azerbaijani

9. **Metrics — dark mode chart colors**
   - Added `useTheme()` hook; `gridColor`, `axisColor`, `tickColor` all adapt to dark/light
   - Applied to all CartesianGrid, XAxis, YAxis across all 11 charts
   - Card backgrounds use `dark:bg-army-800` (army theme)
   - App metrics (uploads, views, transcodings) show `0` instead of `—` when null

10. **RoleManagement — grouped permission categories**
    - `PERMISSION_META` map with emoji icons, Azerbaijani descriptions, and categories
    - Permissions grouped by: Sistem / İstifadəçi / Video / Digər
    - Each category is collapsible, has "select all / deselect all" per category
    - Shows "X seçilib" badge on the permissions section header

11. **Multi-file parallel uploads + Settings**
    - `UploadContext.jsx`: rewrote to support a queue of uploads
      - `fetchUploadConfig()` reads both `maxParallelUploads` (chunks) and `maxConcurrentUploads` (files)
      - Multiple files can upload simultaneously; excess is queued
      - `isShorts` passed through to `updateVideo` API call
    - `UploadManager.jsx`: shows all active uploads as a scrollable list, queue badge
    - `IdpSettings.jsx`: Azerbaijani throughout, army theme dark mode, new `upload.max-concurrent` slider

12. **Search query highlight in results**
    - `VideoCard.jsx`: `HighlightText` component wraps title and uploader name
    - Matched text shown with `bg-primary-200 dark:bg-primary-700/60` background
    - `SearchResults.jsx`: passes `query` as `highlight` prop; Azerbaijani, dark mode

#### Key notes for next session

- Backend needs `maxConcurrentUploads` field in `GET /api/config/upload` response (maps from `upload.max-concurrent` setting) — currently falls back to 2
- Backend needs `isShorts` field in video API (PUT `/videos/{id}`) and GET `/videos/shorts` should filter by it — check if backend already handles this
- The `upload.max-concurrent` setting key is new — backend settings store needs to persist it

#### Known remaining issues (carried forward)

- **Mobile sidebar**: no hide logic on small screens
- **Embed page padding**: `/embed/:id` gets sidebar padding
- **Grafana URL**: `/api/config/grafana` endpoint not verified with new settings UI

---

### 2026-05-15 — UI Overhaul Session 2 (Autoplay, Shorts Redesign, Logos, Fixes)

#### What was done

1. **Embed page sidebar padding fixed**
   - `App.jsx` `SidebarAwareLayout`: checks `useLocation()` and skips sidebar + padding for `/login`, `/callback`, `/logged_out`, and `/embed/*` routes.

2. **OAuth2 SSO button stuck on "Yönləndirilir…"**
   - Root cause: BFcache — browser restores page from cache with `ssoLoading = true` after user closes OAuth2 provider tab or presses Back.
   - Fix: `Login.jsx` listens for `pageshow` (`e.persisted`) and `visibilitychange` events to reset `ssoLoading` to `false`.

3. **Sidebar visible on /login route**
   - Fixed by the same `SidebarAwareLayout` `noSidebar` check described above.

4. **DB-backed metrics section added to Metrics page**
   - `services/api.js`: added `adminGetStats()` calling `GET /api/admin/stats`.
   - `Metrics.jsx`: new "Verilənlər Bazası (Canlı)" section above Prometheus section with 4 cards: Yüklənmiş Videolar, Ümumi Baxışlar (DB), Video Yaddaş (DB), Aktiv Transkodlama.
   - Backend must implement `GET /api/admin/stats` returning `{ totalVideos, totalViews, totalFileSizeBytes, activeTranscodings }`.
   - Grafana link fixed: now points to root `/` instead of `/d/modtube-main`.

5. **"Administratorla əlaqə saxlayın" removed from Login page**

6. **UserForm dark mode + Azerbaijani rewrite**
   - Complete rewrite: military header strip, dark mode inputs (`dark:bg-army-700 dark:border-army-600 dark:text-gray-100`), Azerbaijani labels (Ad, Soyad, E-poçt, Şifrə, Rol), `<Navbar />` included.

7. **MiniPlayer redesign**
   - Uses `Play, Pause, X, Maximize2` lucide icons (no more emoji).
   - `duration` + `progress` state: live progress bar overlaid on video.
   - Accent top border: `h-0.5 bg-primary-500`.
   - Controls bar: `bg-gray-900/95`, title + current/total time display.
   - Container: `rounded-xl overflow-hidden shadow-2xl border border-white/10`.

8. **Video autoplay on click**
   - `VideoPlayer.jsx`: added `autoPlay` prop (default `false`); when set, calls `video.play()` after `MANIFEST_PARSED` (HLS) and `loadedmetadata` (Safari native).
   - `VideoDetail.jsx`: passes `autoPlay={true}` to `VideoPlayer`.

9. **Next suggested video autoplay countdown**
   - `VideoPlayer.jsx`: added `onEnded` prop; calls it when video ends.
   - `VideoSuggestion.jsx`: added `onNextVideoReady` prop; passes `filtered[0]` (first suggestion) after loading.
   - `VideoDetail.jsx`: `handleVideoEnded` starts a 5-second countdown; overlay shows thumbnail, title, countdown, "Ləğv et" and "İndi oynat" buttons. After 5s navigates to `nextVideo.id`. Countdown resets on video `id` change.

10. **Shorts full redesign**
    - `Shorts.jsx` complete rewrite: `ShortItem` component per video with own HLS instance and `IntersectionObserver`.
    - Autoplay (muted) when 60% visible; pause when not. `loop` attribute on `<video>`.
    - Poster thumbnail while video loads; tap-to-pause/play overlay.
    - Progress bar at bottom of video.
    - Right-side action buttons: like (heart), expand to full video (`Maximize2`), sound toggle.
    - Page-level mute toggle in header.
    - `no-scrollbar` utility class added to `index.css`.
    - No time limit enforced on Shorts (backend already handles).

11. **Logo PNG assets**
    - `public/logo_dark.png` and `public/logo_light.png` copied from `C:\Users\samid.sixaliyev\Desktop\logo_extract\`.
    - `ModTubeLogo.jsx`: rewritten to use `<img>` with theme-aware `src` (`dark ? /logo_dark.png : /logo_light.png`).
    - `index.html`: favicon updated to `<link rel="icon" type="image/png" href="/logo_dark.png" />`.

#### Key gotchas

- **BFcache** preserves React state when navigating away and back via browser. Must listen for `pageshow` with `e.persisted` flag and reset loading states.
- **`IntersectionObserver` per item** is required for Shorts — a shared observer was missing per-item pause/play granularity.
- **`public/` folder** may not exist in the Vite project — create it with `New-Item -ItemType Directory -Force` before copying static assets.

#### Known remaining issues (carried forward)

- **Backend `/api/admin/stats` endpoint** — must be implemented. Frontend calls it gracefully and shows error state if unavailable.
- **Mobile sidebar**: no hide logic on small screens — 64px sidebar compresses content.
- **Grafana integration**: `/api/config/grafana` not fully verified on VPS.
- **Backend `isShorts` field**: `PUT /videos/{id}` needs `isShorts` and `GET /videos/shorts` should filter by it.
- **Backend `upload.max-concurrent` setting**: new key, needs to be persisted in settings store.

---

### 2026-05-15 — Offline + Bugfix Session

#### Problems found & fixed

1. **Videos can't open**
   - Root cause: CSP `worker-src 'self'` (implicit from `default-src 'self'`) blocks HLS.js from creating blob: Web Workers. In some browser/version combinations, the fallback path doesn't activate properly.
   - Fix 1: Added `worker-src blob: 'self'` and `connect-src blob:` to the CSP in `index.html`.
   - Fix 2: Set `enableWorker: false` in VideoPlayer's HLS config — avoids blob: workers entirely. On a local/offline LAN, the performance difference is negligible.
   - Also removed `console.log` statements from VideoPlayer.

2. **Deleting video doesn't delete comments**
   - `VideoService.deleteVideo()` deleted files, likes, and the DB record — but not comments.
   - Fix: Added `CommentRepository` injection to `VideoService`; now calls `commentRepository.deleteByVideoId(id)` before deleting the video record.

3. **Internet calls on offline machine**
   - `IdpJwtValidator` used a RestTemplate with NO connect/read timeout for JWKS fetches.
   - If the IDP (auth.ao.az or VPS IP) is unreachable, every request with an RS256 JWT would stall the thread indefinitely.
   - Fix: `buildRestTemplate()` now sets `connectTimeout=3s`, `readTimeout=5s` for both SSL-skip and normal modes. After 3–5 s, the IDP validation times out, throws, is caught by `JwtAuthenticationFilter`, and the request continues unauthenticated. Local (HS256) tokens still work offline.

4. **Metrics `/api/admin/stats` missing**
   - Frontend calls `GET /api/admin/stats` for the "Verilənlər Bazası" section but the endpoint didn't exist.
   - Fix: Added `sumViews()` and `sumFileSizeBytes()` queries to `VideoRepository`; added `getTotalViews()`, `getTotalFileSizeBytes()`, `countByStatus()` to `VideoService`; added `GET /api/admin/stats` endpoint to `AdminController` returning `{totalVideos, totalViews, totalFileSizeBytes, activeTranscodings}`.

5. **Icons broken (logo files were wrong)**
   - Previous copy picked up incorrect files (5965 bytes each, both identical).
   - Correct files: `modtube_logo_dark_mode.png` (1.6 MB) → `logo_dark.png`; `Gemini_Generated_Image_light.png` (1.6 MB) → `logo_light.png`.
   - Fixed by re-copying from `C:\Users\samid.sixaliyev\Desktop\logo_extract\`.

#### Known remaining issues (carried forward)

- **Mobile sidebar**: no hide logic on small screens — 64px sidebar compresses content.
- **Backend `isShorts` field**: `PUT /videos/{id}` needs `isShorts` and `GET /videos/shorts` should filter by it.
- **Backend `upload.max-concurrent` setting**: new key, needs to be persisted in settings store.
- **Offline deployment**: IDP URLs in docker-compose.yml still default to VPS (`13.61.159.58`). Override `IDP_BASE_URL`, `IDP_JWKS_URI`, `IDP_REDIRECT_URI`, `IDP_LOGOUT_REDIRECT_URI` in `.env` when deploying to an offline computer. Local auth (email/password) works without IDP.

---

### 2026-05-15 — SVG Logo Replacement

#### What was done

1. **ModTubeLogo replaced with inline SVG + text**
   - `ModTubeLogo.jsx`: completely rewritten from PNG `<img>` to pure inline SVG + HTML text component.
   - SVG shield: 28×32 viewBox, olive `#556430` fill, `#6b7f3a` inner highlight, white play triangle.
   - Text: "MOD" in olive (`#556430` light / `#a3b96a` dark), "TUBE" in sand (`#9a7b38` light / `#c4aa62` dark).
   - No PNG files required; works fully offline; crisp at any size.
   - `mini` prop → icon-only mode (for collapsed/mobile Navbar).
   - `size` prop scales icon width, font size, and gap proportionally.
   - Security config (`SecurityConfiguration.java`) already has `permitAll()` for `/*.png` from previous fix; still applies for favicon.

---

---

### 2026-05-18 — Permissions, Port Fix, Rate Limiting, UI Bugs

#### What was done

1. **Port: Spring Boot moved from 8080 → 4000**
   - `application.yml`: `server.port: ${SERVER_PORT:4000}` (default changed)
   - `docker-compose.yml`: port mapping changed from `4000:8080` → `4000:4000`
   - `prometheus.yml`: scrape target fixed from `modtube-backend:8080` → `localhost:4000`
   - Health check URL updated to `localhost:4000`
   - Other containers on same Docker host can now reach the app on port 4000 directly

2. **Permissions — DB seeded + dynamic management**
   - `V2__add_permissions.sql`: Seeds all 12 permissions (super-admin, admin-modtube, view-metrics, manage-settings, view-reports, manage-users, manage-roles, upload-video, delete-video, view-private, manage-shorts, comment-moderate)
   - `AdminService`: Added `createPermission()` and `deletePermission()` (system permissions protected)
   - `AdminController`: Added `POST /api/admin/permissions` and `DELETE /api/admin/permissions/{id}`
   - `api.js`: Added `adminCreatePermission()` and `adminDeletePermission()`
   - `RoleManagement.jsx`: New inline permission creation form; permission list shows delete button on hover for non-system perms; PERMISSION_META expanded to all 12 perms with Azerbaijani descriptions

3. **Rate limiting**
   - `RateLimitFilter.java`: Per-IP token bucket — 100 RPS global, 4 RPS for `/api/upload/*`; responds 429 with `Retry-After: 1`
   - Configurable via `RATE_LIMIT_RPS` and `RATE_LIMIT_UPLOAD_RPS` env vars

4. **Docker resource limits**
   - Added `deploy.resources.limits` (2 CPU, 3 GB) and `reservations` (0.5 CPU, 1 GB) to docker-compose
   - `CPU_LIMIT` and `MEM_LIMIT` env vars allow override

5. **VideoPlayer fixes**
   - `formatTime` now handles hours correctly (`1:02:03` instead of `62:03` for long videos)
   - Autoplay: browser-blocked autoplay retries with `video.muted = true` before giving up
   - Progress bar: `NaN` guard for `currentTime / duration` when duration is 0
   - `autoPlay` added to `useEffect` dependency array

6. **VideoCard: `formatDuration` uses `Math.floor(seconds % 60)`** for correct seconds display

7. **Shorts light mode**: Page wrapper and header strip changed from hardcoded `bg-black` to `bg-gray-950 dark:bg-black`

8. **ModTubeLogo redesign**: Gradient shield (green → dark green), inner highlight border, top sheen highlight, `MOD` bold + `TUBE` regular weight for better contrast; unique gradient ID per theme to prevent SVG ID conflicts

#### Known remaining issues (carried forward)

- **Mobile sidebar**: no hide logic on small screens — 64px sidebar compresses content.
- **Backend `isShorts` field**: `PUT /videos/{id}` needs `isShorts` in update; `GET /videos/shorts` already filters by `is_short`.
- **Backend `upload.max-concurrent` setting**: new key, needs to be persisted in settings store.

---

### 2026-05-18 — Claude Opus AI Metrics Analysis

#### What was done

1. **MetricsAnalysisController.java** — new backend endpoint
   - `POST /api/admin/metrics/analyze` (requires `super-admin` or `view-metrics`)
   - Accepts `{db, system, app}` JSON snapshot from frontend
   - Calls `https://api.anthropic.com/v1/messages` with `claude-opus-4-7`
   - Uses `thinking: {type: "adaptive"}`, Azerbaijani system prompt, 300-word max
   - Returns `{analysis: "...text..."}` or `{error: "..."}` on failure
   - Gracefully returns 503 if `ANTHROPIC_API_KEY` env var is unset

2. **Metrics.jsx** — AI Analiz section added at the bottom of the page
   - "Analiz et" button (disabled while stats are loading)
   - Loading skeleton while waiting for Claude response (up to 90s)
   - Formatted result panel with `whitespace-pre-wrap` for readable output
   - Error display if API key missing or API call fails
   - Empty state with `BrainCircuit` icon prompt

3. **api.js** — `adminAnalyzeMetrics(snapshot)` added with 90-second timeout

4. **docker-compose.yml** — `ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}` added to env section

5. **`.env.example`** — `ANTHROPIC_API_KEY=` documented under AI metrics section

6. **Prometheus fixes confirmed from previous session**
   - All `modtube_*` queries in Metrics.jsx changed to `localtube_*` (actual metric prefix)
   - `prometheus.yml` target changed to `localhost:4000` (was `localhost:8080` / `modtube-backend:8080`)

#### Key gotchas

- **Anthropic API timeout**: Claude Opus with extended thinking can take 30–60s. `api.js` uses `timeout: 90000` (90s). Spring Boot `RestTemplate` read timeout set to 60s in `MetricsAnalysisController.buildRestTemplate()`.
- **`thinking: {type: "adaptive"}` on Opus 4.7**: Do NOT use `budget_tokens` — it's removed on Opus 4.7. Use adaptive only.
- **ANTHROPIC_API_KEY is optional**: The button still renders; on click, backend returns 503 with Azerbaijani error message if key is not set.

#### To deploy on VPS

```bash
# SSH to ubuntu@13.61.159.58 then:
cd projects/modtube
git pull origin master
# Add your API key to .env:
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env
docker compose build
docker compose up -d --force-recreate
```

#### Known remaining issues (carried forward)

- **Mobile sidebar**: no hide logic on small screens — 64px sidebar compresses content.
- **Backend `isShorts` field**: `PUT /videos/{id}` needs `isShorts` in update.
- **Backend `upload.max-concurrent` setting**: new key, needs to be persisted in settings store.

---

### 2026-05-18 — Metrics Fix, Port Cleanup, ES/Kibana Removal

#### Root cause of metrics not working

Prometheus was scraping `localhost:8080` (connection refused) because `prometheus.yml` at the project root was never updated when Spring Boot moved to port 4000. The baked-in image had the stale config. Also the Prometheus job name was `modtube` while Metrics.jsx filtered for `job="modtube-backend"`.

Additionally, two metric names in Metrics.jsx were wrong:
- `jvm_threads_live` → **`jvm_threads_live_threads`** (Micrometer gauge name includes `_threads` suffix on JDK21)
- `process_open_file_descriptors` → **`process_files_open_files`** (actual Micrometer name; not the Prometheus Go client name)

#### What was done

1. **`prometheus.yml` (root)** — fixed `localhost:8080` → `localhost:4000`; job `modtube` → `modtube-backend`
2. **`Metrics.jsx`** — corrected both metric names above
3. **`modtube/docker-compose.yml`** — removed unused elasticsearch and kibana services; fixed port 8080 → 4000
4. **`modtube/Dockerfile`** — fixed `EXPOSE 8080` and healthcheck port to 4000
5. **Live VPS fix (no rebuild needed)** — wrote corrected prometheus.yml into running container, sent SIGHUP to reload. Targets immediately came up; `jvm_threads_live_threads`, `process_files_open_files`, `http_server_requests`, `localtube_*` all returning real values.

#### Key gotchas

- **The `prometheus.yml` that matters is the one at the project ROOT** (copied into the all-in-one Docker image). The one at `modtube/prometheus.yml` is for the old multi-container setup and is not used by the VPS deployment.
- **Prometheus config reload without rebuild**: `kill -HUP $(pgrep prometheus)` inside the container. No restart required.
- **Micrometer metric names on JDK21**: `jvm_threads_live_threads` (includes `_threads`), `process_files_open_files` (not `process_open_fds` / `process_open_file_descriptors`). Always verify against `curl http://localhost:4000/actuator/prometheus | grep <pattern>` before guessing.
- **No 8080 anywhere**: All port references cleaned up. Spring Boot defaults to 4000 via `SERVER_PORT:4000` in application.yml.

#### Known remaining issues (carried forward)

- **Mobile sidebar**: no hide logic on small screens — 64px sidebar compresses content.
- **Backend `upload.max-concurrent` setting**: new key, needs to be persisted in settings store.
- **Next rebuild**: prometheus.yml fix is live in the running container but the rebuilt image will also pick it up from the fixed root file.

---

### 2026-05-19 — Shorts Fix, Color Theme, Dark Mode Fixes, Mini Player Bug

#### What was done

1. **Shorts upload now works**
   - Root cause: `PUT /api/videos/{id}` handler in `VideoController.java` read `title`, `description`, `tags` from the update body but **never read `isShorts`**, so `video.setShort()` was never called.
   - Fix: added `if (updates.containsKey("isShorts")) { video.setShort(Boolean.TRUE.equals(updates.get("isShorts"))); }` before `videoService.updateVideo(video)`.
   - Frontend (UploadContext.jsx) was already sending `{ tags: [], isShorts: true }` correctly.
   - Backend `getShorts()` query (`WHERE v.is_short = true`) was already correct.
   - **Requires backend rebuild + redeploy to take effect.**

2. **Website color theme changed to red (matches logo)**
   - `tailwind.config.js`: `primary-*` palette changed from olive green to crimson red (500=`#e02020`, 600=`#c41515`).
   - All buttons, active states, focus rings, borders now use red instead of olive.
   - `army-*` dark backgrounds unchanged (still olive/military — intentional brand choice).

3. **Login page fixes**
   - Background gradient: `to-army-100` changed to `to-gray-100` to avoid jarring red+olive mix in light mode.
   - OAuth2 SSO button: changed from `bg-tan-500` (sand) to `bg-sky-600` (ocean blue) as requested.

4. **MyVideos dark mode text**
   - `h1` "Mənim videolarım": added `dark:text-gray-100`.
   - Count paragraph: added `dark:text-gray-300`.

5. **Mini player not closing on sign-out**
   - Root cause: `UserDropdown.handleLogout()` calls `closeMiniPlayer()` then `logout()` — both are synchronous state updates that React 18 batches together. In some edge cases (fast navigation, re-renders), the mini player state wasn't consistently closing.
   - Fix: added `useAuth` import to `MiniPlayer.jsx` and a `useEffect` that calls `closeMiniPlayer()` whenever `isAuthenticated` transitions to `false`. This is a guaranteed close regardless of who triggered logout.

#### Known remaining issues (carried forward)

- **Mobile sidebar**: no hide logic on small screens.
- **Backend `upload.max-concurrent` setting**: new key needs to be persisted in settings store.
- **Backend rebuild needed**: Shorts fix (`isShorts` in `PUT /api/videos/{id}`) requires a rebuild + redeploy.

---

### 2026-05-19 — Permissions System, Mini Player Redesign, Roles UI, Shorts Nav/Share

#### What was done

1. **Central permissions registry** (`src/config/permissions.js`)
   - `PERMS` constants matching DB strings; `FEATURE` gates (OR logic arrays); `can()` helper
   - `super-admin` always bypasses via `can()` — not added to FEATURE arrays

2. **Frontend permission wiring**
   - `Sidebar.jsx`: `CONTENT_NAV` (upload-video/admin-modtube) and `ADMIN_NAV` (per-item perms: manage-users, manage-roles, manage-settings, view-metrics). Each section only shows if user has any matching perm.
   - `UserDropdown.jsx`: `canManageUsers` and `canManageRoles` flags replacing `isSuperAdmin`-only checks.
   - `App.jsx`: `/upload` and `/my-videos` → `['upload-video', 'admin-modtube']`; `/admin/users` → `['super-admin', 'manage-users']`; `/admin/roles` → `['super-admin', 'manage-roles']`.
   - `VideoDetail.jsx`: `canDelete` = owner with `delete-video` or `admin-modtube`, or super-admin. Delete button uses `canDelete`, edit button uses `canEdit`.

3. **Backend permission wiring**
   - `AdminController.java`: removed class-level `@PreAuthorize("hasAuthority('super-admin')")`; method-level annotations added: stats → `view-metrics OR super-admin`; user endpoints → `manage-users OR super-admin`; role/permission endpoints → `manage-roles OR super-admin`.
   - `VideoController.java`: delete endpoint → `delete-video OR admin-modtube OR super-admin`; `canDelete` added to `toResponse()`.
   - `UploadController.java`: init/chunk/complete → `upload-video OR admin-modtube OR super-admin`.

4. **Grafana removed**
   - `AppConfigController.java`: removed `/api/config/grafana` endpoint.
   - `SystemSettingController.java`: removed `grafana.url` from allowed keys whitelist.
   - (Dockerfile still installs Grafana but it was already disabled from supervisord — low priority to clean up)

5. **Upload transcoding persistence after re-login** (`MyVideos.jsx` rewrite)
   - Backend already stores processing progress in DB. MyVideos now separates videos by status.
   - `ProcessingCard` component polls `/api/upload/status/{videoId}` every 3s and shows live progress bar.
   - When processing completes, card shows "Videoya bax →" link; `onReady` callback reloads the full video list.
   - Status is compared case-insensitively (UploadController returns UPPERCASE, VideoController returns lowercase).

6. **Mini player full redesign** (`MiniPlayer.jsx`)
   - YouTube-style: fixed `bottom: 16px; right: 16px` by default; uses `left/top` only when dragged.
   - `W=400, H=225` (16:9), `CTRL_H=56` control bar.
   - Thumbnail poster shown while HLS loads (requires `thumbnailUrl` in MiniPlayerContext now).
   - Buffered track shown behind progress bar.
   - Window resize handler clamps position so player never goes off-screen.
   - `hls.startPosition = currentTime` for efficient seek-on-load.
   - Autoplay with muted fallback if browser blocks sound.
   - Drag with `dragOffset` correctly calculated from bounding rect (not internal offset).

7. **RoleManagement UI complete redesign**
   - Permission library: grid of colored cards (icon, name, category chip, description, delete button on hover).
   - Category filter tabs (Hamısı / Sistem / İstifadəçi / Video / Kontent).
   - Role cards: header strip (gradient red for system, primary for custom), icon, edit/delete buttons.
   - Expandable permission list per role showing colored mini-cards.
   - RoleFormModal: category filter tabs for the permission picker; 2-column card grid with checkbox overlay.

8. **Shorts: up/down navigation + share button**
   - Floating up/down chevron buttons fixed at center-right, outside the snap-scroll container. Calls `scrollRef.scrollBy({ top: ±itemH })`.
   - Share button per short: uses `navigator.share()` on mobile; falls back to `navigator.clipboard.writeText()`. Shows "Kopyalandı" + green checkmark for 2s.
   - `ChevronUp`, `Link2`, `CheckIcon` added to import list.

#### Key gotchas

- **UploadController.listVideos** returns ALL videos (no user filter) — MyVideos's processing section polls status for these. This is a pre-existing security concern: any authenticated user can call `/api/upload/videos` and see all uploads. Not fixed in this session.
- **MiniPlayer position**: `pos = null` uses CSS `bottom/right`; `pos = {x,y}` uses `left/top`. Switching happens on first drag. Reset to `null` (bottom-right) when a new video activates.
- **Grafana in Dockerfile**: Grafana is still installed in the Docker image but was already excluded from supervisord. Not removed from Dockerfile to avoid a full image rebuild. The only consumer (frontend `/api/config/grafana` call) is now gone.

#### Known remaining issues (carried forward)

- **Mobile sidebar**: no hide logic on small screens.
- **Backend `upload.max-concurrent` setting**: not persisted in DB yet.
- **UploadController.listVideos**: returns all videos, not filtered by current user. MyVideos should ideally filter server-side.

---

### 2026-05-19 — Stuck Transcoding Recovery + Cancel Button

#### What was done

1. **Startup recovery for stuck videos** (`TranscodingService.java`)
   - `@PostConstruct recoverStuckTranscodings()`: on server start, queries for all videos in `UPLOADING`, `UPLOADED`, or `PROCESSING` status and marks them `FAILED`.
   - These states mean the server restarted mid-operation; FFmpeg processes are gone, files may be incomplete.
   - Logs warning per video. Inserts `"Failed: Server restarted"` into `processingStages` map so `/api/upload/status/{id}` reflects the reason.
   - `VideoRepository.findByStatusIn(List<VideoStatus>)` added (Spring Data JPA derived query).
   - `VideoService.getVideosByStatusIn(List<VideoStatus>)` added.

2. **Cancel transcoding** (`TranscodingService.java`)
   - `cancelTranscoding(String videoId)`: iterates `activeProcesses` and `destroyForcibly()` all entries prefixed with `videoId + "_"`, removes them from the map. Sets stage to `"Cancelled"`.
   - Called by the cancel endpoint before `videoService.deleteVideo()` to ensure FFmpeg stops writing before files are deleted.

3. **Cancel endpoint** (`UploadController.java`)
   - `DELETE /api/upload/cancel/{videoId}`: requires authentication.
   - Checks ownership (uploader_id matches user) or admin role.
   - Calls `transcodingService.cancelTranscoding(videoId)` then `videoService.deleteVideo(videoId)` — full cleanup: upload dir, HLS dir, thumbnail dir, comments, likes, DB record.
   - Returns `{status: "cancelled", videoId}`.

4. **Frontend: AbortController-based chunk abort** (`UploadContext.jsx`)
   - Each upload job creates an `AbortController`; signal stored in `cancelRef: Map<id, {ctrl, videoId}>`.
   - `videoId` stored in `cancelRef` as soon as `initUpload` returns so cancel can hit the server.
   - `signal` passed through `uploadChunkWithRetry` → `videoService.uploadChunk` (new optional param).
   - Workers check `signal.aborted` before each chunk and between chunks.
   - Abort errors (`AbortError` / `CanceledError` / `ERR_CANCELED`) caught in `runJob` and silently swallowed — UI already dismissed.
   - `cancelUpload(id)`: aborts in-flight requests, stops poll, calls `videoService.cancelUpload(videoId)`, removes from uploads/queue.

5. **`videoService.js`** — two changes:
   - `uploadChunk`: added optional `signal` parameter passed to axios config.
   - Added `cancelUpload(videoId)`: calls `DELETE /api/upload/cancel/{videoId}`.

6. **`UploadManager.jsx`** — cancel button on in-progress rows
   - `UploadRow` accepts `onCancel` prop.
   - X button shown for `uploading`, `processing`, `idle` phases.
   - Dismiss X only shown for `done`/`error` phases.

7. **`MyVideos.jsx`** — cancel button on `ProcessingCard`
   - X button in header strip for non-done, non-error cards.
   - `handleCancel`: calls `videoService.cancelUpload(videoId)`, removes card from `processingVideos` state.
   - `cancelling` state shows "Ləğv edilir…" body while request in-flight, prevents double-click.
   - Also added `uploading` to the status filter so UPLOADING videos show in the processing section.

#### Key gotchas

- **`@PostConstruct` ordering**: `TranscodingService` gets `VideoService` via constructor injection — `VideoService` is initialized first, so `@PostConstruct` on `TranscodingService` can safely call `videoService.getVideosByStatusIn()`.
- **`destroyForcibly()` vs `destroy()`**: use `destroyForcibly()` for FFmpeg — it sends SIGKILL. `destroy()` sends SIGTERM which FFmpeg may ignore and continue writing segments.
- **Race condition on cancel + delete**: If FFmpeg finishes writing a segment between the `cancelTranscoding()` call and the filesystem delete, that's fine — `deleteVideo()` recursively deletes the entire HLS directory.
- **Abort vs cancel**: The `AbortController` aborts the current HTTP chunk upload (browser/axios level). The server `DELETE /api/upload/cancel/{videoId}` deletes video data. Both are needed — abort to stop wasting bandwidth, delete to clean up server storage.
- **axios CanceledError**: When axios receives an AbortSignal abort, it throws `{name: "CanceledError", code: "ERR_CANCELED"}`. Check both `err.name` and `err.code`.

#### Known remaining issues (carried forward)

- **Mobile sidebar**: no hide logic on small screens.
- **Backend `upload.max-concurrent` setting**: not persisted in DB yet.
- **UploadController.listVideos**: returns all videos, not filtered by current user.

---

### 2026-05-19 — Transcoding Optimization, View Analytics, Metrics Auto-Refresh Fix

#### What was done

1. **Transcoding speed optimization** (`TranscodingService.java`)
   - Root cause of slowness: `-threads 1` forced each FFmpeg process to use a single CPU core regardless of what hardware is available. On an 8-core machine this means 87.5% of CPU was idle during transcoding.
   - Fix: Replaced `-threads 1` with dynamic per-quality thread allocation: `availCores / numQualityProfiles`. Each quality profile gets its fair share of cores (minimum 2).
   - Quality profiles now run **in parallel** using `CompletableFuture.supplyAsync()` instead of sequential for-loop. On a 4-core machine encoding 480p+720p+1080p: ~3× faster wallclock time.
   - Preset changed: `ultrafast` → `veryfast` — veryfast gives 20–30% better compression than ultrafast with only ~15% more CPU time; better quality without noticeable speed loss.
   - CRF and audio bitrate now tuned per resolution: 480p uses CRF28+96k, 1440p uses CRF23+192k, 2160p uses CRF22+256k.
   - Added **1440p** (2560×1440, 12 Mbps) quality tier.
   - `application.yml`: `qualities: 480p,720p,1080p,1440p,2160p`
   - Progress tracking: switched to `AtomicInteger.compareAndSet()` for thread-safe shared progress across parallel quality jobs.
   - Removed `System.gc()` calls from hot path (per-quality finally block) — GC hints inside tight loops cause pauses.

2. **View analytics — per-view event tracking** (backend)
   - `VideoView.java` entity: `video_id`, `user_id`, `user_email`, `ip_address`, `viewed_at`
   - `V3__view_analytics.sql`: creates `video_views` table with FK to `videos(id) ON DELETE CASCADE` + indexes on video_id, user_email, viewed_at.
   - `VideoViewRepository.java`: native queries for top videos (by view count), top users (by view count), daily view trend, hourly distribution.
   - `VideoController.incrementView`: now also saves a `VideoView` record — captures authenticated user email/ID, and IP from `X-Forwarded-For` or `RemoteAddr`.
   - `AdminController`: added 5 analytics endpoints (all require `super-admin` or `view-metrics`):
     - `GET /api/admin/analytics/summary` — views in last 24h, 7d, 30d
     - `GET /api/admin/analytics/top-videos?days=30&limit=20`
     - `GET /api/admin/analytics/top-users?days=30&limit=20`
     - `GET /api/admin/analytics/daily-views?days=30`
     - `GET /api/admin/analytics/hourly?days=30`

3. **View analytics — dashboard page** (frontend)
   - `Analytics.jsx`: new page at `/admin/analytics`
   - Summary cards: views in last 24h / 7d / 30d
   - Daily trend: AreaChart
   - Hourly distribution: BarChart (all 24 hours, 0-filled if no data)
   - Top 20 videos table: rank badge (gold/silver/bronze), title link, uploader, last viewed, view count
   - Top 20 users table: rank badge, email, unique videos watched, last viewed, view count
   - 7/30/90 day selector; refresh button
   - Sidebar: "Analitika" nav item added (requires `view-metrics`)
   - App.jsx: `/admin/analytics` route added

4. **Metrics auto-refresh flash fixed** (`Metrics.jsx`)
   - Root cause: `fetchCharts()` called `setChartsLoading(true)` every time it ran, including on background auto-refresh timer. All 11 charts disappeared and showed spinners every 30 seconds.
   - Fix: Added `initialLoadDone` ref (persists across renders, doesn't trigger re-render). `setChartsLoading(true)` only fires when `initialLoadDone.current === false` (first load or time-range change). Subsequent background refreshes update chart data silently.
   - The refresh button icon now spins while a background refresh is in-flight (`bgRefreshing` state).
   - Time range change resets `initialLoadDone.current = false` so charts properly show loading state for the new range.

5. **Prometheus retention**: Already at `--storage.tsdb.retention.time=30d` in docker-compose.yml. No change needed.

#### Key gotchas

- **Parallel FFmpeg + shared progress**: Using a single `AtomicInteger` for progress across parallel quality jobs means the displayed percentage is the max across all in-progress qualities. `compareAndSet(prev, overallPct)` prevents race: only the thread that "wins" the CAS writes to DB.
- **1440p in allowedQualities**: Profile is only created when `info.height >= 1440`. If the input is 1080p, 1440p profile is skipped even though it's in the config — correct behavior.
- **View tracking with anonymous users**: `user_id` and `user_email` are nullable. Anonymous views (no JWT) still get recorded with just IP address.
- **`X-Forwarded-For` parsing**: Can be a comma-separated list when behind multiple proxies. Code takes only the first IP: `ip.split(",")[0].trim()`.
- **`initialLoadDone` as `useRef`**: Must be a ref (not state) because it needs to persist across renders without causing re-renders. State would cause an infinite loop.

#### Known remaining issues (carried forward)

- **Mobile sidebar**: no hide logic on small screens.
- **Backend `upload.max-concurrent` setting**: not persisted in DB yet.
- **UploadController.listVideos**: returns all videos, not filtered by current user.
- **Backend rebuild needed**: All backend changes require `docker compose build && docker compose up -d --force-recreate` on VPS.

---

### 2026-05-19 — Transcoding Failure Fix + Progress Stuck at 65% Fix

#### Root causes found and fixed

1. **"Transkodlama uğursuz oldu" (Transcoding failed) for ≥1080p videos**
   - Root cause: `-profile:v baseline -level 3.0` applied globally to all qualities. H.264 Baseline Level 3.0 only supports up to ~720×576@30fps. 1080p requires Level 4.0, 1440p requires Level 4.2, 2160p requires Level 5.1. FFmpeg exits non-zero for these.
   - Fix: Added `h264Profile()` and `h264Level()` methods to `QualityProfile` record. 480p/720p use `baseline` L3.1 (broad device compat). 1080p uses `high` L4.0, 1440p uses `high` L4.2, 2160p uses `high` L5.1.

2. **Progress stuck at 65%** (parallel quality encoding)
   - Root cause: Sequential range assignment (480p=5→35%, 720p=35→65%, 1080p=65→95%) with parallel execution. When 720p finishes first, sharedProgress reaches 65. 1080p starts at rangeStart=65, so `overallPct >= prev + 5` requires 1080p to be ~8% encoded before any update. UI shows stuck.
   - Fix: Replaced range-based progress with average-based. Overall progress = `5 + (avg of all quality percentages) * 90 / 100`. As each quality advances, the average rises smoothly. Removed `progressStart` and `progressEnd` params from `transcodeQuality()`.

#### What was changed (`TranscodingService.java`)

- `transcodeQuality()`: removed `progressStart`/`progressEnd` params
- Progress calc: `int overallPct = 5 + (sum(qualityPcts) / count) * 90 / 100`
- `QualityProfile` record: added `h264Profile()` (baseline/high) and `h264Level()` (3.1/4.0/4.2/5.1)
- FFmpeg command: `-profile:v profile.h264Profile()` and `-level profile.h264Level()` instead of hardcoded baseline+3.0

#### Key gotchas

- **Baseline vs High profile**: `baseline` has no B-frames (lower latency, compatible with more old devices). `high` allows B-frames (better compression). For local LAN streaming, `high` is fine for HD+.
- **Level determines max resolution × framerate**: Level 3.0 max is 720×576@25 or 352×288@30. Always check per-resolution when adding new quality tiers.
- **Average-based progress is monotonically increasing**: Faster qualities (480p) reaching 100% while slower ones (1080p) are at 30% → average ~65% → overall 63.5%. When 1080p reaches 60%, average = 80% → overall 77%. Progress always advances.

#### Known remaining issues (carried forward)

- **Mobile sidebar**: no hide logic on small screens.
- **Backend `upload.max-concurrent` setting**: not persisted in DB yet.
- **UploadController.listVideos**: returns all videos, not filtered by current user.
- **Backend rebuild needed**: `docker compose build && docker compose up -d --force-recreate` on VPS.

---

### 2026-05-20 — Bug Fixes, Feature Parity Verification, Playlist Visibility

#### Bug fixes (from previous session)

1. **IDP user role not applying after admin assigns new role**
   - Root cause: `AuthContext.loginWithIdp()` hardcoded `permissions: []` and `role: 'USER'`.
   - Fix: Made `loginWithIdp` async; after storing IDP token it calls new `GET /api/auth/profile` endpoint which returns DB-backed role+permissions via `@AuthenticationPrincipal ModTubePrincipal`.
   - `AuthController.java`: new `@GetMapping("/profile")` uses the Spring Security principal resolved by `JwtAuthenticationFilter` (works for both HS256 local tokens and RS256 IDP tokens).

2. **Private video shown as public after upload / Restricted video allowed users can't see**
   - Root cause: `upload-video` permission was missing from `SecurityConfiguration` filter chain rules for `PUT /api/videos/*`, `POST /api/videos/*/privacy`, `POST /api/videos/*/thumbnail`. Filter chain blocked the request before `@PreAuthorize` could run.
   - Fix: Added `upload-video` to all video-mutation filter chain rules. Also fixed `@PreAuthorize` on those three endpoints.

#### New features

3. **Dark mode army backgrounds → YouTube-style dark neutral grays**
   - `tailwind.config.js`: `army-500` → `#606060`, `army-600` → `#4d4d4d`, `army-700` → `#3d3d3d`, `army-800` → `#212121`, `army-900` → `#0f0f0f`, `army-950` → `#070707`.

4. **Metrics: JVM Thread count trend chart**
   - Added `jvm_threads_live_threads` to range queries and new AreaChart "JVM Thread Sayı" on Metrics page.

5. **Metrics: readable time range labels**
   - Changed from `1d`, `5s` etc. to `1 dəq`, `5 dəq`, `30 dəq`, `1 saat`, `6 saat`, `24 saat`.

6. **Home page: infinite scroll pagination**
   - Replaced "Daha çox yüklə" button with IntersectionObserver sentinel div + spinner. Next page loads automatically when the sentinel enters the viewport.

7. **Playlist feature (YouTube-like)**
   - Backend: `V4__playlists.sql` (tables), `Playlist.java`, `PlaylistItem.java` entities, `PlaylistRepository`, `PlaylistItemRepository`, `PlaylistService`, `PlaylistController`.
   - REST: `GET /api/playlists/mine`, `POST /api/playlists`, `PUT /api/playlists/{id}`, `DELETE /api/playlists/{id}`, `GET /api/playlists/{id}`, `POST /api/playlists/{id}/videos`, `DELETE /api/playlists/{id}/videos/{videoId}`.
   - Privacy filter in `PlaylistService.getPlaylistWithVideos()` — checks each video's visibility against the viewer's permissions before returning it.
   - Frontend: `MyPlaylists.jsx` (list/create/edit/delete), `PlaylistDetail.jsx` (queue + current video panel), playlist modal in `VideoDetail.jsx`, `Pleylistlərim` nav item in `Sidebar.jsx`, routes in `App.jsx`.

8. **Playlist visibility (PUBLIC / PRIVATE / RESTRICTED)**
   - `V5__playlist_visibility.sql`: adds `visibility` and `allowed_emails` columns to `playlists` table.
   - `Playlist.java`: `visibility` (String, default `"PUBLIC"`) and `allowedEmails` (TEXT, comma-separated), `getAllowedEmailList()` helper.
   - `PlaylistService`: `canViewPlaylist()` enforces visibility before returning any data; `normalizeVisibility()` sanitizes input; create/update accept `visibility` + `allowedEmails`.
   - `PlaylistController`: exposes `visibility` and `allowedEmails` fields in all responses.
   - `api.js`: `createPlaylist` and `updatePlaylist` accept `visibility` and `allowedEmails` params.
   - `MyPlaylists.jsx`: visibility toggle buttons (İctimai/Gizli/Məhdud) in create/edit form; email textarea shown for RESTRICTED; `VisBadge` displayed on each playlist card.
   - `PlaylistDetail.jsx`: `VisBadge` in header; 403 error renders a proper "Giriş qadağandır" page instead of redirect.

#### Key gotchas

- **`@OneToMany(mappedBy = "playlistId")` invalid mapping**: `Playlist` must NOT declare `@OneToMany` for `PlaylistItem` because `playlistId` is a plain `String` (not a `@ManyToOne` reference). Use `PlaylistItemRepository.countByPlaylistId()` instead.
- **`Map.of()` rejects null values**: Always use `new HashMap<>()` when any map value could be null (e.g., description).
- **IDP provisioning fallback**: If `JwtAuthenticationFilter.getOrCreate()` fails, the principal falls back to `OidcUserDetails` which has `getUserId() = null`. `AuthController.getProfile()` catches this and returns 500; `loginWithIdp` catches 500 and keeps defaults. Acceptable degradation.

#### Known remaining issues (carried forward)

- **Mobile sidebar**: no hide logic on small screens.
- **Backend `upload.max-concurrent` setting**: not persisted in DB yet.
- **UploadController.listVideos**: returns all videos, not filtered by current user.
- **Backend rebuild needed**: All Java backend changes require `docker compose build && docker compose up -d --force-recreate` on VPS.

---

### 2026-05-20 — Confirm Modals + YouTube-Style Playlists

#### What was done

1. **Replaced all `alert()`/`window.confirm()` with proper modals**
   - Created `src/components/ConfirmModal.jsx` — reusable centered dialog with danger/info variants, Escape key support, backdrop dismiss.
   - Files updated: `VideoDetail.jsx`, `PlaylistDetail.jsx`, `MyPlaylists.jsx`, `CommentSection.jsx`, `RoleManagement.jsx`.
   - Validation errors in VideoDetail edit form (`editError`, `tagError`) now show as inline banners instead of popups.
   - Playlist-add errors (`plError`) shown inside the playlist modal.

2. **MyPlaylists.jsx — YouTube-style grid redesign**
   - Grid layout: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5`.
   - Each playlist card: aspect-video thumbnail with stacked-depth effect, video count badge, play-all overlay on hover, title (2-line clamp), visibility badge, 3-dot context menu (edit/delete).
   - "New playlist" `+` card in grid alongside existing playlists.
   - Create/edit now opens in a centered modal overlay (`PlaylistModal` component) — no more inline form.
   - Delete uses `ConfirmModal`.

3. **Backend: playlist list includes `coverUrl`**
   - `PlaylistItemRepository`: added `findFirstByPlaylistIdOrderByPositionAsc()` Spring Data method.
   - `PlaylistController`: injected `VideoService`; `getMyPlaylists()` now includes `coverUrl` from first video's thumbnail.

#### Known remaining issues (carried forward)

- **Mobile sidebar**: no hide logic on small screens.
- **Backend `upload.max-concurrent` setting**: not persisted in DB yet.
- **UploadController.listVideos**: returns all videos, not filtered by current user.
- **Backend rebuild needed**: `PlaylistController`/`PlaylistItemRepository` changes require `docker compose build && docker compose up -d --force-recreate` on VPS.

---

### 2026-06-11 — Video Meetings (Live WebRTC) Feature

#### What was done

1. **New `video-call` permission** — seeded via `V6__video_meetings.sql`, wired through
   `permissions.js` (`PERMS.VIDEO_CALL` / `FEATURE.VIDEO_CALL`), `Sidebar.jsx` (`Görüşlər`
   nav item), `App.jsx` routes, `RoleManagement.jsx` `PERM_META`, and
   `SecurityConfiguration.java` (`/api/meetings/**` requires `video-call` or `super-admin`).

2. **Backend — `video_meetings` table + entity/service/controller**
   - `V6__video_meetings.sql`: `video_meetings` table (`room_code` UUID, `status`
     SCHEDULED/LIVE/ENDED, `visibility` PUBLIC/RESTRICTED + `allowed_emails`).
   - `VideoMeeting.java`, `VideoMeetingRepository`, `VideoMeetingService`
     (create/list/get/start/end/delete, `canAccessMeeting()` mirrors
     `PlaylistService.canViewPlaylist()`).
   - `VideoMeetingController` at `/api/meetings`: CRUD + `/start`, `/end`,
     `/ice-config` (returns STUN/TURN servers from `modtube.webrtc.*` config).

3. **Backend — WebRTC mesh signaling over raw WebSocket**
   - Added `spring-boot-starter-websocket` dependency.
   - `WebSocketConfig` registers `MeetingSignalingHandler` at `/ws/meetings/*`.
   - `MeetingHandshakeInterceptor`: since browsers can't set `Authorization` headers
     on WS handshakes, the JWT is passed as `?token=...`. The interceptor replicates
     `JwtAuthenticationFilter`'s dual-path validation (RS256 IDP / HS256 local),
     resolves the meeting by `roomCode`, and checks `canAccessMeeting()` before
     accepting the upgrade.
   - `MeetingSignalingHandler`: relays `offer`/`answer`/`ice-candidate` between
     participants of the same room (`peers`, `peer-joined`, `peer-left`,
     `meeting-ended` message types). `endRoom()` is called by
     `VideoMeetingService.endMeeting()` to disconnect everyone when the host ends.

4. **Frontend — `VideoMeetings.jsx`** (mirrors `MyPlaylists.jsx` grid pattern)
   - Grid of meeting cards with status badge (Planlaşdırılıb/Canlı/Bitib) and
     visibility badge (İctimai/Məhdud).
   - "Yeni görüş" modal: title/description/visibility + `UserEmailPicker` for
     RESTRICTED (extracted into its own component, `src/components/UserEmailPicker.jsx`,
     reused from `MyPlaylists.jsx`).
   - Host actions: Başlat (start → navigates to room), Bitir (end), Sil (delete via
     `ConfirmModal`, blocked while LIVE). Non-host: Qoşul (enabled only when LIVE).

5. **Frontend — `MeetingRoom.jsx`** — full mesh WebRTC call UI
   - Loads meeting via `getMeeting(id)`; if host and `SCHEDULED`, calls
     `startMeeting(id)` automatically. 403 → "Giriş qadağandır" page.
   - `getIceConfig()` → `RTCPeerConnection` config (STUN by default).
   - `getUserMedia({video, audio})` for local stream + muted local tile.
   - Opens `wss://.../ws/meetings/{roomCode}?token=...`; maintains
     `Map<peerId, RTCPeerConnection>` and `peerInfoRef` (id → {email, name}
     from `peers`/`peer-joined` messages, since offer/answer/ice-candidate relays
     don't carry sender metadata). Queues ICE candidates that arrive before
     `setRemoteDescription`.
   - Controls: mic/camera toggle (via `track.enabled`), "Tərk et" (cleanup +
     navigate), host-only "Görüşü bitir".
   - `App.jsx` `SidebarAwareLayout`: `/meetings/:id/room` excluded from sidebar
     (regex `/^\/meetings\/[^/]+\/room$/`), same as `/embed/*`.

6. **Configurability pass** (user request: "everything host port other thing
   should be configurable")
   - `vite.config.js`: rewrote to use `loadEnv` — proxy target and dev server
     port now come from `VITE_BACKEND_URL` (default `http://localhost:4000`,
     was hardcoded `:8080`) and `VITE_PORT` (default `3000`). New `/ws` proxy
     entry with `ws: true`.
   - New `video-streaming-frontend/video-streaming-frontend/.env.example`
     documenting `VITE_BACKEND_URL` / `VITE_PORT`.
   - `application.yml`: new `modtube.webrtc.*` block (`ice-servers`, `turn-url`,
     `turn-username`, `turn-credential`), all env-overridable
     (`WEBRTC_ICE_SERVERS`, `WEBRTC_TURN_URL`, `WEBRTC_TURN_USERNAME`,
     `WEBRTC_TURN_CREDENTIAL`).
   - `docker-compose.yml` and root `.env.example`: added the same `WEBRTC_*`
     env vars so they can be set without editing compose/yaml directly.

#### Key gotchas

- **WS auth via query param**: `MeetingHandshakeInterceptor` is the only place
  doing JWT validation for `/ws/**` — `SecurityConfiguration` permits `/ws/**`
  at the filter-chain level since the handshake interceptor handles auth.
- **Signaling messages don't carry sender email/name** except `peers` (initial
  snapshot) and `peer-joined` (broadcast on join). `MeetingRoom.jsx` caches
  `peerId → {email, name}` from those two message types and looks it up when
  an `offer` arrives from that peer.
- **ICE candidate ordering**: candidates can arrive via WS before
  `setRemoteDescription` resolves — they're queued per-peer and flushed after
  `setRemoteDescription` succeeds.
- **Mesh topology**: only suitable for small meetings (~4-6 participants).
  Larger groups would need an SFU — out of scope.
- **No TURN by default**: STUN-only (`stun:stun.l.google.com:19302`). Cross-NAT
  calls may fail to establish; same-LAN works via host ICE candidates. Set
  `WEBRTC_TURN_URL`/`WEBRTC_TURN_USERNAME`/`WEBRTC_TURN_CREDENTIAL` to add a
  TURN server.
- **No AI analysis/summary** for meetings — explicitly declined by user.
- **Backend rebuild needed**: all of the above requires
  `docker compose build && docker compose up -d --force-recreate`. Verified
  `./gradlew compileJava` succeeds (Java 21, JDK temurin container) and
  `npm run build` succeeds (new `MeetingRoom`/`VideoMeetings` chunks present).

#### Known remaining issues (carried forward)

- **Mobile sidebar**: no hide logic on small screens.
- **Backend `upload.max-concurrent` setting**: not persisted in DB yet.
- **UploadController.listVideos**: returns all videos, not filtered by current user.
- **Backend rebuild needed**: new WebSocket dependency, `V6__video_meetings.sql`
  migration, and all video-meetings backend code require
  `docker compose build && docker compose up -d --force-recreate` on VPS.

---

*Update this file every session with: what was attempted, what was fixed, what is still broken, and any gotchas found.*

---

### 2026-06-12 — IDP Role Fix, MinIO Migration, Meeting Mgmt, SPA/Mobile Fixes

#### Bugs fixed
1. **IDP super-admin role not applying** — `IdpJwtValidator` derived email from `mail` claim → fell back to `sub` (UUID) when absent; `/idp/sync-profile` then rewrote the email, so the next login's UUID lookup failed and re-provisioned a fresh USER row, orphaning the admin-assigned role. Fix: new stable `idp_subject` column (`V8__idp_subject.sql`), matched first in `IdpUserProvisioningService.getOrCreate(email, name, subject)`; `OidcUserDetails.subject` carried through `JwtAuthenticationFilter` + `MeetingHandshakeInterceptor`. `OAuthCallback.jsx` now `await`s `loginWithIdp` after sync-profile so role/permissions apply before navigation.
2. **Meeting link / refresh → JSON error** — `SpaController` forward list was missing `/meetings/**`, `/playlists`, `/my-playlists`. Added them.
3. **App crash-loop (500s, slow/“network abuse”)** — a new MinIO `MediaController` mapped `/hls/**`, colliding with the pre-existing `HlsController` → Spring `Ambiguous mapping`, exiting every ~60s (Flyway re-ran each restart). Deleted `HlsController`; `MediaController` now serves both `/hls/**` + `/thumbnails/**`.

#### MinIO migration (video storage)
- Fresh-start, serve-through-app design. New `StorageService` (io.minio 8.5.17): bucket auto-create w/ retry, `uploadDirectory`, `getObject`, `deletePrefix`, content-type map.
- `TranscodingService` uploads HLS dir + thumbnail to MinIO after transcode (local dirs now scratch), then deletes scratch. `VideoService.deleteVideo` → `deletePrefix`; custom thumbnails → `putStream`. `WebConfig` no longer serves hls/thumbnails.
- Config: `modtube.storage.minio.*` (`MINIO_ENDPOINT/ACCESS_KEY/SECRET_KEY/BUCKET`). MinIO runs as a **separate** stack: `docker-compose.minio.yml`; app reaches it via `host.docker.internal:9000` (`extra_hosts: host-gateway`). Prod: point `MINIO_ENDPOINT` at existing MinIO.

#### Meeting improvements
- Screen share quality: `getDisplayMedia` 1080p/30–60fps, `contentHint='detail'`, `maxBitrate=5Mbps` via `setParameters` (existing + new peers).
- One-sharer lock already server-enforced; full/PiP layout, ESC to minimize.
- **Admin management**: `toResponse` adds `canManage` (host OR super-admin) + `canDelete`; new `PUT /api/meetings/{id}` (edit); DELETE returns the reason (LIVE meetings can’t be deleted). Frontend `VideoMeetings.jsx`: super-admins get the manage menu, edit modal, end-then-delete flow, error toast, 10s auto-refresh.

#### Mobile sidebar (carried-forward) — fixed
- `SidebarAwareLayout` content padding now `sm:` only (no mobile squash) + mobile backdrop. Sidebar slides off-screen on mobile when collapsed. New mobile hamburger in `Navbar` toggles the drawer.

#### Verified
- `docker compose build` ✓ (backend+frontend), app boots clean (`Started ModtubeApplication`, `MinIO bucket 'modtube' ready`), 0 errors, home ~20ms, all endpoints 7–40ms, mem 480MB/3GB.
- Run order: `docker compose -f docker-compose.minio.yml up -d` then `docker compose up -d`.
- Image exported: `Downloads/tars/modtube-latest.tar` (`ao-images/modtube:latest`).

#### Known remaining
- Local login still matched by username/email (unchanged); only IDP path uses idp_subject.
- HLS proxied through app (2× internal bandwidth app↔MinIO) — fine for LAN; use presigned URLs if exposing MinIO later.
- Mesh WebRTC still ~4–6 participants; no TURN by default.

---

### 2026-06-16 — Meeting management, capacity, MinIO env, runtime settings

#### manage-meetings permission (so non-super-admin moderators can delete finished meetings)
- `V9__manage_meetings_permission.sql` seeds `manage-meetings` (type VIDEO).
- `VideoMeetingService.canManage(meeting, user)` (new static helper) = host OR
  super-admin OR `manage-meetings`. `getOwned()` now uses it (edit/end/delete any
  meeting); LIVE meetings still can't be deleted (409). `VideoMeetingController.toResponse`
  `canManage`/`canDelete` use it too.
- `SecurityConfiguration`: added `manage-meetings` authority to GET-list / start /
  end / PUT / DELETE `/api/meetings`.
- Frontend: `permissions.js` (PERMS.MANAGE_MEETINGS + FEATURE), `RoleManagement`
  PERM_META, `Sidebar` + `App.jsx` `/meetings` perms now `['video-call','manage-meetings']`.

#### Participant cap (mesh guardrail) — configurable
- `MeetingSignalingHandler`: rejects join when room at capacity → sends
  `{type:'room-full', max}` + closes WS (code 4001). Cap = `effectiveMax()` =
  runtime setting `meeting.max-participants` if set, else `@Value`
  `modtube.webrtc.max-participants` (env `WEBRTC_MAX_PARTICIPANTS`, default 12).
- Frontend `MeetingRoom.jsx`: handles `room-full` → "Görüş doludur" page.

#### Adaptive mesh quality (push usable headcount higher)
- `MeetingRoom.jsx` `applyAdaptiveQuality(n)`: shrinks each outgoing **camera**
  sender's `maxBitrate`/`scaleResolutionDownBy` as participants grow
  (≤4: 1.2Mbps×1 → >16: 150kbps×⅓). Re-runs on participant-count change; skipped
  while screen sharing (that path stays 5Mbps).
- **True 30+ still needs an SFU** — wrote `MEETINGS_SFU_PLAN.md` (LiveKit migration:
  keep all CRUD/perms/access rules, swap only media transport + room UI).

#### MinIO env
- Already had `MINIO_ENDPOINT/ACCESS_KEY/SECRET_KEY/BUCKET`. Added optional
  `MINIO_REGION` (StorageService `.region()` only when non-blank) for real-S3
  backends. All in application.yml + docker-compose.yml + .env.example.

#### Meeting settings manageable from admin Settings page (user request)
- `SystemSettingController` ALLOWED_KEYS += `meeting.max-participants`,
  `meeting.ice-servers`, `meeting.turn-url`, `meeting.turn-username`,
  `meeting.turn-credential`.
- `VideoMeetingController.getIceConfig` and `MeetingSignalingHandler.effectiveMax`
  read these via `SystemSettingService.get(key, envDefault)` — DB settings override
  env/yaml at runtime, no restart.
- `IdpSettings.jsx`: new "Görüş (Video Zəng) Parametrləri" section — max-participants
  slider (2–50), ICE servers, TURN url/username/credential. Saved through existing
  `adminUpdateSettings`.

#### Verify
- Frontend `npm run build` ✓ (IdpSettings/MeetingRoom/VideoMeetings chunks present).
- `docker compose build` ✓ (backend compiles with new deps/injection — no Spring
  bean cycle: MeetingSignalingHandler→SystemSettingService→repo).
- Gotcha: `docker` only on PATH inside **WSL** here (not Git-Bash / PowerShell).
  Build/run via `wsl -e bash -lc "cd /mnt/c/.../localyoutube && docker compose ..."`.

#### Bundled TURN + cap 30 (offline LAN deploy) — follow-up
- **coturn bundled INTO the modtube image** (user: "only turn, one image, not extra").
  `Dockerfile` apt-installs `coturn`; `supervisord.conf` `[program:coturn]` runs
  `turnserver -c /etc/coturn/turnserver.conf`; `docker-entrypoint.sh` writes that
  conf at boot (realm modtube, lt-cred-mech, user from `WEBRTC_TURN_USERNAME/CREDENTIAL`,
  `external-ip=APP_HOST` when APP_HOST is an IP, relay 49152-49200). Entrypoint also
  auto-fills `WEBRTC_ICE_SERVERS`/`WEBRTC_TURN_URL` from `APP_HOST` when blank, so
  meetings work with **no internet / no Google STUN**. `EXPOSE`/compose publish
  3478 tcp+udp + 49152-49200/udp. **MinIO stays a separate container** (not bundled).
- **Max participants default 30** everywhere (application.yml, `@Value`, docker-compose,
  .env files, IdpSettings slider default + help text).
- Deleted redundant `docker-compose.turn.yml`. New env: `WEBRTC_MAX_PARTICIPANTS=30`,
  `WEBRTC_TURN_USERNAME=modtube`, `WEBRTC_TURN_CREDENTIAL=modtube-turn-secret`,
  `MINIO_REGION=` (blank); `WEBRTC_ICE_SERVERS`/`WEBRTC_TURN_URL` now blank→auto.
- New deploy files: `.env.offline.example`, `OFFLINE_LAN_DEPLOY.md`, `MEETINGS_SFU_PLAN.md`.
- Deliverables copied to **`F:\tars`**: `modtube-latest.tar`, `minio-latest.tar`,
  `docker-compose.yml`, `docker-compose.minio.yml`, `.env*.example`, the two .md guides,
  and `NEW_ENV_VARS.txt`. (Downloads/tars also has older tars incl. coturn — no longer
  needed since coturn is in the modtube image.)
- Verified: `docker compose build` ✓ (coturn installs, image builds clean).

---

### 2026-06-18 — Meeting features: private chat, attachments, pinning, ephemeral history

Six meeting-room features (all in `MeetingRoom.jsx` + signaling/REST backend):

1. **1:1 private chat.** Chat panel now has a recipient `<select>` ("🌐 Hamıya" or a
   participant → "🔒 ...") and every remote tile has a DM button (`onDm`). A private
   message carries `to: <sessionId>`; `MeetingSignalingHandler` delivers it only to that
   target **and echoes to the sender** (`private:true`, `toEmail/toName`). Rendered with a
   lock badge ("Şəxsi → name"). History replay filters private msgs to the two parties
   (`isVisibleTo`).
2. **Pin / spotlight + small-screen scaling.** New `pinnedPeerId` ('self'|peerId). The old
   screen-share "full layout" is generalized to a spotlight: `screenSpotlight` (share, wins)
   or `pinSpotlight` (manual pin). `spotlightId` = focused tile; strip = everyone else
   (`remotePeers.filter(id!==spotlightId)` + self). Layout is `flex-col sm:flex-row` and the
   strip is `flex-row sm:flex-col` w/ horizontal scroll on mobile, so screen-share/spotlight
   scales on small screens. `StripTile`/`LocalTile`/`RemoteTile` got a `PinButton`.
3. **Better moderation.** Force-mute / force-cam / kick now allowed for **host OR
   super-admin OR manage-meetings** (server: `canModerate(session)` reads a new `canManage`
   handshake attribute set via `VideoMeetingService.canManage`). Tile controls gated on
   `canManage` (not just host), visible on hover + `focus-within` (touch). Kick now goes
   through a confirmation modal (`kickTarget`/`doKick`).
4. **Chat attachments + preview.** New `POST /api/meetings/{id}/attachments` (multipart,
   25 MB cap, access-checked via `getMeeting`) → MinIO key
   `meeting-attachments/{roomCode}/{uuid}-{name}`, returns `{url,name,size,contentType}`.
   Served **inline** by `MediaController` `GET /meeting-files/**` (permitAll; unguessable
   UUID). Client uploads via `uploadMeetingAttachment`, then sends a `chat` msg with
   `attachment`. `AttachmentView` shows images inline, other files as a download chip.
5. **Attachments cleared when meeting ends.** `MeetingSignalingHandler.purgeRoom()` (called
   from `endRoom` AND when the room empties) deletes the `meeting-attachments/{roomCode}`
   prefix — run via `CompletableFuture.runAsync` so MinIO I/O never pins the `endMeeting`
   DB transaction ([[notifications-sse-after-commit]] same principle).
6. **Ephemeral chat history.** Per-room in-memory `chatHistory` (bounded 300). New joiners /
   reconnects get a `chat-history` message (private-filtered); wiped on `purgeRoom`. So
   late joiners see the conversation while live, and nothing persists after the meeting.

Plumbing: `MeetingSignalingHandler` now injects `StorageService`; `VideoMeetingController`
injects `StorageService`. `MeetingHandshakeInterceptor` sets `canManage` attribute.
`WebSocketConfig` adds `ServletServerContainerFactoryBean` (max text msg 512 KB) so
`chat-history`/large SDP don't exceed the 8 KB default. `SecurityConfiguration` permits
`/meeting-files/**` and `POST /api/meetings/*/attachments` (authenticated).

Verified: frontend `npm run build` ✓ (MeetingRoom chunk 46 KB), backend `compileJava` ✓
(temurin 21 container; only pre-existing Lombok warning). No new env vars.

#### Follow-up — chat UX, link/preview, pin & layout fixes (same day)
- **Root cause of "half chat screen" / broken layout:** room used `min-h-screen`
  (unbounded) so flex children never got a definite height → internal scroll
  collapsed. Fixed: root is now `h-screen overflow-hidden`; ChatPanel widened
  (`sm:w-80 xl:w-96`), proper `flex-1 min-h-0` message list.
- **Chat redesign:** styled recipient `<select>` (appearance-none + globe/chevron
  icons), private-mode banner with one-click "back to public", empty state, polished
  bubbles.
- **Links:** `Linkify` makes http(s)/www URLs in messages clickable.
- **File preview (was force-download):** images render inline and open in a
  fullscreen **Lightbox** (with download); non-images get a chip with **Bax**
  (open/preview in new tab — served inline) + **Yüklə** (download). `isImageAtt`
  also detects by extension when contentType is generic.
- **Pin/spotlight scaling:** large tile fills via the `h-screen` fix; strip tiles
  consistent `aspect-video` (w-28 mobile row / w-full desktop column).
- **Bucket cleanup on delete too:** `purgeRoom` is now public and also called from
  `VideoMeetingService.deleteMeeting` (in addition to end/empty) so the
  `meeting-attachments/{roomCode}` folder is removed from the bucket.

---

### 2026-06-18 — Meetings moved to SFU (LiveKit) + registerable "runner" pool

**Why:** full-mesh WebRTC lagged badly at 8+ participants (each browser uploads its
camera N−1 times; screen-share saturates uplink). Architectural wall — no tuning
fixes mesh past ~10. Switched media to an **SFU** (one upstream per client +
simulcast). User wanted a GitLab-runner-style model: register SFU servers
(URL+key+secret) in settings; meetings distributed across them.

**Decisions (user):** pooled registerable runners · replace mesh entirely · offline
LAN · chat stays on the existing WS (my call — least disruption). modtube image
**loses coturn** (just FE+BE+PostgreSQL); SFU is a separate container. Image:
`livekit/livekit-server`.

**Backend**
- `V13__meeting_runners.sql`: `meeting_runners` (name, ws_url, api_key, api_secret,
  enabled) + `video_meetings.runner_id` + load index. `MeetingRunner` entity/repo.
- `MeetingRunnerService`: CRUD, `pickRunner()` = enabled runner with fewest LIVE
  meetings (`VideoMeetingRepository.countByRunnerIdAndStatus`), `isHealthy()` (GET on
  ws→http base, 2s timeout), secret ≥32 char validation (write-only; blank keeps it).
- `LiveKitTokenService.mint()`: LiveKit token = JWT signed (HS256) with the runner's
  API secret, `iss`=apiKey, `video` grant claim (roomAdmin for host/mod). **No LiveKit
  Java SDK** — reuses jjwt.
- `VideoMeetingService.issueToken()`: access-checked (must be LIVE), assigns+persists a
  runner on first use, mints token → `{url,token,identity}`. `endMeeting` clears
  `runnerId` to free the slot.
- `VideoMeetingController` `GET /{id}/token` (replaced dead `ice-config`).
  `MeetingRunnerController` `/api/admin/meeting-runners` CRUD + `/{id}/health`
  (secret never returned; `hasSecret` flag). `SecurityConfiguration`:
  `/api/admin/meeting-runners/**` → super-admin/manage-settings.
- `MeetingSignalingHandler` trimmed: removed offer/answer/ice + screen-start/stop
  relay (LiveKit owns media + screen detection). **Chat private DM + moderation now
  routed by EMAIL** (LiveKit identity), via new `sendToEmail`/`nameForEmail` helpers,
  since the UI no longer has WS session ids for video tiles. Roster/cap/lifecycle
  (peers, room-full, meeting-ended, kicked) unchanged.

**Deploy**
- Dropped coturn from `Dockerfile` (+ `EXPOSE` only 4000), `supervisord.conf`
  ([program:coturn] gone), `docker-entrypoint.sh` (coturn conf gen gone),
  `docker-compose.yml` (3478/relay ports + WEBRTC_TURN/ICE env gone; kept
  `WEBRTC_MAX_PARTICIPANTS`, default 50).
- New `docker-compose.livekit.yml` (host networking; offline pull/save notes) +
  `livekit.yaml` (port 7880, rtc range, keys placeholder). `.env*.example` updated.

**Frontend**
- `livekit-client@^2.7` added. `MeetingRoom.jsx` media layer rewritten to LiveKit
  (`Room`, TrackSubscribed/Unsubscribed, setMicrophone/Camera/ScreenShareEnabled,
  `adaptiveStream:false, dynacast:true`). Remote tracks → per-peer MediaStream in a
  ref + `useReducer` force-render; **remote audio plays via hidden `RemoteAudio`
  sinks** (independent of tile visibility; tile video muted). Two separate effects:
  LiveKit connect `[meeting,roomCode,mediaRetry]` and chat WS
  `[meeting,roomCode,retryKey]`. Screen-share/pin/spotlight/moderation/chat UI all
  preserved; peers keyed by email. `force-mute/cam` act on LiveKit local tracks.
- New `admin/MeetingRunners.jsx` (list + health dot + load + add/edit modal +
  ConfirmModal delete), route `/admin/meeting-runners`, Sidebar "Görüş Serverləri"
  (Server icon, manage-settings). `api.js`: `getMeetingToken` + runner CRUD/health.

**Verified:** `npm run build` ✓ (MeetingRoom 552 KB w/ livekit-client; MeetingRunners
chunk present). Backend `gradlew compileJava` ✓ in temurin 21 container (only the
pre-existing DaoAuthenticationProvider deprecation note).

**Gotchas / follow-ups**
- HTTPS app page ⇒ runner URL must be `wss://` (mixed-content). LAN-over-HTTP ⇒ `ws://`.
- Kick is cooperative (WS signal → client disconnects LiveKit); server-side
  RemoteParticipant removal via LiveKit RoomService is a future hardening.
- Old `meeting.ice-servers/turn-*` runtime settings + `VideoMeetingController` @Value
  TURN fields are now dead (left in place, harmless). Could be cleaned later.
- LiveKit image must be pulled+saved for offline installs (separate from modtube tar).

---

### 2026-06-19 — Meetings → in-backend WebCodecs relay (LiveKit removed) + public playlists

**Context:** the prod network only allows 443/80/22 to the server (no media ports), all
clients are wired-LAN Chrome/Edge, offline. After exploring LiveKit+TURN, the user chose
to drop the separate meeting servers and route ALL media through the backend over 443.

**Meetings — new architecture (no WebRTC, no SFU, no media ports):**
- **Backend relay** `websocket/MeetingMediaHandler` (`BinaryWebSocketHandler`) at
  `/ws/meetings/media/{roomCode}` (registered in `WebSocketConfig`, binary buffer 4 MB,
  `ConcurrentWebSocketSessionDecorator` for safe fan-out). Wire format
  `[1 kind][1 flags][8 ts f64][4 sampleRate u32][1 ch][1 rsv][payload]`; server prepends
  `[1 senderEmailLen][email]`. **Selective forwarding:** a control frame (kind=255, JSON
  email list) tells the relay which senders' CAMERA a client wants; camera video only
  goes to subscribers, audio + screen-share go to everyone. This is what makes 10-30
  feasible (each client decodes only visible tiles + audio, not all N cameras).
- **Frontend engine** `src/lib/meetingMedia.js` (`MeetingMedia`): WebCodecs VP8 video +
  Opus audio, `latencyMode:'realtime'`, drop frames when `encodeQueueSize>2`, keyframe
  every ~60 frames, per-sender decode → `<canvas>`, audio via WebAudio scheduler (~60 ms
  jitter buffer). `setWanted(emails)` drives selective forwarding (cap `MAX_VIDEO_TILES=20`).
  Capture via `MediaStreamTrackProcessor` (Chromium only).
- **`MeetingRoom.jsx`** rewritten: local preview via MediaStream, remote tiles host the
  engine's canvases (`RemoteVideo`), roster comes from the text chat WS
  (`peers`/`peer-joined`/`peer-left`, keyed by email), chat/attachments/history/pin/
  spotlight/moderation all preserved. Moderation + private chat route by EMAIL.
- **Removed LiveKit feature entirely:** `LiveKitTokenService`, `MeetingRunner` entity/
  repo/service/controller, `GET /api/meetings/{id}/token`, `runner_id` field +
  `countByRunnerIdAndStatus`, admin "Görüş Serverləri" page/panel/tab, `livekit-client`
  npm dep, `/api/admin/meeting-runners` security rule. (V13 migration left applied;
  `meeting_runners` table + `runner_id` column are now orphaned — harmless under
  `ddl-auto: validate`.) `docker-compose.livekit.yml`/`livekit.yaml` remain in-repo but
  unused.

**Playlists:** public browse section. `GET /api/playlists/public`
(`PlaylistRepository.findByVisibilityIgnoreCaseOrderByCreatedAtDesc("PUBLIC")`) returns
ONLY `PUBLIC` playlists — private/restricted/unlisted excluded at the query, and opening
any playlist still re-checks `canViewPlaylist` (403 on private, allow-list on restricted).
New `pages/PublicPlaylists.jsx`, route `/playlists`, sidebar "Pleylistlər" (MAIN_NAV, all
users).

**Env vars:** NONE added. Meetings need only the existing `WEBRTC_MAX_PARTICIPANTS`
(per-room cap, default 50). The coturn/TURN/ICE vars (`WEBRTC_ICE_SERVERS`,
`WEBRTC_TURN_URL`, `WEBRTC_TURN_USERNAME`, `WEBRTC_TURN_CREDENTIAL`) were removed in the
earlier coturn cleanup and are not needed.

**Verify:** frontend `npm run build` ✓ (MeetingRoom 50 KB, no livekit-client);
backend `compileJava` ✓ (temurin 21; only pre-existing DaoAuthenticationProvider
deprecation note). Pushed `master` da57259. Image tar:
`C:\Users\samid.sixaliyev\Downloads\tars\modtube-latest.tar` (853 MB).

**Gotchas / follow-ups:**
- WebCodecs ⇒ **Chrome/Edge only**. getUserMedia needs a secure context (https — fine).
- TCP relay: great on clean wired LAN; no WebRTC loss-resilience. Tuning knobs:
  `MAX_VIDEO_TILES`, bitrates + `KEYFRAME_EVERY` in `meetingMedia.js`.
- **Not load-tested** with many clients here — needs a real multi-machine test + likely a
  tuning pass.
- Audio forced mono (`channelCount:1`) so the per-sender Opus decoder config always matches.
