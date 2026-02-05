import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Eye, ThumbsUp, Clock } from 'lucide-react';

const VideoCard = ({ video }) => {
  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatViews = (views) => {
    if (!views) return '0 views';
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M views`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K views`;
    return `${views} views`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
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

  const getThumbnail = () => {
    if (video.thumbnailUrl) {
      return video.thumbnailUrl;
    }
    // Placeholder thumbnail
    return `https://via.placeholder.com/320x180/0ea5e9/ffffff?text=${encodeURIComponent(video.title?.substring(0, 20) || 'Video')}`;
  };

  return (
    <Link to={`/video/${video.id}`} className="group">
      <div className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300">
        {/* Thumbnail */}
        <div className="relative aspect-video bg-gray-200 overflow-hidden">
          <img
            src={getThumbnail()}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              e.target.src = `https://via.placeholder.com/320x180/0ea5e9/ffffff?text=${encodeURIComponent(video.title?.substring(0, 20) || 'Video')}`;
            }}
          />
          
          {/* Play overlay */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
            <Play className="h-12 w-12 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" fill="white" />
          </div>

          {/* Duration badge */}
          {video.duration && (
            <div className="absolute bottom-2 right-2 bg-black bg-opacity-80 text-white text-xs px-2 py-1 rounded flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>{formatDuration(video.duration)}</span>
            </div>
          )}

          {/* Status badge */}
          {video.status && video.status !== 'ready' && (
            <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded font-medium">
              {video.status.toUpperCase()}
            </div>
          )}
        </div>

        {/* Video Info */}
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2 group-hover:text-primary-600 transition-colors">
            {video.title || 'Untitled Video'}
          </h3>
          
          {video.uploaderName && (
            <p className="text-sm text-gray-600 mb-2">{video.uploaderName}</p>
          )}

          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <div className="flex items-center space-x-1">
              <Eye className="h-4 w-4" />
              <span>{formatViews(video.views)}</span>
            </div>
            
            {video.likes > 0 && (
              <div className="flex items-center space-x-1">
                <ThumbsUp className="h-4 w-4" />
                <span>{video.likes}</span>
              </div>
            )}
            
            {video.uploadedAt && (
              <span>{formatDate(video.uploadedAt)}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default VideoCard;
