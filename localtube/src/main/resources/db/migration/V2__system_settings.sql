-- ─────────────────────────────────────────────
-- System Settings (dynamic key-value config)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
    key         VARCHAR(255) PRIMARY KEY,
    value       TEXT,
    description VARCHAR(500),
    updated_at  TIMESTAMP
);

-- Default IDP settings (mirrors application.yml defaults; change via admin UI without rebuild)
INSERT INTO system_settings (key, value, description, updated_at) VALUES
('idp.base-url',            'https://13.61.159.58',                 'IDP base URL (OAuth2 server)',          NOW()),
('idp.client-id',           'EFxbQK-ekDX1OkWov51cjg',              'OAuth2 public client ID',               NOW()),
('idp.redirect-uri',        'http://13.61.159.58:4000/',            'OAuth2 post-login redirect URI',        NOW()),
('idp.logout-redirect-uri', 'http://13.61.159.58:4000/logged_out',  'OAuth2 post-logout redirect URI',       NOW()),
('idp.jwks-uri',            'https://13.61.159.58/jwks',            'JWKS endpoint for JWT verification',    NOW()),
('idp.issuer',              'https://auth.ao.az',                   'Expected JWT issuer claim',             NOW()),
('idp.enabled',             'true',                                 'Enable IDP/SSO login button',           NOW())
ON CONFLICT (key) DO NOTHING;
