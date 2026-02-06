import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token refresh in progress flag
let isRefreshing = false;
let refreshSubscribers = [];

// Subscribe to token refresh
const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb);
};

// Notify all subscribers when token is refreshed
const onTokenRefreshed = (token) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

// Check if token is expired or expiring soon
const isTokenExpiringSoon = (token) => {
  if (!token) return true;
  
  try {
    // Decode JWT to get expiration
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    const decoded = JSON.parse(jsonPayload);
    const exp = decoded.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    
    // Check if token expires in less than 5 minutes
    const timeUntilExpiration = exp - now;
    const isExpiring = timeUntilExpiration < 5 * 60 * 1000; // 5 minutes
    
    if (isExpiring) {
      console.log('[API] Token expiring soon:', {
        expiresAt: new Date(exp),
        timeLeft: Math.floor(timeUntilExpiration / 1000) + ' seconds'
      });
    }
    
    return isExpiring;
  } catch (err) {
    console.error('[API] Error checking token expiration:', err);
    return true; // If we can't decode, assume expired
  }
};

// Refresh token function
const refreshToken = async () => {
  const token = localStorage.getItem('jwt_token');
  if (!token) {
    throw new Error('No token available');
  }

  console.log('[API] Refreshing token...');

  try {
    const response = await axios.post('/api/auth/refresh', {}, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const newToken = response.data.accessToken;
    localStorage.setItem('jwt_token', newToken);
    
    // Update user data with potentially updated permissions
    const userData = {
      email: response.data.email,
      name: response.data.name,
      fullName: response.data.fullName,
      userId: response.data.userId,
      role: response.data.role,
      permissions: response.data.permissions || []
    };
    localStorage.setItem('user_data', JSON.stringify(userData));
    
    console.log('[API] Token refreshed successfully');
    return newToken;
  } catch (err) {
    console.error('[API] Token refresh failed:', err.response?.data || err.message);
    // If refresh fails, logout
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_data');
    window.location.href = '/login';
    throw err;
  }
};

// Request interceptor - Add token and check expiration
api.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem('jwt_token');
    
    console.log('[API] Request:', config.method?.toUpperCase(), config.url, {
      hasToken: !!token,
      headers: config.headers
    });
    
    if (token) {
      // Check if token is expiring soon
      if (isTokenExpiringSoon(token)) {
        console.log('[API] Token expiring soon, refreshing...');
        
        if (!isRefreshing) {
          isRefreshing = true;
          
          try {
            const newToken = await refreshToken();
            isRefreshing = false;
            
            // Update config with new token
            config.headers.Authorization = `Bearer ${newToken}`;
            
            // Notify all waiting requests
            onTokenRefreshed(newToken);
          } catch (err) {
            isRefreshing = false;
            throw err;
          }
        } else {
          // Wait for token refresh to complete
          return new Promise((resolve) => {
            subscribeTokenRefresh((newToken) => {
              config.headers.Authorization = `Bearer ${newToken}`;
              resolve(config);
            });
          });
        }
      } else {
        // Token is still valid, use it
        config.headers.Authorization = `Bearer ${token}`;
        console.log('[API] Using existing token');
      }
    } else {
      console.log('[API] No token found in localStorage');
    }
    
    return config;
  },
  (error) => {
    console.error('[API] Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - Handle 401 errors
api.interceptors.response.use(
  (response) => {
    console.log('[API] Response:', response.config.method?.toUpperCase(), response.config.url, {
      status: response.status
    });
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    console.error('[API] Response error:', {
      url: originalRequest?.url,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      hasRetried: originalRequest?._retry
    });
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      console.log('[API] Got 401, attempting token refresh...');
      originalRequest._retry = true;
      
      try {
        const newToken = await refreshToken();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        console.log('[API] Retrying request with new token');
        return api(originalRequest);
      } catch (err) {
        console.error('[API] Token refresh failed, redirecting to login');
        // Refresh failed, redirect to login
        return Promise.reject(err);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;