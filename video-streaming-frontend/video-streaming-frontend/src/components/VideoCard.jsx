import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Eye, ThumbsUp, Clock, Lock, Link2 } from 'lucide-react';

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
    // Consistent placeholder with ModTube orange
    return `https://via.placeholder.com/320x180/f97316/ffffff?text=${encodeURIComponent(video.title?.substring(0, 15) || 'Video')}`;
  };

  const getVisibilityIcon = () => {
    switch (video.visibility) {
      case 'private':
        return <Lock className="h-3 w-3" />;
      case 'unlisted':
        return <Link2 className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getVisibilityColor = () => {
    switch (video.visibility) {
      case 'private':
        return 'bg-red-500';
      case 'unlisted':
        return 'bg-yellow-500';
      case 'restricted':
        return 'bg-purple-500';
      default:
        return null;
    }
  };

  return (
    <Link to={`/video/${video.id}`} className="group block">
      <div className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
        {/* Thumbnail - Fixed aspect ratio */}
        <div className="relative aspect-video bg-gradient-to-br from-orange-100 to-yellow-100 overflow-hidden">
          <img
            src={getThumbnail()}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            onError={(e) => {
              e.target.src = `https://via.placeholder.com/320x180/f97316/ffffff?text=${encodeURIComponent(video.title?.substring(0, 15) || 'Video')}`;
            }}
          />
          
          {/* Play overlay - Consistent animation */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
            <div className="bg-primary-500 rounded-full p-4 transform scale-75 group-hover:scale-100 transition-transform duration-300">
              <Play className="h-8 w-8 text-white" fill="white" />
            </div>
          </div>

          {/* Duration badge - Consistent style */}
          {video.duration && (
            <div className="absolute bottom-2 right-2 bg-black/90 backdrop-blur-sm text-white text-xs font-semibold px-2 py-1 rounded-md flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>{formatDuration(video.duration)}</span>
            </div>
          )}

          {/* Status badge - Top left */}
          {video.status && video.status !== 'ready' && (
            <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-md font-bold uppercase tracking-wide">
              {video.status}
            </div>
          )}

          {/* Visibility badge - Top right */}
          {video.visibility && video.visibility !== 'public' && (
            <div className={`absolute top-2 right-2 ${getVisibilityColor()} text-white text-xs px-2 py-1 rounded-md font-semibold flex items-center space-x-1 capitalize`}>
              {getVisibilityIcon()}
              <span>{video.visibility}</span>
            </div>
          )}
        </div>

        {/* Video Info - Consistent spacing and typography */}
        <div className="p-4">
          {/* Title - Consistent line clamp */}
          <h3 className="font-bold text-gray-900 line-clamp-2 mb-2 text-base leading-tight group-hover:text-primary-600 transition-colors min-h-[2.5rem]">
            {video.title || 'Untitled Video'}
          </h3>
          
          {/* Uploader - Consistent style */}
          {video.uploaderName && (
            <p className="text-sm text-gray-600 mb-3 truncate font-medium">
              {video.uploaderName}
            </p>
          )}

          {/* Stats - Consistent layout */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1">
                <Eye className="h-4 w-4 text-gray-400" />
                <span className="font-medium">{formatViews(video.views)}</span>
              </div>
              
              {video.likes > 0 && (
                <div className="flex items-center space-x-1">
                  <ThumbsUp className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">{video.likes}</span>
                </div>
              )}
            </div>
            
            {video.uploadedAt && (
              <span className="text-xs">{formatDate(video.uploadedAt)}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default VideoCard;