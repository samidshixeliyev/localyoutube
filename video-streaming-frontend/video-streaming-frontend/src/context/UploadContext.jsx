import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import videoService from '../services/videoService';

const UploadContext = createContext(null);
export const useUpload = () => useContext(UploadContext);

const CHUNK_SIZE        = 20 * 1024 * 1024; // 20 MB
const MAX_RETRIES       = 3;
const DEFAULT_CONCURRENCY = 2;

/** Fetches the admin-configured max parallel upload chunks. Falls back to DEFAULT_CONCURRENCY. */
async function fetchConcurrency() {
  try {
    const res = await fetch('/api/config/upload');
    if (!res.ok) return DEFAULT_CONCURRENCY;
    const cfg = await res.json();
    const n = parseInt(cfg.maxParallelUploads, 10);
    return Number.isFinite(n) ? Math.max(1, Math.min(10, n)) : DEFAULT_CONCURRENCY;
  } catch {
    return DEFAULT_CONCURRENCY;
  }
}

const IDLE = {
  active: false, minimized: false,
  title: '', phase: 'idle',         // idle | uploading | processing | done | error
  uploadProgress: 0, processingProgress: 0,
  processingStage: '', speed: 0, eta: null,
  videoId: null, error: null,
};

export const UploadProvider = ({ children }) => {
  const [state, setState] = useState(IDLE);

  // Refs survive re-renders and async loops without stale closures
  const pollRef      = useRef(null);
  const startRef     = useRef(null);
  const bytesRef     = useRef(0);

  const patch = useCallback(updates =>
    setState(prev => ({ ...prev, ...updates })), []);

  // ── helpers ────────────────────────────────────────────────────────────────

  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const startPoll = (videoId) => {
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const { status, progress, stage } = await videoService.getUploadStatus(videoId);
        patch({ processingProgress: progress || 0, processingStage: stage || '' });
        if (status === 'READY') {
          stopPoll();
          patch({ phase: 'done', processingProgress: 100, processingStage: 'Ready' });
        } else if (status === 'FAILED') {
          stopPoll();
          patch({ phase: 'error', error: 'Transcoding failed. Open upload page to retry.' });
        }
      } catch { /* network blip — keep polling */ }
    }, 2000);
  };

  const uploadChunkWithRetry = async (chunk, idx, total, videoId) => {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await videoService.uploadChunk(chunk, idx, total, videoId);
        return;
      } catch (err) {
        if (attempt === MAX_RETRIES - 1) throw err;
        await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  };

  // ── public API ─────────────────────────────────────────────────────────────

  /**
   * Called from UploadPage after form validation.
   * Runs entirely in the background — the page can unmount safely.
   */
  const startUpload = useCallback(async (file, meta) => {
    const { title, description, tags, visibility, allowedEmails } = meta;

    patch({ ...IDLE, active: true, title: title || file.name, phase: 'uploading' });

    // Resolve concurrency from admin setting before starting
    const concurrency = await fetchConcurrency();

    const chunks = Math.ceil(file.size / CHUNK_SIZE);
    startRef.current = Date.now();
    bytesRef.current = 0;

    try {
      const { videoId } = await videoService.initUpload(
        file.name, title, description, file.size, chunks
      );
      patch({ videoId });

      let next = 0, done = 0;

      const worker = async () => {
        while (next < chunks) {
          const idx   = next++;
          const start = idx * CHUNK_SIZE;
          const end   = Math.min(start + CHUNK_SIZE, file.size);

          await uploadChunkWithRetry(file.slice(start, end), idx, chunks, videoId);

          done++;
          bytesRef.current += (end - start);
          const elapsed = (Date.now() - startRef.current) / 1000;
          const speed   = elapsed > 0 ? bytesRef.current / elapsed : 0;
          const eta     = speed > 0 ? (file.size - bytesRef.current) / speed : null;
          patch({
            uploadProgress: Math.round((done / chunks) * 100),
            speed, eta,
          });
        }
      };

      await Promise.all(Array.from({ length: Math.min(concurrency, chunks) }, worker));
      await videoService.completeUpload(videoId);

      if (visibility !== 'public' || allowedEmails.length > 0)
        await videoService.setPrivacy(videoId, { visibility, allowedUserEmails: allowedEmails });
      if (tags.length > 0)
        await videoService.updateVideo(videoId, { tags });

      patch({ phase: 'processing', uploadProgress: 100, processingProgress: 0, processingStage: 'Starting…' });
      startPoll(videoId);

    } catch (err) {
      stopPoll();
      patch({ phase: 'error', error: err.response?.data?.message || err.message || 'Upload failed' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss  = useCallback(() => { stopPoll(); setState(IDLE); }, []);
  const minimize = useCallback(() => patch({ minimized: true  }), [patch]);
  const expand   = useCallback(() => patch({ minimized: false }), [patch]);

  return (
    <UploadContext.Provider value={{ state, startUpload, dismiss, minimize, expand }}>
      {children}
    </UploadContext.Provider>
  );
};
