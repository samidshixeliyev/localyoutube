-- ═══════════════════════════════════════════════════════════════════
-- V2: Seed all application permissions used by Spring Security
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO permissions (name, description, type, created_at) VALUES
-- System
('super-admin',       'Full system access — covers all permissions',        'SYSTEM', NOW()),
('view-metrics',      'Access the Prometheus metrics/monitoring dashboard', 'ADMIN',  NOW()),
('manage-settings',   'Read and update application and IDP settings',       'ADMIN',  NOW()),
('view-reports',      'Access reports and audit logs',                      'ADMIN',  NOW()),
-- User management
('manage-users',      'Create, edit and delete user accounts',              'USER',   NOW()),
('manage-roles',      'Create, edit and delete roles and permissions',      'USER',   NOW()),
-- Video management
('admin-modtube',     'Upload, edit and delete any video',                  'VIDEO',  NOW()),
('upload-video',      'Upload new videos',                                  'VIDEO',  NOW()),
('delete-video',      'Delete any video regardless of owner',               'VIDEO',  NOW()),
('view-private',      'View private and restricted videos',                 'VIDEO',  NOW()),
('manage-shorts',     'Publish and manage short videos',                    'VIDEO',  NOW()),
-- Moderation
('comment-moderate',  'Delete or hide any comment',                        'CONTENT', NOW())
ON CONFLICT (name) DO NOTHING;
