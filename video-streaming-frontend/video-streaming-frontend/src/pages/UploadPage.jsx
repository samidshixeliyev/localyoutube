import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useUpload } from '../context/UploadContext';
import { adminGetUsers } from '../services/api';
import { Upload, X, Globe, Lock, Link2, Users, Hash, Plus, AlertCircle } from 'lucide-react';

const MAX_FILE_SIZE = 50 * 1024 * 1024 * 1024; // 50 GB

const VISIBILITY_OPTIONS = [
  { value: 'public',     Icon: Globe,  label: 'İctimai',   description: 'Hər kəs görə bilər' },
  { value: 'unlisted',   Icon: Link2,  label: 'Siyahısız', description: 'Linki olan hər kəs görə bilər' },
  { value: 'private',    Icon: Lock,   label: 'Gizli',     description: 'Yalnız adminlər görə bilər' },
  { value: 'restricted', Icon: Users,  label: 'Məhdud',    description: 'Yalnız seçilmiş istifadəçilər görə bilər' },
];

export default function UploadPage() {
  const navigate    = useNavigate();
  const fileRef     = useRef(null);
  const suggestRef  = useRef(null);
  const { state: uploadState, startUpload } = useUpload();

  const [file,          setFile]          = useState(null);
  const [title,         setTitle]         = useState('');
  const [description,   setDescription]   = useState('');
  const [visibility,    setVisibility]    = useState('public');
  const [isShorts,      setIsShorts]      = useState(false);
  const [allowedEmails, setAllowedEmails] = useState([]);
  const [emailInput,    setEmailInput]    = useState('');
  const [tags,          setTags]          = useState([]);
  const [tagInput,      setTagInput]      = useState('');
  const [error,         setError]         = useState('');

  const [userSuggestions, setUserSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // ── Outside-click closes suggestion dropdown ──────────────────────────────
  useEffect(() => {
    const onClick = (ev) => {
      if (suggestRef.current && !suggestRef.current.contains(ev.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFile = (f) => {
    if (!f) return;
    if (!f.type.startsWith('video/')) { setError('Zəhmət olmasa düzgün video faylı seçin'); return; }
    if (f.size > MAX_FILE_SIZE)       { setError('Fayl həcmi 50 GB-dan çoxdur'); return; }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ''));
    setError('');
  };

  const onFileInput = (e) => handleFile(e.target.files[0]);
  const onDrop      = (e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); };

  // ── Tags ──────────────────────────────────────────────────────────────────
  const addTag = () => {
    const t = tagInput.replace(/^#+/, '').trim().toLowerCase();
    if (!t) return;
    if (tags.includes(t)) { setError('Etiket artıq əlavə edilib'); return; }
    if (tags.length >= 10) { setError('Maksimum 10 etiket'); return; }
    if (!/^[a-z0-9-]+$/.test(t)) { setError('Etiketlər: yalnız hərflər, rəqəmlər və tire'); return; }
    setTags([...tags, t]); setTagInput(''); setError('');
  };

  // ── Email autocomplete ────────────────────────────────────────────────────
  const fetchUserSuggestions = async (q) => {
    if (q.length < 2) { setUserSuggestions([]); setShowSuggestions(false); return; }
    try {
      const res = await adminGetUsers();
      const users = res.data || [];
      const filtered = users.filter(u =>
        u.email?.toLowerCase().includes(q.toLowerCase()) ||
        u.fullName?.toLowerCase().includes(q.toLowerCase()) ||
        u.name?.toLowerCase().includes(q.toLowerCase())
      ).slice(0, 5);
      setUserSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } catch { setUserSuggestions([]); }
  };

  const onEmailInputChange = (e) => {
    const v = e.target.value;
    setEmailInput(v);
    fetchUserSuggestions(v.trim());
  };

  // ── Emails ────────────────────────────────────────────────────────────────
  const addEmail = () => {
    const e = emailInput.trim().toLowerCase();
    if (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      if (!allowedEmails.includes(e)) {
        setAllowedEmails([...allowedEmails, e]);
        setEmailInput('');
        setShowSuggestions(false);
        setUserSuggestions([]);
      } else setError('E-poçt artıq əlavə edilib');
    } else if (e) setError('Yanlış e-poçt');
  };

  const selectSuggestion = (u) => {
    if (!allowedEmails.includes(u.email)) {
      setAllowedEmails([...allowedEmails, u.email]);
    }
    setEmailInput('');
    setShowSuggestions(false);
    setUserSuggestions([]);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file)                                          { setError('Zəhmət olmasa fayl seçin');   return; }
    if (!title.trim())                                  { setError('Zəhmət olmasa başlıq daxil edin');   return; }
    if (visibility === 'restricted' && !allowedEmails.length)
                                                        { setError('Ən azı bir e-poçt əlavə edin'); return; }
    if (uploadState.active && uploadState.phase !== 'done' && uploadState.phase !== 'error')
                                                        { setError('Başqa yükləmə artıq davam edir. Bitməsini gözləyin.'); return; }

    startUpload(file, { title, description, tags, visibility, allowedEmails, isShorts });
    navigate('/my-videos');
  };

  return (
    <>
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-army-800 rounded-xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Video Yüklə</h1>

          {error && (
            <div className="mb-5 flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Active upload notice */}
          {uploadState.active && uploadState.phase !== 'done' && uploadState.phase !== 'error' && (
            <div className="mb-5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 text-sm text-orange-700 dark:text-orange-300">
              ⏳ <strong>{uploadState.title}</strong> arxa planda yüklənir. Bitdikdən sonra yeni yükləmə başlada bilərsiniz.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Drop zone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Video Fayl *</label>
              {!file ? (
                <div
                  onClick={() => fileRef.current?.click()}
                  onDrop={onDrop}
                  onDragOver={e => e.preventDefault()}
                  className="border-2 border-dashed border-gray-300 dark:border-army-600 rounded-xl p-12 text-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                >
                  <Upload className="h-10 w-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-300 mb-1">Klikləyin və ya video faylı buraya sürükleyin</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">MP4, AVI, MOV, MKV — 50 GB-a qədər</p>
                </div>
              ) : (
                <div className="border border-gray-300 dark:border-army-600 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 rounded-lg flex items-center justify-center">
                      <Upload className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{file.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{(file.size / 1e9).toFixed(2)} GB</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setFile(null)} className="text-gray-400 dark:text-gray-500 hover:text-red-500 p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <input ref={fileRef} type="file" accept="video/*" onChange={onFileInput} className="hidden" />
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Başlıq *</label>
              <input
                type="text" value={title} onChange={e => setTitle(e.target.value)}
                maxLength={100} required placeholder="Video başlığını daxil edin"
                className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-army-600 dark:bg-army-700 dark:text-gray-100 dark:placeholder-gray-500 rounded-lg text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{title.length}/100</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Təsvir</label>
              <textarea
                value={description} onChange={e => setDescription(e.target.value)}
                maxLength={5000} rows={3} placeholder="Videonu təsvir edin"
                className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-army-600 dark:bg-army-700 dark:text-gray-100 dark:placeholder-gray-500 rounded-lg text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all resize-none"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Etiketlər</label>
              <div className="flex gap-2 mb-2">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text" value={tagInput}
                    onChange={e => { let v = e.target.value; if (v && !v.startsWith('#')) v = '#' + v; setTagInput(v); }}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="#nümunə" maxLength={30}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-army-600 dark:bg-army-700 dark:text-gray-100 dark:placeholder-gray-500 rounded-lg text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                  />
                </div>
                <button type="button" onClick={addTag} disabled={tags.length >= 10}
                  className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Əlavə et
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-1">
                  {tags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2.5 py-1 rounded-full text-xs font-medium">
                      #{t}
                      <button type="button" onClick={() => setTags(tags.filter(x => x !== t))} className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-200 ml-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500">{tags.length}/10</p>
            </div>

            {/* Visibility */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Görünürlük</label>
              <div className="space-y-2">
                {VISIBILITY_OPTIONS.map(({ value, Icon, label, description }) => (
                  <label key={value}
                    className={`flex items-start gap-3 p-3.5 border rounded-xl cursor-pointer transition-all ${
                      visibility === value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-army-700 hover:border-gray-300 dark:hover:border-army-600'}`}>
                    <input type="radio" name="visibility" value={value}
                      checked={visibility === value} onChange={() => setVisibility(value)} className="mt-1" />
                    <Icon className="w-4 h-4 mt-0.5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Shorts toggle */}
            <div>
              <label className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors border-gray-200 dark:border-army-700 hover:border-primary-300 dark:hover:border-primary-700">
                <input type="checkbox" checked={isShorts} onChange={e => setIsShorts(e.target.checked)} className="mt-1 rounded" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400 text-xs font-bold rounded">SHORTS</span>
                    Bu video Shorts-dur
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Şaquli format (9:16), 60 saniyəyə qədər</p>
                </div>
              </label>
            </div>

            {/* Restricted emails */}
            {visibility === 'restricted' && (
              <div className="bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-200 dark:border-primary-800 rounded-xl p-4">
                <label className="block text-sm font-medium text-primary-900 dark:text-primary-200 mb-2">İcazəli istifadəçilər *</label>
                <div className="flex gap-2 mb-3 relative">
                  <div className="relative flex-1">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={onEmailInputChange}
                      onFocus={() => { if (userSuggestions.length > 0) setShowSuggestions(true); }}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                      placeholder="istifadeci@ao.az"
                      className="w-full px-3 py-2 border border-primary-300 dark:border-primary-700 dark:bg-army-700 dark:text-gray-100 dark:placeholder-gray-500 rounded-lg text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                    />
                    {showSuggestions && userSuggestions.length > 0 && (
                      <div ref={suggestRef} className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-army-800 border border-primary-200 dark:border-primary-800 rounded-xl shadow-lg z-10 overflow-hidden">
                        {userSuggestions.map(u => (
                          <button
                            key={u.email}
                            type="button"
                            onMouseDown={() => selectSuggestion(u)}
                            className="w-full text-left px-4 py-2.5 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                          >
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{u.fullName || u.name || u.email}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={addEmail} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700">Əlavə et</button>
                </div>
                {allowedEmails.length > 0 && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {allowedEmails.map(e => (
                      <div key={e} className="flex items-center justify-between bg-white dark:bg-army-900 px-3 py-2 rounded-lg border border-primary-200 dark:border-primary-800">
                        <span className="text-sm text-gray-800 dark:text-gray-200">{e}</span>
                        <button type="button" onClick={() => setAllowedEmails(allowedEmails.filter(x => x !== e))} className="text-red-500 hover:text-red-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Submit */}
            <button type="submit"
              className="w-full py-3 bg-gradient-to-r from-primary-600 to-orange-500 text-white font-semibold rounded-xl hover:from-primary-700 hover:to-orange-600 hover:-translate-y-px active:translate-y-0 shadow-sm transition-all">
              Yükləməyə Başla
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
