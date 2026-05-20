import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ListVideo, Play, ChevronLeft, Lock, Trash2,
  Globe, Users, Link2, Shuffle, RotateCcw, ChevronDown, ChevronUp,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import ConfirmModal from '../components/ConfirmModal';
import { getPlaylist, removeFromPlaylist } from '../services/api';
import { useAuth } from '../context/AuthContext';

/* ── helpers ─────────────────────────────────────────────────── */
const fmtDur = (s) => {
  if (!s) return '';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = (s % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};
const fmtViews = (v) => {
  if (!v) return '0';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return `${v}`;
};

/* ── visibility badge ────────────────────────────────────────── */
const VIS_MAP = {
  PUBLIC:     { Icon: Globe,     label: 'İctimai',   cls: 'text-green-500'  },
  PRIVATE:    { Icon: Lock,      label: 'Gizli',     cls: 'text-red-500'    },
  RESTRICTED: { Icon: Users,     label: 'Məhdud',    cls: 'text-yellow-500' },
  UNLISTED:   { Icon: Link2,     label: 'Siyahısız', cls: 'text-gray-400'   },
};
function VisBadge({ value }) {
  const v = VIS_MAP[(value || 'PUBLIC').toUpperCase()] || VIS_MAP.PUBLIC;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${v.cls}`}>
      <v.Icon className="w-3 h-3" />{v.label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function PlaylistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const listRef = useRef(null);

  const [playlist,  setPlaylist]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [descOpen,   setDescOpen]   = useState(false);
  const [shuffled,   setShuffled]   = useState(false);
  const [displayOrder, setDisplayOrder] = useState([]); // indices into playlist.videos
  const [removeTarget, setRemoveTarget] = useState(null); // videoId pending removal
  const [removeError,  setRemoveError]  = useState('');

  const load = useCallback(async () => {
    try {
      const res = await getPlaylist(id);
      setPlaylist(res.data);
      setDisplayOrder(res.data.videos.map((_, i) => i));
    } catch (err) {
      if (err?.response?.status === 403) setForbidden(true);
      else navigate('/my-playlists');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  // Scroll the active item into view in the queue list
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector('[data-active="true"]');
    if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentIdx]);

  const confirmRemove = async () => {
    if (!removeTarget) return;
    try {
      await removeFromPlaylist(id, removeTarget);
      const newVideos = playlist.videos.filter(v => v.videoId !== removeTarget);
      setPlaylist(p => ({ ...p, videos: newVideos, totalItems: p.totalItems - 1 }));
      setDisplayOrder(newVideos.map((_, i) => i));
      if (currentIdx >= newVideos.length) setCurrentIdx(Math.max(0, newVideos.length - 1));
    } catch { setRemoveError('Video silinə bilmədi'); }
    finally { setRemoveTarget(null); }
  };

  const toggleShuffle = () => {
    if (shuffled) {
      setDisplayOrder(playlist.videos.map((_, i) => i));
    } else {
      const arr = playlist.videos.map((_, i) => i);
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      setDisplayOrder(arr);
    }
    setShuffled(s => !s);
    setCurrentIdx(0);
  };

  const isOwner = user && playlist && user.email === playlist.ownerEmail;
  const videos  = playlist?.videos || [];
  // current video index in original array
  const realIdx = displayOrder[currentIdx] ?? 0;
  const currentVideo = videos[realIdx] ?? null;

  /* ── Loading ── */
  if (loading) return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50 dark:bg-army-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </>
  );

  /* ── Forbidden ── */
  if (forbidden) return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50 dark:bg-army-900 flex items-center justify-center">
        <div className="text-center px-4">
          <Lock className="w-16 h-16 text-gray-300 dark:text-army-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Giriş qadağandır</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Bu pleylist gizlidir və ya sizin üçün məhdudlaşdırılıb.</p>
          <button onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
            Ana Səhifəyə Qayıt
          </button>
        </div>
      </div>
    </>
  );

  if (!playlist) return null;

  const coverUrl = videos[0]?.thumbnailUrl || null;
  const totalDuration = videos.reduce((s, v) => s + (v.duration || 0), 0);
  const desc = playlist.description || '';

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50 dark:bg-army-900">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6">

          {/* Back button */}
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-5 transition-colors">
            <ChevronLeft className="w-4 h-4" />Geri
          </button>

          <div className="flex flex-col lg:flex-row gap-6">

            {/* ── LEFT: Playlist info card (sticky on desktop) ── */}
            <div className="lg:w-80 xl:w-96 flex-shrink-0">
              <div className="lg:sticky lg:top-6">
                <div className="bg-gradient-to-b from-gray-800 to-gray-950 dark:from-army-800 dark:to-army-950 rounded-2xl overflow-hidden shadow-xl">

                  {/* Cover thumbnail */}
                  <div className="relative aspect-video">
                    {coverUrl ? (
                      <img src={coverUrl} alt={playlist.name} className="w-full h-full object-cover opacity-80" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-700 dark:bg-army-800">
                        <ListVideo className="w-20 h-20 text-gray-500 dark:text-army-600" />
                      </div>
                    )}
                    {/* Play all overlay */}
                    {currentVideo && (
                      <Link
                        to={`/video/${currentVideo.videoId}?list=${id}&index=${realIdx}`}
                        className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 group hover:bg-black/50 transition-colors"
                      >
                        <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                          <Play className="w-7 h-7 text-gray-900 fill-gray-900 ml-1" />
                        </div>
                        <span className="text-white text-sm font-semibold">Hamısını Oynat</span>
                      </Link>
                    )}
                  </div>

                  {/* Playlist info */}
                  <div className="p-4">
                    <h1 className="text-white font-bold text-lg leading-tight mb-1">{playlist.name}</h1>

                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <VisBadge value={playlist.visibility} />
                      <span className="text-gray-400 text-xs">·</span>
                      <span className="text-gray-400 text-xs">{playlist.ownerEmail?.split('@')[0]}</span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                      <span>{videos.length} video görünür</span>
                      {playlist.totalItems !== videos.length && (
                        <span className="text-gray-500">({playlist.totalItems} ümumi)</span>
                      )}
                      {totalDuration > 0 && (
                        <>
                          <span>·</span>
                          <span>{fmtDur(totalDuration)}</span>
                        </>
                      )}
                    </div>

                    {/* Description */}
                    {desc && (
                      <div className="mb-3">
                        <p className={`text-gray-300 text-xs leading-relaxed ${descOpen ? '' : 'line-clamp-2'}`}>
                          {desc}
                        </p>
                        {desc.length > 80 && (
                          <button
                            onClick={() => setDescOpen(o => !o)}
                            className="flex items-center gap-0.5 text-gray-400 hover:text-white text-xs mt-1 transition-colors"
                          >
                            {descOpen ? <><ChevronUp className="w-3 h-3" />Az göstər</> : <><ChevronDown className="w-3 h-3" />Daha çox</>}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Controls */}
                    <div className="flex items-center gap-2 pt-1">
                      {currentVideo && (
                        <Link
                          to={`/video/${currentVideo.videoId}?list=${id}&index=${realIdx}`}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold transition-colors"
                        >
                          <Play className="w-4 h-4 fill-white" />Oynat
                        </Link>
                      )}
                      <button
                        onClick={toggleShuffle}
                        title="Qarışdır"
                        className={`p-2 rounded-lg transition-colors ${
                          shuffled
                            ? 'bg-primary-600 text-white'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                      >
                        <Shuffle className="w-4 h-4" />
                      </button>
                      <button
                        title="Dövrü oynat"
                        className="p-2 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
                        onClick={() => setCurrentIdx(0)}
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── RIGHT: Video queue ── */}
            <div className="flex-1 min-w-0">
              <div
                ref={listRef}
                className="bg-white dark:bg-army-800 rounded-2xl border border-gray-200 dark:border-army-700 overflow-hidden"
              >
                {/* Queue header */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-army-700 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Pleylist — {videos.length} video
                  </span>
                  {shuffled && (
                    <span className="text-xs text-primary-500 font-medium flex items-center gap-1">
                      <Shuffle className="w-3 h-3" />Qarışdırılıb
                    </span>
                  )}
                </div>

                {/* Video rows */}
                <div className="divide-y divide-gray-100 dark:divide-army-700/60">
                  {displayOrder.map((realI, queueI) => {
                    const v = videos[realI];
                    if (!v) return null;
                    const isActive = queueI === currentIdx;

                    return (
                      <div
                        key={v.itemId}
                        data-active={isActive}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer group transition-colors relative ${
                          isActive
                            ? 'bg-primary-50 dark:bg-primary-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-army-700/40'
                        }`}
                        onClick={() => setCurrentIdx(queueI)}
                      >
                        {/* Active left accent bar */}
                        {isActive && (
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary-600 rounded-r" />
                        )}

                        {/* Index / play indicator */}
                        <div className="w-6 flex-shrink-0 flex items-center justify-center">
                          {isActive ? (
                            <Play className="w-3.5 h-3.5 text-primary-600 fill-primary-600" />
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                              {queueI + 1}
                            </span>
                          )}
                        </div>

                        {/* Thumbnail */}
                        <div className="w-24 h-[54px] rounded-lg overflow-hidden flex-shrink-0 bg-gray-900 dark:bg-army-900 relative">
                          {v.thumbnailUrl ? (
                            <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Play className="w-4 h-4 text-gray-500" />
                            </div>
                          )}
                          {v.duration && (
                            <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[10px] px-1 rounded font-mono leading-tight">
                              {fmtDur(v.duration)}
                            </span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium line-clamp-2 leading-tight ${
                            isActive
                              ? 'text-primary-600 dark:text-primary-400'
                              : 'text-gray-800 dark:text-gray-200'
                          }`}>
                            {v.title}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                            {v.uploaderName}
                            {v.views ? ` · ${fmtViews(v.views)} baxış` : ''}
                          </p>
                        </div>

                        {/* Watch button (on hover / active) */}
                        <Link
                          to={`/video/${v.videoId}?list=${id}&index=${realI}`}
                          onClick={e => e.stopPropagation()}
                          className={`flex-shrink-0 p-1.5 rounded-lg transition-all ${
                            isActive
                              ? 'text-primary-600 bg-primary-100 dark:bg-primary-900/30'
                              : 'text-gray-400 opacity-0 group-hover:opacity-100 hover:text-primary-600'
                          }`}
                          title="İzlə"
                        >
                          <Play className="w-4 h-4 fill-current" />
                        </Link>

                        {/* Remove (owner only) */}
                        {isOwner && (
                          <button
                            onClick={e => { e.stopPropagation(); setRemoveTarget(v.videoId); }}
                            className="flex-shrink-0 p-1.5 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg"
                            title="Pleylistdən sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {videos.length === 0 && (
                    <div className="py-16 text-center">
                      <ListVideo className="w-12 h-12 text-gray-300 dark:text-army-600 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        {playlist.totalItems > 0
                          ? 'Bu videolar sizin üçün görünmür (gizli / məhdud)'
                          : 'Bu pleylist boşdur'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={!!removeTarget}
        title="Video silinsin?"
        message="Bu video pleylistdən silinsin? Video özü silinmir."
        confirmLabel="Sil"
        onConfirm={confirmRemove}
        onClose={() => setRemoveTarget(null)}
      />

      {removeError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg"
          onClick={() => setRemoveError('')}>
          {removeError}
        </div>
      )}
    </>
  );
}
