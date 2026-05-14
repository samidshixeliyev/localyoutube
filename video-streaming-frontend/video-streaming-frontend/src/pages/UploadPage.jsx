import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useUpload } from '../context/UploadContext';
import { Upload, X, Globe, Lock, Link2, Users, Hash, Plus, AlertCircle } from 'lucide-react';

const MAX_FILE_SIZE = 50 * 1024 * 1024 * 1024; // 50 GB

const VISIBILITY_OPTIONS = [
  { value: 'public',     Icon: Globe,  label: 'Public',     description: 'Everyone can see this video' },
  { value: 'unlisted',   Icon: Link2,  label: 'Unlisted',   description: 'Anyone with the link can see' },
  { value: 'private',    Icon: Lock,   label: 'Private',    description: 'Only admins can see' },
  { value: 'restricted', Icon: Users,  label: 'Restricted', description: 'Only specific users can see' },
];

export default function UploadPage() {
  const navigate    = useNavigate();
  const fileRef     = useRef(null);
  const { state: uploadState, startUpload } = useUpload();

  const [file,          setFile]          = useState(null);
  const [title,         setTitle]         = useState('');
  const [description,   setDescription]   = useState('');
  const [visibility,    setVisibility]    = useState('public');
  const [allowedEmails, setAllowedEmails] = useState([]);
  const [emailInput,    setEmailInput]    = useState('');
  const [tags,          setTags]          = useState([]);
  const [tagInput,      setTagInput]      = useState('');
  const [error,         setError]         = useState('');

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFile = (f) => {
    if (!f) return;
    if (!f.type.startsWith('video/')) { setError('Please select a valid video file'); return; }
    if (f.size > MAX_FILE_SIZE)       { setError('File size exceeds 50 GB'); return; }
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
    if (tags.includes(t)) { setError('Tag already added'); return; }
    if (tags.length >= 10) { setError('Max 10 tags'); return; }
    if (!/^[a-z0-9-]+$/.test(t)) { setError('Tags: letters, numbers, hyphens only'); return; }
    setTags([...tags, t]); setTagInput(''); setError('');
  };

  // ── Emails ────────────────────────────────────────────────────────────────
  const addEmail = () => {
    const e = emailInput.trim().toLowerCase();
    if (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      if (!allowedEmails.includes(e)) { setAllowedEmails([...allowedEmails, e]); setEmailInput(''); }
      else setError('Email already added');
    } else if (e) setError('Invalid email');
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file)                                          { setError('Please select a file');   return; }
    if (!title.trim())                                  { setError('Please enter a title');   return; }
    if (visibility === 'restricted' && !allowedEmails.length)
                                                        { setError('Add at least one email'); return; }
    if (uploadState.active && uploadState.phase !== 'done' && uploadState.phase !== 'error')
                                                        { setError('Another upload is already in progress. Wait for it to finish.'); return; }

    startUpload(file, { title, description, tags, visibility, allowedEmails });
    navigate('/my-videos');
  };

  return (
    <>
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Upload Video</h1>

          {error && (
            <div className="mb-5 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Active upload notice */}
          {uploadState.active && uploadState.phase !== 'done' && uploadState.phase !== 'error' && (
            <div className="mb-5 bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
              ⏳ <strong>{uploadState.title}</strong> is uploading in the background. You can start a new upload after it finishes.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Drop zone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Video File *</label>
              {!file ? (
                <div
                  onClick={() => fileRef.current?.click()}
                  onDrop={onDrop}
                  onDragOver={e => e.preventDefault()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors"
                >
                  <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-1">Click or drag & drop a video file</p>
                  <p className="text-sm text-gray-400">MP4, AVI, MOV, MKV — up to 50 GB</p>
                </div>
              ) : (
                <div className="border border-gray-300 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <Upload className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{file.name}</p>
                      <p className="text-xs text-gray-500">{(file.size / 1e9).toFixed(2)} GB</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500 p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <input ref={fileRef} type="file" accept="video/*" onChange={onFileInput} className="hidden" />
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
              <input
                type="text" value={title} onChange={e => setTitle(e.target.value)}
                maxLength={100} required placeholder="Enter video title"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
              />
              <p className="text-xs text-gray-400 mt-1">{title.length}/100</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea
                value={description} onChange={e => setDescription(e.target.value)}
                maxLength={5000} rows={3} placeholder="Describe your video"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all resize-none"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tags</label>
              <div className="flex gap-2 mb-2">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text" value={tagInput}
                    onChange={e => { let v = e.target.value; if (v && !v.startsWith('#')) v = '#' + v; setTagInput(v); }}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="#example" maxLength={30}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                  />
                </div>
                <button type="button" onClick={addTag} disabled={tags.length >= 10}
                  className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-1">
                  {tags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full text-xs font-medium">
                      #{t}
                      <button type="button" onClick={() => setTags(tags.filter(x => x !== t))} className="text-blue-500 hover:text-blue-700 ml-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400">{tags.length}/10</p>
            </div>

            {/* Visibility */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
              <div className="space-y-2">
                {VISIBILITY_OPTIONS.map(({ value, Icon, label, description }) => (
                  <label key={value}
                    className={`flex items-start gap-3 p-3.5 border rounded-xl cursor-pointer transition-all ${
                      visibility === value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="visibility" value={value}
                      checked={visibility === value} onChange={() => setVisibility(value)} className="mt-1" />
                    <Icon className="w-4 h-4 mt-0.5 text-gray-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{label}</p>
                      <p className="text-xs text-gray-500">{description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Restricted emails */}
            {visibility === 'restricted' && (
              <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                <label className="block text-sm font-medium text-purple-900 mb-2">Allowed users (email) *</label>
                <div className="flex gap-2 mb-3">
                  <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                    placeholder="user@example.com"
                    className="flex-1 px-3 py-2 border border-purple-300 rounded-lg text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20" />
                  <button type="button" onClick={addEmail} className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">Add</button>
                </div>
                {allowedEmails.length > 0 && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {allowedEmails.map(e => (
                      <div key={e} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-purple-200">
                        <span className="text-sm text-gray-800">{e}</span>
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
              Start Upload
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
