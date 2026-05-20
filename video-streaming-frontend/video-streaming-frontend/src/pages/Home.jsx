import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getVideos, getShorts } from '../services/api';
import Navbar from '../components/Navbar';
import { Play, Eye, Clock, Loader2, ChevronRight, Zap, Film, TrendingUp, Star } from 'lucide-react';

/* ─── helpers ─────────────────────────────────────────────────── */
const fmtViews = (v) => {
  if (!v) return '0';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return `${v}`;
};

const fmtDur = (s) => {
  if (!s) return '';
  const m = Math.floor(s / 60);
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
};

const fmtAge = (ts) => {
  if (!ts) return '';
  const d = Math.floor((Date.now() - new Date(ts)) / 86400000);
  if (d === 0)   return 'Bu gün';
  if (d === 1)   return 'Dünən';
  if (d < 7)     return `${d} gün əvvəl`;
  if (d < 30)    return `${Math.floor(d / 7)} həftə əvvəl`;
  if (d < 365)   return `${Math.floor(d / 30)} ay əvvəl`;
  return `${Math.floor(d / 365)} il əvvəl`;
};

/* ─── VideoCard ───────────────────────────────────────────────── */
function VideoCard({ video }) {
  return (
    <Link to={`/video/${video.id}`} className="group video-card block">
      <div className="army-card overflow-hidden hover:shadow-md dark:hover:border-primary-700/50 transition-all duration-200">
        {/* Thumbnail */}
        <div className="relative aspect-video bg-army-900 overflow-hidden">
          {video.thumbnailUrl ? (
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-army-800">
              <Play className="h-10 w-10 text-primary-600/50" />
            </div>
          )}
          {video.duration && (
            <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-mono">
              {fmtDur(video.duration)}
            </div>
          )}
          {video.isShort && (
            <div className="absolute top-1.5 left-1.5 bg-primary-600 text-white text-xs px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
              <Zap className="h-3 w-3" />Short
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 line-clamp-2
                         group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors leading-snug mb-1.5">
            {video.title}
          </h3>
          {video.uploaderName && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-1">{video.uploaderName}</p>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{fmtViews(video.views)}</span>
            <span>•</span>
            <span>{fmtAge(video.uploadedAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ─── ShortCard ───────────────────────────────────────────────── */
function ShortCard({ video }) {
  return (
    <Link to={`/video/${video.id}`} className="group flex-shrink-0 w-36">
      <div className="relative overflow-hidden rounded-xl bg-army-900 border border-army-700 group-hover:border-primary-600/50 transition-all duration-200"
           style={{ aspectRatio: '9/16' }}>
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt={video.title}
               className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Zap className="h-8 w-8 text-primary-500/50" />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute bottom-2 left-2 right-2">
          <p className="text-white text-xs font-medium line-clamp-2 leading-tight">{video.title}</p>
          <p className="text-white/60 text-xs mt-0.5 flex items-center gap-0.5">
            <Eye className="h-2.5 w-2.5" />{fmtViews(video.views)}
          </p>
        </div>
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-primary-600/80 rounded-full p-2.5">
            <Play className="h-5 w-5 text-white fill-white" />
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ─── SectionHeader ───────────────────────────────────────────── */
function SectionHeader({ icon: Icon, title, to, color = 'text-primary-600 dark:text-primary-400' }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="w-1 h-6 bg-primary-600 rounded-full" />
        <Icon className={`h-5 w-5 ${color}`} />
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 tracking-tight">{title}</h2>
      </div>
      {to && (
        <button onClick={() => navigate(to)}
          className="flex items-center gap-1 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
          Hamısına bax <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/* ─── FeaturedBanner ──────────────────────────────────────────── */
function FeaturedBanner({ video }) {
  if (!video) return null;
  return (
    <Link to={`/video/${video.id}`} className="group block relative overflow-hidden rounded-2xl">
      <div className="aspect-[21/9] bg-army-900">
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt={video.title}
               className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-army-800 to-primary-900">
            <Film className="h-20 w-20 text-primary-600/30" />
          </div>
        )}
      </div>
      {/* Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      {/* Label */}
      <div className="absolute top-4 left-4">
        <span className="inline-flex items-center gap-1.5 bg-primary-600 text-white text-xs font-bold px-3 py-1 rounded-full">
          <Star className="h-3 w-3" /> Seçilmiş
        </span>
      </div>
      {/* Info */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <h2 className="text-white text-xl sm:text-2xl font-black line-clamp-2 mb-2 drop-shadow-lg">{video.title}</h2>
        <div className="flex items-center gap-3 text-white/70 text-sm">
          {video.uploaderName && <span>{video.uploaderName}</span>}
          <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{fmtViews(video.views)} baxış</span>
          {video.duration && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{fmtDur(video.duration)}</span>}
        </div>
      </div>
      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-primary-600/90 rounded-full p-5 shadow-2xl">
          <Play className="h-8 w-8 text-white fill-white" />
        </div>
      </div>
    </Link>
  );
}

/* ─── StatBadge ───────────────────────────────────────────────── */
function StatBadge({ icon: Icon, label, value, color }) {
  return (
    <div className={`army-card px-4 py-3 flex items-center gap-3`}>
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</p>
        <p className="text-xl font-black text-gray-900 dark:text-gray-100">{value}</p>
      </div>
    </div>
  );
}

/* ─── Home page ───────────────────────────────────────────────── */
const Home = () => {
  const [videos, setVideos] = useState([]);
  const [shorts, setShorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef(null);
  const pageRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);

  const PAGE_SIZE = 12;

  const loadVideos = useCallback(async (p) => {
    try {
      p === 0 ? setLoading(true) : setLoadingMore(true);
      loadingMoreRef.current = true;
      const res = await getVideos(p, PAGE_SIZE);
      const data = Array.isArray(res.data?.videos) ? res.data.videos
                 : Array.isArray(res.data?.content) ? res.data.content
                 : Array.isArray(res.data) ? res.data : [];
      const totalPages = res.data?.totalPages ?? 1;
      if (p === 0) setVideos(data);
      else setVideos(prev => [...prev, ...data]);
      const more = p + 1 < totalPages && data.length > 0;
      setHasMore(more);
      hasMoreRef.current = more;
      setError('');
    } catch {
      setError('Videolar yüklənə bilmədi. Yenidən cəhd edin.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, []);

  useEffect(() => { loadVideos(0); }, [loadVideos]);

  useEffect(() => {
    getShorts(0, 10)
      .then(r => setShorts(Array.isArray(r.data?.videos) ? r.data.videos
                         : Array.isArray(r.data?.content) ? r.data.content
                         : Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreRef.current && !loadingMoreRef.current) {
        const next = pageRef.current + 1;
        pageRef.current = next;
        setPage(next);
        loadVideos(next);
      }
    }, { threshold: 0.1 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadVideos]);

  // Separate shorts from regular for the main grid
  const regularVideos = videos.filter(v => !v.isShort);
  const featured = regularVideos[0] || null;
  const gridVideos = regularVideos.slice(featured ? 1 : 0);

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse space-y-8">
          {/* Featured skeleton */}
          <div className="rounded-2xl bg-army-800 dark:bg-army-700" style={{ aspectRatio: '21/9' }} />
          {/* Grid skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="army-card overflow-hidden">
                <div className="aspect-video bg-army-700 dark:bg-army-600" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-army-700 dark:bg-army-600 rounded w-3/4" />
                  <div className="h-3 bg-army-700 dark:bg-army-600 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
            <div className="h-2 w-2 bg-red-500 rounded-full flex-shrink-0" />
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            <button onClick={() => loadVideos(0)} className="ml-auto text-xs text-red-600 dark:text-red-400 underline font-medium">
              Yenidən cəhd et
            </button>
          </div>
        )}

        {/* ── Stats bar ── */}
        {videos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBadge icon={Film}     label="Ümumi video"  value={videos.length + (hasMore ? '+' : '')} color="bg-primary-600" />
            <StatBadge icon={Zap}      label="Shorts"       value={shorts.length}                        color="bg-tan-500" />
            <StatBadge icon={Eye}      label="Baxış (cəmi)" value={fmtViews(videos.reduce((a, v) => a + (v.views || 0), 0))} color="bg-primary-700" />
            <StatBadge icon={TrendingUp} label="Bu həftə"   value={videos.filter(v => {
              const d = Math.floor((Date.now() - new Date(v.uploadedAt)) / 86400000);
              return d <= 7;
            }).length}                                                                                    color="bg-army-600" />
          </div>
        )}

        {/* ── Featured banner (most recent video) ── */}
        {featured && <FeaturedBanner video={featured} />}

        {/* ── Shorts row ── */}
        {shorts.length > 0 && (
          <section>
            <SectionHeader icon={Zap} title="Shorts" to="/shorts" color="text-tan-500 dark:text-tan-400" />
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {shorts.map(v => <ShortCard key={v.id} video={v} />)}
              {/* "Hamısı" card */}
              <Link to="/shorts"
                className="flex-shrink-0 w-36 rounded-xl border-2 border-dashed border-primary-600/30 dark:border-primary-700/50
                           flex flex-col items-center justify-center gap-2 text-primary-600 dark:text-primary-400
                           hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all"
                style={{ aspectRatio: '9/16' }}>
                <ChevronRight className="h-6 w-6" />
                <span className="text-xs font-bold">Hamısı</span>
              </Link>
            </div>
          </section>
        )}

        {/* ── All videos grid ── */}
        {gridVideos.length === 0 && !featured ? (
          <div className="text-center py-20">
            <Film className="h-16 w-16 text-gray-300 dark:text-army-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Hələki video yoxdur</h3>
            <p className="text-gray-500 dark:text-gray-400">İlk videonu sən yüklə!</p>
          </div>
        ) : (
          <section>
            <SectionHeader icon={Film} title="Bütün videolar" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {gridVideos.map(v => <VideoCard key={v.id} video={v} />)}
            </div>

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-8 mt-4 flex items-center justify-center">
              {loadingMore && (
                <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
                  <span>Yüklənir…</span>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </>
  );
};

export default Home;
