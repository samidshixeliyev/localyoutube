import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUpload } from '../context/UploadContext';
import { X, ChevronDown, ChevronUp, CheckCircle, AlertCircle, Upload, Cpu } from 'lucide-react';

const fmt = {
  speed: (b) => b > 1e6 ? `${(b/1e6).toFixed(1)} MB/s` : b > 1024 ? `${(b/1024).toFixed(0)} KB/s` : `${b|0} B/s`,
  eta:   (s) => !s || s <= 0 ? '' : s < 60 ? `~${Math.ceil(s)}s` : `~${Math.ceil(s/60)}m`,
};

export default function UploadManager() {
  const { state, dismiss, minimize, expand } = useUpload();
  const navigate = useNavigate();

  if (!state.active) return null;

  const { phase, title, minimized, uploadProgress, processingProgress,
          processingStage, speed, eta, videoId, error } = state;

  const isDone  = phase === 'done';
  const isError = phase === 'error';
  const pct     = phase === 'uploading' ? uploadProgress : processingProgress;

  const statusColor = isDone  ? 'bg-green-600'
                    : isError ? 'bg-red-600'
                    : 'bg-gradient-to-r from-primary-600 to-orange-500';

  const label = isDone  ? 'Upload complete'
              : isError ? 'Upload failed'
              : phase === 'uploading'   ? `Uploading… ${uploadProgress}%`
              : phase === 'processing'  ? `Processing… ${processingProgress}%`
              : 'Starting…';

  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">

      {/* Header */}
      <div className={`${statusColor} px-4 py-3 flex items-center gap-2`}>
        {isDone
          ? <CheckCircle className="w-4 h-4 text-white flex-shrink-0" />
          : isError
          ? <AlertCircle className="w-4 h-4 text-white flex-shrink-0" />
          : phase === 'uploading'
          ? <Upload className="w-4 h-4 text-white flex-shrink-0 animate-pulse" />
          : <Cpu className="w-4 h-4 text-white flex-shrink-0 animate-pulse" />
        }

        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold leading-tight truncate">{label}</p>
          <p className="text-white/75 text-xs truncate">{title}</p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={minimized ? expand : minimize}
            className="p-1 rounded hover:bg-white/15 transition-colors text-white"
          >
            {minimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {(isDone || isError) && (
            <button
              onClick={dismiss}
              className="p-1 rounded hover:bg-white/15 transition-colors text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body — hidden when minimized */}
      {!minimized && (
        <div className="p-4">

          {isError ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <>
              {/* Progress bar */}
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isDone ? 'bg-green-500' : 'bg-gradient-to-r from-primary-500 to-orange-400'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Phase tabs */}
              <div className="flex gap-1 mb-3">
                {['uploading', 'processing'].map((p, i) => (
                  <div key={p} className={`flex-1 text-center py-1 rounded text-xs font-medium transition-colors ${
                    phase === p
                      ? 'bg-primary-100 text-primary-700'
                      : (phase === 'processing' || phase === 'done') && p === 'uploading'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {i + 1}. {p === 'uploading' ? 'Upload' : 'Process'}
                  </div>
                ))}
              </div>

              {/* Stats */}
              <div className="flex justify-between text-xs text-gray-500">
                {phase === 'uploading' && (
                  <>
                    <span>{fmt.speed(speed)}</span>
                    <span>{fmt.eta(eta)}</span>
                  </>
                )}
                {phase === 'processing' && (
                  <span className="truncate w-full text-center text-gray-600">{processingStage || '…'}</span>
                )}
                {isDone && (
                  <span className="text-green-600 font-medium w-full text-center">Done!</span>
                )}
              </div>
            </>
          )}

          {/* Action buttons */}
          {isDone && videoId && (
            <button
              onClick={() => navigate(`/video/${videoId}`)}
              className="mt-3 w-full py-2 text-xs font-semibold bg-gradient-to-r from-primary-600 to-orange-500 text-white rounded-lg hover:from-primary-700 hover:to-orange-600 transition-all"
            >
              View video →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
