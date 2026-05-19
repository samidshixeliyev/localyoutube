CREATE TABLE IF NOT EXISTS video_views (
    id         BIGSERIAL    PRIMARY KEY,
    video_id   VARCHAR(36)  NOT NULL,
    user_id    BIGINT,
    user_email VARCHAR(255),
    ip_address VARCHAR(45),
    viewed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_view_video FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_view_video ON video_views(video_id);
CREATE INDEX IF NOT EXISTS idx_view_user  ON video_views(user_email);
CREATE INDEX IF NOT EXISTS idx_view_time  ON video_views(viewed_at);
