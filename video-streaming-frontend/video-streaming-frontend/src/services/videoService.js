import api from './api';

export const videoService = {
  // Get all videos with pagination
  getVideos: async (page = 0, size = 20) => {
    const response = await api.get(`/videos?page=${page}&size=${size}`);
    return response.data;
  },

  // Search videos
  searchVideos: async (query, page = 0, size = 20) => {
    const response = await api.get(`/videos/search?query=${query}&page=${page}&size=${size}`);
    return response.data;
  },

  // Get single video
  getVideo: async (id) => {
    const response = await api.get(`/videos/${id}`);
    return response.data;
  },

  // Increment view count
  incrementView: async (id) => {
    const response = await api.post(`/videos/${id}/view`);
    return response.data;
  },

  // Like video
  likeVideo: async (id) => {
    const response = await api.post(`/videos/${id}/like`);
    return response.data;
  },

  // Unlike video
  unlikeVideo: async (id) => {
    const response = await api.delete(`/videos/${id}/like`);
    return response.data;
  },

  // Delete video
  deleteVideo: async (id) => {
    const response = await api.delete(`/videos/${id}`);
    return response.data;
  },

  // Upload related endpoints
  initUpload: async (filename, title, description, totalSize, totalChunks) => {
    const response = await api.post('/upload/init', null, {
      params: { filename, title, description, totalSize, totalChunks }
    });
    return response.data;
  },

  uploadChunk: async (file, chunkIndex, totalChunks, videoId) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/upload/chunk', formData, {
      params: { chunkIndex, totalChunks, videoId },
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  completeUpload: async (videoId, totalChunks) => {
    const response = await api.post('/upload/complete', null, {
      params: { videoId, totalChunks }
    });
    return response.data;
  },

  // Get my uploaded videos
  getMyVideos: async () => {
    const response = await api.get('/upload/videos');
    return response.data;
  }
};