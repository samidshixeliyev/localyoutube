import api from './api';

// Video service for all video-related API calls
const videoService = {
  // Get all public videos with pagination
  getPublicVideos: async (page = 0, size = 12) => {
    try {
      console.log('[VideoService] Fetching public videos:', { page, size });
      const response = await api.get('/videos/public', {
        params: { page, size }
      });
      
      // Handle different response formats
      // Backend might return: { content: [...] } or just [...]
      const videos = response.data.content || response.data || [];
      console.log('[VideoService] Public videos loaded:', videos.length);
      return videos;
    } catch (error) {
      console.error('[VideoService] Error fetching public videos:', error);
      throw error;
    }
  },

  // Get single video by ID
  getVideoById: async (id) => {
    try {
      console.log('[VideoService] Fetching video:', id);
      const response = await api.get(`/videos/${id}`);
      return response.data;
    } catch (error) {
      console.error('[VideoService] Error fetching video:', error);
      throw error;
    }
  },

  // Get current user's videos
  getMyVideos: async () => {
    try {
      console.log('[VideoService] Fetching my videos');
      const response = await api.get('/videos/my');
      const videos = response.data.content || response.data || [];
      console.log('[VideoService] My videos loaded:', videos.length);
      return videos;
    } catch (error) {
      console.error('[VideoService] Error fetching my videos:', error);
      throw error;
    }
  },

  // Search videos
  searchVideos: async (query, page = 0, size = 12) => {
    try {
      console.log('[VideoService] Searching videos:', { query, page, size });
      const response = await api.get('/videos/search', {
        params: { query, page, size }
      });
      const videos = response.data.content || response.data || [];
      console.log('[VideoService] Search results:', videos.length);
      return videos;
    } catch (error) {
      console.error('[VideoService] Error searching videos:', error);
      throw error;
    }
  },

  // Upload new video
  uploadVideo: async (formData, onProgress) => {
    try {
      console.log('[VideoService] Uploading video');
      const response = await api.post('/videos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(percentCompleted);
          }
        },
      });
      console.log('[VideoService] Video uploaded successfully');
      return response.data;
    } catch (error) {
      console.error('[VideoService] Error uploading video:', error);
      throw error;
    }
  },

  // Update video details
  updateVideo: async (id, videoData) => {
    try {
      console.log('[VideoService] Updating video:', id, videoData);
      const response = await api.put(`/videos/${id}`, videoData);
      console.log('[VideoService] Video updated successfully');
      return response.data;
    } catch (error) {
      console.error('[VideoService] Error updating video:', error);
      throw error;
    }
  },

  // Delete video
  deleteVideo: async (id) => {
    try {
      console.log('[VideoService] Deleting video:', id);
      const response = await api.delete(`/videos/${id}`);
      console.log('[VideoService] Video deleted successfully');
      return response.data;
    } catch (error) {
      console.error('[VideoService] Error deleting video:', error);
      throw error;
    }
  },

  // Upload thumbnail
  uploadThumbnail: async (videoId, thumbnailFile) => {
    try {
      console.log('[VideoService] Uploading thumbnail for video:', videoId);
      const formData = new FormData();
      formData.append('thumbnail', thumbnailFile);
      
      const response = await api.post(`/videos/${videoId}/thumbnail`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log('[VideoService] Thumbnail uploaded successfully');
      return response.data;
    } catch (error) {
      console.error('[VideoService] Error uploading thumbnail:', error);
      throw error;
    }
  },

  // Like video
  likeVideo: async (id) => {
    try {
      console.log('[VideoService] Liking video:', id);
      const response = await api.post(`/videos/${id}/like`);
      return response.data;
    } catch (error) {
      console.error('[VideoService] Error liking video:', error);
      throw error;
    }
  },

  // Unlike video
  unlikeVideo: async (id) => {
    try {
      console.log('[VideoService] Unliking video:', id);
      const response = await api.delete(`/videos/${id}/like`);
      return response.data;
    } catch (error) {
      console.error('[VideoService] Error unliking video:', error);
      throw error;
    }
  },

  // Get HLS URL for video
  // With Vite proxy, use relative URL
  getHlsUrl: (videoId) => {
    return `/hls/${videoId}/master.m3u8`;
  },

  // Get thumbnail URL
  // With Vite proxy, use relative URL
  getThumbnailUrl: (thumbnailPath) => {
    if (!thumbnailPath) return null;
    // If it's already a full URL, return as is
    if (thumbnailPath.startsWith('http')) return thumbnailPath;
    // Otherwise, use proxy path
    return `/thumbnails/${thumbnailPath}`;
  },

  // Get download URL
  getDownloadUrl: (videoId, quality = 'original') => {
    return `/api/videos/${videoId}/download?quality=${quality}`;
  },
};

export default videoService;