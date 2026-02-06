import api from './api';

const videoService = {
  // Get all videos with pagination
  getPublicVideos: async (page = 0, size = 12) => {
    try {
      // ✅ FIXED: Correct endpoint with  prefix
      const response = await api.get('/videos', {
        params: { page, size }
      });
      return response.data.videos || [];
    } catch (error) {
      console.error('[VideoService] Error fetching videos:', error);
      throw error;
    }
  },

  getVideoById: async (id) => {
    try {
      const response = await api.get(`/videos/${id}`);
      return response.data;
    } catch (error) {
      console.error('[VideoService] Error fetching video:', error);
      throw error;
    }
  },

  getVideo: async (id) => {
    return await videoService.getVideoById(id);
  },

  // Get my videos
  getMyVideos: async () => {
    try {
      const response = await api.get('/upload/videos');
      return response.data || [];
    } catch (error) {
      console.error('[VideoService] Error fetching my videos:', error);
      throw error;
    }
  },

  searchVideos: async (query, page = 0, size = 12) => {
    try {
      const response = await api.get('/videos/search', {
        params: { query, page, size }
      });
      const result = response.data.content || response.data || [];
      return Array.isArray(result) ? { videos: result, total: result.length } : result;
    } catch (error) {
      console.error('[VideoService] Error searching videos:', error);
      throw error;
    }
  },

  // ✅ FIXED: Use correct endpoints with  prefix
  initUpload: async (filename, title, description, fileSize, totalChunks) => {
    try {
      const response = await api.post('/upload/init', null, {
        params: { 
          filename, 
          title, 
          description, 
          totalSize: fileSize,
          totalChunks 
        }
      });
      return response.data;
    } catch (error) {
      console.error('[VideoService] Error initializing upload:', error);
      throw error;
    }
  },

  uploadChunk: async (chunk, chunkIndex, totalChunks, videoId) => {
    try {
      const formData = new FormData();
      formData.append('file', chunk);
      
      const response = await api.post('/upload/chunk', formData, {
        params: { chunkIndex, totalChunks, videoId },
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      return response.data;
    } catch (error) {
      console.error(`[VideoService] Error uploading chunk ${chunkIndex}:`, error);
      throw error;
    }
  },

  completeUpload: async (videoId, totalChunks) => {
    try {
      const response = await api.post('/upload/complete', null, {
        params: { videoId }
      });
      return response.data;
    } catch (error) {
      console.error('[VideoService] Error completing upload:', error);
      throw error;
    }
  },

  setPrivacy: async (videoId, privacySettings) => {
    try {
      const response = await api.post(`/videos/${videoId}/privacy`, privacySettings);
      return response.data;
    } catch (error) {
      console.error('[VideoService] Error setting privacy:', error);
      throw error;
    }
  },

  updateVideo: async (id, videoData) => {
    try {
      const response = await api.put(`/videos/${id}`, videoData);
      return response.data;
    } catch (error) {
      console.error('[VideoService] Error updating video:', error);
      throw error;
    }
  },

  deleteVideo: async (id) => {
    try {
      const response = await api.delete(`/videos/${id}`);
      return response.data;
    } catch (error) {
      console.error('[VideoService] Error deleting video:', error);
      throw error;
    }
  },

  uploadThumbnail: async (videoId, thumbnailFile) => {
    try {
      const formData = new FormData();
      formData.append('file', thumbnailFile);
      
      const response = await api.post(`/videos/${videoId}/thumbnail`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      console.error('[VideoService] Error uploading thumbnail:', error);
      throw error;
    }
  },

  incrementView: async (id) => {
    try {
      const response = await api.post(`/videos/${id}/view`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  toggleLike: async (id) => {
    try {
      const status = await videoService.getLikeStatus(id);
      if (status.liked) {
        const response = await api.delete(`/videos/${id}/like`);
        return { liked: false, likes: response.data.likes || 0 };
      } else {
        const response = await api.post(`/videos/${id}/like`);
        return { liked: true, likes: response.data.likes || 0 };
      }
    } catch (error) {
      console.error('[VideoService] Error toggling like:', error);
      throw error;
    }
  },

  getLikeStatus: async (id) => {
    try {
      const response = await api.get(`/videos/${id}/like-status`);
      return response.data;
    } catch (error) {
      return { liked: false };
    }
  },

  likeVideo: async (id) => {
    try {
      const response = await api.post(`/videos/${id}/like`);
      return response.data;
    } catch (error) {
      console.error('[VideoService] Error liking video:', error);
      throw error;
    }
  },

  unlikeVideo: async (id) => {
    try {
      const response = await api.delete(`/videos/${id}/like`);
      return response.data;
    } catch (error) {
      console.error('[VideoService] Error unliking video:', error);
      throw error;
    }
  },

  getHlsUrl: (videoId) => `/hls/${videoId}/master.m3u8`,
  getThumbnailUrl: (thumbnailPath) => {
    if (!thumbnailPath) return null;
    if (thumbnailPath.startsWith('http')) return thumbnailPath;
    return `/thumbnails/${thumbnailPath}`;
  },
  getDownloadUrl: (videoId, quality = 'original') => `/videos/${videoId}/download?quality=${quality}`,
};

export default videoService;