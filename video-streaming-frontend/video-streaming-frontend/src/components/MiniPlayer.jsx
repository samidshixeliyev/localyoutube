import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMiniPlayer } from '../context/MiniPlayerContext';
import { useAuth } from '../context/AuthContext';
import { Play, Pause, X, Maximize2 } from 'lucide-react';
import Hls from 'hls.js';

const W = 400;
const H = 225; // 16:9
const CTRL_H = 56;
const MARGIN = 16;

function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}

export default function MiniPlayer() {
  const navigate = useNavigate();
  const { miniPlayerState, closeMiniPlayer, updateCurrentTime, togglePlayPause } = useMiniPlayer();
  const { isAuthenticated } = useAuth();

  const videoRef   = useRef(null);
  const hlsRef     = useRef(null);
  const containerRef = useRef(null);

  const [duration, setDuration]   = useState(0);
  const [progress, setProgress]   = useState(0);
  const [buffered, setBuffered]   = useState(0);
  const [loading,  setLoading]    = useState(true);

  // Drag state
  const [pos,        setPos]        = useState(null); // null = use CSS bottom/right default
  const isDragging   = useRef(false);
  const dragStart    = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const { active, videoId, title, hlsUrl, thumbnailUrl, currentTime, isPlaying } = miniPlayerState;

  // Close when signed out
  useEffect(() => {
    if (!isAuthenticated) closeMiniPlayer();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Snap back to bottom-right whenever a new video activates
  useEffect(() => {
    if (active) {
      setPos(null);
      setLoading(true);
      setProgress(0);
      setDuration(0);
    }
  }, [active, hlsUrl]);

  // Clamp position on window resize
  useEffect(() => {
    const onResize = () => {
      setPos(prev => {
        if (!prev) return prev;
        return {
          x: Math.max(MARGIN, Math.min(window.innerWidth  - W - MARGIN, prev.x)),
          y: Math.max(MARGIN, Math.min(window.innerHeight - H - CTRL_H - MARGIN, prev.y)),
        };
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── HLS setup ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!active || !hlsUrl || !videoRef.current) return;
    const video = videoRef.current;
    setLoading(true);

    const onCanPlay = () => setLoading(false);
    video.addEventListener('canplay', onCanPlay);

    if (Hls.isSupported()) {
      const hls = new Hls({
        startPosition: currentTime || -1,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        enableWorker: false,
      });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (currentTime > 0) video.currentTime = currentTime;
        video.play().catch(() => {
          video.muted = true;
          video.play().catch(() => {});
        });
      });
      hls.on(Hls.Events.BUFFER_APPENDED, () => {
        if (video.buffered.length > 0) {
          setBuffered((video.buffered.end(video.buffered.length - 1) / (video.duration || 1)) * 100);
        }
      });
      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      video.addEventListener('loadedmetadata', () => {
        if (currentTime > 0) video.currentTime = currentTime;
        video.play().catch(() => {});
      });
    }

    return () => {
      video.removeEventListener('canplay', onCanPlay);
      video.pause();
      video.src = '';
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, hlsUrl]);

  // ── Sync play/pause from context ──────────────────────────────────
  useEffect(() => {
    if (!videoRef.current || !active) return;
    if (isPlaying) videoRef.current.play().catch(() => {});
    else           videoRef.current.pause();
  }, [isPlaying, active]);

  // ── Time tracking ─────────────────────────────────────────────────
  useEffect(() => {
    if (!videoRef.current || !active) return;
    const video = videoRef.current;
    const onTime = () => {
      const d = video.duration || 0;
      updateCurrentTime(video.currentTime);
      setProgress(d > 0 ? (video.currentTime / d) * 100 : 0);
    };
    const onMeta = () => setDuration(video.duration || 0);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('loadedmetadata', onMeta);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('loadedmetadata', onMeta);
    };
  }, [active, updateCurrentTime]);

  // ── Drag handlers ─────────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    if (e.target.closest('[data-controls]')) return;
    e.preventDefault();
    isDragging.current = true;
    const rect = containerRef.current.getBoundingClientRect();
    dragStart.current = { mx: e.clientX, my: e.clientY, px: rect.left, py: rect.top };

    const onMove = (ev) => {
      if (!isDragging.current) return;
      const nx = dragStart.current.px + (ev.clientX - dragStart.current.mx);
      const ny = dragStart.current.py + (ev.clientY - dragStart.current.my);
      setPos({
        x: Math.max(MARGIN, Math.min(window.innerWidth  - W - MARGIN, nx)),
        y: Math.max(MARGIN, Math.min(window.innerHeight - H - CTRL_H - MARGIN, ny)),
      });
    };
    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, []);

  // ── Progress bar seek ─────────────────────────────────────────────
  const onProgressClick = useCallback((e) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const d = videoRef.current.duration;
    if (d) videoRef.current.currentTime = ratio * d;
  }, []);

  if (!active) return null;

  const handleExpand = () => {
    const t = videoRef.current?.currentTime || 0;
    closeMiniPlayer();
    navigate(`/video/${videoId}?t=${Math.floor(t)}`);
  };

  // Position style: use left/top when dragged, else fixed bottom-right
  const posStyle = pos
    ? { left: pos.x, top: pos.y }
    : { right: MARGIN, bottom: MARGIN + 24 };

  return (
    <div
      ref={containerRef}
      style={{ position: 'fixed', width: W, zIndex: 9999, ...posStyle,
               cursor: isDragging.current ? 'grabbing' : 'grab', userSelect: 'none' }}
      className="rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.5)] border border-white/10 bg-black"
      onMouseDown={onMouseDown}
    >
      {/* Video area */}
      <div className="relative bg-black" style={{ height: H }}>
        {/* Thumbnail shown while loading */}
        {loading && thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          playsInline
        />

        {/* Buffered + progress bar */}
        <div
          className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 cursor-pointer"
          data-controls
          onClick={onProgressClick}
        >
          <div className="absolute inset-0 bg-white/10" style={{ width: `${buffered}%` }} />
          <div className="h-full bg-primary-500 relative transition-[width] duration-200" style={{ width: `${progress}%` }}>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow -mr-1.5 opacity-0 group-hover:opacity-100" />
          </div>
        </div>
      </div>

      {/* Controls bar — YouTube style */}
      <div
        data-controls
        className="flex items-center gap-0 bg-[#181818] cursor-default px-1"
        style={{ height: CTRL_H }}
      >
        {/* Play / Pause */}
        <button
          onClick={togglePlayPause}
          className="p-2.5 text-white hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
          title={isPlaying ? 'Durdur' : 'Oynat'}
        >
          {isPlaying
            ? <Pause className="h-5 w-5 fill-white" />
            : <Play  className="h-5 w-5 fill-white" />}
        </button>

        {/* Title + time */}
        <div className="flex-1 min-w-0 px-2">
          <p className="text-white text-sm font-medium truncate leading-tight">{title}</p>
          {duration > 0 && (
            <p className="text-gray-400 text-xs mt-0.5">
              {fmtTime(videoRef.current?.currentTime || 0)} / {fmtTime(duration)}
            </p>
          )}
        </div>

        {/* Expand to full page */}
        <button
          onClick={handleExpand}
          className="p-2.5 text-white hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
          title="Tam ekranda aç"
        >
          <Maximize2 className="h-5 w-5" />
        </button>

        {/* Close */}
        <button
          onClick={closeMiniPlayer}
          className="p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
          title="Bağla"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
