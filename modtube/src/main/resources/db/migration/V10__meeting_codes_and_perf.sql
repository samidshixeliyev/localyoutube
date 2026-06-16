-- ═══════════════════════════════════════════════════════════════════
-- V10: meeting join PIN (room code) + performance indexes
-- ═══════════════════════════════════════════════════════════════════

-- ── 4-digit join PIN for meetings (gate for PUBLIC meetings) ─────────
ALTER TABLE video_meetings ADD COLUMN IF NOT EXISTS join_pin VARCHAR(8);

-- Backfill existing meetings with a random 4-digit PIN
UPDATE video_meetings
SET join_pin = lpad((floor(random() * 10000))::int::text, 4, '0')
WHERE join_pin IS NULL;

-- ── Notification payload (e.g. signed invite token for join links) ──
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data TEXT;

-- ── Performance indexes (idempotent) ────────────────────────────────
-- Notifications: list query is ORDER BY created_at DESC per user → composite
-- index covers both the filter and the sort (fixes slow notification pulls).
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications (user_email, created_at DESC);

-- Comments per video (comment listing on the watch page)
CREATE INDEX IF NOT EXISTS idx_comments_video_id
    ON comments (video_id);

-- Likes: like-status + counts per video, and per (video,user)
CREATE INDEX IF NOT EXISTS idx_video_likes_video_id
    ON video_likes (video_id);

-- Meetings: list filtered by host + by room code lookup (WS handshake)
CREATE INDEX IF NOT EXISTS idx_video_meetings_room_code
    ON video_meetings (room_code);

-- Users: fast email lookup (auth + meeting/playlist access checks)
CREATE INDEX IF NOT EXISTS idx_users_email_lower
    ON users (lower(email));
