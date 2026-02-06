import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getVideoSuggestions } from '../services/api';

const VideoSuggestions = ({ videoId, tags }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!videoId || !tags || tags.length === 0) {
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);

        getVideoSuggestions(videoId, 10)
            .then(res => {
                if (!cancelled) setSuggestions(res.data.videos || []);
            })
            .catch(err => console.error('Failed to load suggestions:', err))
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [videoId, tags]);

    const formatDuration = (seconds) => {
        if (!seconds) return '';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const formatViews = (views) => {
        if (!views) return '0 views';
        if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M views';
        if (views >= 1000) return (views / 1000).toFixed(1) + 'K views';
        return views + ' views';
    };

    if (loading) {
        return (
            <div>
                <h3 className="font-semibold text-gray-900 mb-3">Related Videos</h3>
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex gap-2 mb-3 animate-pulse">
                        <div className="w-40 h-[90px] bg-gray-200 rounded-md flex-shrink-0" />
                        <div className="flex-1">
                            <div className="h-3.5 bg-gray-200 rounded w-11/12 mb-2" />
                            <div className="h-3 bg-gray-200 rounded w-3/5" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (suggestions.length === 0) return null;

    return (
        <div>
            <h3 className="font-semibold text-gray-900 mb-3">Related Videos</h3>
            <div className="space-y-2.5">
                {suggestions.map(video => (
                    <Link
                        key={video.id}
                        to={`/video/${video.id}`}
                        className="flex gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors group"
                    >
                        {/* Thumbnail */}
                        <div className="relative w-40 h-[90px] bg-gray-900 rounded-md overflow-hidden flex-shrink-0">
                            {video.thumbnailUrl ? (
                                <img
                                    src={video.thumbnailUrl}
                                    alt={video.title}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500 text-xl">🎬</div>
                            )}
                            {video.duration && (
                                <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded font-medium">
                                    {formatDuration(video.duration)}
                                </span>
                            )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-medium text-gray-900 line-clamp-2 leading-snug group-hover:text-primary-600 transition-colors">
                                {video.title}
                            </h4>
                            <p className="text-[11px] text-gray-500 mt-1">{video.uploaderName || 'Unknown'}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{formatViews(video.views)}</p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default VideoSuggestions;