import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import videoService from '../services/videoService';

const UploadContext = createContext(null);
export const useUpload = () => useContext(UploadContext);

const MAX_RETRIES = 3;

const MB = 1024 * 1024;
const GB = 1024 * MB;

// Scale chunk size with file size:
//   < 50 MB  →  2 MB  (few chunks, fast start for tiny files)
//   < 200 MB →  5 MB
//   < 500 MB → 10 MB
//   < 2 GB   → 20 MB
//   ≥ 2 GB   → 50 MB  (fewer round-trips for huge files)
function getChunkSize(fileSize) {
  if (fileSize < 50  * MB) return  2 * MB;
  if (fileSize < 200 * MB) return  5 * MB;
  if (fileSize < 500 * MB) return 10 * MB;
  if (fileSize <  2  * GB) return 20 * MB;
  return 50 * MB;
}

async function fetchUploadConfig() {
  try {
    const res = await fetch('/api/config/upload');
    if (!res.ok) return { chunks: 2, concurrent: 2 };
    const cfg = await res.json();
    const chunks     = parseInt(cfg.maxParallelUploads, 10);
    const concurrent = parseInt(cfg.maxConcurrentUploads, 10);
    return {
      chunks:     Number.isFinite(chunks)     ? Math.max(1, Math.min(10, chunks))     : 2,
      concurrent: Number.isFinite(concurrent) ? Math.max(1, Math.min(5,  concurrent)) : 2,
    };
  } catch {
    return { chunks: 2, concurrent: 2 };
  }
}

const IDLE = {
  active: false, minimized: false,
  title: '', phase: 'idle',
  uploadProgress: 0, processingProgress: 0,
  processingStage: '', speed: 0, eta: null,
  videoId: null, error: null,
};

let _nextId = 1;
const makeId = () => `up-${Date.now()}-${_nextId++}`;

const isFinished = (u) => u.phase === 'done' || u.phase === 'error';

const isAbortError = (err) =>
  err?.name === 'AbortError' ||
  err?.name === 'CanceledError' ||
  err?.code === 'ERR_CANCELED';

