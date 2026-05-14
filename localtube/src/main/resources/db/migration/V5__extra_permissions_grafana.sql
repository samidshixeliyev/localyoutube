-- ─────────────────────────────────────────────
-- Granular admin permissions
-- Allows non-super-admin users to access specific admin areas.
-- ─────────────────────────────────────────────
INSERT INTO permissions (name, description, type, created_at) VALUES
('view-metrics',   'Access the metrics/monitoring dashboard',              'ADMIN', NOW()),
('manage-settings','Read and update application & IDP settings',           'ADMIN', NOW())
ON CONFLICT (name) DO NOTHING;

-- ─────────────────────────────────────────────
-- Grafana URL setting
-- Admin can change the Grafana link shown on the metrics page.
-- Empty value → auto-detect as same-host:3000 in the frontend.
-- ─────────────────────────────────────────────
INSERT INTO system_settings (key, value, description, updated_at) VALUES
('grafana.url', '', 'External Grafana URL shown as a quick-link on the Metrics page (e.g. http://10.0.0.1:3000). Leave empty to auto-detect as <hostname>:3000.', NOW())
ON CONFLICT (key) DO NOTHING;
