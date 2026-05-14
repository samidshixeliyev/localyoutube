-- ─────────────────────────────────────────────
-- IDP JWT claim name configuration
-- Admins can change these via the IDP Settings page without a rebuild.
-- ─────────────────────────────────────────────
INSERT INTO system_settings (key, value, description, updated_at) VALUES
('idp.claim.email',    'mail',      'JWT claim that contains the user email address',                        NOW()),
('idp.claim.fullname', 'cn',        'JWT claim for full display name (e.g. "Daniel Hernandez")',             NOW()),
('idp.claim.first',    'givenName', 'JWT claim for given / first name',                                      NOW()),
('idp.claim.last',     'sn',        'JWT claim for surname / family name (used if full-name claim is empty)',NOW()),
('idp.claim.username', 'uid',       'JWT claim for login username (fallback when name claims are absent)',   NOW())
ON CONFLICT (key) DO NOTHING;
