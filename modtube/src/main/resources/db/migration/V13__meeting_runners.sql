-- ═══════════════════════════════════════════════════════════════════
-- V13: Meeting runners (SFU servers) — GitLab-runner-style pool
-- ───────────────────────────────────────────────────────────────────
-- Video meetings moved from full-mesh WebRTC to an SFU (LiveKit). Each
-- registered "runner" is an external LiveKit server (URL + API key/secret).
-- Meetings are assigned to the least-loaded healthy runner at start; all
-- participants of a room connect to that same runner.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS meeting_runners (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(120)  NOT NULL,
    -- LiveKit signaling URL the browser connects to, e.g. ws://10.0.0.5:7880 or wss://sfu.lan
    ws_url      VARCHAR(500)  NOT NULL,
    api_key     VARCHAR(255)  NOT NULL,
    -- LiveKit API secret (must be >= 32 chars). Used to mint join tokens.
    api_secret  VARCHAR(255)  NOT NULL,
    enabled     BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP     DEFAULT NOW()
);

-- Which runner a meeting is currently bound to (null = unassigned / not live).
ALTER TABLE video_meetings ADD COLUMN IF NOT EXISTS runner_id BIGINT;

-- Fast per-runner active-room counting for load balancing.
CREATE INDEX IF NOT EXISTS idx_video_meetings_runner_status
    ON video_meetings(runner_id, status);
