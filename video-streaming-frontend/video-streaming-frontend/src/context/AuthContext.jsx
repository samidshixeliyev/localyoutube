import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check token expiration every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const token = localStorage.getItem('jwt_token');
      if (token && isTokenExpiringSoon(token)) {
        console.log('Token expiring soon, will refresh on next request');
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  // Check if token is expiring soon
  const isTokenExpiringSoon = (token) => {
    if (!token) return true;
    
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      
      const decoded = JSON.parse(jsonPayload);
      const exp = decoded.exp * 1000;
      const now = Date.now();
      
      // Check if token expires in less than 5 minutes
      const timeUntilExpiration = exp - now;
      return timeUntilExpiration < 5 * 60 * 1000;
    } catch (err) {
      return true;
    }
  };

  useEffect(() => {
    // Check if user data exists on mount
    const token = localStorage.getItem('jwt_token');
    const userData = localStorage.getItem('user_data');
    
    if (token && userData) {
      try {
        // Check if token is still valid
        if (!isTokenExpiringSoon(token)) {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
          setIsAuthenticated(true);
        } else {
          // Token expired, clear and redirect to login
          logout();
        }
      } catch (err) {
        console.error('Error parsing user data:', err);
        logout();
      }
    }
    setLoading(false);
  }, []);

  const login = (loginResponse) => {
    // Store token
    localStorage.setItem('jwt_token', loginResponse.accessToken);
    
    // Store user data
    const userData = {
      email: loginResponse.email,
      name: loginResponse.name,
      fullName: loginResponse.fullName,
      userId: loginResponse.userId,
      role: loginResponse.role,
      permissions: loginResponse.permissions || []
    };
    
    localStorage.setItem('user_data', JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_data');
    setUser(null);
    setIsAuthenticated(false);
  };

  const hasPermission = (permission) => {
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permission);
  };

  const isAdmin = () => {
    return hasPermission('admin-modtube') || user?.role === 'ADMIN';
  };

  const value = {
    user,
    isAuthenticated,
    login,
    logout,
    loading,
    hasPermission,
    isAdmin
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};