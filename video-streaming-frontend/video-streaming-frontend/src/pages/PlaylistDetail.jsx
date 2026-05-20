import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ListVideo, Play, ChevronLeft, Lock, ArrowRight, Trash2, Globe, Users } from 'lucide-react';
import Navbar from '../components/Navbar';
import { getPlaylist, removeFromPlaylist } from '../services/api';
import { useAuth } from '../context/AuthContext';

const VIS_MAP = {
  PUBLIC:     { Icon: Globe,  label: 'İctimai', cls: 'text-green-500'  },
  PRIVATE:    { Icon: Lock,   label: 'Gizli',   cls: 'text-red-500'    },
  RESTRICTED: { Icon: Users,  label: 'Məhdud',  cls: 'text-yellow-500' },
};
function VisBadge({ value }) {
  const v = VIS_MAP[(value || 'PUBLIC').toUpperCase()] || VIS_MAP.PUBLIC;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${v.cls}`}>
      <v.Icon className="w-3 h-3" />{v.label}
    </span>
  );
}

const fmtDur = (s) => {
  if (!s) return '';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = (s % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m.toString().padStart(2,'0')}:${sec}` : `${m}:${sec}`;
};

const fmtViews = (v) => {
  if (!v) return '0';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return `${v}`;
};

export default function PlaylistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await getPlaylist(id);
      setPlaylist(res.data);
    } catch (err) {
      if (err?.response?.status === 403) {
        setForbidden(true);
      } else {
        navigate('/my-playlists');
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleRemove = async (videoId) => {
    if (!window.confirm('Bu video pleylistdən silinsin?')) return;
    try {
      await removeFromPlaylist(id, videoId);
      setPlaylist(p => ({ ...p, videos: p.videos.filter(v => v.videoId !== videoId) }));
    } catch { alert('Silinə bilmədi'); }
  };

  const isOwner = user && playlist && user.email === playlist.ownerEmail;
  const videos = playlist?.videos || [];
  const currentVideo = videos[currentIdx] || null;

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gray-50 dark:bg-army-900 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </>
    );
  }

  if (forbidden) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gray-50 dark:bg-army-900 flex items-center justify-center">
          <div className="text-center">
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
  }

  if (!playlist) return null;

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50 dark:bg-army-900">
        <div className="max-w-7xl mx-auto px-4 py-6">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate('/my-playlists')}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-army-800 rounded-lg transition-all">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <ListVideo className="w-6 h-6 text-primary-600" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">{playlist.name}</h1>
                <VisBadge value={playlist.visibility} />
              </div>
              {playlist.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{playlist.description}</p>
              )}
            </div>
            <span className="text-sm text-gray-400 dark:text-gray-500 flex-shrink-0">
              {videos.length} / {playlist.totalItems} video
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: current video info + play */}
            <div className="lg:col-span-2">
              {currentVideo ? (
                <div className="bg-white dark:bg-army-800 rounded-xl border border-gray-200 dark:border-army-700 overflow-hidden">
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-army-900">
                    {currentVideo.thumbnailUrl ? (
                      <img src={currentVideo.thumbnailUrl} alt={currentVideo.title}
                           className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-16 h-16 text-primary-600/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <Link to={`/video/${currentVideo.videoId}?list=${id}&index=${currentIdx}`}
                        className="bg-primary-600/90 rounded-full p-5 shadow-2xl hover:bg-primary-700 transition-colors">
                        <Play className="w-10 h-10 text-white fill-white" />
                      </Link>
                    </div>
                    {currentVideo.duration && (
                      <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-mono">
                        {fmtDur(currentVideo.duration)}
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h2 className="font-bold text-gray-900 dark:text-gray-100 text-lg leading-tight truncate">
                          {currentVideo.title}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {currentVideo.uploaderName}
                          {currentVideo.views ? ` · ${fmtViews(currentVideo.views)} baxış` : ''}
                        </p>
                      </div>
                      <Link to={`/video/${currentVideo.videoId}?list=${id}&index=${currentIdx}`}
                        className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
                        İzlə <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-400 dark:text-gray-500">
                      <span>{currentIdx + 1} / {videos.length}</span>
                      {currentIdx > 0 && (
                        <button onClick={() => setCurrentIdx(i => i - 1)}
                          className="hover:text-primary-600 transition-colors">← Əvvəlki</button>
                      )}
                      {currentIdx < videos.length - 1 && (
                        <button onClick={() => setCurrentIdx(i => i + 1)}
                          className="hover:text-primary-600 transition-colors">Növbəti →</button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-army-800 rounded-xl border border-gray-200 dark:border-army-700 p-12 text-center">
                  <Lock className="w-12 h-12 text-gray-300 dark:text-army-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">
                    {playlist.totalItems > 0
                      ? 'Bu videolar sizin üçün görünmür (gizli/məhdud)'
                      : 'Bu pleylist boşdur'}
                  </p>
                </div>
              )}
            </div>

            {/* Right: video queue */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-army-800 rounded-xl border border-gray-200 dark:border-army-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-army-700 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Növbə ({videos.length})
                  </span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-army-700 max-h-[600px] overflow-y-auto">
                  {videos.map((v, i) => (
                    <div key={v.itemId}
                         className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                           i === currentIdx
                             ? 'bg-primary-50 dark:bg-primary-900/20'
                             : 'hover:bg-gray-50 dark:hover:bg-army-700/50'
                         }`}
                         onClick={() => setCurrentIdx(i)}>
                      <span className={`w-5 text-xs font-bold flex-shrink-0 mt-0.5 ${
                        i === currentIdx ? 'text-primary-600' : 'text-gray-400 dark:text-gray-500'
                      }`}>{i + 1}</span>
                      <div className="w-16 h-9 rounded overflow-hidden flex-shrink-0 bg-army-800">
                        {v.thumbnailUrl ? (
                          <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="w-3 h-3 text-gray-500" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium line-clamp-2 leading-tight ${
                          i === currentIdx
                            ? 'text-primary-600 dark:text-primary-400'
                            : 'text-gray-800 dark:text-gray-200'
                        }`}>{v.title}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                          {v.uploaderName}
                          {v.duration ? ` · ${fmtDur(v.duration)}` : ''}
                        </p>
                      </div>
                      {isOwner && (
                        <button
                          onClick={e => { e.stopPropagation(); handleRemove(v.videoId); }}
                          className="p-1 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors flex-shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {videos.length === 0 && (
                    <div className="p-8 text-center text-gray-400 dark:text-gray-600 text-sm">
                      Görünür video yoxdur
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
