ALTER TABLE playlists
    ADD COLUMN visibility     VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
    ADD COLUMN allowed_emails TEXT;
