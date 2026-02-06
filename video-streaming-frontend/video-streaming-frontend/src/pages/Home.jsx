import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import videoService from '../services/videoService';
import Navbar from '../components/Navbar';
import { Play, Eye, Clock, Loader2 } from 'lucide-react';

const Home = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadVideos();
  }, [page]);

  const loadVideos = async () => {
    try {
      setLoading(true);
      const data = await videoService.getPublicVideos(page, 12);
      
      // CRITICAL: Filter out unlisted videos on frontend as backup
      const publicOnly = data.filter(video => 
        !video.visibility || video.visibility === 'public'
      );
      
      if (page === 0) {
        setVideos(publicOnly);
      } else {
        setVideos(prev => [...prev, ...publicOnly]);
      }
      
      setHasMore(publicOnly.length === 12);
      setError('');
    } catch (err) {
      setError('Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const formatViews = (views) => {
    if (!views) return '0 views';
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M views`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K views`;
    return `${views} views`;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  if (loading && page === 0) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600" />
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Discover Videos
        </h1>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {videos.length === 0 && !loading ? (
          <div className="text-center py-12">
            <Play className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No videos yet
            </h3>
            <p className="text-gray-600">
              Be the first to upload a video!
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {videos.map((video) => (
                <Link
                  key={video.id}
                  to={`/video/${video.id}`}
                  className="group"
                >
                  <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-gray-900 overflow-hidden">
                      {video.thumbnailUrl ? (
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="h-12 w-12 text-gray-600" />
                        </div>
                      )}
                      
                      {/* Duration Badge */}
                      {video.duration && (
                        <div className="absolute bottom-2 right-2 bg-black bg-opacity-80 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatDuration(video.duration)}</span>
                        </div>
                      )}

                      {/* Status Badge */}
                      {video.status !== 'ready' && (
                        <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded font-medium">
                          {video.status === 'processing' ? 'Processing...' : 'Uploading...'}
                        </div>
                      )}
                    </div>

                    {/* Video Info */}
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-primary-600 transition-colors">
                        {video.title}
                      </h3>
                      
                      <div className="flex items-center text-sm text-gray-600 mb-2">
                        {video.uploaderName && (
                          <span className="truncate">{video.uploaderName}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          <span>{formatViews(video.views)}</span>
                        </div>
                        <span>•</span>
                        <span>{formatDate(video.uploadedAt)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="text-center mt-8">
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={loading}
                  className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    'Load More'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default Home;