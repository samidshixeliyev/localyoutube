import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import videoService from '../services/videoService';
import VideoCard from '../components/VideoCard';
import Navbar from '../components/Navbar';
import { Loader2, Upload as UploadIcon, Cpu, CheckCircle, AlertCircle, Clock, X } from 'lucide-react';

const POLL_INTERVAL = 3000;

const QUALITY_ORDER = ['480p', '720p', '1080p', '1440p', '2160p'];

function ProcessingCard({ video, onReady, onCancel }) {
  const [progress, setProgress]       = useState(video.processingProgress || 0);
  const [stage, setStage]             = useState('');
  const [phase, setPhase]             = useState('processing');
  const [cancelling, setCancelling]   = useState(false);
  const [qualityProgress, setQualityProgress] = useState({});
  const timerRef = useRef(null);

  const poll = useCallback(async () => {
    try {
      const { status, progress: p, stage: s, qualityProgress: qp } =
        await videoService.getUploadStatus(video.id);
      setProgress(p || 0);
      setStage(s || '');
      if (qp) setQualityProgress(qp);
      if (status === 'READY') {
        setPhase('done');
        clearInterval(timerRef.current);
        onReady(video.id);
      } else if (status === 'FAILED') {
        setPhase('error');
        clearInterval(timerRef.current);
      }
    } catch { /* keep polling */ }
  }, [video.id, onReady]);

  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [poll]);

  const handleCancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    clearInterval(timerRef.current);
    try {
      await videoService.cancelUpload(video.id);
      onCancel(video.id);
    } catch {
      setCancelling(false);
      timerRef.current = setInterval(poll, POLL_INTERVAL);
    }
  };

  const isDone  = phase === 'done';
  const isError = phase === 'error';
  const isActive = !isDone && !isError;

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-army-700 bg-white dark:bg-army-800">
      <div className={`px-3 py-2 flex items-center gap-2 ${
        isDone    ? 'bg-green-600'
        : isError ? 'bg-red-600'
        : 'bg-gradient-to-r from-primary-600 to-orange-500'
      }`}>
        {isDone   ? <CheckCircle className="w-4 h-4 text-white flex-shrink-0" />
        : isError ? <AlertCircle className="w-4 h-4 text-white flex-shrink-0" />
        : <Cpu className="w-4 h-4 text-white flex-shrink-0 animate-pulse" />}

        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold leading-tight truncate">
            {isDone ? 'Tamamlandı' : isError ? 'Xəta' : `Emal edilir… ${progress}%`}
          </p>
          <p className="text-white/75 text-xs truncate">{video.title}</p>
        </div>

        {/* Cancel button for active state */}
        {isActive && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="p-1 rounded hover:bg-white/20 transition-colors text-white/80 hover:text-white disabled:opacity-50 flex-shrink-0"
            title="Ləğv et və sil"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-3">
        {isError ? (
          <p className="text-sm text-red-600 dark:text-red-400">Emal zamanı xəta baş verdi.</p>
        ) : cancelling ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Ləğv edilir…</p>
        ) : (
          <>
            {/* Overall progress bar */}
            <div className="h-1.5 bg-gray-100 dark:bg-army-700 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isDone ? 'bg-green-500' : 'bg-gradient-to-r from-primary-500 to-orange-400'
                }`}
                style={{ width: `${isDone ? 100 : progress}%` }}
              />
            </div>

            {/* Per-quality progress bars (shown during transcoding) */}
            {!isDone && Object.keys(qualityProgress).length > 0 && (
              <div className="space-y-1 mb-2">
                {QUALITY_ORDER.filter(q => q in qualityProgress).map(q => (
                  <div key={q} className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-gray-400 dark:text-gray-500 w-10 text-right flex-shrink-0">
                      {q}
                    </span>
                    <div className="flex-1 h-1.5 bg-gray-100 dark:bg-army-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          qualityProgress[q] >= 100
                            ? 'bg-green-500'
                            : 'bg-gradient-to-r from-primary-500 to-orange-400'
                        }`}
                        style={{ width: `${qualityProgress[q]}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 w-8 flex-shrink-0">
                      {qualityProgress[q] >= 100 ? '✓' : `${qualityProgress[q]}%`}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {!isDone && stage && (
              <p className="text-xs text-center text-gray-500 dark:text-gray-400 truncate">{stage}</p>
            )}
            {isDone && (
              <Link
                to={`/video/${video.id}`}
                className="mt-2 block text-center py-1.5 text-xs font-semibold bg-gradient-to-r from-primary-600 to-orange-500 text-white rounded-lg hover:from-primary-700 hover:to-orange-600 transition-all"
              >
                Videoya bax →
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const MyVideos = () => {
  const [readyVideos,      setReadyVideos]      = useState([]);
  const [processingVideos, setProcessingVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => { loadMyVideos(); }, []);

  const loadMyVideos = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await videoService.getMyVideos();
      const all = Array.isArray(data) ? data : (data.videos || []);
      const st  = (v) => (v.status || '').toLowerCase();
      setReadyVideos(all.filter(v => st(v) === 'ready'));
      setProcessingVideos(all.filter(v => ['processing', 'uploaded', 'uploading', 'pending'].includes(st(v))));
    } catch (err) {
      console.error('Error loading my videos:', err);
      setError('Videolar yüklənərkən xəta baş verdi.');
    } finally {
      setLoading(false);
    }
  };

  const handleReady = useCallback((videoId) => {
    setProcessingVideos(prev => prev.filter(v => v.id !== videoId));
    loadMyVideos();
  }, []);

  const handleCancel = useCallback((videoId) => {
    setProcessingVideos(prev => prev.filter(v => v.id !== videoId));
  }, []);

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Mənim videolarım</h1>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
          >
            <UploadIcon className="h-4 w-4" />
            Yüklə
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : error ? (
          <p className="text-red-500 dark:text-red-400">{error}</p>
        ) : (
          <>
            {/* Processing section */}
            {processingVideos.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-5 w-5 text-primary-600" />
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    Emal edilir ({processingVideos.length})
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {processingVideos.map(v => (
                    <ProcessingCard key={v.id} video={v} onReady={handleReady} onCancel={handleCancel} />
                  ))}
                </div>
              </div>
            )}

            {/* Ready videos */}
            {readyVideos.length === 0 && processingVideos.length === 0 ? (
              <div className="text-center py-12">
                <UploadIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg mb-2">Heç bir video yüklənməyib</p>
                <p className="text-gray-400 mb-6">Öz videolarınızı Orduyla paylaşın</p>
                <Link
                  to="/upload"
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <UploadIcon className="h-5 w-5" />
                  <span>İlk Videonu Yüklə</span>
                </Link>
              </div>
            ) : readyVideos.length > 0 ? (
              <>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Sizin {readyVideos.length} videonuz var.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {readyVideos.map((video) => (
                    <VideoCard key={video.id} video={video} />
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </>
  );
};

export default MyVideos;