export const UploadProvider = ({ children }) => {
  const [uploads, setUploads] = useState([]);
  const [queue,   setQueue]   = useState([]);

  const uploadConfigRef = useRef({ chunks: 2, concurrent: 2 });
  const pollsRef        = useRef(new Map());   // id -> intervalHandle
  const startTimeRef    = useRef(new Map());   // id -> Date.now()
  const bytesRef        = useRef(new Map());   // id -> bytes uploaded
  const cancelRef       = useRef(new Map());   // id -> { ctrl: AbortController, videoId: string|null }

  useEffect(() => {
    fetchUploadConfig().then(cfg => { uploadConfigRef.current = cfg; });
  }, []);

  const patchUpload = useCallback((id, updates) => {
    setUploads(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
  }, []);

  const stopPoll = (id) => {
    const handle = pollsRef.current.get(id);
    if (handle) { clearInterval(handle); pollsRef.current.delete(id); }
  };

  const stopAllPolls = () => {
    pollsRef.current.forEach(h => clearInterval(h));
    pollsRef.current.clear();
  };

  const uploadChunkWithRetry = async (chunk, idx, total, videoId, signal) => {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      try {
        await videoService.uploadChunk(chunk, idx, total, videoId, signal);
        return;
      } catch (err) {
        if (isAbortError(err)) throw err;
        if (attempt === MAX_RETRIES - 1) throw err;
        await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  };

  const runningCountRef = useRef(0);

  const onJobFinished = useCallback((id) => {
    runningCountRef.current = Math.max(0, runningCountRef.current - 1);
    setQueue(prevQueue => {
      if (prevQueue.length === 0) return prevQueue;
      const max = uploadConfigRef.current.concurrent || 2;
      if (runningCountRef.current >= max) return prevQueue;
      const [next, ...rest] = prevQueue;
      setTimeout(() => beginJob(next.file, next.meta, next.id), 0);
      return rest;
    });
  }, []);

  const beginJob = useCallback((file, meta, id) => {
    runningCountRef.current += 1;
    runJob(file, meta, id).finally(() => onJobFinished(id));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onJobFinished]);

  const startPoll = (id, videoId) => {
    stopPoll(id);
    const handle = setInterval(async () => {
      try {
        const { status, progress, stage } = await videoService.getUploadStatus(videoId);
        patchUpload(id, { processingProgress: progress || 0, processingStage: stage || '' });
        if (status === 'READY') {
          stopPoll(id);
          cancelRef.current.delete(id);
          patchUpload(id, { phase: 'done', processingProgress: 100, processingStage: 'Ready' });
        } else if (status === 'FAILED') {
          stopPoll(id);
          cancelRef.current.delete(id);
          patchUpload(id, { phase: 'error', error: 'Transkodlama uğursuz oldu. Yenidən yükləyin.' });
        }
      } catch { /* network blip — keep polling */ }
    }, 2000);
    pollsRef.current.set(id, handle);
  };

  const runJob = async (file, meta, id) => {
    const { title, description, tags, visibility, allowedEmails, isShorts } = meta;

    patchUpload(id, { phase: 'uploading', title: title || file.name });

    const ctrl = new AbortController();
    cancelRef.current.set(id, { ctrl, videoId: null });
    const signal = ctrl.signal;

    const cfg       = uploadConfigRef.current;
    const CHUNK_SIZE = getChunkSize(file.size);
    const chunks    = Math.ceil(file.size / CHUNK_SIZE);
    startTimeRef.current.set(id, Date.now());
    bytesRef.current.set(id, 0);

    try {
      const { videoId } = await videoService.initUpload(
        file.name, title, description, file.size, chunks
      );
      patchUpload(id, { videoId });

      // Store videoId so cancelUpload can delete it from server
      const entry = cancelRef.current.get(id);
      if (entry) entry.videoId = videoId;

      if (signal.aborted) return;

      let next = 0, done = 0;

      const worker = async () => {
        while (next < chunks) {
          if (signal.aborted) return;
          const idx   = next++;
          const start = idx * CHUNK_SIZE;
          const end   = Math.min(start + CHUNK_SIZE, file.size);

          await uploadChunkWithRetry(file.slice(start, end), idx, chunks, videoId, signal);

          if (signal.aborted) return;
          done++;
          const prevBytes = bytesRef.current.get(id) || 0;
          const newBytes  = prevBytes + (end - start);
          bytesRef.current.set(id, newBytes);

          const startedAt = startTimeRef.current.get(id) || Date.now();
          const elapsed   = (Date.now() - startedAt) / 1000;
          const speed     = elapsed > 0 ? newBytes / elapsed : 0;
          const eta       = speed > 0 ? (file.size - newBytes) / speed : null;
          patchUpload(id, {
            uploadProgress: Math.round((done / chunks) * 100),
            speed, eta,
          });
        }
      };

      await Promise.all(Array.from({ length: Math.min(cfg.chunks, chunks) }, worker));

      if (signal.aborted) return;

      await videoService.completeUpload(videoId);

      if (signal.aborted) return;

      if (visibility !== 'public' || (allowedEmails && allowedEmails.length > 0))
        await videoService.setPrivacy(videoId, { visibility, allowedUserEmails: allowedEmails });
      if ((tags && tags.length > 0) || isShorts) {
        await videoService.updateVideo(videoId, { tags: tags || [], isShorts: !!isShorts });
      }

      patchUpload(id, {
        phase: 'processing',
        uploadProgress: 100,
        processingProgress: 0,
        processingStage: 'Başlayır…',
      });
      startPoll(id, videoId);

    } catch (err) {
      if (isAbortError(err)) return; // cancelled — dismissUpload already called

      stopPoll(id);
      cancelRef.current.delete(id);
      patchUpload(id, {
        phase: 'error',
        error: err.response?.data?.message || err.message || 'Yükləmə uğursuz oldu',
      });
    }
  };

  // ── Public API ──────────────────────────────────────────────────────────────

  const startUpload = useCallback((file, meta) => {
    const id = makeId();
    const entry = {
      ...IDLE,
      id,
      active: true,
      title: (meta && meta.title) || file.name,
      phase: 'uploading',
      minimized: false,
    };
    setUploads(prev => [...prev, entry]);

    const max = uploadConfigRef.current.concurrent || 2;
    if (runningCountRef.current < max) {
      beginJob(file, meta, id);
    } else {
      patchUpload(id, { phase: 'idle', processingStage: 'Növbədə' });
      setQueue(prev => [...prev, { id, file, meta }]);
    }
    return id;
  }, [beginJob, patchUpload]);

  const dismissUpload = useCallback((id) => {
    stopPoll(id);
    cancelRef.current.delete(id);
    bytesRef.current.delete(id);
    startTimeRef.current.delete(id);
    setUploads(prev => prev.filter(u => u.id !== id));
    setQueue(prev => prev.filter(q => q.id !== id));
  }, []);

  const cancelUpload = useCallback(async (id) => {
    const entry = cancelRef.current.get(id);

    // Abort in-flight chunk requests
    entry?.ctrl?.abort();

    // Stop transcoding poll
    stopPoll(id);

    // Delete video data from server
    const videoId = entry?.videoId;
    if (videoId) {
      try {
        await videoService.cancelUpload(videoId);
      } catch { /* best-effort — server recovery on restart handles it */ }
    }

    cancelRef.current.delete(id);
    bytesRef.current.delete(id);
    startTimeRef.current.delete(id);
    setUploads(prev => prev.filter(u => u.id !== id));
    setQueue(prev => prev.filter(q => q.id !== id));
  }, []);

  const minimizeUpload = useCallback((id) => patchUpload(id, { minimized: true  }), [patchUpload]);
  const expandUpload   = useCallback((id) => patchUpload(id, { minimized: false }), [patchUpload]);

  const clearAllUploads = useCallback(() => {
    stopAllPolls();
    cancelRef.current.forEach(entry => entry?.ctrl?.abort());
    cancelRef.current.clear();
    runningCountRef.current = 0;
    bytesRef.current.clear();
    startTimeRef.current.clear();
    setUploads([]);
    setQueue([]);
  }, []);

  const firstUpload = uploads[0];
  const state = firstUpload ? { ...firstUpload } : { ...IDLE };

  const dismiss = useCallback((id) => {
    if (id) return dismissUpload(id);
    if (firstUpload) dismissUpload(firstUpload.id);
    else {
      stopAllPolls();
      setUploads([]);
      setQueue([]);
    }
  }, [dismissUpload, firstUpload]);

  const minimize = useCallback((id) => {
    if (id) return minimizeUpload(id);
    if (firstUpload) minimizeUpload(firstUpload.id);
  }, [minimizeUpload, firstUpload]);

  const expand = useCallback((id) => {
    if (id) return expandUpload(id);
    if (firstUpload) expandUpload(firstUpload.id);
  }, [expandUpload, firstUpload]);

  return (
    <UploadContext.Provider value={{
      uploads,
      state,
      startUpload,
      dismiss,
      minimize,
      expand,
      dismissUpload,
      minimizeUpload,
      expandUpload,
      cancelUpload,
      clearAllUploads,
      queueLength: queue.length,
    }}>
      {children}
    </UploadContext.Provider>
  );
};
