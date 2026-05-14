-- ─────────────────────────────────────────────
-- Upload configuration settings
-- Admins can change these via the Settings page without a rebuild.
-- ─────────────────────────────────────────────
INSERT INTO system_settings (key, value, description, updated_at) VALUES
('upload.max-parallel', '2', 'Maximum number of parallel chunk uploads per video (1–10). Higher values speed up uploads on fast connections.', NOW())
ON CONFLICT (key) DO NOTHING;
