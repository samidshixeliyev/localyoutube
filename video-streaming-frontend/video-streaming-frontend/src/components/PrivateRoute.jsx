import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * requiredPermission — a single string OR an array of strings.
 *   String: user must have exactly that permission.
 *   Array:  user must have AT LEAST ONE of the listed permissions (OR logic).
 *
 * super-admin always passes every route regardless.
 */
const PrivateRoute = ({
  children,
  requiredPermission,   // string | string[] | undefined
  requireAuth = true,
}) => {
  const { isAuthenticated, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!requireAuth) return children;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // super-admin bypasses every permission check
  if (hasPermission('super-admin')) return children;

  // Resolve the required set as an array
  if (requiredPermission) {
    const perms = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    if (!perms.some(p => hasPermission(p))) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
};

export default PrivateRoute;