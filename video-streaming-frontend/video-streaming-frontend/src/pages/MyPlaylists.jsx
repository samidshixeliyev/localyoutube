import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ListVideo, Plus, Trash2, Edit2, X, Check, Play, Globe, Lock, Users } from 'lucide-react';
import Navbar from '../components/Navbar';
import { getMyPlaylists, createPlaylist, updatePlaylist, deletePlaylist } from '../services/api';

const VIS_OPTS = [
  { value: 'PUBLIC',     label: 'İctimai',   Icon: Globe,  cls: 'text-green-500' },
  { value: 'PRIVATE',    label: 'Gizli',     Icon: Lock,   cls: 'text-red-500'   },
  { value: 'RESTRICTED', label: 'Məhdud',    Icon: Users,  cls: 'text-yellow-500'},
];

function VisBadge({ value }) {
  const opt = VIS_OPTS.find(o => o.value === (value || 'PUBLIC').toUpperCase()) || VIS_OPTS[0];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${opt.cls}`}>
      <opt.Icon className="w-3 h-3" />{opt.label}
    </span>
  );
}

function VisibilityForm({ visibility, setVisibility, allowedEmails, setAllowedEmails }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {VIS_OPTS.map(opt => (
          <button key={opt.value} type="button"
            onClick={() => setVisibility(opt.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors
              ${visibility === opt.value
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                : 'border-gray-200 dark:border-army-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-army-500'
              }`}>
            <opt.Icon className="w-3.5 h-3.5" />{opt.label}
          </button>
        ))}
      </div>
      {visibility === 'RESTRICTED' && (
        <textarea
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-army-600 bg-white dark:bg-army-700 text-gray-900 dark:text-gray-100 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="İzin verilən e-poçtlar (vergüllə ayırın): user@example.com, user2@example.com"
          rows={2}
          value={allowedEmails}
          onChange={e => setAllowedEmails(e.target.value)}
        />
      )}
    </div>
  );
}

export default function MyPlaylists() {
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newVis, setNewVis] = useState('PUBLIC');
  const [newEmails, setNewEmails] = useState('');
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editVis, setEditVis] = useState('PUBLIC');
  const [editEmails, setEditEmails] = useState('');

  const load = async () => {
    try {
      const res = await getMyPlaylists();
      setPlaylists(res.data || []);
    } catch {
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await createPlaylist(newName.trim(), newDesc.trim(), newVis, newEmails.trim());
      setPlaylists(p => [res.data, ...p]);
      setShowCreate(false);
      setNewName(''); setNewDesc(''); setNewVis('PUBLIC'); setNewEmails('');
    } catch { alert('Yaradıla bilmədi'); }
    finally { setCreating(false); }
  };

  const handleUpdate = async (id) => {
    if (!editName.trim()) return;
    try {
      await updatePlaylist(id, editName.trim(), editDesc.trim(), editVis, editEmails.trim());
      setPlaylists(p => p.map(pl => pl.id === id
        ? { ...pl, name: editName.trim(), description: editDesc.trim(), visibility: editVis, allowedEmails: editEmails.trim() }
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
    setEditEmails(Array.isArray(pl.allowedEmails) ? pl.allowedEmails.join(', ') : (pl.allowedEmails || ''));
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

          {showCreate && (
            <div className="bg-white dark:bg-army-800 rounded-xl border border-gray-200 dark:border-army-700 p-4 mb-4">
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
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Görünürlük</p>
                <VisibilityForm
                  visibility={newVis} setVisibility={setNewVis}
                  allowedEmails={newEmails} setAllowedEmails={setNewEmails}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreate} disabled={creating || !newName.trim()}
                  className="px-4 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                  {creating ? 'Yaradılır…' : 'Yarat'}
                </button>
                <button onClick={() => { setShowCreate(false); setNewName(''); setNewDesc(''); setNewVis('PUBLIC'); setNewEmails(''); }}
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
                     className="bg-white dark:bg-army-800 rounded-xl border border-gray-200 dark:border-army-700 p-4 flex items-start gap-4">
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
                          allowedEmails={editEmails} setAllowedEmails={setEditEmails}
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
