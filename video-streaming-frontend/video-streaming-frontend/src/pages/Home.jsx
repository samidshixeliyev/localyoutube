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

  useEffect(() => { loadVideos(); }, [page]);

  const loadVideos = async () => {
    try {
      setLoading(true);
      const data = await videoService.getPublicVideos(page, 12);
      if (page === 0) setVideos(data);
      else setVideos(prev => [...prev, ...data]);
      setHasMore(data.length === 12);
      setError('');
    } catch (err) {
      setError('Failed to load videos. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const formatViews = (v) => {
    if (!v) return '0 views';
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M views`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K views`;
    return `${v} views`;
  };

  const formatDuration = (s) => {
    if (!s) return '0:00';
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const formatDate = (ts) => {
    if (!ts) return '';
    const d = Math.floor((Date.now() - new Date(ts)) / 86400000);
    if (d === 0) return 'Today';
    if (d === 1) return 'Yesterday';
    if (d < 7) return `${d} days ago`;
    if (d < 30) return `${Math.floor(d / 7)} weeks ago`;
    if (d < 365) return `${Math.floor(d / 30)} months ago`;
    return `${Math.floor(d / 365)} years ago`;
  };

  if (loading && page === 0) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600" />
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">
          Videoları kəşf et
        </h1>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {videos.length === 0 && !loading ? (
          <div className="text-center py-12">
            <Play className="h-16 w-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Hələki video yoxdur</h3>
            <p className="text-gray-600 dark:text-gray-400">İlk videonu sən yüklə!</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {videos.map((video) => (
                <Link key={video.id} to={`/video/${video.id}`} className="group">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-none dark:border dark:border-gray-700 overflow-hidden hover:shadow-xl dark:hover:border-gray-600 transition-all duration-300">
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
                      {video.duration && (
                        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatDuration(video.duration)}</span>
                        </div>
                      )}
                      {video.status !== 'ready' && (
                        <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded font-medium">
                          {video.status === 'processing' ? 'Processing…' : 'Uploading…'}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {video.title}
                      </h3>
                      {video.uploaderName && (
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-2">
                          <span className="truncate">{video.uploaderName}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-500">
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

            {hasMore && (
              <div className="text-center mt-8">
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={loading}
                  className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <span className="flex items-center gap-2 justify-center">
                      <Loader2 className="h-5 w-5 animate-spin" /> Yüklənir...
                    </span>
                  ) : 'Load More'}
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
