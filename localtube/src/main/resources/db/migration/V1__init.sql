-- Enable pg_trgm for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─────────────────────────────────────────────
-- Roles & Permissions
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    description VARCHAR(500),
    type        VARCHAR(100),
    created_at  TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    description VARCHAR(500),
    created_at  TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permission (
    role_id       BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ─────────────────────────────────────────────
-- Users
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id         BIGSERIAL PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    surname    VARCHAR(255),
    email      VARCHAR(255) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    role_id    BIGINT REFERENCES roles(id),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- ─────────────────────────────────────────────
-- Videos
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS videos (
    id                  VARCHAR(64) PRIMARY KEY,
    title               VARCHAR(500),
    description         TEXT,
    filename            VARCHAR(500),
    original_filename   VARCHAR(500),
    uploader_id         BIGINT,
    uploader_name       VARCHAR(255),
    uploader_email      VARCHAR(255),
    upload_path         TEXT,
    hls_path            TEXT,
    master_playlist_url TEXT,
    thumbnail_path      TEXT,
    thumbnail_url       TEXT,
    status              VARCHAR(50),
    processing_progress INT,
    processing_error    TEXT,
    file_size           BIGINT,
    duration_seconds    INT,
    width               INT,
    height              INT,
    codec               VARCHAR(50),
    frame_rate          DOUBLE PRECISION,
    views               BIGINT  DEFAULT 0,
    likes               BIGINT  DEFAULT 0,
    comment_count       INT     DEFAULT 0,
    visibility          VARCHAR(50) DEFAULT 'PUBLIC',
    restriction_note    TEXT,
    uploaded_at         BIGINT,
    processed_at        BIGINT,
    updated_at          BIGINT
);

CREATE INDEX IF NOT EXISTS idx_videos_status     ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_visibility ON videos(visibility);
CREATE INDEX IF NOT EXISTS idx_videos_uploader   ON videos(uploader_id);
CREATE INDEX IF NOT EXISTS idx_videos_title_trgm ON videos USING gin(title gin_trgm_ops);

CREATE TABLE IF NOT EXISTS video_tags (
    video_id VARCHAR(64) NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    tag      VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_video_tags ON video_tags(video_id);

CREATE TABLE IF NOT EXISTS video_qualities (
    video_id VARCHAR(64) NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    quality  VARCHAR(50)
);
CREATE INDEX IF NOT EXISTS idx_video_qualities ON video_qualities(video_id);

CREATE TABLE IF NOT EXISTS video_allowed_emails (
    video_id VARCHAR(64) NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    email    VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_video_allowed_emails ON video_allowed_emails(video_id);

-- ─────────────────────────────────────────────
-- Video Likes
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_likes (
    id         VARCHAR(255) PRIMARY KEY,
    video_id   VARCHAR(64) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    created_at BIGINT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_likes_unique ON video_likes(video_id, user_email);
CREATE INDEX IF NOT EXISTS idx_video_likes_video ON video_likes(video_id);

-- ─────────────────────────────────────────────
-- Comments
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
    id         VARCHAR(64) PRIMARY KEY,
    video_id   VARCHAR(64),
    user_id    VARCHAR(255),
    username   VARCHAR(255),
    text       TEXT,
    likes      BIGINT DEFAULT 0,
    created_at BIGINT,
    updated_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_comments_video ON comments(video_id);
