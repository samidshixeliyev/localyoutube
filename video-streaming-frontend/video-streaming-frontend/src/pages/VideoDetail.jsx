import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import videoService from "../services/videoService";
import VideoPlayer from "../components/VideoPlayer";
import ThumbnailUpload from "../components/ThumbnailUpload";
import CommentSection from "../components/CommentSection";
import VideoSuggestions from "../components/VideoSuggestion";
import Navbar from "../components/Navbar";
import {
  ThumbsUp, Eye, Calendar, Trash2, Loader2, Image,
  Edit2, Lock, Globe, Link2, Users, Save, X, Check,
  Plus, Hash, Code2, Copy, CheckCheck, ChevronDown, ChevronUp,
  Play, SkipForward
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useMiniPlayer } from "../context/MiniPlayerContext";
import api, { adminGetUsers } from "../services/api";

/* ── visibility helpers ──────────────────────────────────────── */
const VISIBILITY = {
  PUBLIC:     { icon: Globe,  label: 'İctimai',      color: 'bg-green-500',  border: 'border-green-500' },
  UNLISTED:   { icon: Link2,  label: 'Siyahısız',    color: 'bg-yellow-500', border: 'border-yellow-500' },
  PRIVATE:    { icon: Lock,   label: 'Gizli',        color: 'bg-red-500',    border: 'border-red-500' },
  RESTRICTED: { icon: Users,  label: 'Məhdud',       color: 'bg-purple-500', border: 'border-purple-500' },
};
const getVis = (v) => VISIBILITY[(v || 'PUBLIC').toUpperCase()] || VISIBILITY.PUBLIC;

