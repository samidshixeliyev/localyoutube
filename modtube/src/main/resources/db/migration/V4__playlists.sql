CREATE TABLE playlists (
    id          VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id    BIGINT       REFERENCES users(id) ON DELETE CASCADE,
    owner_email VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE playlist_items (
    id          BIGSERIAL    PRIMARY KEY,
    playlist_id VARCHAR(36)  NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    video_id    VARCHAR(36)  NOT NULL,
    position    INTEGER      NOT NULL DEFAULT 0,
    added_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_playlists_owner       ON playlists(owner_email);
CREATE INDEX idx_playlist_items_list   ON playlist_items(playlist_id, position);
CREATE INDEX idx_playlist_items_video  ON playlist_items(video_id);
