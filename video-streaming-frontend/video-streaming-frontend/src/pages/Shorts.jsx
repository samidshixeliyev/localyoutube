import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getShorts } from '../services/api';
import Navbar from '../components/Navbar';
import { Play, Pause, Eye, Heart, ArrowLeft, Zap, Volume2, VolumeX, Loader2 } from 'lucide-react';

/* ─── helpers ─────────────────────────────────────────────────── */
const fmtViews = (v) => {
  if (!v) return '0';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return `${v}`;
};

/* ─── ShortItem — one full-viewport card ─────────────────────── */
function ShortItem({ video, isActive }) {
  const navigate = useNavigate();
  return (
    <div className="snap-start flex-shrink-0 w-full h-full flex items-center justify-center">
      <div
        className="relative bg-black overflow-hidden cursor-pointer group"
        style={{ height: '100%', aspectRatio: '9/16', maxWidth: '100%', maxHeight: '100%' }}
        onClick={() => navigate(`/video/${video.id}`)}
      >
        {/* Thumbnail */}
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-army-800 to-army-900 flex items-center justify-center">
            <Zap className="h-16 w-16 text-primary-600/30" />
          </div>
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10 pointer-events-none" />

        {/* Play icon on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-primary-600/80 rounded-full p-4 backdrop-blur-sm">
            <Play className="h-10 w-10 text-white fill-white" />
          </div>
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="bg-primary-600 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Zap className="h-3 w-3" />SHORT
            </span>
          </div>
          <h3 className="text-white font-bold text-base line-clamp-2 mb-1 drop-shadow">{video.title}</h3>
          {video.uploaderName && (
            <p className="text-white/70 text-sm mb-2">@{video.uploaderName}</p>
          )}
          <div className="flex items-center gap-3 text-white/70 text-sm">
            <span className="flex items-center gap-1">
              <Eye className="h-4 w-4" />{fmtViews(video.views)}
            </span>
          </div>
        </div>

        {/* Right-side action buttons */}
        <div className="absolute right-3 bottom-16 flex flex-col items-center gap-4 pointer-events-auto">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/video/${video.id}`); }}
            className="flex flex-col items-center gap-1 text-white hover:text-primary-400 transition-colors"
          >
            <div className="bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full p-3 transition-colors">
              <Play className="h-5 w-5 fill-white" />
            </div>
            <span className="text-xs font-medium">İzlə</span>
          </button>
          <div className="flex flex-col items-center gap-1 text-white/60">
            <div className="bg-white/10 rounded-full p-3">
              <Heart className="h-5 w-5" />
            </div>
            <span className="text-xs">{fmtViews(video.likes)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Shorts page ─────────────────────────────────────────────── */
const Shorts = () => {
  const navigate = useNavigate();
  const [shorts, setShorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [error, setError] = useState('');
  const containerRef = useRef(null);
  const observerRef = useRef(null);
  const PAGE_SIZE = 10;

  const loadShorts = useCallback(async (p) => {
    try {
      p === 0 ? setLoading(true) : setLoadingMore(true);
      const res = await getShorts(p, PAGE_SIZE);
      const data = res.data?.content ?? res.data ?? [];
      if (p === 0) setShorts(data);
      else setShorts(prev => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      setError('Shorts yüklənə bilmədi.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { loadShorts(0); }, [loadShorts]);

  // IntersectionObserver to track which short is in view
  useEffect(() => {
    if (!containerRef.current) return;
    const items = containerRef.current.querySelectorAll('[data-short-item]');
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveIdx(Number(entry.target.dataset.idx));
          }
        });
        // Load more when near end
        const lastVisible = entries.find(e => e.isIntersecting && Number(e.target.dataset.idx) >= shorts.length - 2);
        if (lastVisible && hasMore && !loadingMore) {
          const next = page + 1;
          setPage(next);
          loadShorts(next);
        }
      },
      { threshold: 0.6 }
    );
    items.forEach(el => observerRef.current.observe(el));
    return () => observerRef.current?.disconnect();
  }, [shorts, hasMore, loadingMore, page, loadShorts]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <Zap className="h-12 w-12 text-primary-600 mx-auto mb-3 animate-pulse" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">Shorts yüklənir…</p>
          </div>
        </div>
      </>
    );
  }

  if (shorts.length === 0) {
    return (
      <>
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
          <Zap className="h-16 w-16 text-gray-300 dark:text-army-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Shorts hələ yoxdur</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Qısa videolar burada göstəriləcək</p>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-full font-semibold hover:bg-primary-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />Ana səhifəyə qayıt
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="bg-black min-h-screen">
        {/* Header strip */}
        <div className="sticky top-14 z-40 bg-black/90 backdrop-blur-sm border-b border-white/10 px-4 py-2 flex items-center gap-3">
          <button onClick={() => navigate('/')}
            className="text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary-500" />
            <span className="text-white font-bold">Shorts</span>
            <span className="text-white/40 text-sm">· {shorts.length}{hasMore ? '+' : ''} video</span>
          </div>
          {/* Progress dots */}
          <div className="ml-auto flex items-center gap-1">
            {shorts.slice(0, Math.min(shorts.length, 8)).map((_, i) => (
              <div key={i} className={`rounded-full transition-all duration-300 ${
                i === activeIdx
                  ? 'w-4 h-1.5 bg-primary-500'
                  : 'w-1.5 h-1.5 bg-white/25'
              }`} />
            ))}
            {shorts.length > 8 && <span className="text-white/40 text-xs ml-1">+{shorts.length - 8}</span>}
          </div>
        </div>

        {/* Vertical snap scroll container */}
        <div
          ref={containerRef}
          className="overflow-y-scroll snap-y snap-mandatory"
          style={{ height: 'calc(100vh - 7rem)' }}
        >
          {shorts.map((video, i) => (
            <div
              key={video.id}
              data-short-item
              data-idx={i}
              className="snap-start w-full flex items-center justify-center py-2"
              style={{ height: 'calc(100vh - 7rem)' }}
            >
              <ShortItem video={video} isActive={i === activeIdx} />
            </div>
          ))}

          {/* Loading more indicator */}
          {loadingMore && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
            </div>
          )}

          {/* End of feed */}
          {!hasMore && shorts.length > 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Zap className="h-10 w-10 text-primary-600/40 mb-3" />
              <p className="text-white/40 text-sm">Bütün shorts göstərildi</p>
              <button onClick={() => navigate('/')}
                className="mt-4 flex items-center gap-2 px-5 py-2 bg-primary-600/80 text-white rounded-full text-sm font-medium hover:bg-primary-600 transition-colors">
                <ArrowLeft className="h-4 w-4" />Ana səhifəyə qayıt
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-900/80 text-red-200 text-sm px-4 py-2 rounded-lg backdrop-blur-sm">
            {error}
          </div>
        )}
      </div>
    </>
  );
};

export default Shorts;
