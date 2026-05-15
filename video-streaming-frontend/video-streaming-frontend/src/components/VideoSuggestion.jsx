import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getVideoSuggestions, getVideos } from '../services/api';
import { Play } from 'lucide-react';

/* ── helpers ──────────────────────────────────────────────────────── */
const fmtViews = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
};
const fmtDur = (s) => {
  if (!s) return null;
  const m = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, '0');
  return `${m}:${sec}`;
};
const fmtAge = (ts) => {
  if (!ts) return '';
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days < 1)   return 'Bu gün';
  if (days < 7)   return `${days} gün əvvəl`;
  if (days < 30)  return `${Math.floor(days / 7)} həftə əvvəl`;
  if (days < 365) return `${Math.floor(days / 30)} ay əvvəl`;
  return `${Math.floor(days / 365)} il əvvəl`;
};

/* ── Single suggestion card — YouTube sidebar style ─────────────── */
const SuggestionCard = ({ video }) => {
  const dur = fmtDur(video.durationSeconds);

  return (
    <Link
      to={`/video/${video.id}`}
      className="flex gap-2 rounded-lg overflow-hidden hover:bg-gray-100 dark:hover:bg-army-700/60 transition-colors group p-1"
    >
      {/* Thumbnail */}
      <div className="relative flex-shrink-0 w-40 h-[90px] rounded-md overflow-hidden bg-army-900">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-army-800">
            <Play className="h-7 w-7 text-primary-500/60" />
          </div>
        )}
        {dur && (
          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
            {dur}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 py-0.5 pr-1">
        <h4 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug mb-1
                       group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {video.title}
        </h4>
        {video.uploaderName && (
          <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate">
            {video.uploaderName}
          </p>
        )}
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
          {fmtViews(video.views)} baxış
          {video.uploadedAt ? ` · ${fmtAge(video.uploadedAt)}` : ''}
        </p>
      </div>
    </Link>
  );
};

/* ── Skeleton while loading ─────────────────────────────────────── */
const SkeletonCard = () => (
  <div className="flex gap-2 p-1 animate-pulse">
    <div className="flex-shrink-0 w-40 h-[90px] bg-gray-200 dark:bg-army-700 rounded-md" />
    <div className="flex-1 py-1 space-y-2">
      <div className="h-3 bg-gray-200 dark:bg-army-700 rounded w-full" />
      <div className="h-3 bg-gray-200 dark:bg-army-700 rounded w-3/4" />
      <div className="h-3 bg-gray-200 dark:bg-army-700 rounded w-1/2" />
    </div>
  </div>
);

/* ── Main component ─────────────────────────────────────────────── */
const VideoSuggestions = ({ videoId, tags, onNextVideoReady }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        // Try tag-based suggestions first
        if (tags && tags.length > 0) {
          const res = await getVideoSuggestions(videoId, 15);
          const data = Array.isArray(res.data?.videos)   ? res.data.videos
                     : Array.isArray(res.data?.content)  ? res.data.content
                     : Array.isArray(res.data)           ? res.data : [];
          const filtered = data.filter(v => v.id !== videoId);
          if (!cancelled && filtered.length > 0) {
            setSuggestions(filtered);
            if (onNextVideoReady && filtered.length > 0) onNextVideoReady(filtered[0]);
            return;
          }
        }

        // Fallback: latest videos
        const res = await getVideos(0, 15);
        const data = Array.isArray(res.data?.videos)   ? res.data.videos
                   : Array.isArray(res.data?.content)  ? res.data.content
                   : Array.isArray(res.data)           ? res.data : [];
        if (!cancelled) {
          const filtered = data.filter(v => v.id !== videoId);
          setSuggestions(filtered);
          if (onNextVideoReady && filtered.length > 0) onNextVideoReady(filtered[0]);
        }
      } catch {
        /* silent fail */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [videoId, tags]);

  return (
    <div>
      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2 px-1">
        Digər videolar
      </h3>

      {loading && (
        <div className="space-y-1">
          {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {!loading && suggestions.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
          Video tapılmadı
        </p>
      )}

      {!loading && suggestions.length > 0 && (
        <div className="space-y-0.5">
          {suggestions.map(v => <SuggestionCard key={v.id} video={v} />)}
        </div>
      )}
    </div>
  );
};

export default VideoSuggestions;
