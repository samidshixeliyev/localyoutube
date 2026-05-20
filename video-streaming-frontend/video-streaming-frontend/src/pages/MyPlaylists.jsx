import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ListVideo, Plus, Trash2, Edit2, X, Check, Play,
  Globe, Lock, Users, Link2, Search,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { getMyPlaylists, createPlaylist, updatePlaylist, deletePlaylist, adminGetUsers } from '../services/api';
import { useAuth } from '../context/AuthContext';

/* ── visibility options ───────────────────────────────────────── */
const VIS_OPTS = [
  { value: 'PUBLIC',     label: 'İctimai',   Icon: Globe,  desc: 'Hər kəs görə bilər'         },
  { value: 'UNLISTED',   label: 'Siyahısız', Icon: Link2,  desc: 'Linkə sahib olanlar'        },
  { value: 'RESTRICTED', label: 'Məhdud',    Icon: Users,  desc: 'Seçilmiş istifadəçilər'     },
  { value: 'PRIVATE',    label: 'Gizli',     Icon: Lock,   desc: 'Yalnız siz'                 },
];

const VIS_BADGE_CLS = {
  PUBLIC:     'text-green-500',
  UNLISTED:   'text-gray-400',
  RESTRICTED: 'text-yellow-500',
  PRIVATE:    'text-red-500',
};

