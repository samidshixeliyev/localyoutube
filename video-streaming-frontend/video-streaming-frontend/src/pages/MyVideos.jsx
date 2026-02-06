import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import  videoService  from '../services/videoService';
import VideoCard from '../components/VideoCard';
import Navbar from '../components/Navbar';
import { Loader2, Upload as UploadIcon } from 'lucide-react';

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
      setError('');
      const data = await videoService.getMyVideos();
      // Handle both array response and paginated response
      setVideos(Array.isArray(data) ? data : data.videos || []);
    } catch (err) {
      console.error('Error loading my videos:', err);
      setError('Failed to load your videos. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">My Videos</h1>

        {videos.length === 0 ? (
          <div className="text-center py-12">
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