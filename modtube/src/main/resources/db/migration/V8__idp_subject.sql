-- Stable IDP identity column.
-- IDP users were previously matched by email, but /idp/sync-profile rewrites the
-- email from the provisioning placeholder (UUID) to the real address. That broke
-- re-matching on subsequent logins: the UUID lookup failed and a brand-new USER
-- row was created each time, orphaning any admin-assigned role (e.g. super-admin).
--
-- idp_subject stores the IDP 'sub' claim, which never changes. Login now matches
-- by this stable key, so admin-assigned roles persist across logins.

ALTER TABLE users ADD COLUMN IF NOT EXISTS idp_subject VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_idp_subject
    ON users (idp_subject)
    WHERE idp_subject IS NOT NULL;
