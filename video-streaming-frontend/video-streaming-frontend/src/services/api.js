import axios from 'axios';

// Determine base URL based on environment
const getBaseURL = () => {
  // Production: use env var or construct from window.location
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
  }
  // Development: use Vite proxy
  return '/api';
};

// Read API URL from environment variable or use Vite proxy default
const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout for normal requests
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Increase timeout for file uploads
    if (config.headers['Content-Type'] === 'multipart/form-data') {
      config.timeout = 300000; // 5 minutes for uploads
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Log error for debugging (only in development)
    if (import.meta.env.DEV) {
      console.error('[API] Response error:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
        hasRetried: error.config?._retry
      });
    }

    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401 && !error.config?._retry) {
      error.config._retry = true;
      
      // Clear auth data
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('user');
      
      // Redirect to login if not already there
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    // Handle network errors (CORS, connection refused, etc.)
    if (error.code === 'ERR_NETWORK' || !error.response) {
      const enhancedError = new Error(
        'Unable to connect to server. Please check your internet connection or try again later.'
      );
      enhancedError.originalError = error;
      return Promise.reject(enhancedError);
    }

    return Promise.reject(error);
  }
);

export default api;