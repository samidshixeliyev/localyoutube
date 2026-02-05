import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { videoService } from '../services/videoService';
import VideoPlayer from '../components/VideoPlayer';
import Navbar from '../components/Navbar';
import { ThumbsUp, Eye, Calendar, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const VideoDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liked, setLiked] = useState(false);
  const [viewIncremented, setViewIncremented] = useState(false);

  useEffect(() => {
    loadVideo();
  }, [id]);

  const loadVideo = async () => {
    try {
      setLoading(true);
      const data = await videoService.getVideo(id);
      setVideo(data);
      setError('');
    } catch (err) {
      console.error('Error loading video:', err);
      setError('Failed to load video. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTimeUpdate = (currentTime) => {
    // Increment view after 3 seconds
    if (currentTime > 3 && !viewIncremented) {
      videoService.incrementView(id).catch(console.error);
      setViewIncremented(true);
      setVideo(prev => ({ ...prev, views: (prev.views || 0) + 1 }));
    }
  };

  const handleLike = async () => {
    try {
      if (liked) {
        await videoService.unlikeVideo(id);
        setLiked(false);
        setVideo(prev => ({ ...prev, likes: Math.max(0, (prev.likes || 0) - 1) }));
      } else {
        await videoService.likeVideo(id);
        setLiked(true);
        setVideo(prev => ({ ...prev, likes: (prev.likes || 0) + 1 }));
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this video?')) {
      return;
    }

    try {
      await videoService.deleteVideo(id);
      navigate('/my-videos');
    } catch (err) {
      console.error('Error deleting video:', err);
      alert('Failed to delete video');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatViews = (views) => {
    if (!views) return '0 views';
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M views`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K views`;
    return `${views} views`;
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600" />
        </div>
      </>
    );
  }

  if (error || !video) {
    return (
      <>
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-screen">
          <p className="text-red-600 mb-4">{error || 'Video not found'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Go Home
          </button>
        </div>
      </>
    );
  }

  const canDelete = user && (user.id === video.uploaderId || user.username === video.uploaderName);

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2">
            {/* Video Player */}
            <div className="bg-black rounded-lg overflow-hidden mb-6">
              {video.hlsUrl && video.status === 'ready' ? (
                <VideoPlayer
                  hlsUrl={video.hlsUrl}
                  onTimeUpdate={handleTimeUpdate}
                />
              ) : (
                <div className="aspect-video flex items-center justify-center bg-gray-900">
                  <div className="text-center text-white">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
                    <p className="text-lg">
                      {video.status === 'processing'
                        ? 'Video is being processed...'
                        : 'Video not available'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Video Info */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                {video.title}
              </h1>

              {/* Stats and Actions */}
              <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
                <div className="flex items-center space-x-6 text-gray-600">
                  <div className="flex items-center space-x-2">
                    <Eye className="h-5 w-5" />
                    <span>{formatViews(video.views)}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5" />
                    <span>{formatDate(video.uploadedAt)}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleLike}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      liked
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <ThumbsUp className="h-5 w-5" />
                    <span>{video.likes || 0}</span>
                  </button>

                  {canDelete && (
                    <button
                      onClick={handleDelete}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="h-5 w-5" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Uploader */}
              {video.uploaderName && (
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {video.uploaderName.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-900">
                      {video.uploaderName}
                    </span>
                  </div>
                </div>
              )}

              {/* Description */}
              {video.description && (
                <div>
                  <h2 className="font-semibold text-gray-900 mb-2">Description</h2>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {video.description}
                  </p>
                </div>
              )}

              {/* Video Details */}
              {(video.width || video.height || video.duration) && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h2 className="font-semibold text-gray-900 mb-3">Details</h2>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {video.width && video.height && (
                      <div>
                        <span className="text-gray-500">Resolution:</span>
                        <span className="ml-2 text-gray-900">
                          {video.width}x{video.height}
                        </span>
                      </div>
                    )}
                    {video.duration && (
                      <div>
                        <span className="text-gray-500">Duration:</span>
                        <span className="ml-2 text-gray-900">
                          {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                    )}
                    {video.qualities && video.qualities.length > 0 && (
                      <div>
                        <span className="text-gray-500">Qualities:</span>
                        <span className="ml-2 text-gray-900">
                          {video.qualities.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Related videos placeholder */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Related Videos</h2>
              <p className="text-gray-500 text-sm">Coming soon...</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default VideoDetail;
