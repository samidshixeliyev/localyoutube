import api from './api';

export const videoService = {
  // Get public videos for home page
  async getPublicVideos(page = 0, size = 12) {
    try {
      const response = await api.get(`/videos/public?page=${page}&size=${size}`);
      return response.data.content || response.data || [];
    } catch (error) {
      console.error('[videoService] Failed to load public videos:', error);
      throw error;
    }
  },

  // Get single video by ID
  async getVideo(id) {
    try {
      const response = await api.get(`/videos/${id}`);
      return response.data;
    } catch (error) {
      console.error('[videoService] Failed to load video:', error);
      throw error;
    }
  },

  // Search videos
  async searchVideos(query, page = 0, size = 12) {
    try {
      const response = await api.get(`/videos/search?q=${encodeURIComponent(query)}&page=${page}&size=${size}`);
      return response.data.content || response.data || [];
    } catch (error) {
      console.error('[videoService] Search failed:', error);
      throw error;
    }
  },

  // Get user's videos
  async getMyVideos(page = 0, size = 12) {
    try {
      const response = await api.get(`/videos/my?page=${page}&size=${size}`);
      return response.data.content || response.data || [];
    } catch (error) {
      console.error('[videoService] Failed to load my videos:', error);
      throw error;
    }
  },

  // Upload video
  async uploadVideo(formData, onProgress) {
    try {
      const response = await api.post('/videos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(percentCompleted);
          }
        },
      });
      return response.data;
    } catch (error) {
      console.error('[videoService] Upload failed:', error);
      throw error;
    }
  },

  // Update video
  async updateVideo(id, data) {
    try {
      const response = await api.put(`/videos/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('[videoService] Update failed:', error);
      throw error;
    }
  },

  // Delete video
  async deleteVideo(id) {
    try {
      const response = await api.delete(`/videos/${id}`);
      return response.data;
    } catch (error) {
      console.error('[videoService] Delete failed:', error);
      throw error;
    }
  },

  // Update video privacy
  async updatePrivacy(id, privacyData) {
    try {
      const response = await api.post(`/videos/${id}/privacy`, privacyData);
      return response.data;
    } catch (error) {
      console.error('[videoService] Privacy update failed:', error);
      throw error;
    }
  },

  // Increment view count
  async incrementView(id) {
    try {
      const response = await api.post(`/videos/${id}/view`);
      return response.data;
    } catch (error) {
      console.error('[videoService] View increment failed:', error);
      // Don't throw - view count is not critical
      return null;
    }
  },

  // Toggle like
  async toggleLike(id) {
    try {
      const response = await api.post(`/videos/${id}/like`);
      return response.data;
    } catch (error) {
      console.error('[videoService] Like toggle failed:', error);
      throw error;
    }
  },

  // Get like status
  async getLikeStatus(id) {
    try {
      const response = await api.get(`/videos/${id}/like-status`);
      return response.data;
    } catch (error) {
      console.error('[videoService] Like status check failed:', error);
      // Return default if fails
      return { liked: false };
    }
  },

  // Upload thumbnail
  async uploadThumbnail(id, file) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post(`/videos/${id}/thumbnail`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('[videoService] Thumbnail upload failed:', error);
      throw error;
    }
  },
};