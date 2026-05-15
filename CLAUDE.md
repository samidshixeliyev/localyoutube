# LocalYouTube / ModTube — Project Summary

## Stack

| Layer     | Technology                                     |
|-----------|------------------------------------------------|
| Frontend  | React 18, Vite, Tailwind CSS, HLS.js, Recharts |
| Backend   | Spring Boot (Java), Prometheus metrics         |
| Auth      | JWT + PKCE OAuth2 IDP                          |
| Video     | HLS streaming via nginx, thumbnails            |
| Dev proxy | Vite proxies `/api`, `/hls`, `/thumbnails`, `/uploads` → `localhost:8080` |

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
│   │       └── admin/
│   │           ├── Metrics.jsx      ← Prometheus metrics dashboard
│   │           ├── UserManagement.jsx
│   │           ├── RoleManagement.jsx
│   │           └── IdpSettings.jsx
│   ├── tailwind.config.js           ← Army/olive green palette (primary-*, army-*, tan-*)
│   └── vite.config.js
└── modtube/                          ← Spring Boot backend
    └── src/main/java/ao/az/modtube/
        ├── controller/MetricsProxyController.java  ← Proxies Prometheus queries
        └── config/security/
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

*Update this file every session with: what was attempted, what was fixed, what is still broken, and any gotchas found.*
