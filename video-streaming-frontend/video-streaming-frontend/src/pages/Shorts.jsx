import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import { getShorts } from '../services/api';
import Navbar from '../components/Navbar';
import {
  Play, Eye, Heart, ArrowLeft, Zap,
  Volume2, VolumeX, Loader2, Maximize2,
} from 'lucide-react';

/* ─── helpers ─────────────────────────────────────────────────── */
const fmtViews = (v) => {
  if (!v) return '0';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return `${v}`;
};

/* ─── ShortItem — one full-viewport short with inline video ───── */
function ShortItem({ video, muted, onToggleMute, onVisible, isLast, onLastVisible }) {
  const navigate = useNavigate();
  const wrapperRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [isInView, setIsInView] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoReady, setVideoReady] = useState(false);

  // Per-item IntersectionObserver – tracks in-view state for autoplay/pause
  useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current;
    const io = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.6;
        setIsInView(visible);
        if (visible) {
          onVisible?.(video.id);
          if (isLast) onLastVisible?.();
        }
      },
      { threshold: [0, 0.6, 1] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [video.id, isLast, onVisible, onLastVisible]);

  // Initialise HLS once
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !video.hlsUrl) return;

    if (Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 10, lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(video.hlsUrl);
      hls.attachMedia(vid);
      hls.on(Hls.Events.MANIFEST_PARSED, () => setVideoReady(true));
    } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
      vid.src = video.hlsUrl;
      vid.addEventListener('loadedmetadata', () => setVideoReady(true), { once: true });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [video.hlsUrl]);

  // Play / pause based on visibility
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isInView) {
      vid.muted = muted;
      const p = vid.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => { /* autoplay blocked; user will tap */ });
      }
    } else {
      vid.pause();
      vid.currentTime = 0;
    }
  }, [isInView, muted]);

  // Track play state + progress
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTime = () => {
      if (vid.duration > 0) setProgress((vid.currentTime / vid.duration) * 100);
    };
    vid.addEventListener('play', onPlay);
    vid.addEventListener('pause', onPause);
    vid.addEventListener('timeupdate', onTime);
    return () => {
      vid.removeEventListener('play', onPlay);
      vid.removeEventListener('pause', onPause);
      vid.removeEventListener('timeupdate', onTime);
    };
  }, []);

  const handleTogglePlay = (e) => {
    e.stopPropagation();
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) vid.play().catch(() => {});
    else vid.pause();
  };

  return (
    <div
      ref={wrapperRef}
      className="snap-start w-full flex items-center justify-center"
      style={{ height: 'calc(100vh - 7rem)' }}
    >
      <div
        className="relative bg-black overflow-hidden rounded-xl"
        style={{ height: '100%', aspectRatio: '9/16', maxWidth: '100%', maxHeight: '100%' }}
      >
        {/* Poster while video loads */}
        {!videoReady && video.thumbnailUrl && (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {!videoReady && !video.thumbnailUrl && (
          <div className="absolute inset-0 bg-gradient-to-br from-army-800 to-army-900 flex items-center justify-center">
            <Zap className="h-16 w-16 text-primary-600/30" />
          </div>
        )}

        {/* Inline video element */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover bg-black"
          playsInline
          loop
          muted={muted}
          poster={video.thumbnailUrl || undefined}
          onClick={handleTogglePlay}
        />

        {/* Tap-to-play hint when paused */}
        {!isPlaying && videoReady && (
          <div
            onClick={handleTogglePlay}
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
          >
            <div className="bg-black/40 rounded-full p-5 backdrop-blur-sm">
              <Play className="h-12 w-12 text-white fill-white" />
            </div>
          </div>
        )}

        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-16 p-4 pointer-events-none">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="bg-primary-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Zap className="h-3 w-3" />SHORT
            </span>
          </div>
          <h3 className="text-white font-semibold text-base line-clamp-2 mb-1 drop-shadow">
            {video.title}
          </h3>
          {video.uploaderName && (
            <p className="text-white/80 text-sm mb-1.5">@{video.uploaderName}</p>
          )}
          <div className="flex items-center gap-3 text-white/70 text-xs">
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />{fmtViews(video.views)}
            </span>
          </div>
        </div>

        {/* Right-side action stack */}
        <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); /* like placeholder */ }}
            className="flex flex-col items-center gap-1 text-white"
          >
            <div className="bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-full p-3 transition-colors">
              <Heart className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-medium">{fmtViews(video.likes)}</span>
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/video/${video.id}`); }}
            className="flex flex-col items-center gap-1 text-white"
            title="Tam ekran"
          >
            <div className="bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-full p-3 transition-colors">
              <Maximize2 className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-medium">İzlə</span>
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
            className="flex flex-col items-center gap-1 text-white"
            title={muted ? 'Səsi aç' : 'Səsi kapat'}
          >
            <div className="bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-full p-3 transition-colors">
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </div>
          </button>
        </div>

        {/* Bottom progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/15">
          <div
            className="h-full bg-primary-500 transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Buffer spinner */}
        {!videoReady && (
          <div className="absolute top-3 right-3">
            <Loader2 className="h-5 w-5 text-white/70 animate-spin" />
          </div>
        )}
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
  const [activeId, setActiveId] = useState(null);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState('');
  const PAGE_SIZE = 10;

  const loadShorts = useCallback(async (p) => {
    try {
      p === 0 ? setLoading(true) : setLoadingMore(true);
      const res = await getShorts(p, PAGE_SIZE);
      const data = Array.isArray(res.data?.videos) ? res.data.videos
                 : Array.isArray(res.data?.content) ? res.data.content
                 : Array.isArray(res.data) ? res.data : [];
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

  // Triggered when the last item becomes visible — load next page
  const handleLastVisible = useCallback(() => {
    if (!hasMore || loadingMore) return;
    const next = page + 1;
    setPage(next);
    loadShorts(next);
  }, [hasMore, loadingMore, page, loadShorts]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-[80vh] bg-black">
          <div className="text-center">
            <Zap className="h-12 w-12 text-primary-500 mx-auto mb-3 animate-pulse" />
            <p className="text-white/60 font-medium">Shorts yüklənir…</p>
          </div>
        </div>
      </>
    );
  }

  if (shorts.length === 0) {
    return (
      <>
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 bg-black">
          <Zap className="h-16 w-16 text-army-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Shorts hələ yoxdur</h2>
          <p className="text-white/60 mb-6">Qısa videolar burada göstəriləcək</p>
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
        <div className="sticky top-14 z-40 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-2 flex items-center gap-3">
          <button onClick={() => navigate('/')}
            className="text-white/70 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary-500" />
            <span className="text-white font-bold">Shorts</span>
          </div>
          <button
            onClick={() => setMuted(m => !m)}
            className="ml-auto text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            title={muted ? 'Səsi aç' : 'Səsi kapat'}
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
        </div>

        {/* Vertical snap-scroll feed */}
        <div
          className="overflow-y-scroll snap-y snap-mandatory no-scrollbar"
          style={{ height: 'calc(100vh - 7rem)' }}
        >
          {shorts.map((video, i) => (
            <ShortItem
              key={video.id}
              video={video}
              muted={muted}
              onToggleMute={() => setMuted(m => !m)}
              onVisible={setActiveId}
              isLast={i === shorts.length - 1}
              onLastVisible={handleLastVisible}
            />
          ))}

          {loadingMore && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
            </div>
          )}

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
