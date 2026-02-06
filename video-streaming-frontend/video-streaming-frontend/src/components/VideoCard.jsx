import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const VISIBILITY_BADGES = {
    public: { label: 'Public', classes: 'bg-green-100 text-green-700 border-green-200' },
    restricted: { label: 'Restricted', classes: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    private: { label: 'Private', classes: 'bg-red-100 text-red-700 border-red-200' },
    unlisted: { label: 'Unlisted', classes: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const VideoCard = ({ video }) => {
    const { hasPermission } = useAuth();
    const isSuperAdmin = hasPermission('super-admin');

    const formatDuration = (seconds) => {
        if (!seconds) return '';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const formatViews = (views) => {
        if (!views) return '0 views';
        if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M views';
        if (views >= 1000) return (views / 1000).toFixed(1) + 'K views';
        return views + ' views';
    };

    const formatTimeAgo = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        if (days < 365) return `${Math.floor(days / 30)} months ago`;
        return `${Math.floor(days / 365)} years ago`;
    };

    const visibility = video.visibility || 'public';
    const badge = VISIBILITY_BADGES[visibility] || VISIBILITY_BADGES.public;

    return (
        <Link
            to={`/video/${video.id}`}
            className="block rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg bg-white group"
        >
            {/* Thumbnail */}
            <div className="relative w-full aspect-video bg-gray-900 overflow-hidden">
                {video.thumbnailUrl ? (
                    <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-3xl">
                        🎬
                    </div>
                )}

                {/* Duration */}
                {video.duration && (
                    <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                        {formatDuration(video.duration)}
                    </span>
                )}

                {/* Visibility Badge - Super Admin Only */}
                {isSuperAdmin && (
                    <span className={`absolute top-1.5 left-1.5 text-xs px-2 py-0.5 rounded-md font-semibold border ${badge.classes}`}>
                        {badge.label}
                    </span>
                )}
            </div>

            {/* Info */}
            <div className="p-3">
                <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
                    {video.title}
                </h3>
                <p className="text-xs text-gray-500 mt-1.5">
                    {video.uploaderName || 'Unknown'}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                    <span>{formatViews(video.views)}</span>
                    <span>•</span>
                    <span>{formatTimeAgo(video.uploadedAt)}</span>
                </div>
            </div>
        </Link>
    );
};

export default VideoCard;