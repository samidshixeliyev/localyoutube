import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ListVideo, Plus, Trash2, Edit2, X, Play,
  Globe, Lock, Users, Link2, Search, MoreVertical,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import ConfirmModal from '../components/ConfirmModal';
import { getMyPlaylists, createPlaylist, updatePlaylist, deletePlaylist, adminGetUsers } from '../services/api';
import { useAuth } from '../context/AuthContext';

/* ── Visibility ──────────────────────────────────────────────── */
const VIS_OPTS = [
  { value: 'PUBLIC',     label: 'İctimai',   Icon: Globe,  desc: 'Hər kəs görə bilər'      },
  { value: 'UNLISTED',   label: 'Siyahısız', Icon: Link2,  desc: 'Linkə sahib olanlar'     },
  { value: 'RESTRICTED', label: 'Məhdud',    Icon: Users,  desc: 'Seçilmiş istifadəçilər'  },
  { value: 'PRIVATE',    label: 'Gizli',     Icon: Lock,   desc: 'Yalnız siz'              },
];

const VIS_CLS = {
  PUBLIC:     { text: 'text-green-500',  bg: 'bg-green-500/10'  },
  UNLISTED:   { text: 'text-gray-400',   bg: 'bg-gray-400/10'   },
  RESTRICTED: { text: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  PRIVATE:    { text: 'text-red-500',    bg: 'bg-red-500/10'    },
};

function VisBadge({ value }) {
  const key = (value || 'PUBLIC').toUpperCase();
  const opt = VIS_OPTS.find(o => o.value === key) || VIS_OPTS[0];
  const cls = VIS_CLS[key] || VIS_CLS.PUBLIC;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${cls.text} ${cls.bg}`}>
      <opt.Icon className="w-2.5 h-2.5" />{opt.label}
    </span>
  );
}

/* ── Email picker ────────────────────────────────────────────── */
function UserEmailPicker({ emails, onChange, canSearch }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [open,  setOpen]  = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = async (q) => {
    setQuery(q);
    if (q.length < 2) { setUsers([]); setOpen(false); return; }
    try {
      const res = await adminGetUsers();
      const filtered = (res.data || []).filter(u =>
        u.email?.toLowerCase().includes(q.toLowerCase()) ||
        u.fullName?.toLowerCase().includes(q.toLowerCase())
      ).slice(0, 8);
      setUsers(filtered);
      setOpen(filtered.length > 0);
    } catch { setUsers([]); setOpen(false); }
  };

  const addEmail = (email) => {
    const e = email.trim().toLowerCase();
    if (!e || emails.includes(e)) return;
    onChange([...emails, e]);
    setQuery(''); setUsers([]); setOpen(false);
  };

  const addManual = () => {
    const e = query.trim().toLowerCase();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return;
    addEmail(e);
  };

  return (
    <div className="space-y-2">
      {emails.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {emails.map(e => (
            <span key={e} className="flex items-center gap-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs px-2 py-1 rounded-full">
              {e}
              <button onClick={() => onChange(emails.filter(x => x !== e))} className="hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative" ref={dropRef}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-army-600 bg-white dark:bg-army-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder={canSearch ? 'İstifadəçi axtar…' : 'E-poçt daxil edin…'}
              value={query}
              onChange={e => { if (canSearch) search(e.target.value); else setQuery(e.target.value); }}
              onKeyDown={e => e.key === 'Enter' && addManual()}
            />
          </div>
          <button onClick={addManual} className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {open && (
          <div className="absolute z-20 mt-1 w-full bg-white dark:bg-army-800 border border-gray-200 dark:border-army-600 rounded-xl shadow-lg overflow-hidden">
            {users.map(u => (
              <button key={u.email} type="button" onMouseDown={() => addEmail(u.email)}
                className="w-full text-left px-3 py-2.5 hover:bg-primary-50 dark:hover:bg-primary-900/20 border-b border-gray-100 dark:border-army-700 last:border-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{u.fullName || u.name}</p>
                <p className="text-xs text-gray-400">{u.email}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Playlist form modal ─────────────────────────────────────── */
function PlaylistModal({ open, onClose, onSave, initial, canSearch }) {
  const [name,     setName]     = useState('');
  const [desc,     setDesc]     = useState('');
  const [vis,      setVis]      = useState('PUBLIC');
  const [emails,   setEmails]   = useState([]);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const isEdit = !!initial;

  useEffect(() => {
    if (open) {
      setName(initial?.name || '');
      setDesc(initial?.description || '');
      setVis((initial?.visibility || 'PUBLIC').toUpperCase());
      const raw = initial?.allowedEmails;
      setEmails(
        Array.isArray(raw)  ? raw
        : typeof raw === 'string' && raw.trim() ? raw.split(',').map(s => s.trim()).filter(Boolean)
        : []
      );
      setError('');
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSave = async () => {
    if (!name.trim()) { setError('Ad tələb olunur'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ name: name.trim(), description: desc.trim(), visibility: vis, allowedEmails: emails.join(',') });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || (isEdit ? 'Yenilənə bilmədi' : 'Yaradıla bilmədi'));
    } finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-army-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-army-700 overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-army-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {isEdit ? 'Pleylist redaktə et' : 'Yeni pleylist yarat'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-army-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Ad <span className="text-red-500">*</span></label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Pleylist adı"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-army-600 bg-white dark:bg-army-700 text-gray-900 dark:text-gray-100 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Açıqlama</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="İsteğe bağlı açıqlama"
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-army-600 bg-white dark:bg-army-700 text-gray-900 dark:text-gray-100 text-sm placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Görünürlük</label>
            <div className="grid grid-cols-2 gap-2">
              {VIS_OPTS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setVis(opt.value)}
                  className={`flex items-start gap-2 p-2.5 rounded-xl border-2 text-left transition-all ${
                    vis === opt.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                      : 'border-gray-200 dark:border-army-600 hover:border-gray-300 dark:hover:border-army-500'
                  }`}>
                  <opt.Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${vis === opt.value ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`} />
                  <div>
                    <p className={`text-xs font-semibold ${vis === opt.value ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}`}>{opt.label}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {vis === 'RESTRICTED' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">İzin verilən istifadəçilər</label>
              <UserEmailPicker emails={emails} onChange={setEmails} canSearch={canSearch} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-army-700 flex justify-end gap-2.5 flex-shrink-0">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-army-700 hover:bg-gray-200 dark:hover:bg-army-600 rounded-xl transition-colors disabled:opacity-50">
            Ləğv et
          </button>
          <button onClick={handleSave} disabled={saving || !name.trim()}
            className="px-5 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2">
            {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isEdit ? 'Saxla' : 'Yarat'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Playlist card ───────────────────────────────────────────── */
function PlaylistCard({ pl, onEdit, onDelete }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="group flex flex-col cursor-pointer" onClick={() => navigate(`/playlists/${pl.id}`)}>
      {/* Thumbnail */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-200 dark:bg-army-700 flex-shrink-0">
        {pl.coverUrl ? (
          <img src={pl.coverUrl} alt={pl.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-900 via-army-800 to-army-900">
            <ListVideo className="w-10 h-10 text-white/25" />
          </div>
        )}

        {/* Stacked effect */}
        <div className="absolute bottom-0 right-0 w-1/3 h-full pointer-events-none">
          <div className="absolute right-0 top-0 bottom-0 w-[8px] bg-black/20 rounded-r-xl" />
          <div className="absolute right-[8px] top-[3%] bottom-[3%] w-[5px] bg-black/10 rounded-r-xl" />
        </div>

        {/* Video count */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/75 text-white text-xs font-semibold px-2 py-1 rounded-lg backdrop-blur-sm">
          <ListVideo className="w-3 h-3" />
          {pl.itemCount}
        </div>

        {/* Hover play overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <Play className="w-5 h-5 text-gray-900 fill-gray-900 ml-0.5" />
          </div>
          <span className="text-white text-xs font-semibold">Hamısını oynat</span>
        </div>
      </div>

      {/* Info row */}
      <div className="mt-2.5 flex items-start gap-1 px-0.5">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
            {pl.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <VisBadge value={pl.visibility} />
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{pl.itemCount} video</span>
          </div>
        </div>

        {/* 3-dot menu */}
        <div ref={menuRef} className="relative flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-army-700 transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-20 bg-white dark:bg-army-800 border border-gray-200 dark:border-army-700 rounded-xl shadow-lg overflow-hidden w-36">
              <button onClick={() => { setMenuOpen(false); onEdit(pl); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-army-700 transition-colors">
                <Edit2 className="w-3.5 h-3.5 text-gray-400" /> Redaktə et
              </button>
              <button onClick={() => { setMenuOpen(false); onDelete(pl); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Sil
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function MyPlaylists() {
  const { hasPermission } = useAuth();
  const canSearch = hasPermission('manage-users') || hasPermission('super-admin') || hasPermission('admin-modtube');

  const [playlists,  setPlaylists]  = useState([]);
  const [loading,    setLoading]    = useState(true);

  // Modal state
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await getMyPlaylists();
      setPlaylists(res.data || []);
    } catch { setPlaylists([]); }
    finally { setLoading(false); }
  };

  const handleCreate = async ({ name, description, visibility, allowedEmails }) => {
    const res = await createPlaylist(name, description, visibility, allowedEmails);
    setPlaylists(p => [res.data, ...p]);
  };

  const handleUpdate = async ({ name, description, visibility, allowedEmails }) => {
    await updatePlaylist(editTarget.id, name, description, visibility, allowedEmails);
    setPlaylists(p => p.map(pl => pl.id === editTarget.id
      ? { ...pl, name, description, visibility, allowedEmails }
      : pl));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePlaylist(deleteTarget.id);
      setPlaylists(p => p.filter(pl => pl.id !== deleteTarget.id));
    } catch { /* server error — playlist stays in list */ }
    finally { setDeleting(false); setDeleteTarget(null); }
  };

  const openCreate = () => { setEditTarget(null); setModalOpen(true); };
  const openEdit = (pl) => { setEditTarget(pl); setModalOpen(true); };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50 dark:bg-army-900">
        <div className="max-w-6xl mx-auto px-4 py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-7">
            <div className="flex items-center gap-3">
              <ListVideo className="w-6 h-6 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pleylistlərim</h1>
              {!loading && playlists.length > 0 && (
                <span className="text-sm text-gray-400 dark:text-gray-500 font-normal">{playlists.length}</span>
              )}
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors text-sm font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" /> Yeni pleylist
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="space-y-2">
                  <div className="aspect-video rounded-xl bg-gray-200 dark:bg-army-800 animate-pulse" />
                  <div className="h-4 w-3/4 bg-gray-200 dark:bg-army-800 rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-gray-200 dark:bg-army-800 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : playlists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-28 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-army-800 flex items-center justify-center mb-5">
                <ListVideo className="w-10 h-10 text-gray-300 dark:text-army-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-1">Hələ pleylist yoxdur</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs">
                Sevdiyiniz videoları toplamaq üçün bir pleylist yaradın.
              </p>
              <button onClick={openCreate}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm">
                <Plus className="w-4 h-4" /> İlk pleylistini yarat
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-6">
              {/* New playlist card */}
              <button
                onClick={openCreate}
                className="flex flex-col items-center justify-center aspect-video rounded-xl border-2 border-dashed border-gray-300 dark:border-army-600 text-gray-400 dark:text-army-500 hover:border-primary-400 dark:hover:border-primary-600 hover:text-primary-500 dark:hover:text-primary-400 transition-colors group"
              >
                <Plus className="w-7 h-7 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium">Yeni</span>
              </button>

              {playlists.map(pl => (
                <PlaylistCard
                  key={pl.id}
                  pl={pl}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit modal */}
      <PlaylistModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={editTarget ? handleUpdate : handleCreate}
        initial={editTarget}
        canSearch={canSearch}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Pleylist silinsin?"
        message={`"${deleteTarget?.name}" pleylistini silmək istədiyinizə əminsinizmi? Bu əməliyyat geri alına bilməz.`}
        confirmLabel={deleting ? 'Silinir…' : 'Sil'}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
