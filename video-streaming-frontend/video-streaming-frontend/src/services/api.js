import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const api = axios.create({
    baseURL: API_BASE,
    timeout: 30000,
});

// Request interceptor - attach JWT
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
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
            localStorage.removeItem('token');
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
    api.post('/api/auth/login', { email, password });

export const refreshToken = () =>
    api.post('/api/auth/refresh');

export const getMe = () =>
    api.get('/api/auth/me');

export const changePassword = (currentPassword, newPassword) =>
    api.post('/api/auth/change-password', { currentPassword, newPassword });

// ═══════════════════════════════════════════════════════════════
// VIDEOS
// ═══════════════════════════════════════════════════════════════

export const getVideos = (page = 0, size = 20) =>
    api.get('/api/videos', { params: { page, size } });

export const getVideo = (id) =>
    api.get(`/api/videos/${id}`);

export const searchVideos = (query, page = 0, size = 20) =>
    api.get('/api/videos/search', { params: { query, page, size } });

export const updateVideo = (id, data) =>
    api.put(`/api/videos/${id}`, data);

export const deleteVideo = (id) =>
    api.delete(`/api/videos/${id}`);

export const setVideoPrivacy = (id, privacySettings) =>
    api.post(`/api/videos/${id}/privacy`, privacySettings);

export const getVideoSuggestions = (id, size = 10) =>
    api.get(`/api/videos/${id}/suggestions`, { params: { size } });

// ═══════════════════════════════════════════════════════════════
// INTERACTIONS
// ═══════════════════════════════════════════════════════════════

export const incrementView = (id) =>
    api.post(`/api/videos/${id}/view`);

export const toggleLike = (id) =>
    api.post(`/api/videos/${id}/like`);

export const removeLike = (id) =>
    api.delete(`/api/videos/${id}/like`);

export const getLikeStatus = (id) =>
    api.get(`/api/videos/${id}/like-status`);

export const getComments = (videoId, page = 0, size = 20) =>
    api.get(`/api/videos/${videoId}/comments`, { params: { page, size } });

export const addComment = (videoId, text) =>
    api.post(`/api/videos/${videoId}/comments`, { text });

export const deleteComment = (videoId, commentId) =>
    api.delete(`/api/videos/${videoId}/comments/${commentId}`);

// ═══════════════════════════════════════════════════════════════
// UPLOAD
// ═══════════════════════════════════════════════════════════════

export const initUpload = (filename, title, description, totalSize, totalChunks) =>
    api.post('/api/upload/init', null, {
        params: { filename, title, description, totalSize, totalChunks }
    });

export const uploadChunk = (formData, onProgress) =>
    api.post('/api/upload/chunk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: onProgress
    });

export const completeUpload = (videoId) =>
    api.post('/api/upload/complete', null, { params: { videoId } });

export const getUploadStatus = (videoId) =>
    api.get(`/api/upload/status/${videoId}`);

export const uploadThumbnail = (videoId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/api/videos/${videoId}/thumbnail`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
};

// ═══════════════════════════════════════════════════════════════
// ADMIN - USER MANAGEMENT (super-admin only)
// ═══════════════════════════════════════════════════════════════

export const adminGetUsers = () =>
    api.get('/api/admin/users');

export const adminGetUser = (id) =>
    api.get(`/api/admin/users/${id}`);

export const adminCreateUser = (data) =>
    api.post('/api/admin/users', data);

export const adminUpdateUser = (id, data) =>
    api.put(`/api/admin/users/${id}`, data);

export const adminDeleteUser = (id) =>
    api.delete(`/api/admin/users/${id}`);

export const adminResetPassword = (id, newPassword) =>
    api.post(`/api/admin/users/${id}/password`, { newPassword });

// ═══════════════════════════════════════════════════════════════
// ADMIN - ROLES (super-admin only)
// ═══════════════════════════════════════════════════════════════

export const adminGetRoles = () =>
    api.get('/api/admin/roles');

export const adminGetRole = (id) =>
    api.get(`/api/admin/roles/${id}`);

// ═══════════════════════════════════════════════════════════════
// SHARE
// ═══════════════════════════════════════════════════════════════

export const getShareUrl = (id) =>
    api.get(`/api/videos/${id}/share`);

export default api;