-- ═══════════════════════════════════════════════════════════════════
-- V7: In-app notification system
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE notifications (
    id         BIGSERIAL PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    type       VARCHAR(50)  NOT NULL,   -- MEETING_INVITE | MEETING_STARTED
    title      VARCHAR(255) NOT NULL,
    message    TEXT,
    meeting_id BIGINT REFERENCES video_meetings(id) ON DELETE CASCADE,
    read       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_email ON notifications(user_email);
CREATE INDEX idx_notifications_unread     ON notifications(user_email, read) WHERE read = FALSE;
