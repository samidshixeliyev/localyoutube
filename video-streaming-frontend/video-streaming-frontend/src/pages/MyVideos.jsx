import React, { useEffect, useState } from 'react';
import { videoService } from '../services/videoService';
import VideoCard from '../components/VideoCard';
import Navbar from '../components/Navbar';
import { Loader2, Upload as UploadIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

const MyVideos = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMyVideos();
  }, []);

  const loadMyVideos = async () => {
    try {
      setLoading(true);
      const data = await videoService.getMyVideos();
      setVideos(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      console.error('Error loading my videos:', err);
      setError('Failed to load your videos. Please try again.');
    } finally {
      setLoading(false);
    }
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

  if (error) {
    return (
      <>
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-screen">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadMyVideos}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Retry
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Videos</h1>
          <Link
            to="/upload"
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <UploadIcon className="h-5 w-5" />
            <span>Upload New</span>
          </Link>
        </div>

        {videos.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <UploadIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">No videos uploaded yet</p>
            <p className="text-gray-400 mb-6">Start sharing your content with the world!</p>
            <Link
              to="/upload"
              className="inline-flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <UploadIcon className="h-5 w-5" />
              <span>Upload Your First Video</span>
            </Link>
          </div>
        ) : (
          <>
            <p className="text-gray-600 mb-6">
              You have {videos.length} video{videos.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default MyVideos;
