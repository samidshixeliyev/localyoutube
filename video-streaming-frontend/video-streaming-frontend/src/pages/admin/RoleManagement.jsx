import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminGetRoles,
  adminCreateRole,
  adminUpdateRole,
  adminDeleteRole,
  adminGetPermissions,
  adminCreatePermission,
  adminDeletePermission,
} from '../../services/api';
import Navbar from '../../components/Navbar';
import {
  ArrowLeft, Shield, Plus, Edit2, Trash2, X, Check,
  Lock, Save, AlertTriangle, ChevronDown, ChevronUp, Key,
  Users, Settings, Video, MessageSquare, Eye, Upload, Star,
} from 'lucide-react';

/* ─── Permission metadata ─────────────────────────────────────── */
const SYSTEM_ROLES = ['super-admin'];
const SYSTEM_PERMISSIONS = new Set([
  'super-admin', 'admin-modtube', 'view-metrics', 'manage-settings',
]);

const PERM_META = {
  'super-admin':      { category: 'Sistem',     icon: '🛡️', color: 'red',     desc: 'Tam sistem girişi — bütün icazələri əhatə edir' },
  'view-metrics':     { category: 'Sistem',     icon: '📊', color: 'amber',   desc: 'Prometheus metrik panelini görmək' },
  'manage-settings':  { category: 'Sistem',     icon: '⚙️', color: 'orange',  desc: 'Sistem parametrlərinə dəyişiklik etmək' },
  'view-reports':     { category: 'Sistem',     icon: '📋', color: 'amber',   desc: 'Hesabatları görmək' },
  'manage-users':     { category: 'İstifadəçi', icon: '👥', color: 'blue',    desc: 'İstifadəçiləri yaratmaq, redaktə etmək, silmək' },
  'manage-roles':     { category: 'İstifadəçi', icon: '🎭', color: 'purple',  desc: 'Rolları və icazələri idarə etmək' },
  'admin-modtube':    { category: 'Video',      icon: '🎬', color: 'primary', desc: 'Bütün videoları yükləmək, redaktə etmək, silmək' },
  'upload-video':     { category: 'Video',      icon: '📤', color: 'primary', desc: 'Yeni video yükləmək' },
  'delete-video':     { category: 'Video',      icon: '🗑️', color: 'red',     desc: 'Video silmək' },
  'view-private':     { category: 'Video',      icon: '🔒', color: 'primary', desc: 'Gizli və məhdud videoları izləmək' },
  'manage-shorts':    { category: 'Video',      icon: '⚡', color: 'yellow',  desc: 'Shorts videoları idarə etmək' },
  'comment-moderate': { category: 'Kontent',    icon: '💬', color: 'teal',    desc: 'Şərhləri silmək' },
};
const DEFAULT_META = { category: 'Digər', icon: '🔑', color: 'gray', desc: '' };

const CAT_ORDER = ['Sistem', 'İstifadəçi', 'Video', 'Kontent', 'Digər'];

const COLOR_MAP = {
  red:     'bg-red-50    dark:bg-red-900/20    border-red-200    dark:border-red-800    text-red-700    dark:text-red-300',
  amber:   'bg-amber-50  dark:bg-amber-900/20  border-amber-200  dark:border-amber-800  text-amber-700  dark:text-amber-300',
  orange:  'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300',
  blue:    'bg-blue-50   dark:bg-blue-900/20   border-blue-200   dark:border-blue-800   text-blue-700   dark:text-blue-300',
  purple:  'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300',
  primary: 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300',
  yellow:  'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300',
  teal:    'bg-teal-50   dark:bg-teal-900/20   border-teal-200   dark:border-teal-800   text-teal-700   dark:text-teal-300',
  gray:    'bg-gray-50   dark:bg-army-700      border-gray-200   dark:border-army-600   text-gray-700   dark:text-gray-300',
};

function getMeta(name) {
  return PERM_META[name] || DEFAULT_META;
}

