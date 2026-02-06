import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ 
  children, 
  requiredPermission,          // string e.g. "admin-modtube" or undefined
  requireAuth = true 
}) => {
  const { isAuthenticated, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Public routes (no authentication required)
  if (!requireAuth) {
    return children;
  }

  // Not logged in → redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Super-admin can access EVERY protected route
  if (hasPermission('super-admin')) {
    return children;
  }

  // For regular users → check the specific permission if required
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default PrivateRoute;