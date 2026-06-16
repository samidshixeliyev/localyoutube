import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';
import { decodeJwt } from '../utils/jwt';

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  try {
    return Array.from(crypto.getRandomValues(new Uint8Array(length)))
      .map(b => chars[b % chars.length])
      .join('');
  } catch {
    // fallback for non-secure contexts
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
}

// Pure-JS SHA-256 — works on HTTP (no crypto.subtle required)
function sha256Sync(str) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';
  const words = [];
  const asciiBitLength = str.length * 8;
  let hash = [];
  const k = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = candidate * candidate; i < 313; i += candidate) isComposite[i] = true;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  str += '\x80';
  while (str.length % 64 !== 56) str += '\x00';
  for (let i = 0; i < str.length; i++) {
    const j = str.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (let j = 0; j < words.length;) {
    const w = words.slice(j, j += 16);
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      const i2 = i < 16 ? w[i] : (
        rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      ) + w[i - 7] + (
        rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      ) + w[i - 16];
      w[i] = i2 >>> 0;
      const temp1 = hash[7] + (
        rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)
      ) + ((hash[4] & hash[5]) ^ (~hash[4] & hash[6])) + k[i] + w[i];
      const temp2 = (
        rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)
      ) + ((hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) >>> 0, hash[0], hash[1], hash[2],
        (hash[3] + temp1) >>> 0, hash[4], hash[5], hash[6]];
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) >>> 0;
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

function hexToBase64url(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.substr(i, 2), 16));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function sha256Base64url(str) {
  // Prefer crypto.subtle (secure context: HTTPS / localhost)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const data = new TextEncoder().encode(str);
      const hash = await crypto.subtle.digest('SHA-256', data);
      return btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    } catch { /* fall through to pure-JS */ }
  }
  // Pure-JS fallback for plain HTTP contexts
  return hexToBase64url(sha256Sync(str));
}

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ── Synchronous bootstrap ────────────────────────────────────────────────────
// Read and validate the JWT from localStorage before the first render so that
// `loading` never needs to be true and no spinner ever flashes on page load.
function loadUserSync() {
  try {
    const token = localStorage.getItem('jwt_token');
    if (!token) return null;

    const decoded = decodeJwt(token);
    if (Date.now() >= decoded.exp * 1000) {
      // Token already expired — clear immediately
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('user');
      return null;
    }

    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
    return null;
  }
}
// ────────────────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }) => {
  // Initialized synchronously — no async delay, no loading flash
  const [user, setUser] = useState(loadUserSync);
  const [loading] = useState(false); // always false; kept for API compat

  // Check token validity without redirecting
  const checkTokenValidity = () => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      setUser(null);
      return false;
    }

    try {
      const decoded = decodeJwt(token);
      if (Date.now() >= decoded.exp * 1000) {
        setUser(null);
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user');
        return false;
      }
      return true;
    } catch {
      setUser(null);
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('user');
      return false;
    }
  };

  useEffect(() => {
    // Periodic expiry check — catches tokens that expire while the tab is open
    const interval = setInterval(checkTokenValidity, 60000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      prompt: 'login',
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

  const loginWithIdp = async (token, idpUser) => {
    localStorage.setItem('jwt_token', token);

    const config = (() => {
      try { return JSON.parse(sessionStorage.getItem('idp_config') || '{}'); }
      catch { return {}; }
    })();

    const claimEmail    = config.claimEmail    || 'mail';
    const claimFullName = config.claimFullName || 'cn';
    const claimFirst    = config.claimFirst    || 'givenName';
    const claimLast     = config.claimLast     || 'sn';
    const claimUsername = config.claimUsername || 'uid';

    const email =
      idpUser[claimEmail] ||
      idpUser.email ||
      idpUser.preferred_username ||
      (typeof idpUser.sub === 'string' && idpUser.sub.includes('@') ? idpUser.sub : null);

    const fullName =
      idpUser[claimFullName] ||
      (idpUser[claimFirst] && idpUser[claimLast]
        ? `${idpUser[claimFirst]} ${idpUser[claimLast]}`
        : idpUser[claimFirst] || idpUser[claimLast]) ||
      idpUser.name;

    const username =
      idpUser[claimUsername] ||
      idpUser.preferred_username ||
      (email ? email.split('@')[0] : null) ||
      idpUser.sub;

    const userData = {
      email:        email || idpUser.sub,
      name:         fullName || username,
      fullName:     fullName || username,
      username,
      title:        idpUser.title || null,
      organization: idpUser.o    || null,
      permissions:  [],
      role:         'USER',
      isIdpUser:    true,
    };

    // Fetch DB-backed role and permissions using the IDP token now in localStorage.
    // JwtAuthenticationFilter provisions the IDP user in DB on the first call.
    try {
      const resp = await api.get('/auth/profile');
      if (resp.data?.role)        userData.role        = resp.data.role;
      if (resp.data?.permissions) userData.permissions = resp.data.permissions;
    } catch {
      // Offline or IDP validation failed — keep defaults (empty permissions, USER role)
    }

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
        const decoded = decodeJwt(token);
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