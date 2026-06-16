-- ═══════════════════════════════════════════════════════════════════
-- V9: manage-meetings permission
-- Lets non-super-admin moderators edit/delete/end ANY user's meeting
-- (a finished or scheduled meeting; live meetings still can't be deleted).
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO permissions (name, description, type, created_at) VALUES
('manage-meetings', 'Manage (edit, end, delete) any user''s video meetings', 'VIDEO', NOW())
ON CONFLICT (name) DO NOTHING;
