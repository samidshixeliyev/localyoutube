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

*Update this file every session with: what was attempted, what was fixed, what is still broken, and any gotchas found.*
