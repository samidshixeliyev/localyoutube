import axios from 'axios';

// ✅ CRITICAL FIX: Use the backend server URL directly
// This ensures all API requests go to the correct backend server
const API_BASE = 'http://172.22.111.47:8081/api';

const api = axios.create({
    baseURL: API_BASE,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Request interceptor - attach JWT
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor - handle 401
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('jwt_token');
            localStorage.removeItem('user');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// ═══════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════

export const login = (email, password) =>
    api.post('/auth/login', { email, password });

export const refreshToken = () =>
    api.post('/auth/refresh');

export const getMe = () =>
    api.get('/auth/me');

export const changePassword = (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword });

// ═══════════════════════════════════════════════════════════════
// VIDEOS
// ═══════════════════════════════════════════════════════════════

export const getVideos = (page = 0, size = 20) =>
    api.get('/videos', { params: { page, size } });

export const getVideo = (id) =>
    api.get(`/videos/${id}`);

export const searchVideos = (query, page = 0, size = 20) =>
    api.get('/videos/search', { params: { query, page, size } });

export const updateVideo = (id, data) =>
    api.put(`/videos/${id}`, data);

export const deleteVideo = (id) =>
    api.delete(`/videos/${id}`);

export const setVideoPrivacy = (id, privacySettings) =>
    api.post(`/videos/${id}/privacy`, privacySettings);

export const getVideoSuggestions = (id, size = 10) =>
    api.get(`/videos/${id}/suggestions`, { params: { size } });

// ═══════════════════════════════════════════════════════════════
// INTERACTIONS
// ═══════════════════════════════════════════════════════════════

export const incrementView = (id) =>
    api.post(`/videos/${id}/view`);

export const toggleLike = (id) =>
    api.post(`/videos/${id}/like`);

export const removeLike = (id) =>
    api.delete(`/videos/${id}/like`);

export const getLikeStatus = (id) =>
    api.get(`/videos/${id}/like-status`);

export const getComments = (videoId, page = 0, size = 20) =>
    api.get(`/videos/${videoId}/comments`, { params: { page, size } });

export const addComment = (videoId, text) =>
    api.post(`/videos/${videoId}/comments`, { text });

export const deleteComment = (videoId, commentId) =>
    api.delete(`/videos/${videoId}/comments/${commentId}`);

// ═══════════════════════════════════════════════════════════════
// UPLOAD
// ═══════════════════════════════════════════════════════════════

export const initUpload = (filename, title, description, totalSize, totalChunks) =>
    api.post('/upload/init', null, {
        params: { filename, title, description, totalSize, totalChunks }
    });

export const uploadChunk = (formData, onProgress) =>
    api.post('/upload/chunk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: onProgress
    });

export const completeUpload = (videoId) =>
    api.post('/upload/complete', null, { params: { videoId } });

export const getUploadStatus = (videoId) =>
    api.get(`/upload/status/${videoId}`);

export const uploadThumbnail = (videoId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/videos/${videoId}/thumbnail`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
};

// ═══════════════════════════════════════════════════════════════
// ADMIN - USER MANAGEMENT (super-admin only)
// ═══════════════════════════════════════════════════════════════

export const adminGetUsers = () =>
    api.get('/admin/users');

export const adminGetUser = (id) =>
    api.get(`/admin/users/${id}`);

export const adminCreateUser = (data) =>
    api.post('/admin/users', data);

export const adminUpdateUser = (id, data) =>
    api.put(`/admin/users/${id}`, data);

export const adminDeleteUser = (id) =>
    api.delete(`/admin/users/${id}`);

export const adminResetPassword = (id, newPassword) =>
    api.post(`/admin/users/${id}/password`, { newPassword });

// ═══════════════════════════════════════════════════════════════
// ADMIN - ROLES (super-admin only)
// ═══════════════════════════════════════════════════════════════

export const adminGetRoles = () =>
    api.get('/admin/roles');

export const adminGetRole = (id) =>
    api.get(`/admin/roles/${id}`);

// ═══════════════════════════════════════════════════════════════
// SHARE
// ═══════════════════════════════════════════════════════════════

export const getShareUrl = (id) =>
    api.get(`/videos/${id}/share`);

export default api;