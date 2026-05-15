import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const VISIBILITY_BADGES = {
    public:     { label: 'İctimai',   classes: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' },
    restricted: { label: 'Məhdud',    classes: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800' },
    private:    { label: 'Gizli',     classes: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' },
    unlisted:   { label: 'Siyahısız', classes: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-army-700 dark:text-gray-400 dark:border-army-600' },
};

/** Renders text with `query` substrings wrapped in a highlight span */
function HighlightText({ text, query }) {
    if (!query || !text) return <>{text}</>;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase()
                    ? <mark key={i} className="bg-primary-200 dark:bg-primary-700/60 text-primary-900 dark:text-primary-100 rounded px-0.5 not-italic">{part}</mark>
                    : part
            )}
        </>
    );
}

const VideoCard = ({ video, highlight }) => {
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
        if (!views) return '0 baxış';
        if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M baxış';
        if (views >= 1000) return (views / 1000).toFixed(1) + 'K baxış';
        return views + ' baxış';
    };

    const formatTimeAgo = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days === 0) return 'Bu gün';
        if (days === 1) return 'Dünən';
        if (days < 7) return `${days} gün əvvəl`;
        if (days < 30) return `${Math.floor(days / 7)} həftə əvvəl`;
        if (days < 365) return `${Math.floor(days / 30)} ay əvvəl`;
        return `${Math.floor(days / 365)} il əvvəl`;
    };

    const visibility = video.visibility || 'public';
    const badge = VISIBILITY_BADGES[visibility] || VISIBILITY_BADGES.public;

    return (
        <Link
            to={`/video/${video.id}`}
            className="block rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg bg-white dark:bg-army-800 border border-transparent dark:border-army-700 group"
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

                {video.isShorts && (
                    <span className="absolute top-1.5 right-1.5 bg-primary-600 text-white text-xs px-1.5 py-0.5 rounded font-bold">
                        SHORTS
                    </span>
                )}

                {video.duration && (
                    <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                        {formatDuration(video.duration)}
                    </span>
                )}

                {isSuperAdmin && (
                    <span className={`absolute top-1.5 left-1.5 text-xs px-2 py-0.5 rounded-md font-semibold border ${badge.classes}`}>
                        {badge.label}
                    </span>
                )}
            </div>

            {/* Info */}
            <div className="p-3">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug">
                    <HighlightText text={video.title} query={highlight} />
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                    <HighlightText text={video.uploaderName || 'Naməlum'} query={highlight} />
                </p>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mt-1">
                    <span>{formatViews(video.views)}</span>
                    <span>•</span>
                    <span>{formatTimeAgo(video.uploadedAt)}</span>
                </div>
            </div>
        </Link>
    );
};

export default VideoCard;
