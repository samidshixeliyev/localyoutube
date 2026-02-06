import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const MiniPlayerContext = createContext(null);

export function MiniPlayerProvider({ children }) {
    const [miniPlayerState, setMiniPlayerState] = useState({
        active: false,
        videoId: null,
        title: '',
        hlsUrl: null,
        currentTime: 0,
        isPlaying: false,
    });

    const playerRef = useRef(null);

    const activateMiniPlayer = useCallback((videoData) => {
        setMiniPlayerState({
            active: true,
            videoId: videoData.videoId,
            title: videoData.title || '',
            hlsUrl: videoData.hlsUrl,
            currentTime: videoData.currentTime || 0,
            isPlaying: true,
        });
    }, []);

    const closeMiniPlayer = useCallback(() => {
        setMiniPlayerState({
            active: false,
            videoId: null,
            title: '',
            hlsUrl: null,
            currentTime: 0,
            isPlaying: false,
        });
    }, []);

    const updateCurrentTime = useCallback((time) => {
        setMiniPlayerState(prev => ({ ...prev, currentTime: time }));
    }, []);

    const togglePlayPause = useCallback(() => {
        setMiniPlayerState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
    }, []);

    return (
        <MiniPlayerContext.Provider value={{
            miniPlayerState,
            playerRef,
            activateMiniPlayer,
            closeMiniPlayer,
            updateCurrentTime,
            togglePlayPause,
        }}>
            {children}
        </MiniPlayerContext.Provider>
    );
}

export function useMiniPlayer() {
    const context = useContext(MiniPlayerContext);
    if (!context) {
        throw new Error('useMiniPlayer must be used within MiniPlayerProvider');
    }
    return context;
}

export default MiniPlayerContext;