-- ═══════════════════════════════════════════════════════════════════
-- V6: Video meetings (live WebRTC calls)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO permissions (name, description, type, created_at) VALUES
('video-call', 'Create and join live video meetings', 'VIDEO', NOW())
ON CONFLICT (name) DO NOTHING;

CREATE TABLE video_meetings (
    id             BIGSERIAL PRIMARY KEY,
    title          VARCHAR(255) NOT NULL,
    description    TEXT,
    room_code      VARCHAR(64) NOT NULL UNIQUE,
    host_id        BIGINT,
    host_email     VARCHAR(255) NOT NULL,
    host_name      VARCHAR(255),
    status         VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    visibility     VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
    allowed_emails TEXT,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    started_at     TIMESTAMP,
    ended_at       TIMESTAMP
);

CREATE INDEX idx_video_meetings_host_email ON video_meetings(host_email);
CREATE INDEX idx_video_meetings_status     ON video_meetings(status);