function VisBadge({ value }) {
  const opt = VIS_OPTS.find(o => o.value === (value || 'PUBLIC').toUpperCase()) || VIS_OPTS[0];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${VIS_BADGE_CLS[opt.value]}`}>
      <opt.Icon className="w-3 h-3" />{opt.label}
    </span>
  );
}

/* ── user-search input for RESTRICTED ────────────────────────── */
function UserEmailPicker({ emails, onChange, canSearch }) {
  const [query, setQuery]   = useState('');
  const [users,  setUsers]  = useState([]);
  const [open,   setOpen]   = useState(false);
  const dropRef = useRef(null);

  // Close on outside click
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
    setQuery('');
    setUsers([]);
    setOpen(false);
  };

  const addManual = () => {
    const e = query.trim().toLowerCase();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return;
    addEmail(e);
  };

  return (
    <div className="space-y-2">
      {/* Chip list */}
      {emails.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {emails.map(e => (
            <span key={e} className="flex items-center gap-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs px-2 py-1 rounded-full">
              {e}
              <button onClick={() => onChange(emails.filter(x => x !== e))} className="hover:text-red-500 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
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
          <button onClick={addManual}
            className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-20 mt-1 w-full bg-white dark:bg-army-800 border border-gray-200 dark:border-army-600 rounded-xl shadow-lg overflow-hidden">
            {users.map(u => (
              <button key={u.email} type="button"
                onMouseDown={() => addEmail(u.email)}
                className="w-full text-left px-3 py-2.5 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors border-b border-gray-100 dark:border-army-700 last:border-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{u.fullName || u.name}</p>
                <p className="text-xs text-gray-400">{u.email}</p>
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        {canSearch ? 'İstifadəçi adı və ya e-poçtla axtarın, ya da birbaşa e-poçt yazıb Enter basın.' : 'E-poçt daxil edib Enter basın.'}
      </p>
    </div>
  );
}

/* ── visibility form ──────────────────────────────────────────── */
function VisibilityForm({ visibility, setVisibility, emails, setEmails, canSearch }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {VIS_OPTS.map(opt => (
          <button key={opt.value} type="button"
            onClick={() => setVisibility(opt.value)}
            className={`flex items-start gap-2 p-2.5 rounded-lg border text-left transition-colors ${
              visibility === opt.value
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                : 'border-gray-200 dark:border-army-600 hover:border-gray-300 dark:hover:border-army-500'
            }`}>
            <opt.Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${visibility === opt.value ? 'text-primary-600' : 'text-gray-400'}`} />
            <div>
              <p className={`text-xs font-semibold ${visibility === opt.value ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}`}>{opt.label}</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight">{opt.desc}</p>
            </div>
          </button>
        ))}
      </div>
      {visibility === 'RESTRICTED' && (
        <div className="mt-2">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">İzin verilən istifadəçilər</p>
          <UserEmailPicker emails={emails} onChange={setEmails} canSearch={canSearch} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function MyPlaylists() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canSearch = hasPermission('manage-users') || hasPermission('super-admin') || hasPermission('admin-modtube');

  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [newName,    setNewName]    = useState('');
  const [newDesc,    setNewDesc]    = useState('');
  const [newVis,     setNewVis]     = useState('PUBLIC');
  const [newEmails,  setNewEmails]  = useState([]);
  const [creating,   setCreating]   = useState(false);

  // Edit form state
  const [editId,     setEditId]     = useState(null);
  const [editName,   setEditName]   = useState('');
  const [editDesc,   setEditDesc]   = useState('');
  const [editVis,    setEditVis]    = useState('PUBLIC');
  const [editEmails, setEditEmails] = useState([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await getMyPlaylists();
      setPlaylists(res.data || []);
    } catch { setPlaylists([]); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await createPlaylist(
        newName.trim(), newDesc.trim(),
        newVis, newEmails.join(',')
      );
      setPlaylists(p => [res.data, ...p]);
      setShowCreate(false);
      setNewName(''); setNewDesc(''); setNewVis('PUBLIC'); setNewEmails([]);
    } catch { alert('Yaradıla bilmədi'); }
    finally { setCreating(false); }
  };

  const handleUpdate = async (id) => {
    if (!editName.trim()) return;
    try {
      await updatePlaylist(id, editName.trim(), editDesc.trim(), editVis, editEmails.join(','));
      setPlaylists(p => p.map(pl => pl.id === id
        ? { ...pl, name: editName.trim(), description: editDesc.trim(), visibility: editVis, allowedEmails: editEmails }
        : pl));
      setEditId(null);
    } catch { alert('Yenilənə bilmədi'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu pleylist silinsin?')) return;
    try {
      await deletePlaylist(id);
      setPlaylists(p => p.filter(pl => pl.id !== id));
    } catch { alert('Silinə bilmədi'); }
  };

  const startEdit = (pl) => {
    setEditId(pl.id);
    setEditName(pl.name);
    setEditDesc(pl.description || '');
    setEditVis((pl.visibility || 'PUBLIC').toUpperCase());
    const raw = pl.allowedEmails;
    setEditEmails(
      Array.isArray(raw) ? raw
      : typeof raw === 'string' && raw.trim() ? raw.split(',').map(s => s.trim()).filter(Boolean)
      : []
    );
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50 dark:bg-army-900">
        <div className="max-w-4xl mx-auto px-4 py-8">

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <ListVideo className="w-6 h-6 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pleylistlərim</h1>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium">
              <Plus className="w-4 h-4" /> Yeni pleylist
            </button>
          </div>

          {/* Create form */}
          {showCreate && (
            <div className="bg-white dark:bg-army-800 rounded-xl border border-gray-200 dark:border-army-700 p-4 mb-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Yeni pleylist</p>
              <input
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-army-600 bg-white dark:bg-army-700 text-gray-900 dark:text-gray-100 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Ad *"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
              <textarea
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-army-600 bg-white dark:bg-army-700 text-gray-900 dark:text-gray-100 text-sm mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Açıqlama (isteğe bağlı)"
                rows={2}
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
              />
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Görünürlük</p>
                <VisibilityForm
                  visibility={newVis} setVisibility={setNewVis}
                  emails={newEmails} setEmails={setNewEmails}
                  canSearch={canSearch}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={creating || !newName.trim()}
                  className="px-4 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                  {creating ? 'Yaradılır…' : 'Yarat'}
                </button>
                <button onClick={() => { setShowCreate(false); setNewName(''); setNewDesc(''); setNewVis('PUBLIC'); setNewEmails([]); }}
                  className="px-4 py-1.5 bg-gray-100 dark:bg-army-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-army-600">
                  Ləğv et
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-200 dark:bg-army-800 rounded-xl animate-pulse" />)}
            </div>
          ) : playlists.length === 0 ? (
            <div className="text-center py-20">
              <ListVideo className="w-16 h-16 text-gray-300 dark:text-army-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Hələki pleylist yoxdur</p>
              <button onClick={() => setShowCreate(true)}
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
                İlk pleylistini yarat
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {playlists.map(pl => (
                <div key={pl.id}
                  className="bg-white dark:bg-army-800 rounded-xl border border-gray-200 dark:border-army-700 p-4 flex items-start gap-4 shadow-sm">
                  <div className="w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                    <ListVideo className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {editId === pl.id ? (
                      <div className="space-y-2">
                        <input
                          className="w-full px-2 py-1 rounded border border-gray-300 dark:border-army-600 bg-white dark:bg-army-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                        />
                        <input
                          className="w-full px-2 py-1 rounded border border-gray-300 dark:border-army-600 bg-white dark:bg-army-700 text-sm text-gray-500 dark:text-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          value={editDesc}
                          onChange={e => setEditDesc(e.target.value)}
                          placeholder="Açıqlama"
                        />
                        <VisibilityForm
                          visibility={editVis} setVisibility={setEditVis}
                          emails={editEmails} setEmails={setEditEmails}
                          canSearch={canSearch}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link to={`/playlists/${pl.id}`}
                            className="font-semibold text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors truncate">
                            {pl.name}
                          </Link>
                          <VisBadge value={pl.visibility} />
                        </div>
                        {pl.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">{pl.description}</p>
                        )}
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{pl.itemCount} video</p>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {editId === pl.id ? (
                      <>
                        <button onClick={() => handleUpdate(pl.id)}
                          className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditId(null)}
                          className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-army-700 rounded-lg transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => navigate(`/playlists/${pl.id}`)}
                          className="p-1.5 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors">
                          <Play className="w-4 h-4" />
                        </button>
                        <button onClick={() => startEdit(pl)}
                          className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-army-700 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(pl.id)}
                          className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
