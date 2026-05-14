import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings } from 'lucide-react';

const VideoPlayer = ({ hlsUrl, onTimeUpdate }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const playerContainerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [availableQualities, setAvailableQualities] = useState([]);
  const [currentQuality, setCurrentQuality] = useState(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [isSwitchingQuality, setIsSwitchingQuality] = useState(false);
  const controlsTimeoutRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return;

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,

        // Buffer — larger values keep large-file playback smooth
        backBufferLength:    90,
        maxBufferLength:     60,          // up from 30 — buffer 60 s ahead
        maxMaxBufferLength:  120,         // ceiling for ABR growth
        maxBufferSize:       100 * 1e6,   // 100 MB in-memory segment cache
        maxBufferHole:       0.5,

        // Fragment loading — generous timeouts for large segments over LAN
        fragLoadingTimeOut:        30000,
        fragLoadingMaxRetry:       6,
        fragLoadingRetryDelay:     1000,
        fragLoadingMaxRetryTimeout: 64000,

        // Manifest / level loading
        manifestLoadingTimeOut:  15000,
        manifestLoadingMaxRetry: 3,
        levelLoadingTimeOut:     15000,
        levelLoadingMaxRetry:    4,

        // ABR — conservative to prevent thrashing on large files
        abrEwmaFastVoD:      3.0,
        abrEwmaSlowVoD:      9.0,
        abrBandWidthFactor:  0.9,
        abrBandWidthUpFactor: 0.6,
        startLevel:          -1,          // let ABR pick initial quality

        nudgeMaxRetry:       5,
        enableSoftwareAES:   false,
        startFragPrefetch:   true,  // pre-fetch first fragment of new level after switch
      });
      
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        setIsLoading(false);
        console.log('[VideoPlayer] HLS manifest loaded, levels:', data.levels.length);
        
        const levels = data.levels.map((level, index) => ({
          index,
          height: level.height,
          bitrate: level.bitrate,
          label: level.height ? `${level.height}p` : `Level ${index}`
        }));
        
        setAvailableQualities(levels);
        setCurrentQuality(-1);
        
        console.log('[VideoPlayer] Available qualities:', levels);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        console.log('[VideoPlayer] Quality switched to level:', data.level);
        setIsSwitchingQuality(false);
        
        if (hls.autoLevelEnabled) {
          const currentLevel = hls.levels[data.level];
          console.log('[VideoPlayer] Auto quality:', currentLevel.height + 'p');
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('[VideoPlayer] HLS error:', data);
        
        if (data.fatal) {
          setIsLoading(false);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('[VideoPlayer] Network error, trying to recover');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('[VideoPlayer] Media error, trying to recover');
              hls.recoverMediaError();
              break;
            default:
              console.error('[VideoPlayer] Fatal error, destroying HLS');
              hls.destroy();
              break;
          }
        }
      });

      return () => {
        if (hls) {
          hls.destroy();
        }
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = hlsUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
      });
    }
  }, [hlsUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (onTimeUpdate) {
        onTimeUpdate(video.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [onTimeUpdate]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(err => console.error('Play error:', err));
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    
    video.muted = !video.muted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e) => {
    const video = videoRef.current;
    if (!video) return;
    
    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleSeek = (e) => {
    const video = videoRef.current;
    if (!video) return;
    
    const seekTime = parseFloat(e.target.value);
    video.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const toggleFullscreen = async () => {
    const container = playerContainerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
          await container.webkitRequestFullscreen();
        } else if (container.mozRequestFullScreen) {
          await container.mozRequestFullScreen();
        } else if (container.msRequestFullscreen) {
          await container.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  const changeQuality = (levelIndex) => {
    if (!hlsRef.current) return;

    const hls = hlsRef.current;
    setShowQualityMenu(false);

    if (levelIndex === -1) {
      // Re-enable ABR (auto quality) — no buffering needed
      hls.currentLevel = -1;
      setCurrentQuality(-1);
    } else {
      // Hard switch: currentLevel flushes the buffer immediately and starts
      // loading the new level right away. nextLevel would wait for the
      // existing buffer (up to 60 s) to drain first — far too slow.
      setIsSwitchingQuality(true);
      hls.currentLevel = levelIndex;
      setCurrentQuality(levelIndex);
    }
  };

  const getQualityLabel = () => {
    if (!hlsRef.current) return 'Auto';
    
    if (currentQuality === -1) {
      const hls = hlsRef.current;
      if (hls.autoLevelEnabled && hls.levels[hls.currentLevel]) {
        return `Auto (${hls.levels[hls.currentLevel].height}p)`;
      }
      return 'Auto';
    } else {
      const quality = availableQualities.find(q => q.index === currentQuality);
      return quality ? quality.label : 'Auto';
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  return (
    <div 
      ref={playerContainerRef}
      className="relative bg-black aspect-video w-full group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="w-full h-full"
        onClick={togglePlay}
        playsInline
      />

      {/* Initial loading spinner — full overlay only before first play */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60">
          <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-white" />
        </div>
      )}

      {/* Quality-switch indicator — small badge, doesn't block the video */}
      {isSwitchingQuality && !isLoading && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/70 text-white text-xs font-medium px-2.5 py-1.5 rounded-full pointer-events-none">
          <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
          Switching…
        </div>
      )}

      {/* Play button overlay */}
      {!isPlaying && !isLoading && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 hover:bg-opacity-40 transition-all"
        >
          <div className="bg-primary-600 rounded-full p-6 transform hover:scale-110 transition-transform">
            <Play className="h-12 w-12 text-white" fill="white" />
          </div>
        </button>
      )}

      {/* Controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/70 to-transparent p-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Progress bar */}
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1 mb-4 cursor-pointer accent-primary-600 appearance-none bg-gray-600 rounded-full"
          style={{
            background: `linear-gradient(to right, #f97316 0%, #f97316 ${(currentTime / duration) * 100}%, #4B5563 ${(currentTime / duration) * 100}%, #4B5563 100%)`
          }}
        />

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={togglePlay}
              className="text-white hover:text-primary-400 transition-colors"
            >
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </button>

            <div className="flex items-center space-x-2">
              <button
                onClick={toggleMute}
                className="text-white hover:text-primary-400 transition-colors"
              >
                {isMuted || volume === 0 ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 cursor-pointer accent-primary-600"
              />
            </div>

            <span className="text-white text-sm font-medium">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {/* Quality Selector */}
            {availableQualities.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowQualityMenu(!showQualityMenu)}
                  className="text-white hover:text-primary-400 transition-colors flex items-center space-x-2 px-3 py-1 rounded bg-black bg-opacity-50 hover:bg-opacity-70"
                >
                  <Settings className="h-5 w-5" />
                  <span className="text-sm font-medium">{getQualityLabel()}</span>
                </button>
                
                {showQualityMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-black bg-opacity-95 rounded-lg overflow-hidden shadow-xl min-w-[150px]">
                    <button
                      onClick={() => changeQuality(-1)}
                      className={`block w-full text-left px-4 py-3 text-white hover:bg-primary-600 transition-colors text-sm ${
                        currentQuality === -1 ? 'bg-primary-600 font-bold' : ''
                      }`}
                    >
                      Auto {currentQuality === -1 && '✓'}
                    </button>
                    
                    {[...availableQualities]
                      .sort((a, b) => b.height - a.height)
                      .map((quality) => (
                        <button
                          key={quality.index}
                          onClick={() => changeQuality(quality.index)}
                          className={`block w-full text-left px-4 py-3 text-white hover:bg-primary-600 transition-colors text-sm ${
                            currentQuality === quality.index ? 'bg-primary-600 font-bold' : ''
                          }`}
                        >
                          {quality.label} {currentQuality === quality.index && '✓'}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-primary-400 transition-colors"
            >
              {isFullscreen ? <Minimize className="h-6 w-6" /> : <Maximize className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;