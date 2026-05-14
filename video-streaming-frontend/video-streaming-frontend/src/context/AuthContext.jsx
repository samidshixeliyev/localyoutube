import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map(b => chars[b % chars.length])
    .join('');
}

async function sha256Base64url(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

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

  // ── IDP (PKCE) auth ──────────────────────────────────────────────────────

  const initiateIdpLogin = async () => {
    const config = await fetch('/api/auth/idp/config').then(r => r.json());

    const verifier = generateRandomString(64);
    const challenge = await sha256Base64url(verifier);
    const state = generateRandomString(32);

    sessionStorage.setItem('pkce_verifier', verifier);
    sessionStorage.setItem('pkce_state', state);
    sessionStorage.setItem('idp_config', JSON.stringify(config));

    // Use the server-registered redirect URI exactly
    const redirectUri = config.redirectUri || window.location.origin + '/';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: redirectUri,
      scope: config.scope,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    window.location.href = config.authorizationEndpoint + '?' + params.toString();
  };

  const logoutWithIdp = async () => {
    const idToken = localStorage.getItem('jwt_token');
    setUser(null);
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');

    try {
      const config = await fetch('/api/auth/idp/config').then(r => r.json());
      const logoutUri = config.endSessionEndpoint;
      const params = new URLSearchParams({
        post_logout_redirect_uri: config.logoutRedirectUri || window.location.origin + '/logged_out',
      });
      if (idToken) params.set('id_token_hint', idToken);
      window.location.href = logoutUri + '?' + params.toString();
    } catch {
      window.location.href = '/';
    }
  };

  const loginWithIdp = (token, idpUser) => {
    localStorage.setItem('jwt_token', token);
    const userData = {
      email: idpUser.email || idpUser.sub,
      username: idpUser.display_name || idpUser.ldap_username || idpUser.email?.split('@')[0],
      permissions: [],
      role: 'USER',
      isIdpUser: true,
    };
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  // ── Local admin login ────────────────────────────────────────────────────

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
    loginWithIdp,
    initiateIdpLogin,
    logout,
    logoutWithIdp,
    register,
    hasPermission,
    isAuthenticated,
    checkTokenValidity
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;