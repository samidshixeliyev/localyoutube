import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMiniPlayer } from '../context/MiniPlayerContext';
import { Play, Pause, X, Maximize2 } from 'lucide-react';
import Hls from 'hls.js';

export default function MiniPlayer() {
    const navigate = useNavigate();
    const { miniPlayerState, closeMiniPlayer, updateCurrentTime, togglePlayPause } = useMiniPlayer();
    const videoRef  = useRef(null);
    const hlsRef    = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [position,   setPosition]   = useState({ x: window.innerWidth - 420, y: window.innerHeight - 290 });
    const [duration,   setDuration]   = useState(0);
    const [progress,   setProgress]   = useState(0);
    const dragOffset = useRef({ x: 0, y: 0 });

    const { active, videoId, title, hlsUrl, currentTime, isPlaying } = miniPlayerState;

    // ── HLS initialise ──────────────────────────────────────────────
    useEffect(() => {
        if (!active || !hlsUrl || !videoRef.current) return;
        const video = videoRef.current;

        if (Hls.isSupported()) {
            const hls = new Hls({ startPosition: currentTime || 0, maxBufferLength: 30, maxMaxBufferLength: 60 });
            hls.loadSource(hlsUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                if (currentTime > 0) video.currentTime = currentTime;
                if (isPlaying) video.play().catch(() => {});
            });
            hlsRef.current = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = hlsUrl;
            video.addEventListener('loadedmetadata', () => {
                if (currentTime > 0) video.currentTime = currentTime;
                if (isPlaying) video.play().catch(() => {});
            });
        }

        return () => {
            if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, hlsUrl]);

    // ── Sync play/pause ─────────────────────────────────────────────
    useEffect(() => {
        if (!videoRef.current || !active) return;
        if (isPlaying) videoRef.current.play().catch(() => {});
        else           videoRef.current.pause();
    }, [isPlaying, active]);

    // ── Track time + duration + progress ───────────────────────────
    useEffect(() => {
        if (!videoRef.current || !active) return;
        const video = videoRef.current;
        const onTime = () => {
            updateCurrentTime(video.currentTime);
            setProgress(video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0);
        };
        const onMeta = () => setDuration(video.duration || 0);
        video.addEventListener('timeupdate', onTime);
        video.addEventListener('loadedmetadata', onMeta);
        return () => {
            video.removeEventListener('timeupdate', onTime);
            video.removeEventListener('loadedmetadata', onMeta);
        };
    }, [active, updateCurrentTime]);

    // ── Drag ────────────────────────────────────────────────────────
    const handleMouseDown = (e) => {
        if (e.target.closest('.mp-controls')) return;
        setIsDragging(true);
        dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    useEffect(() => {
        if (!isDragging) return;
        const move = (e) => setPosition({
            x: Math.max(0, Math.min(window.innerWidth  - 410, e.clientX - dragOffset.current.x)),
            y: Math.max(0, Math.min(window.innerHeight - 260, e.clientY - dragOffset.current.y)),
        });
        const up = () => setIsDragging(false);
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup',   up);
        return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    }, [isDragging]);

    if (!active) return null;

    const handleExpand = () => {
        const time = videoRef.current?.currentTime || 0;
        closeMiniPlayer();
        navigate(`/video/${videoId}?t=${Math.floor(time)}`);
    };

    const fmtTime = (s) => {
        if (!s || isNaN(s)) return '0:00';
        const m = Math.floor(s / 60);
        return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    };

    return (
        <div
            style={{ position: 'fixed', left: position.x, top: position.y, width: 380, zIndex: 9999,
                     cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' }}
            className="rounded-xl overflow-hidden shadow-2xl border border-white/10"
            onMouseDown={handleMouseDown}
        >
            {/* Accent border top */}
            <div className="h-0.5 bg-primary-500 w-full" />

            {/* Video */}
            <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
                <video
                    ref={videoRef}
                    className="w-full h-full object-contain"
                    playsInline
                />
                {/* Progress bar overlay */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                    <div
                        className="h-full bg-primary-500 transition-[width] duration-200"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Controls */}
            <div className="mp-controls flex items-center gap-2 px-3 py-2 bg-gray-900/95 cursor-default">
                {/* Play/Pause */}
                <button
                    onClick={togglePlayPause}
                    className="p-1.5 rounded-lg text-white hover:bg-white/10 transition-colors flex-shrink-0"
                >
                    {isPlaying
                        ? <Pause className="h-4 w-4 fill-white" />
                        : <Play  className="h-4 w-4 fill-white" />}
                </button>

                {/* Title + time */}
                <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate leading-tight">{title}</p>
                    {duration > 0 && (
                        <p className="text-gray-400 text-[10px] mt-0.5">
                            {fmtTime(videoRef.current?.currentTime || 0)} / {fmtTime(duration)}
                        </p>
                    )}
                </div>

                {/* Expand */}
                <button
                    onClick={handleExpand}
                    className="p-1.5 rounded-lg text-white hover:bg-white/10 transition-colors flex-shrink-0"
                    title="Tam ekranda aç"
                >
                    <Maximize2 className="h-4 w-4" />
                </button>

                {/* Close */}
                <button
                    onClick={closeMiniPlayer}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                    title="Bağla"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
