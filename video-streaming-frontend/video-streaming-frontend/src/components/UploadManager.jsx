import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUpload } from '../context/UploadContext';
import { useAuth } from '../context/AuthContext';
import { X, ChevronDown, ChevronUp, CheckCircle, AlertCircle, Upload, Cpu, Clock } from 'lucide-react';

const fmt = {
  speed: (b) => b > 1e6 ? `${(b/1e6).toFixed(1)} MB/s` : b > 1024 ? `${(b/1024).toFixed(0)} KB/s` : `${b|0} B/s`,
  eta:   (s) => !s || s <= 0 ? '' : s < 60 ? `~${Math.ceil(s)}s` : `~${Math.ceil(s/60)}m`,
};

const phaseLabel = (u) => {
  if (u.phase === 'done')        return 'Tamamlandı';
  if (u.phase === 'error')       return 'Xəta baş verdi';
  if (u.phase === 'uploading')   return `Yüklənir… ${u.uploadProgress}%`;
  if (u.phase === 'processing')  return `Emal edilir… ${u.processingProgress}%`;
  return 'Başlayır…';
};

const statusColor = (u) => {
  if (u.phase === 'done')  return 'bg-green-600';
  if (u.phase === 'error') return 'bg-red-600';
  return 'bg-gradient-to-r from-primary-600 to-orange-500';
};

const PhaseIcon = ({ u }) => {
  if (u.phase === 'done')       return <CheckCircle  className="w-4 h-4 text-white flex-shrink-0" />;
  if (u.phase === 'error')      return <AlertCircle  className="w-4 h-4 text-white flex-shrink-0" />;
  if (u.phase === 'uploading')  return <Upload       className="w-4 h-4 text-white flex-shrink-0 animate-pulse" />;
  if (u.phase === 'processing') return <Cpu          className="w-4 h-4 text-white flex-shrink-0 animate-pulse" />;
  return <Clock className="w-4 h-4 text-white flex-shrink-0" />;
};

function UploadRow({ u, onDismiss, navigate }) {
  const isDone  = u.phase === 'done';
  const isError = u.phase === 'error';
  const pct     = u.phase === 'uploading' ? u.uploadProgress : u.processingProgress;

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-army-700 bg-white dark:bg-army-800">
      {/* Row header */}
      <div className={`${statusColor(u)} px-3 py-2 flex items-center gap-2`}>
        <PhaseIcon u={u} />
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold leading-tight truncate">{phaseLabel(u)}</p>
          <p className="text-white/75 text-xs truncate">{u.title}</p>
        </div>
        {(isDone || isError) && (
          <button
            onClick={() => onDismiss(u.id)}
            className="p-1 rounded hover:bg-white/15 transition-colors text-white flex-shrink-0"
            title="Bağla"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Row body */}
      <div className="p-3">
        {isError ? (
          <p className="text-sm text-red-600 dark:text-red-400">{u.error}</p>
        ) : (
          <>
            <div className="h-2 bg-gray-100 dark:bg-army-700 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isDone ? 'bg-green-500' : 'bg-gradient-to-r from-primary-500 to-orange-400'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="flex gap-1 mb-2">
              {['uploading', 'processing'].map((p, i) => (
                <div key={p} className={`flex-1 text-center py-1 rounded text-[10px] font-medium transition-colors ${
                  u.phase === p
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                    : (u.phase === 'processing' || u.phase === 'done') && p === 'uploading'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                    : 'bg-gray-100 text-gray-400 dark:bg-army-700 dark:text-gray-500'
                }`}>
                  {i + 1}. {p === 'uploading' ? 'Yükləmə' : 'Emal'}
                </div>
              ))}
            </div>

            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              {u.phase === 'uploading' && (
                <>
                  <span>{fmt.speed(u.speed)}</span>
                  <span>{fmt.eta(u.eta)}</span>
                </>
              )}
              {u.phase === 'processing' && (
                <span className="truncate w-full text-center text-gray-600 dark:text-gray-300">{u.processingStage || '…'}</span>
              )}
              {u.phase === 'idle' && (
                <span className="truncate w-full text-center text-gray-500 dark:text-gray-400">gözləyir…</span>
              )}
              {isDone && (
                <span className="text-green-600 dark:text-green-400 font-medium w-full text-center">Tamamlandı</span>
              )}
            </div>
          </>
        )}

        {isDone && u.videoId && (
          <button
            onClick={() => navigate(`/video/${u.videoId}`)}
            className="mt-2 w-full py-1.5 text-xs font-semibold bg-gradient-to-r from-primary-600 to-orange-500 text-white rounded-lg hover:from-primary-700 hover:to-orange-600 transition-all"
          >
            Videoya bax →
          </button>
        )}
      </div>
    </div>
  );
}

export default function UploadManager() {
  const { uploads, dismissUpload, queueLength, dismiss } = useUpload();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [allMinimized, setAllMinimized] = useState(false);

  // Clear the upload mini-window when the user logs out
  useEffect(() => {
    if (!isAuthenticated && uploads.length > 0) {
      dismiss();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (!uploads || uploads.length === 0) return null;

  const totalCount = uploads.length;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] w-80 bg-white dark:bg-army-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-army-700 overflow-hidden">
      {/* Container header */}
      <div className="px-4 py-3 flex items-center gap-2 bg-gradient-to-r from-primary-600 to-orange-500 text-white">
        <Upload className="w-4 h-4 flex-shrink-0" />
        <p className="text-sm font-semibold flex-1">Yükləmələr ({totalCount})</p>
        <button
          onClick={() => setAllMinimized(v => !v)}
          className="p-1 rounded hover:bg-white/15 transition-colors"
          title={allMinimized ? 'Genişləndir' : 'Yığ'}
        >
          {allMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Scrollable list */}
      {!allMinimized && (
        <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
          {uploads.map(u => (
            <UploadRow key={u.id} u={u} onDismiss={dismissUpload} navigate={navigate} />
          ))}

          {queueLength > 0 && (
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400 py-2 border-t border-dashed border-gray-200 dark:border-army-700">
              <Clock className="w-3.5 h-3.5" />
              <span>{queueLength} gözləyir</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
