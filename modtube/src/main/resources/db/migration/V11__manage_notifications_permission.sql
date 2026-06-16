-- ═══════════════════════════════════════════════════════════════════
-- V11: manage-notifications permission (broadcast / announcements)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO permissions (name, description, type, created_at) VALUES
('manage-notifications', 'Send broadcast notifications / announcements to all users', 'SYSTEM', NOW())
ON CONFLICT (name) DO NOTHING;
