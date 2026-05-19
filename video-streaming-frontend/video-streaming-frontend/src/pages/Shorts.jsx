import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import { getShorts } from '../services/api';
import videoService from '../services/videoService';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import CommentSection from '../components/CommentSection';
import {
  Play, Eye, Heart, ArrowLeft, Zap,
  Volume2, VolumeX, Loader2, Maximize2,
  MessageSquare, X, ChevronDown, Settings,
  ChevronUp, Link2, Check as CheckIcon,
} from 'lucide-react';

/* ─── helpers ─────────────────────────────────────────────────── */
const fmtViews = (v) => {
  if (!v) return '0';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return `${v}`;
};

const qualityLabel = (level) =>
  level < 0 ? 'Avtomatik' : `${level.height}p`;

/* ─── ShortItem ────────────────────────────────────────────────── */
function ShortItem({ video, muted, onToggleMute, onVisible, isLast, onLastVisible }) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const wrapperRef = useRef(null);
  const videoRef   = useRef(null);
  const hlsRef     = useRef(null);

  const [isInView,    setIsInView]    = useState(false);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [videoReady,  setVideoReady]  = useState(false);

  // Like state
  const [liked,     setLiked]     = useState(!!video.isLikedByCurrentUser);
  const [likeCount, setLikeCount] = useState(video.likes || 0);
  const [liking,    setLiking]    = useState(false);

  // Comments / description panel
  const [showPanel,    setShowPanel]    = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  // Quality selector
  const [levels,       setLevels]       = useState([]);
  const [activeLevel,  setActiveLevel]  = useState(-1);
  const [showQuality,  setShowQuality]  = useState(false);

  // Share state
  const [copied, setCopied] = useState(false);

  // ── IntersectionObserver ───────────────────────────────────────
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
          setShowPanel(false);
          setShowQuality(false);
        }
      },
      { threshold: [0, 0.6, 1] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [video.id, isLast, onVisible, onLastVisible]);

  // ── HLS init ───────────────────────────────────────────────────
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !video.hlsUrl) return;

    if (Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 10, lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(video.hlsUrl);
      hls.attachMedia(vid);
      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setVideoReady(true);
        setLevels(data.levels || []);
        setActiveLevel(-1); // start in ABR auto mode
      });
    } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
      vid.src = video.hlsUrl;
      vid.addEventListener('loadedmetadata', () => setVideoReady(true), { once: true });
    }

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [video.hlsUrl]);

  // ── Play / pause based on visibility ──────────────────────────
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isInView) {
      vid.muted = muted;
      vid.play().catch(() => {});
    } else {
      vid.pause();
      vid.currentTime = 0;
    }
  }, [isInView, muted]);

  // ── Play state + progress ──────────────────────────────────────
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const onPlay  = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTime  = () => {
      if (vid.duration > 0) setProgress((vid.currentTime / vid.duration) * 100);
    };
    vid.addEventListener('play',       onPlay);
    vid.addEventListener('pause',      onPause);
    vid.addEventListener('timeupdate', onTime);
    return () => {
      vid.removeEventListener('play',       onPlay);
      vid.removeEventListener('pause',      onPause);
      vid.removeEventListener('timeupdate', onTime);
    };
  }, []);

  const handleTogglePlay = (e) => {
    e.stopPropagation();
    if (showQuality) { setShowQuality(false); return; }
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) vid.play().catch(() => {});
    else vid.pause();
  };

  // ── Like ───────────────────────────────────────────────────────
  const handleLike = async (e) => {
    e.stopPropagation();
    if (!isAuthenticated) { navigate('/login'); return; }
    if (liking) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount(c => wasLiked ? c - 1 : c + 1);
    setLiking(true);
    try {
      const result = await videoService.toggleLike(video.id);
      setLiked(result.liked);
      setLikeCount(result.likes);
    } catch {
      setLiked(wasLiked);
      setLikeCount(c => wasLiked ? c + 1 : c - 1);
    } finally {
      setLiking(false);
    }
  };

  // ── Quality ────────────────────────────────────────────────────
  const handleQualityChange = (idx) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = idx; // -1 = auto, 0+ = specific level
      setActiveLevel(idx);
    }
    setShowQuality(false);
  };

  const currentLevelObj = activeLevel >= 0 ? levels[activeLevel] : null;
  const qualityBadge    = currentLevelObj ? `${currentLevelObj.height}p` : 'Auto';

  const handleShare = async (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}/video/${video.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: video.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* ignore */ }
    }
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
        {/* Poster while loading */}
        {!videoReady && video.thumbnailUrl && (
          <img src={video.thumbnailUrl} alt={video.title}
            className="absolute inset-0 w-full h-full object-cover" />
        )}
        {!videoReady && !video.thumbnailUrl && (
          <div className="absolute inset-0 bg-gradient-to-br from-army-800 to-army-900 flex items-center justify-center">
            <Zap className="h-16 w-16 text-primary-600/30" />
          </div>
        )}

        {/* Video */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover bg-black"
          playsInline loop muted={muted}
          poster={video.thumbnailUrl || undefined}
          onClick={handleTogglePlay}
        />

        {/* Tap-to-play overlay */}
        {!isPlaying && videoReady && !showPanel && (
          <div onClick={handleTogglePlay}
            className="absolute inset-0 flex items-center justify-center cursor-pointer">
            <div className="bg-black/40 rounded-full p-5 backdrop-blur-sm">
              <Play className="h-12 w-12 text-white fill-white" />
            </div>
          </div>
        )}

        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-16 p-4 pointer-events-none">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="bg-primary-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Zap className="h-3 w-3" />SHORT
            </span>
          </div>
          <h3 className="text-white font-semibold text-sm line-clamp-2 mb-1 drop-shadow">
            {video.title}
          </h3>
          {video.uploaderName && (
            <p className="text-white/75 text-xs mb-1.5">@{video.uploaderName}</p>
          )}
          <div className="flex items-center gap-3 text-white/60 text-xs">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />{fmtViews(video.views)}
            </span>
          </div>
        </div>

        {/* Right-side action stack */}
        <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4 z-10">

          {/* Like */}
          <button onClick={handleLike}
            className="flex flex-col items-center gap-1 text-white">
            <div className={`backdrop-blur-sm rounded-full p-3 transition-all ${
              liked ? 'bg-primary-600/80 hover:bg-primary-600' : 'bg-white/15 hover:bg-white/25'
            }`}>
              <Heart className={`h-5 w-5 transition-all ${liked ? 'fill-white text-white' : ''}`} />
            </div>
            <span className="text-[11px] font-medium">{fmtViews(likeCount)}</span>
          </button>

          {/* Comments */}
          <button onClick={(e) => { e.stopPropagation(); setShowPanel(true); }}
            className="flex flex-col items-center gap-1 text-white">
            <div className="bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-full p-3 transition-colors">
              <MessageSquare className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-medium">{fmtViews(video.commentCount)}</span>
          </button>

          {/* Expand to full video */}
          <button onClick={(e) => { e.stopPropagation(); navigate(`/video/${video.id}`); }}
            className="flex flex-col items-center gap-1 text-white" title="Tam ekran">
            <div className="bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-full p-3 transition-colors">
              <Maximize2 className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-medium">İzlə</span>
          </button>

          {/* Mute */}
          <button onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
            className="flex flex-col items-center gap-1 text-white"
            title={muted ? 'Səsi aç' : 'Səsi kapat'}>
            <div className="bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-full p-3 transition-colors">
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </div>
          </button>

          {/* Share */}
          <button onClick={handleShare}
            className="flex flex-col items-center gap-1 text-white" title="Paylaş">
            <div className={`backdrop-blur-sm rounded-full p-3 transition-colors ${
              copied ? 'bg-green-500/80' : 'bg-white/15 hover:bg-white/25'
            }`}>
              {copied ? <CheckIcon className="h-5 w-5" /> : <Link2 className="h-5 w-5" />}
            </div>
            <span className="text-[11px] font-medium">{copied ? 'Kopyalandı' : 'Paylaş'}</span>
          </button>

          {/* Quality selector (only shows when HLS levels available) */}
          {levels.length > 0 && (
            <div className="relative flex flex-col items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); setShowQuality(v => !v); }}
                className="flex flex-col items-center gap-1 text-white">
                <div className={`backdrop-blur-sm rounded-full p-3 transition-colors ${
                  showQuality ? 'bg-white/30' : 'bg-white/15 hover:bg-white/25'
                }`}>
                  <Settings className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-medium">{qualityBadge}</span>
              </button>

              {/* Quality dropdown */}
              {showQuality && (
                <div
                  className="absolute bottom-full mb-2 right-0 bg-gray-900/95 backdrop-blur-md rounded-xl overflow-hidden shadow-2xl border border-white/10 min-w-[90px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-white/50 text-[10px] font-semibold px-3 pt-2 pb-1 uppercase tracking-wider">Keyfiyyət</p>
                  {/* Auto option */}
                  <button
                    onClick={() => handleQualityChange(-1)}
                    className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center justify-between gap-2 ${
                      activeLevel === -1 ? 'text-primary-400 bg-primary-900/30' : 'text-white hover:bg-white/10'
                    }`}
                  >
                    Avtomatik
                    {activeLevel === -1 && <span className="w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />}
                  </button>
                  {/* Specific levels — highest resolution first */}
                  {[...levels].reverse().map((lvl, ri) => {
                    const idx = levels.length - 1 - ri;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleQualityChange(idx)}
                        className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center justify-between gap-2 ${
                          activeLevel === idx ? 'text-primary-400 bg-primary-900/30' : 'text-white hover:bg-white/10'
                        }`}
                      >
                        {lvl.height}p{lvl.bitrate > 2_000_000 ? ' HD' : ''}
                        {activeLevel === idx && <span className="w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/15">
          <div className="h-full bg-primary-500 transition-[width] duration-200"
            style={{ width: `${progress}%` }} />
        </div>

        {/* Buffer spinner */}
        {!videoReady && (
          <div className="absolute top-3 right-3">
            <Loader2 className="h-5 w-5 text-white/70 animate-spin" />
          </div>
        )}

        {/* ── Comments / Description panel (YouTube-style) ─────── */}
        {showPanel && (
          <div
            className="dark absolute inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl overflow-hidden"
            style={{ height: '70%', background: 'rgba(12, 12, 12, 0.97)', backdropFilter: 'blur(12px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex items-center justify-center pt-3 pb-0 flex-shrink-0">
              <div className="w-10 h-1 bg-white/25 rounded-full" />
            </div>

            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b border-white/10">
              <span className="text-white font-semibold text-sm">
                {video.commentCount ? `${fmtViews(video.commentCount)} Şərh` : 'Şərhlər'}
              </span>
              <button onClick={() => setShowPanel(false)}
                className="text-white/50 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Description section */}
            {video.description && (
              <div className="flex-shrink-0 border-b border-white/10 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white/90 text-xs font-semibold mb-1.5">
                      {video.uploaderName && (
                        <span className="text-primary-400">@{video.uploaderName} · </span>
                      )}
                      {video.title}
                    </p>
                    <p className={`text-white/60 text-xs whitespace-pre-wrap leading-relaxed ${!descExpanded ? 'line-clamp-2' : ''}`}>
                      {video.description}
                    </p>
                  </div>
                  {video.description.length > 80 && (
                    <button onClick={() => setDescExpanded(v => !v)}
                      className="flex-shrink-0 text-white/40 hover:text-white/70 transition-colors mt-0.5">
                      <ChevronDown className={`h-4 w-4 transition-transform ${descExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Scrollable comments */}
            <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6 no-scrollbar">
              <CommentSection
                videoId={video.id}
                currentUserId={user?.email || null}
              />
            </div>
          </div>
        )}

        {/* Backdrop tap to close panel */}
        {showPanel && (
          <div
            className="absolute inset-x-0 top-0 z-40"
            style={{ bottom: '70%' }}
            onClick={() => setShowPanel(false)}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Shorts page ─────────────────────────────────────────────── */
const Shorts = () => {
  const navigate = useNavigate();
  const [shorts,      setShorts]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page,        setPage]        = useState(0);
  const [hasMore,     setHasMore]     = useState(true);
  const [activeId,    setActiveId]    = useState(null);
  const [muted,       setMuted]       = useState(true);
  const [error,       setError]       = useState('');
  const scrollRef = useRef(null);
  const PAGE_SIZE = 10;

  const scrollToItem = useCallback((dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const itemH = el.clientHeight;
    el.scrollBy({ top: dir * itemH, behavior: 'smooth' });
  }, []);

  const loadShorts = useCallback(async (p) => {
    try {
      p === 0 ? setLoading(true) : setLoadingMore(true);
      const res = await getShorts(p, PAGE_SIZE);
      const data = Array.isArray(res.data?.videos)  ? res.data.videos
                 : Array.isArray(res.data?.content) ? res.data.content
                 : Array.isArray(res.data)           ? res.data : [];
      if (p === 0) setShorts(data);
      else         setShorts(prev => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      setError('Shorts yüklənə bilmədi.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { loadShorts(0); }, [loadShorts]);

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
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <Zap className="h-12 w-12 text-primary-500 mx-auto mb-3 animate-pulse" />
            <p className="text-gray-500 dark:text-white/60 font-medium">Shorts yüklənir…</p>
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
          <Zap className="h-16 w-16 text-army-600 dark:text-army-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Shorts hələ yoxdur</h2>
          <p className="text-gray-500 dark:text-white/60 mb-6">Qısa videolar burada göstəriləcək</p>
          <button onClick={() => navigate('/')}
            className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-full font-semibold hover:bg-primary-700 transition-colors">
            <ArrowLeft className="h-4 w-4" />Ana səhifəyə qayıt
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      {/* Dark background for the video feed — intentional for immersive video experience */}
      <div className="bg-black min-h-screen">
        {/* Header strip */}
        <div className="sticky top-14 z-40 bg-black/90 backdrop-blur-md border-b border-white/10 px-4 py-2 flex items-center gap-3">
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

        {/* Up / Down navigation arrows — floating right of center */}
        <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2 pointer-events-none">
          <button
            onClick={() => scrollToItem(-1)}
            className="pointer-events-auto w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white transition-colors shadow-lg"
            title="Əvvəlki"
          >
            <ChevronUp className="h-5 w-5" />
          </button>
          <button
            onClick={() => scrollToItem(1)}
            className="pointer-events-auto w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white transition-colors shadow-lg"
            title="Növbəti"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>

        {/* Vertical snap-scroll feed */}
        <div
          ref={scrollRef}
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
