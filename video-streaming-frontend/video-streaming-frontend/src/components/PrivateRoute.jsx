import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children, requireAuth = true }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // If route doesn't require auth, always render
  if (!requireAuth) {
    return children;
  }

  // If route requires auth, check authentication
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;