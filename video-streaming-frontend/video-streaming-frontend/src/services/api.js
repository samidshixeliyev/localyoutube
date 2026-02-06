import axios from 'axios';

// Read API URL from environment variable or use Vite proxy default
// In development: uses '/api' which Vite proxies to http://172.22.111.47:8081/api
// In production: uses VITE_API_URL from .env file
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
    // Log error for debugging
    console.error('[API] Response error:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      hasRetried: error.config?._retry
    });

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

    return Promise.reject(error);
  }
);

export default api;