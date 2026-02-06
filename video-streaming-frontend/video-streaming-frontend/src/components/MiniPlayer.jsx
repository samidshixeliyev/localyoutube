import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMiniPlayer } from '../context/MiniPlayerContext';
import Hls from 'hls.js';

export default function MiniPlayer() {
    const navigate = useNavigate();
    const { miniPlayerState, closeMiniPlayer, updateCurrentTime, togglePlayPause } = useMiniPlayer();
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: window.innerWidth - 340, y: window.innerHeight - 230 });
    const dragOffset = useRef({ x: 0, y: 0 });

    const { active, videoId, title, hlsUrl, currentTime, isPlaying } = miniPlayerState;

    // Initialize HLS
    useEffect(() => {
        if (!active || !hlsUrl || !videoRef.current) return;

        const video = videoRef.current;

        if (Hls.isSupported()) {
            const hls = new Hls({
                startPosition: currentTime || 0,
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
            });
            hls.loadSource(hlsUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                if (currentTime > 0) {
                    video.currentTime = currentTime;
                }
                if (isPlaying) {
                    video.play().catch(() => {});
                }
            });
            hlsRef.current = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = hlsUrl;
            video.addEventListener('loadedmetadata', () => {
                if (currentTime > 0) {
                    video.currentTime = currentTime;
                }
                if (isPlaying) {
                    video.play().catch(() => {});
                }
            });
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [active, hlsUrl]);

    // Sync play/pause
    useEffect(() => {
        if (!videoRef.current || !active) return;
        if (isPlaying) {
            videoRef.current.play().catch(() => {});
        } else {
            videoRef.current.pause();
        }
    }, [isPlaying, active]);

    // Track time
    useEffect(() => {
        if (!videoRef.current || !active) return;
        const video = videoRef.current;
        const handler = () => updateCurrentTime(video.currentTime);
        video.addEventListener('timeupdate', handler);
        return () => video.removeEventListener('timeupdate', handler);
    }, [active, updateCurrentTime]);

    // Drag handlers
    const handleMouseDown = (e) => {
        if (e.target.closest('.mini-player-controls')) return;
        setIsDragging(true);
        dragOffset.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };
    };

    useEffect(() => {
        if (!isDragging) return;
        const handleMove = (e) => {
            setPosition({
                x: Math.max(0, Math.min(window.innerWidth - 320, e.clientX - dragOffset.current.x)),
                y: Math.max(0, Math.min(window.innerHeight - 200, e.clientY - dragOffset.current.y)),
            });
        };
        const handleUp = () => setIsDragging(false);
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [isDragging]);

    if (!active) return null;

    const handleExpand = () => {
        const time = videoRef.current?.currentTime || 0;
        closeMiniPlayer();
        navigate(`/video/${videoId}?t=${Math.floor(time)}`);
    };

    return (
        <div
            style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                width: 320,
                zIndex: 9999,
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                backgroundColor: '#000',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
            }}
            onMouseDown={handleMouseDown}
        >
            {/* Video */}
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
                <video
                    ref={videoRef}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    playsInline
                    muted={false}
                />
            </div>

            {/* Controls Bar */}
            <div
                className="mini-player-controls"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    backgroundColor: '#1a1a1a',
                    color: '#fff',
                    fontSize: '12px',
                    cursor: 'default',
                }}
            >
                <span
                    style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginRight: '8px',
                    }}
                    title={title}
                >
                    {title}
                </span>

                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {/* Play/Pause */}
                    <button
                        onClick={togglePlayPause}
                        style={{
                            background: 'none', border: 'none', color: '#fff',
                            cursor: 'pointer', padding: '2px 4px', fontSize: '14px'
                        }}
                        title={isPlaying ? 'Pause' : 'Play'}
                    >
                        {isPlaying ? '⏸' : '▶'}
                    </button>

                    {/* Expand */}
                    <button
                        onClick={handleExpand}
                        style={{
                            background: 'none', border: 'none', color: '#fff',
                            cursor: 'pointer', padding: '2px 4px', fontSize: '14px'
                        }}
                        title="Expand"
                    >
                        ⤢
                    </button>

                    {/* Close */}
                    <button
                        onClick={closeMiniPlayer}
                        style={{
                            background: 'none', border: 'none', color: '#fff',
                            cursor: 'pointer', padding: '2px 4px', fontSize: '14px'
                        }}
                        title="Close"
                    >
                        ✕
                    </button>
                </div>
            </div>
        </div>
    );
}