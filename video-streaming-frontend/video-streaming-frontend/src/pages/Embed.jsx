import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import videoService from '../services/videoService';
import VideoPlayer from '../components/VideoPlayer';
import { Loader2, AlertCircle } from 'lucide-react';

/**
 * Minimal embed page — rendered inside an <iframe>.
 * No Navbar, no sidebar, just the video player on a black background.
 *
 * Usage:
 *   <iframe src="https://yoursite/embed/VIDEO_ID" width="640" height="360"
 *           frameborder="0" allowfullscreen allow="autoplay; fullscreen"></iframe>
 */
const Embed = () => {
  const { id } = useParams();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewIncremented, setViewIncremented] = useState(false);

  useEffect(() => {
    videoService.getVideo(id)
      .then(data => {
        setVideo(data);
        setError('');
      })
      .catch(() => setError('Video not found or not available.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleTimeUpdate = (currentTime) => {
    if (currentTime > 3 && !viewIncremented) {
      videoService.incrementView(id).catch(() => {});
      setViewIncremented(true);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-white/60" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center gap-3">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-white/70 text-sm">{error || 'Video not found.'}</p>
      </div>
    );
  }

  if (video.status !== 'ready') {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-white/60" />
        <p className="text-white/70 text-sm">
          {video.status === 'processing' ? 'Video is being processed…' : 'Video is uploading…'}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black overflow-hidden">
      <VideoPlayer
        hlsUrl={video.hlsUrl}
        onTimeUpdate={handleTimeUpdate}
      />
    </div>
  );
};

export default Embed;
