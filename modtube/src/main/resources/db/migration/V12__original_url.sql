-- ═══════════════════════════════════════════════════════════════════
-- V12: store the original uploaded video (kept in MinIO under originals/{id}/)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE videos ADD COLUMN IF NOT EXISTS original_url TEXT;
