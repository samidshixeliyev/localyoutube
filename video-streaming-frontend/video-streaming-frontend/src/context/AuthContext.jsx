import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check token validity without redirecting
  const checkTokenValidity = () => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      setUser(null);
      return false;
    }

    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      const decoded = JSON.parse(jsonPayload);
      const exp = decoded.exp * 1000; // Convert to milliseconds
      const now = Date.now();

      // Token expired
      if (now >= exp) {
        setUser(null);
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user');
        // DON'T redirect - just clear auth state
        return false;
      }

      return true;
    } catch (error) {
      setUser(null);
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('user');
      return false;
    }
  };

  useEffect(() => {
    const initAuth = () => {
      // Check token validity
      if (!checkTokenValidity()) {
        setLoading(false);
        return;
      }

      // Load user from localStorage
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          setUser(userData);
        } catch (error) {
          localStorage.removeItem('user');
          localStorage.removeItem('jwt_token');
        }
      }
      setLoading(false);
    };

    initAuth();

    // Check token validity every minute
    const interval = setInterval(() => {
      checkTokenValidity();
    }, 60000); // Check every 60 seconds

    return () => clearInterval(interval);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      
      // Handle both 'token' and 'accessToken' response formats
      const token = response.data.token || response.data.accessToken;
      
      if (token) {
        localStorage.setItem('jwt_token', token);
        
        // Decode token to get user info
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        
        const decoded = JSON.parse(jsonPayload);
        const userData = {
          email: decoded.email || decoded.sub,
          username: decoded.username || decoded.name || email.split('@')[0],
          permissions: decoded.permissions || [],
          role: decoded.role || ''
        };
        
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        
        return { success: true };
      } else {
        return {
          success: false,
          message: 'No token received from server'
        };
      }
    } catch (error) {
      console.error('[AuthContext] Login error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed'
      };
    }
  };

  // Logout without using useNavigate - component will handle navigation
  const logout = () => {
    setUser(null);
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
  };

  const register = async (username, email, password) => {
    try {
      const response = await api.post('/auth/register', {
        username,
        email,
        password
      });
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Registration failed'
      };
    }
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    return user.permissions?.includes(permission) || false;
  };

  const isAuthenticated = !!user;

  const value = {
    user,
    loading,
    login,
    logout,
    register,
    hasPermission,
    isAuthenticated,
    checkTokenValidity
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;