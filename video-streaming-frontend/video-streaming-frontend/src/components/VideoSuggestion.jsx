import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getVideoSuggestions, getVideos } from '../services/api';
import { Play } from 'lucide-react';

const fmtViews = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n/1_000).toFixed(1)}K`;
  return `${n}`;
};
const fmtDur = (s) => {
  if (!s) return '';
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
};

const SuggestionCard = ({ video }) => (
  <Link to={`/video/${video.id}`}
    className="flex gap-2.5 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-army-700 transition-colors group">
    <div className="relative w-36 h-[80px] bg-army-900 rounded-lg overflow-hidden flex-shrink-0">
      {video.thumbnailUrl ? (
        <img src={video.thumbnailUrl} alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-army-800">
          <Play className="h-6 w-6 text-primary-600/50" />
        </div>
      )}
      {video.durationSeconds && (
        <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded font-mono">
          {fmtDur(video.durationSeconds)}
        </span>
      )}
    </div>
    <div className="flex-1 min-w-0 py-0.5">
      <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug
                     group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
        {video.title}
      </h4>
      {video.uploaderName && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 truncate">{video.uploaderName}</p>
      )}
      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{fmtViews(video.views)} baxış</p>
    </div>
  </Link>
);

const SkeletonCard = () => (
  <div className="flex gap-2.5 p-2 animate-pulse">
    <div className="w-36 h-[80px] bg-gray-200 dark:bg-army-700 rounded-lg flex-shrink-0" />
    <div className="flex-1 py-1 space-y-2">
      <div className="h-3 bg-gray-200 dark:bg-army-700 rounded w-full" />
      <div className="h-3 bg-gray-200 dark:bg-army-700 rounded w-2/3" />
      <div className="h-3 bg-gray-200 dark:bg-army-700 rounded w-1/2" />
    </div>
  </div>
);

const VideoSuggestions = ({ videoId, tags }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        if (tags && tags.length > 0) {
          const res = await getVideoSuggestions(videoId, 12);
          const data = Array.isArray(res.data?.videos) ? res.data.videos
                     : Array.isArray(res.data?.content) ? res.data.content
                     : Array.isArray(res.data) ? res.data : [];
          if (!cancelled && data.length > 0) {
            setSuggestions(data.filter(v => v.id !== videoId));
            return;
          }
        }
        // Fallback: latest videos
        const res = await getVideos(0, 12);
        const data = Array.isArray(res.data?.videos) ? res.data.videos
                   : Array.isArray(res.data?.content) ? res.data.content
                   : Array.isArray(res.data) ? res.data : [];
        if (!cancelled) setSuggestions(data.filter(v => v.id !== videoId));
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    };

    load();
    return () => { cancelled = true; };
  }, [videoId, tags]);

  return (
    <div>
      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">Digər videolar</h3>
      {loading && <div className="space-y-1">{[1,2,3,4,5].map(i => <SkeletonCard key={i} />)}</div>}
      {!loading && suggestions.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">Video tapılmadı</p>
      )}
      {!loading && suggestions.length > 0 && (
        <div className="space-y-0.5">{suggestions.map(v => <SuggestionCard key={v.id} video={v} />)}</div>
      )}
    </div>
  );
};

export default VideoSuggestions;