/* ─── Toast ───────────────────────────────────────────────────── */
function Toast({ msg, type = 'success' }) {
  if (!msg) return null;
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl font-medium text-sm
      ${type === 'success' ? 'bg-primary-700 text-white' : 'bg-red-700 text-white'}`}>
      {type === 'success'
        ? <Check className="h-4 w-4" />
        : <AlertTriangle className="h-4 w-4" />}
      {msg}
    </div>
  );
}

/* ─── Permission card ─────────────────────────────────────────── */
function PermCard({ perm, selectable, selected, onToggle, onDelete }) {
  const meta = getMeta(perm.name);
  const colorCls = COLOR_MAP[meta.color] || COLOR_MAP.gray;
  const isSystem = SYSTEM_PERMISSIONS.has(perm.name);

  return (
    <div
      onClick={selectable ? () => onToggle(perm.id) : undefined}
      className={`relative group rounded-xl border p-3.5 transition-all duration-150 ${
        selectable ? 'cursor-pointer hover:shadow-md' : ''
      } ${
        selectable && selected
          ? 'ring-2 ring-primary-500 border-primary-400 dark:border-primary-500 bg-primary-50 dark:bg-primary-900/20'
          : 'bg-white dark:bg-army-800 border-gray-200 dark:border-army-700 hover:border-primary-300 dark:hover:border-primary-700'
      }`}
    >
      {/* Checkbox indicator for selectable mode */}
      {selectable && (
        <div className={`absolute top-2.5 right-2.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
          selected
            ? 'bg-primary-600 border-primary-600'
            : 'border-gray-300 dark:border-army-500'
        }`}>
          {selected && <Check className="h-2.5 w-2.5 text-white" />}
        </div>
      )}

      {/* Delete button for permission library */}
      {!selectable && !isSystem && onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(perm); }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
          title="Sil"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      <div className="flex items-start gap-3 pr-5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 border ${colorCls}`}>
          {meta.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{perm.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
            {meta.desc || perm.description || '—'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-2.5">
        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorCls}`}>
          {meta.category}
        </span>
        {isSystem && (
          <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
            SİSTEM
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── RoleFormModal ───────────────────────────────────────────── */
function RoleFormModal({ mode, role, permissions, onClose, onSaved }) {
  const isCreate = mode === 'create';
  const isSystemRole = !isCreate && SYSTEM_ROLES.includes(role?.name);

  const [name, setName] = useState(isCreate ? '' : role.name);
  const [description, setDescription] = useState(isCreate ? '' : (role.description || ''));
  const [selectedPerms, setSelectedPerms] = useState(
    isCreate ? [] : (role.permissions || []).map(p =>
      permissions.find(x => x.name === p)?.id
    ).filter(Boolean)
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [filterCat, setFilterCat] = useState('Hamısı');

  const togglePerm = (id) =>
    setSelectedPerms(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const grouped = permissions.reduce((acc, p) => {
    const cat = getMeta(p.name).category;
    (acc[cat] = acc[cat] || []).push(p);
    return acc;
  }, {});
  const cats = ['Hamısı', ...CAT_ORDER.filter(c => grouped[c])];
  const filtered = filterCat === 'Hamısı' ? permissions : (grouped[filterCat] || []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Rol adı tələb olunur'); return; }
    setSaving(true); setErr('');
    try {
      const payload = { name: name.trim(), description: description.trim() || null, permissionIds: selectedPerms };
      if (isCreate) {
        const res = await adminCreateRole(payload);
        onSaved(res.data, 'create');
      } else {
        const res = await adminUpdateRole(role.id, payload);
        onSaved(res.data, 'update');
      }
    } catch (ex) {
      setErr(ex.response?.data?.message || 'Xəta baş verdi');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-army-800 rounded-2xl w-full max-w-2xl shadow-2xl border border-gray-200 dark:border-army-700 my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-army-700 bg-gradient-to-r from-primary-600 to-primary-700 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-white" />
            <h3 className="text-lg font-bold text-white">
              {isCreate ? 'Yeni Rol Yarat' : `Redaktə: ${role.name}`}
            </h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {err && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-red-700 dark:text-red-400 text-sm">
              {err}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Rol adı <span className="text-red-500">*</span>
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={isSystemRole}
                placeholder="məs. moderator"
                className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-army-600 rounded-xl text-sm
                           bg-white dark:bg-army-700 text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500
                           disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Təsvir
              </label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Rol haqqında qısa məlumat"
                className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-army-600 rounded-xl text-sm
                           bg-white dark:bg-army-700 text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Permission picker */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                İcazələr
              </label>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
                {selectedPerms.length} seçilib
              </span>
            </div>

            {/* Category tabs */}
            <div className="flex gap-1.5 flex-wrap mb-3">
              {cats.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilterCat(cat)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    filterCat === cat
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-army-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-army-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
              {filtered.map(perm => (
                <PermCard
                  key={perm.id}
                  perm={perm}
                  selectable
                  selected={selectedPerms.includes(perm.id)}
                  onToggle={togglePerm}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-army-600 rounded-xl text-sm font-semibold
                         text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-army-700 transition-colors">
              Ləğv et
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold
                         hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm">
              {saving
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saxlanır…</>
                : <><Save className="h-4 w-4" />{isCreate ? 'Yarat' : 'Yadda saxla'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── DeleteModal ─────────────────────────────────────────────── */
function DeleteModal({ role, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState('');
  const handleDelete = async () => {
    setDeleting(true); setErr('');
    try {
      await adminDeleteRole(role.id);
      onDeleted(role.id);
    } catch (ex) {
      setErr(ex.response?.data?.message || 'Silinə bilmədi');
      setDeleting(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-army-800 rounded-2xl w-full max-w-sm shadow-2xl border border-gray-200 dark:border-army-700 p-6">
        <div className="text-center mb-5">
          <div className="mx-auto w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-3">
            <Trash2 className="h-7 w-7 text-red-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Rolu sil</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            <span className="font-bold text-gray-900 dark:text-gray-100">"{role.name}"</span> silinsin?
          </p>
          <p className="text-xs text-red-600 mt-1 font-medium">Bu əməliyyat geri qaytarıla bilməz!</p>
        </div>
        {err && <p className="mb-4 text-sm text-red-600 dark:text-red-400 text-center">{err}</p>}
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-army-600 rounded-xl text-sm font-semibold
                       text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-army-700 transition-colors">
            Ləğv et
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold
                       hover:bg-red-700 disabled:opacity-60 transition-colors">
            {deleting ? 'Silinir…' : 'Sil'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── RoleCard ────────────────────────────────────────────────── */
function RoleCard({ role, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const isSystem = SYSTEM_ROLES.includes(role.name);
  const permCount = role.permissions?.length || 0;

  return (
    <div className="bg-white dark:bg-army-800 border border-gray-200 dark:border-army-700 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
      {/* Card header strip */}
      <div className={`px-5 py-4 flex items-center justify-between gap-4 border-b border-gray-100 dark:border-army-700 ${
        isSystem ? 'bg-gradient-to-r from-red-600 to-red-700' : 'bg-gradient-to-r from-primary-600 to-primary-700'
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base truncate">{role.name}</h3>
              {isSystem && (
                <span className="inline-flex items-center gap-1 bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <Star className="h-2.5 w-2.5" />SİSTEM
                </span>
              )}
            </div>
            {role.description && (
              <p className="text-white/70 text-xs truncate">{role.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => onEdit(role)}
            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
            title="Redaktə et">
            <Edit2 className="h-4 w-4" />
          </button>
          {!isSystem && (
            <button onClick={() => onDelete(role)}
              className="p-2 rounded-lg bg-white/20 hover:bg-red-500/50 text-white transition-colors"
              title="Sil">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="p-4">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors w-full text-left"
        >
          <Lock className="h-4 w-4" />
          <span>{permCount} icazə</span>
          <span className="flex-1" />
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expanded && permCount > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            {(role.permissions || []).map(name => {
              const meta = getMeta(name);
              const colorCls = COLOR_MAP[meta.color] || COLOR_MAP.gray;
              return (
                <div key={name} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs font-medium ${colorCls}`}>
                  <span>{meta.icon}</span>
                  <span className="truncate">{name}</span>
                </div>
              );
            })}
          </div>
        )}
        {expanded && permCount === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center py-2">İcazə yoxdur</p>
        )}
      </div>
    </div>
  );
}

/* ─── Main page ───────────────────────────────────────────────── */
const RoleManagement = () => {
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState({ msg: '', type: 'success' });

  const [showPermForm, setShowPermForm] = useState(false);
  const [newPerm, setNewPerm] = useState({ name: '', description: '', type: 'CUSTOM' });
  const [permSaving, setPermSaving] = useState(false);
  const [permErr, setPermErr] = useState('');
  const [permTab, setPermTab] = useState('Hamısı');

  useEffect(() => {
    Promise.all([adminGetRoles(), adminGetPermissions()])
      .then(([r, p]) => { setRoles(r.data); setPermissions(p.data); })
      .catch(() => setError('Məlumatlar yüklənə bilmədi'))
      .finally(() => setLoading(false));
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3500);
  };

  const handleCreatePermission = async (e) => {
    e.preventDefault();
    if (!newPerm.name.trim()) { setPermErr('İcazə adı tələb olunur'); return; }
    setPermSaving(true); setPermErr('');
    try {
      await adminCreatePermission(newPerm);
      const res = await adminGetPermissions();
      setPermissions(res.data);
      setNewPerm({ name: '', description: '', type: 'CUSTOM' });
      setShowPermForm(false);
      showToast('İcazə yaradıldı');
    } catch (ex) {
      setPermErr(ex.response?.data?.message || 'Xəta baş verdi');
    } finally { setPermSaving(false); }
  };

  const handleDeletePermission = async (perm) => {
    if (SYSTEM_PERMISSIONS.has(perm.name)) return;
    if (!window.confirm(`"${perm.name}" icazəsini silmək istədiyinizə əminsinizmi?`)) return;
    try {
      await adminDeletePermission(perm.id);
      setPermissions(prev => prev.filter(p => p.id !== perm.id));
      showToast(`"${perm.name}" silindi`);
    } catch (ex) {
      showToast(ex.response?.data?.message || 'Silinə bilmədi', 'error');
    }
  };

  const handleSaved = (saved, op) => {
    if (op === 'create') setRoles(prev => [...prev, saved]);
    else setRoles(prev => prev.map(r => r.id === saved.id ? saved : r));
    showToast(op === 'create' ? `"${saved.name}" yaradıldı` : `"${saved.name}" yeniləndi`);
    setModal(null);
  };

  const handleDeleted = (id) => {
    const r = roles.find(x => x.id === id);
    setRoles(prev => prev.filter(x => x.id !== id));
    showToast(`"${r?.name}" silindi`);
    setModal(null);
  };

  // Grouped permissions for the library
  const grouped = permissions.reduce((acc, p) => {
    const cat = getMeta(p.name).category;
    (acc[cat] = acc[cat] || []).push(p);
    return acc;
  }, {});
  const permCats = ['Hamısı', ...CAT_ORDER.filter(c => grouped[c])];
  const visiblePerms = permTab === 'Hamısı' ? permissions : (grouped[permTab] || []);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Shield className="h-12 w-12 text-primary-600 animate-pulse" />
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-primary-50 dark:bg-army-900 transition-colors">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/admin/users')}
                className="p-2 rounded-xl border border-gray-200 dark:border-army-700 bg-white dark:bg-army-800
                           text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-army-700 transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Shield className="h-6 w-6 text-primary-600" />
                  Rol İdarəetməsi
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {roles.length} rol · {permissions.length} icazə
                </p>
              </div>
            </div>
            <button
              onClick={() => setModal({ type: 'create' })}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-bold
                         rounded-xl hover:bg-primary-700 transition-colors shadow-sm">
              <Plus className="h-4 w-4" />Yeni Rol
            </button>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl p-4 text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* ── Permissions Library ── */}
          <div className="bg-white dark:bg-army-800 border border-gray-200 dark:border-army-700 rounded-2xl shadow-sm mb-8">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-army-700">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary-600" />
                <h2 className="font-bold text-gray-900 dark:text-gray-100">İcazə Kitabxanası</h2>
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-gray-100 dark:bg-army-700 text-gray-600 dark:text-gray-400">
                  {permissions.length}
                </span>
              </div>
              <button
                onClick={() => { setShowPermForm(v => !v); setPermErr(''); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg
                           bg-primary-600 text-white hover:bg-primary-700 transition-colors">
                <Plus className="h-3.5 w-3.5" />
                {showPermForm ? 'Ləğv et' : 'Yeni icazə'}
              </button>
            </div>

            {/* New permission form */}
            {showPermForm && (
              <form onSubmit={handleCreatePermission}
                    className="mx-5 mt-4 p-4 bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-800 rounded-xl space-y-3">
                {permErr && <p className="text-xs text-red-600 font-medium">{permErr}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    value={newPerm.name}
                    onChange={e => setNewPerm(p => ({ ...p, name: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                    placeholder="icaze-adi (kebab-case)"
                    className="px-3 py-2 border border-gray-300 dark:border-army-600 rounded-xl text-sm
                               bg-white dark:bg-army-700 text-gray-900 dark:text-gray-100
                               focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                    required
                  />
                  <input
                    value={newPerm.description}
                    onChange={e => setNewPerm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Qısa izah (isteğe bağlı)"
                    className="px-3 py-2 border border-gray-300 dark:border-army-600 rounded-xl text-sm
                               bg-white dark:bg-army-700 text-gray-900 dark:text-gray-100
                               focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                  />
                  <select
                    value={newPerm.type}
                    onChange={e => setNewPerm(p => ({ ...p, type: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 dark:border-army-600 rounded-xl text-sm
                               bg-white dark:bg-army-700 text-gray-900 dark:text-gray-100
                               focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500">
                    <option value="CUSTOM">CUSTOM</option>
                    <option value="VIDEO">VIDEO</option>
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="CONTENT">CONTENT</option>
                  </select>
                </div>
                <button type="submit" disabled={permSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-bold
                             rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors">
                  {permSaving ? 'Saxlanır…' : <><Check className="h-3.5 w-3.5" />Yarat</>}
                </button>
              </form>
            )}

            {/* Category filter */}
            <div className="flex gap-1.5 flex-wrap px-5 py-3">
              {permCats.map(cat => (
                <button key={cat} onClick={() => setPermTab(cat)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    permTab === cat
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-army-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-army-600'
                  }`}>{cat}</button>
              ))}
            </div>

            {/* Permission cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-5 pb-5">
              {visiblePerms.map(p => (
                <PermCard key={p.id} perm={p} selectable={false} onDelete={handleDeletePermission} />
              ))}
            </div>
          </div>

          {/* ── Roles ── */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary-600" />
              Rollar ({roles.length})
            </h2>
            {roles.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-army-800 rounded-2xl border border-dashed border-gray-300 dark:border-army-600">
                <Shield className="h-12 w-12 text-gray-300 dark:text-army-600 mx-auto mb-3" />
                <p className="text-gray-500">Hələ heç bir rol yoxdur</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {roles.map(role => (
                  <RoleCard
                    key={role.id}
                    role={role}
                    onEdit={(r) => setModal({ type: 'edit', role: r })}
                    onDelete={(r) => setModal({ type: 'delete', role: r })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {modal?.type === 'create' && (
        <RoleFormModal mode="create" permissions={permissions} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
      {modal?.type === 'edit' && (
        <RoleFormModal mode="edit" role={modal.role} permissions={permissions} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
      {modal?.type === 'delete' && (
        <DeleteModal role={modal.role} onClose={() => setModal(null)} onDeleted={handleDeleted} />
      )}

      <Toast msg={toast.msg} type={toast.type} />
    </>
  );
};

export default RoleManagement;
