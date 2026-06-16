/**
 * Central permission registry.
 *
 * ADDING A NEW FEATURE:
 *   1. Add a constant to PERMS below (must match the string stored in the DB).
 *   2. Add a FEATURE entry that lists which permission(s) gate the feature.
 *   3. Seed the permission in the DB via RoleManagement (it's already dynamic).
 *   4. In your component: import { FEATURE } from '../config/permissions';
 *      then check  can(user.permissions, FEATURE.YOUR_FEATURE).
 *   5. In the backend: add the permission string to @PreAuthorize.
 *
 * super-admin always bypasses every check — do not add it to FEATURE arrays.
 */

export const PERMS = {
  SUPER_ADMIN:      'super-admin',
  ADMIN_MODTUBE:    'admin-modtube',      // broad video management role
  UPLOAD_VIDEO:     'upload-video',        // upload + see own uploads
  DELETE_VIDEO:     'delete-video',        // delete own (or any, if super-admin) videos
  VIEW_METRICS:     'view-metrics',        // Prometheus metrics dashboard
  MANAGE_SETTINGS:  'manage-settings',     // IDP / system settings
  MANAGE_USERS:     'manage-users',        // user CRUD
  MANAGE_ROLES:     'manage-roles',        // role + permission CRUD
  VIEW_PRIVATE:     'view-private',        // watch private / restricted videos
  MANAGE_SHORTS:    'manage-shorts',       // flag / unflag short-form content
  COMMENT_MODERATE: 'comment-moderate',    // delete any comment
  VIEW_REPORTS:     'view-reports',        // analytics / report pages
  VIDEO_CALL:       'video-call',          // create / join live video meetings
};

/**
 * Feature gates.
 * Array = user must have ANY ONE of the listed perms (OR logic).
 * super-admin always bypasses via the can() helper.
 */
export const FEATURE = {
  // Video features
  UPLOAD:           [PERMS.UPLOAD_VIDEO,     PERMS.ADMIN_MODTUBE],
  MY_VIDEOS:        [PERMS.UPLOAD_VIDEO,     PERMS.ADMIN_MODTUBE],
  EDIT_VIDEO:       [PERMS.ADMIN_MODTUBE],
  DELETE_VIDEO:     [PERMS.DELETE_VIDEO,     PERMS.ADMIN_MODTUBE],
  MANAGE_SHORTS:    [PERMS.MANAGE_SHORTS,    PERMS.ADMIN_MODTUBE],

  // Content moderation
  COMMENT_MODERATE: [PERMS.COMMENT_MODERATE, PERMS.ADMIN_MODTUBE],
  VIEW_PRIVATE:     [PERMS.VIEW_PRIVATE,     PERMS.ADMIN_MODTUBE],

  // Admin pages
  VIEW_METRICS:     [PERMS.VIEW_METRICS],
  VIEW_REPORTS:     [PERMS.VIEW_REPORTS],
  MANAGE_SETTINGS:  [PERMS.MANAGE_SETTINGS],
  MANAGE_USERS:     [PERMS.MANAGE_USERS],
  MANAGE_ROLES:     [PERMS.MANAGE_ROLES],

  // Live video meetings
  VIDEO_CALL:       [PERMS.VIDEO_CALL],
};

/**
 * Check whether a user's permissions array grants access to a feature.
 *
 * @param {string[]} userPerms  - permissions array from the JWT / AuthContext
 * @param {string|string[]} feature - a FEATURE key, a FEATURE value array, or a raw perm string
 * @returns {boolean}
 */
export function can(userPerms = [], feature) {
  if (!Array.isArray(userPerms)) return false;
  if (userPerms.includes(PERMS.SUPER_ADMIN)) return true;
  const required = Array.isArray(feature)
    ? feature
    : (FEATURE[feature] ?? [feature]);
  return required.some(p => userPerms.includes(p));
}