/* ── formatters ─────────────────────────────────────────────── */
const fmtViews = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n/1_000).toFixed(1)}K`;
  return `${n}`;
};
const AZ_MONTHS = ['yanvar','fevral','mart','aprel','may','iyun','iyul','avqust','sentyabr','oktyabr','noyabr','dekabr'];
const fmtDate = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getDate()} ${AZ_MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/* ═══════════════════════════════════════════════════════════════ */
const VideoDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startTime = parseInt(searchParams.get('t') || '0', 10) || 0;
  const { isAuthenticated, user } = useAuth();
  const { activateMiniPlayer, closeMiniPlayer } = useMiniPlayer();

  // Refs for mini-player activation on unmount
  const videoDataRef = useRef(null);
  const currentTimeRef = useRef(0);
  const activateMiniPlayerRef = useRef(activateMiniPlayer);

  const [video,            setVideo]            = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState('');
  const [liked,            setLiked]            = useState(false);
  const [isLiking,         setIsLiking]         = useState(false);
  const [viewIncremented,  setViewIncremented]  = useState(false);
  const [currentUser,      setCurrentUser]      = useState(null);
  const [showThumbnailUpload, setShowThumbnailUpload] = useState(false);
  const [descExpanded,     setDescExpanded]     = useState(false);

  // Autoplay next video
  const [nextVideo, setNextVideo] = useState(null);
  const [autoplayCountdown, setAutoplayCountdown] = useState(null);

  // Edit
  const [isEditing, setIsEditing] = useState(false);
  const [editForm,  setEditForm]  = useState({ title:'', description:'', visibility:'PUBLIC', allowedEmails:[], tags:[] });
  const [emailInput, setEmailInput] = useState('');
  const [tagInput,   setTagInput]   = useState('');
  const [saving,     setSaving]     = useState(false);

  // Embed (admin only)
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [embedCopied,    setEmbedCopied]    = useState(false);

  // Email autocomplete for restricted edit
  const [emailSuggestions, setEmailSuggestions] = useState([]);
  const [showEmailSug,     setShowEmailSug]     = useState(false);
  const emailSugRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (emailSugRef.current && !emailSugRef.current.contains(e.target)) setShowEmailSug(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchEmailSuggestions = async (q) => {
    if (q.length < 2) { setEmailSuggestions([]); setShowEmailSug(false); return; }
    try {
      const res = await adminGetUsers();
      const users = (res.data || []).filter(u =>
        u.email?.toLowerCase().includes(q.toLowerCase()) ||
        u.fullName?.toLowerCase().includes(q.toLowerCase()) ||
        u.name?.toLowerCase().includes(q.toLowerCase())
      ).slice(0, 5);
      setEmailSuggestions(users);
      setShowEmailSug(users.length > 0);
    } catch { setEmailSuggestions([]); }
  };

  // Keep activateMiniPlayer ref fresh
  useEffect(() => { activateMiniPlayerRef.current = activateMiniPlayer; });
  // Keep video data ref fresh
  useEffect(() => { videoDataRef.current = video; }, [video]);

  // Close mini player when entering a video page; activate it when leaving
  useEffect(() => {
    closeMiniPlayer();
    return () => {
      const v = videoDataRef.current;
      const t = currentTimeRef.current;
      if (v?.hlsUrl && v?.status?.toLowerCase() === 'ready' && t > 1) {
        activateMiniPlayerRef.current({
          videoId: id,
          title: v.title,
          hlsUrl: v.hlsUrl,
          currentTime: t,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* decode JWT -------------------------------------------------- */
  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (!token) { setCurrentUser(null); return; }
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      const email = payload.email || payload.sub || payload.username;
      const perms = payload.permissions || [];
      const role  = payload.role || '';
      setCurrentUser({
        email,
        username: payload.username || payload.name || email.split('@')[0],
        permissions: perms,
        role,
        isAdmin: perms.includes('super-admin') || perms.includes('admin-modtube') ||
                 role === 'ADMIN' || role === 'SUPER_ADMIN',
      });
    } catch { setCurrentUser(null); }
  }, []);

  /* load video -------------------------------------------------- */
  useEffect(() => { loadVideo(); }, [id]);

  useEffect(() => {
    if (!currentUser || !id) return;
    videoService.getLikeStatus(id)
      .then(r => setLiked(r.liked))
      .catch(() => {});
  }, [id, currentUser]);

  const loadVideo = async () => {
    try {
      setLoading(true);
      const data = await videoService.getVideo(id);
      setVideo(data);
      setEditForm({
        title:         data.title        || '',
        description:   data.description  || '',
        visibility:    (data.visibility  || 'PUBLIC').toUpperCase(),
        allowedEmails: data.allowedEmails || [],
        tags:          data.tags          || [],
      });
    } catch { setError('Video yüklənə bilmədi. Yenidən cəhd edin.'); }
    finally  { setLoading(false); }
  };

  const handleTimeUpdate = (t) => {
    currentTimeRef.current = t;
    if (t > 3 && !viewIncremented) {
      videoService.incrementView(id).catch(() => {});
      setViewIncremented(true);
      setVideo(p => ({ ...p, views: (p.views || 0) + 1 }));
    }
  };

  // Autoplay-next handlers
  const handleNextVideoReady = useCallback((v) => { setNextVideo(v); }, []);

  const handleVideoEnded = useCallback(() => {
    if (!nextVideo) return;
    setAutoplayCountdown(5);
  }, [nextVideo]);

  useEffect(() => {
    if (autoplayCountdown === null) return;
    if (autoplayCountdown === 0) {
      navigate(`/video/${nextVideo.id}`);
      setAutoplayCountdown(null);
      return;
    }
    const t = setTimeout(() => setAutoplayCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [autoplayCountdown, nextVideo, navigate]);

  // Reset autoplay state when navigating to a new video
  useEffect(() => {
    setNextVideo(null);
    setAutoplayCountdown(null);
  }, [id]);

  const cancelAutoplay = () => setAutoplayCountdown(null);
  const playNextNow = () => {
    if (nextVideo) navigate(`/video/${nextVideo.id}`);
  };

  const handleLike = async () => {
    if (!currentUser) { navigate('/login'); return; }
    if (isLiking) return;
    setIsLiking(true);
    try {
      const r = await videoService.toggleLike(id);
      setLiked(r.liked);
      setVideo(p => ({ ...p, likes: r.likes }));
    } catch (err) {
      if (err.response?.status === 401) navigate('/login');
    } finally { setIsLiking(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Bu videonu silmək istədiyinizə əminsinizmi? Bu əməliyyat geri alına bilməz.')) return;
    try {
      await videoService.deleteVideo(id);
      navigate('/my-videos');
    } catch (err) {
      alert('Video silinə bilmədi: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleSaveEdit = async () => {
    if (!editForm.title.trim()) { alert('Başlıq tələb olunur'); return; }
    if (editForm.visibility === 'RESTRICTED' && editForm.allowedEmails.length === 0) {
      alert('Məhdud giriş üçün ən azı bir e-poçt əlavə edin'); return;
    }
    setSaving(true);
    try {
      await api.put(`/videos/${id}`, { title: editForm.title, description: editForm.description, tags: editForm.tags });
      await api.post(`/videos/${id}/privacy`, { visibility: editForm.visibility, allowedUserEmails: editForm.allowedEmails });
      await loadVideo();
      setIsEditing(false);
    } catch (err) { alert('Yenilənə bilmədi: ' + (err.response?.data?.message || err.message)); }
    finally { setSaving(false); }
  };

  const addEmail = () => {
    const e = emailInput.trim().toLowerCase();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { alert('Düzgün e-poçt daxil edin'); return; }
    if (editForm.allowedEmails.includes(e)) return;
    setEditForm(p => ({ ...p, allowedEmails: [...p.allowedEmails, e] }));
    setEmailInput('');
  };
  const removeEmail = (e) => setEditForm(p => ({ ...p, allowedEmails: p.allowedEmails.filter(x => x !== e) }));

  const addTag = () => {
    const t = tagInput.replace(/^#+/, '').trim().toLowerCase();
    if (!t || editForm.tags.includes(t) || editForm.tags.length >= 10) return;
    if (!/^[a-z0-9-]+$/.test(t)) { alert('Etiketlər yalnız hərf, rəqəm və tire içərə bilər'); return; }
    setEditForm(p => ({ ...p, tags: [...p.tags, t] }));
    setTagInput('');
  };
  const removeTag = (t) => setEditForm(p => ({ ...p, tags: p.tags.filter(x => x !== t) }));

  const getEmbedCode = () => {
    const url = `${window.location.origin}/embed/${id}`;
    return `<iframe\n  src="${url}"\n  width="640"\n  height="360"\n  frameborder="0"\n  allowfullscreen\n></iframe>`;
  };
  const handleCopyEmbed = () => {
    const text = getEmbedCode();
    const done = () => { setEmbedCopied(true); setTimeout(() => setEmbedCopied(false), 2000); };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(done).catch(() => execCopy(text, done));
    } else {
      execCopy(text, done);
    }
  };
  const execCopy = (text, done) => {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    done();
  };

  /* ── loading / error states ─────────────────────────────────── */
  if (loading) return (
    <><Navbar />
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-army-950">
        <Loader2 className="h-12 w-12 animate-spin text-primary-600" />
      </div>
    </>
  );

  if (error || !video) return (
    <><Navbar />
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-army-950 gap-4">
        <p className="text-red-500 dark:text-red-400">{error || 'Video tapılmadı'}</p>
        <button onClick={() => navigate('/')}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          Ana səhifəyə qayıt
        </button>
      </div>
    </>
  );

  const isOwner = currentUser && (currentUser.email === video.uploaderEmail);
  const isAdmin = currentUser?.isAdmin;
  const canEdit = isOwner || isAdmin;
  const vis     = getVis(video.visibility);
  const VisIcon = vis.icon;

  const DESC_LIMIT = 200;
  const longDesc = video.description && video.description.length > DESC_LIMIT;

  /* ════════════════════════════════════════════════════════════ */
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-100 dark:bg-army-950 transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row gap-6">

            {/* ── MAIN COLUMN ─────────────────────────────────── */}
            <div className="flex-1 min-w-0 space-y-4">

              {/* Player */}
              <div className="bg-black rounded-xl overflow-hidden shadow-2xl">
                {video.hlsUrl && video.status?.toLowerCase() === 'ready' ? (
                  <VideoPlayer
                    hlsUrl={video.hlsUrl}
                    onTimeUpdate={handleTimeUpdate}
                    startTime={startTime}
                    autoPlay={true}
                    onEnded={handleVideoEnded}
                  />
                ) : (
                  <div className="aspect-video flex items-center justify-center bg-army-900">
                    <div className="text-center text-white/70">
                      <Loader2 className="h-10 w-10 animate-spin mx-auto mb-3 text-primary-500" />
                      <p className="text-sm">
                        {video.status === 'PROCESSING' ? 'Video emal olunur…'
                         : video.status === 'UPLOADING' ? 'Video yüklənir…'
                         : 'Video mövcud deyil'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Autoplay next video countdown */}
              {autoplayCountdown !== null && nextVideo && (
                <div className="flex items-center gap-4 bg-army-800 border border-army-700 rounded-xl p-4">
                  <div className="flex-shrink-0 w-24 h-[54px] rounded-lg overflow-hidden bg-army-900">
                    {nextVideo.thumbnailUrl
                      ? <img src={nextVideo.thumbnailUrl} alt={nextVideo.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Play className="h-6 w-6 text-primary-500/60" /></div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 mb-0.5">{autoplayCountdown} saniyə sonra:</p>
                    <p className="text-sm font-semibold text-gray-100 line-clamp-1">{nextVideo.title}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={cancelAutoplay}
                      className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 border border-army-600 rounded-lg transition-colors">
                      Ləğv et
                    </button>
                    <button onClick={playNextNow}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-semibold">
                      <SkipForward className="h-3.5 w-3.5" />İndi oynat
                    </button>
                  </div>
                </div>
              )}

              {/* Title row */}
              {!isEditing && (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 leading-snug flex-1">
                      {video.title}
                    </h1>
                    {/* visibility badge — only owner/admin sees it */}
                    {canEdit && (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-xs font-semibold flex-shrink-0 ${vis.color}`}>
                        <VisIcon className="h-3.5 w-3.5" />
                        {vis.label}
                      </span>
                    )}
                  </div>

                  {/* Meta + actions row */}
                  <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-gray-200 dark:border-army-700">
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 flex-1">
                      <span className="flex items-center gap-1.5">
                        <Eye className="h-4 w-4" />
                        {fmtViews(video.views)} baxış
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        {fmtDate(video.uploadedAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Like */}
                      <button onClick={handleLike} disabled={isLiking}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                          liked
                            ? 'bg-primary-600 text-white shadow'
                            : 'bg-gray-100 dark:bg-army-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-army-700'
                        } disabled:opacity-50`}>
                        <ThumbsUp className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
                        {video.likes || 0}
                      </button>

                      {/* Embed — admin only */}
                      {isAdmin && (
                        <button onClick={() => setShowEmbedModal(true)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 dark:bg-army-800 text-gray-700 dark:text-gray-300 rounded-full text-sm font-semibold hover:bg-gray-200 dark:hover:bg-army-700 transition-colors">
                          <Code2 className="h-4 w-4" />
                          Embed
                        </button>
                      )}

                      {/* Owner / admin actions */}
                      {canEdit && (
                        <>
                          <button onClick={() => setIsEditing(true)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-full text-sm font-semibold hover:bg-primary-700 transition-colors shadow">
                            <Edit2 className="h-4 w-4" />
                            Redaktə
                          </button>
                          <button onClick={() => setShowThumbnailUpload(v => !v)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-army-700 dark:bg-army-600 text-white rounded-full text-sm font-semibold hover:bg-army-600 dark:hover:bg-army-500 transition-colors">
                            <Image className="h-4 w-4" />
                          </button>
                          <button onClick={handleDelete}
                            className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-full text-sm font-semibold hover:bg-red-700 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Uploader */}
                  {video.uploaderName && (
                    <div className="flex items-center gap-3 py-2">
                      <div className="h-10 w-10 bg-gradient-to-br from-primary-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-base shadow flex-shrink-0">
                        {video.uploaderName.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {video.uploaderName}
                      </span>
                    </div>
                  )}

                  {/* Description */}
                  {video.description && (
                    <div className="bg-gray-100 dark:bg-army-800 rounded-xl p-4">
                      <p className={`text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed ${
                        !descExpanded && longDesc ? 'line-clamp-3' : ''
                      }`}>
                        {video.description}
                      </p>
                      {longDesc && (
                        <button onClick={() => setDescExpanded(v => !v)}
                          className="mt-2 flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400">
                          {descExpanded ? <><ChevronUp className="h-3.5 w-3.5" />Daha az göstər</> : <><ChevronDown className="h-3.5 w-3.5" />Daha çox göstər</>}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Tags */}
                  {video.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {video.tags.map((t, i) => (
                        <span key={i} className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2.5 py-0.5 rounded-full text-xs font-medium">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── EDIT FORM ─────────────────────────────────── */}
              {isEditing && (
                <div className="bg-white dark:bg-army-800 rounded-xl border border-gray-200 dark:border-army-700 p-5 space-y-4">
                  <h2 className="font-bold text-gray-900 dark:text-gray-100 text-lg">Videonu redaktə et</h2>

                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Başlıq</label>
                    <input value={editForm.title}
                      onChange={e => setEditForm(p => ({...p, title: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-army-600 rounded-lg bg-white dark:bg-army-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500" />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Təsvir</label>
                    <textarea value={editForm.description}
                      onChange={e => setEditForm(p => ({...p, description: e.target.value}))}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-army-600 rounded-lg bg-white dark:bg-army-900 text-gray-900 dark:text-gray-100 resize-none focus:ring-2 focus:ring-primary-500" />
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Etiketlər</label>
                    <div className="flex gap-2 mb-2">
                      <div className="relative flex-1">
                        <Hash className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input value={tagInput}
                          onChange={e => { let v = e.target.value; if (v && !v.startsWith('#')) v='#'+v; setTagInput(v); }}
                          onKeyDown={e => e.key==='Enter' && (e.preventDefault(), addTag())}
                          placeholder="#nümunə"
                          className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-army-600 rounded-lg bg-white dark:bg-army-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 text-sm" />
                      </div>
                      <button onClick={addTag} className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {editForm.tags.map(t => (
                        <span key={t} className="inline-flex items-center gap-1 bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-300 px-2 py-0.5 rounded-full text-xs font-medium">
                          #{t}
                          <button onClick={() => removeTag(t)}><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Visibility */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Görünürlük</label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(VISIBILITY).map(([val, cfg]) => {
                        const Icon = cfg.icon;
                        return (
                          <label key={val} className={`flex items-center gap-2 p-3 border-2 rounded-xl cursor-pointer transition-colors ${
                            editForm.visibility === val
                              ? `${cfg.border} bg-gray-50 dark:bg-army-900`
                              : 'border-gray-200 dark:border-army-700 hover:border-gray-300 dark:hover:border-army-600'
                          }`}>
                            <input type="radio" name="visibility" value={val} checked={editForm.visibility===val}
                              onChange={e => setEditForm(p=>({...p, visibility:e.target.value}))} className="sr-only" />
                            <Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{cfg.label}</span>
                            {editForm.visibility===val && <Check className="h-3.5 w-3.5 ml-auto text-primary-600" />}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Restricted emails */}
                  {editForm.visibility === 'RESTRICTED' && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
                      <label className="block text-sm font-medium text-purple-800 dark:text-purple-300 mb-2">İcazəli istifadəçilər</label>
                      <div className="flex gap-2 mb-3">
                        <div className="relative flex-1" ref={emailSugRef}>
                          <input type="email" value={emailInput}
                            onChange={e => { setEmailInput(e.target.value); fetchEmailSuggestions(e.target.value); }}
                            onKeyDown={e => e.key==='Enter' && (e.preventDefault(), addEmail())}
                            onFocus={() => emailInput.length >= 2 && emailSuggestions.length > 0 && setShowEmailSug(true)}
                            placeholder="user@example.com"
                            className="w-full px-3 py-2 border border-purple-300 dark:border-purple-700 rounded-lg bg-white dark:bg-army-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20" />
                          {showEmailSug && emailSuggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-army-800 border border-purple-200 dark:border-purple-700 rounded-xl shadow-lg z-20 overflow-hidden">
                              {emailSuggestions.map(u => (
                                <button key={u.email} type="button"
                                  onMouseDown={() => {
                                    if (!editForm.allowedEmails.includes(u.email))
                                      setEditForm(p => ({ ...p, allowedEmails: [...p.allowedEmails, u.email] }));
                                    setEmailInput(''); setShowEmailSug(false);
                                  }}
                                  className="w-full text-left px-3 py-2.5 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors border-b border-gray-100 dark:border-army-700 last:border-0">
                                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{u.fullName || u.name || u.email}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button onClick={addEmail} className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex-shrink-0">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      {editForm.allowedEmails.map(e => (
                        <div key={e} className="flex items-center justify-between bg-white dark:bg-army-900 px-3 py-2 rounded-lg border border-gray-200 dark:border-army-700 mb-2">
                          <span className="text-sm text-gray-900 dark:text-gray-100">{e}</span>
                          <button onClick={() => removeEmail(e)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Save / Cancel */}
                  <div className="flex gap-3 pt-2 border-t border-gray-200 dark:border-army-700">
                    <button onClick={handleSaveEdit} disabled={saving}
                      className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium text-sm">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {saving ? 'Saxlanılır…' : 'Yadda saxla'}
                    </button>
                    <button onClick={() => setIsEditing(false)} disabled={saving}
                      className="px-5 py-2 border border-gray-300 dark:border-army-600 rounded-lg hover:bg-gray-50 dark:hover:bg-army-700 text-gray-700 dark:text-gray-300 font-medium text-sm">
                      Ləğv et
                    </button>
                  </div>
                </div>
              )}

              {/* Thumbnail upload */}
              {canEdit && showThumbnailUpload && (
                <ThumbnailUpload videoId={id} currentThumbnail={video.thumbnailUrl}
                  onUploadSuccess={() => { loadVideo(); setShowThumbnailUpload(false); }} />
              )}

              {/* Comments */}
              <div className="bg-white dark:bg-army-800 rounded-xl border border-gray-100 dark:border-army-700 p-5">
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  Şərhlər
                  {video.commentCount > 0 && (
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400">· {video.commentCount}</span>
                  )}
                </h2>
                <CommentSection videoId={id} currentUserId={currentUser?.email} />
              </div>
            </div>

            {/* ── SIDEBAR ─────────────────────────────────────── */}
            <div className="lg:w-96 xl:w-[26rem] flex-shrink-0">
              <VideoSuggestions videoId={id} tags={video.tags || []} onNextVideoReady={handleNextVideoReady} />
            </div>
          </div>
        </div>
      </div>

      {/* Embed modal — admin only */}
      {showEmbedModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
             onClick={() => setShowEmbedModal(false)}>
          <div className="bg-white dark:bg-army-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-army-700 w-full max-w-lg"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-army-700">
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-primary-600" />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Video yerləşdirmə kodu</h3>
              </div>
              <button onClick={() => setShowEmbedModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-army-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Bu kodu HTML səhifənizdə istifadə edin:
              </p>
              <pre className="bg-gray-50 dark:bg-army-900 border border-gray-200 dark:border-army-700 rounded-lg p-4 text-xs text-gray-800 dark:text-gray-200 font-mono whitespace-pre-wrap break-all overflow-x-auto">
{getEmbedCode()}
              </pre>
              <button onClick={handleCopyEmbed}
                className={`mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                  embedCopied ? 'bg-green-600 text-white' : 'bg-primary-600 hover:bg-primary-700 text-white'
                }`}>
                {embedCopied ? <><CheckCheck className="h-4 w-4" />Kopyalandı!</> : <><Copy className="h-4 w-4" />Kodu kopyala</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VideoDetail;
