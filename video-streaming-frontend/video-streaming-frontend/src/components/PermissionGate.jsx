import { useAuth } from '../context/AuthContext';
import { can } from '../config/permissions';

/**
 * Renders `children` only when the current user holds the required permission.
 *
 * Props:
 *   perm     — a single raw permission string (e.g. "upload-video")
 *   perms    — array of permission strings; access granted if user has ANY one
 *   feature  — a FEATURE key from permissions.js (e.g. FEATURE.UPLOAD)
 *              Can be a string key ("UPLOAD") or the resolved array from FEATURE.
 *   fallback — what to render when access is denied (default: nothing)
 *
 * super-admin always bypasses every check.
 *
 * Examples:
 *   <PermissionGate perm="upload-video">
 *     <UploadButton />
 *   </PermissionGate>
 *
 *   <PermissionGate perms={["manage-users", "super-admin"]} fallback={<p>Access denied</p>}>
 *     <UserTable />
 *   </PermissionGate>
 *
 *   <PermissionGate feature={FEATURE.MANAGE_ROLES}>
 *     <RoleEditor />
 *   </PermissionGate>
 */
export default function PermissionGate({ perm, perms, feature, fallback = null, children }) {
  const { user } = useAuth();
  const userPerms = user?.permissions ?? [];

  let required;
  if (feature !== undefined) {
    required = Array.isArray(feature) ? feature : [feature];
  } else if (perms !== undefined) {
    required = perms;
  } else if (perm !== undefined) {
    required = [perm];
  } else {
    return fallback;
  }

  return can(userPerms, required) ? children : fallback;
}
