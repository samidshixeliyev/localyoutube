import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminGetRoles,
  adminCreateRole,
  adminUpdateRole,
  adminDeleteRole,
  adminGetPermissions,
} from '../../services/api';
import Navbar from '../../components/Navbar';
import {
  ArrowLeft, Shield, Plus, Edit2, Trash2, X, Check,
  Users, Lock, Save, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react';

/* ─── helpers ─────────────────────────────────────────────────── */
const SYSTEM_ROLES = ['super-admin'];

/* Permission metadata — enriches backend permissions with category, icon, description.
   Unknown permissions fall back to DEFAULT_META so the UI stays robust. */
const PERMISSION_META = {
  'super-admin':       { category: 'Sistem', icon: '🛡️', desc: 'Tam sistem girişi — bütün icazələri əhatə edir' },
  'admin-modtube':     { category: 'Video',  icon: '🎬', desc: 'Video yükləmə, redaktə və silmə' },
  'view-private':      { category: 'Video',  icon: '🔒', desc: 'Gizli videoları izləmək' },
  'view-metrics':      { category: 'Sistem', icon: '📊', desc: 'Prometheus metrik panelini görmək' },
  'manage-settings':   { category: 'Sistem', icon: '⚙️', desc: 'Sistem parametrlərinə dəyişiklik etmək' },
  'manage-users':      { category: 'İstifadəçi', icon: '👥', desc: 'İstifadəçiləri yaratmaq, redaktə etmək və silmək' },
  'manage-roles':      { category: 'İstifadəçi', icon: '🎭', desc: 'Rolları idarə etmək' },
  'upload-video':      { category: 'Video',  icon: '📤', desc: 'Video yükləmək' },
  'delete-video':      { category: 'Video',  icon: '🗑️', desc: 'İstənilən videonu silmək' },
  'view-reports':      { category: 'Sistem', icon: '📋', desc: 'Hesabatları görmək' },
};
const DEFAULT_META = { category: 'Digər', icon: '🔑', desc: '' };

function PermBadge({ name }) {
  const isSuper = name === 'super-admin';
  const isAdmin = name === 'admin-modtube';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md border
      ${isSuper ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' :
        isAdmin ? 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/30 dark:text-primary-400 dark:border-primary-800' :
                  'bg-army-50 text-gray-700 border-army-200 dark:bg-army-700 dark:text-gray-300 dark:border-army-600'}`}>
      <Lock className="h-2.5 w-2.5" />{name}
    </span>
  );
}

/* ─── Toast ───────────────────────────────────────────────────── */
function Toast({ msg, type = 'success' }) {
  if (!msg) return null;
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl font-medium text-sm
      ${type === 'success'
        ? 'bg-primary-700 text-white'
        : 'bg-red-700 text-white'}`}>
      {type === 'success'
        ? <Check className="h-4 w-4 bg-white/20 rounded-full p-0.5" />
        : <AlertTriangle className="h-4 w-4" />}
      {msg}
    </div>
  );
}

/* ─── RoleForm modal ──────────────────────────────────────────── */
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
  const [expandedCats, setExpandedCats] = useState({});

  const togglePerm = (id) => {
    setSelectedPerms(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleCat = (cat) =>
    setExpandedCats(prev => ({ ...prev, [cat]: !isCatExpanded(cat) }));
  const isCatExpanded = (cat) => expandedCats[cat] !== false; // default expanded

  const selectAllInCat = (perms) => {
    const ids = perms.map(p => p.id);
    setSelectedPerms(prev => Array.from(new Set([...prev, ...ids])));
  };
  const deselectAllInCat = (perms) => {
    const ids = new Set(perms.map(p => p.id));
    setSelectedPerms(prev => prev.filter(id => !ids.has(id)));
  };
  const allSelectedInCat = (perms) => perms.length > 0 && perms.every(p => selectedPerms.includes(p.id));

  /* Group permissions by category from PERMISSION_META */
  const groupedPerms = permissions.reduce((acc, perm) => {
    const meta = PERMISSION_META[perm.name] || DEFAULT_META;
    if (!acc[meta.category]) acc[meta.category] = [];
    acc[meta.category].push({ ...perm, meta });
    return acc;
  }, {});

  /* Stable category order: known categories first, then anything else (incl. "Digər") */
  const CATEGORY_ORDER = ['Sistem', 'İstifadəçi', 'Video', 'Digər'];
  const orderedCategories = Object.keys(groupedPerms).sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Rol adı tələb olunur'); return; }
    setSaving(true); setErr('');
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        permissionIds: selectedPerms,
      };
      if (isCreate) {
        const res = await adminCreateRole(payload);
        onSaved(res.data, 'create');
      } else {
        const res = await adminUpdateRole(role.id, payload);
        onSaved(res.data, 'update');
      }
    } catch (ex) {
      setErr(ex.response?.data?.message || 'Xəta baş verdi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-army-800 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200 dark:border-army-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-army-700">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {isCreate ? 'Yeni rol yarat' : `Rolu redaktə et: ${role.name}`}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {err && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-red-700 dark:text-red-400 text-sm">
              {err}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Rol adı <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={isSystemRole}
              placeholder="məs. moderator"
              className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-army-600 rounded-lg text-sm
                         bg-white dark:bg-army-700 text-gray-900 dark:text-gray-100
                         focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500
                         disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            />
            {isSystemRole && (
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Sistem rolunun adı dəyişdirilə bilməz</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Təsvir (isteğe bağlı)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Bu rolun icazələrini qısaca izah edin…"
              className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-army-600 rounded-lg text-sm
                         bg-white dark:bg-army-700 text-gray-900 dark:text-gray-100
                         focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500
                         resize-none transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                İcazələr
              </label>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full
                               bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                {selectedPerms.length} seçilib
              </span>
            </div>

            <div className="border border-gray-200 dark:border-army-600 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              {permissions.length === 0 ? (
                <p className="p-3 text-sm text-gray-400 dark:text-gray-500">İcazə tapılmadı</p>
              ) : orderedCategories.map(cat => {
                const perms = groupedPerms[cat];
                const expanded = isCatExpanded(cat);
                const selectedCount = perms.filter(p => selectedPerms.includes(p.id)).length;
                const allSelected = allSelectedInCat(perms);
                return (
                  <div key={cat} className="border-b border-gray-100 dark:border-army-700 last:border-0">
                    {/* Category header */}
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-army-900/40">
                      <button
                        type="button"
                        onClick={() => toggleCat(cat)}
                        className="flex items-center gap-2 flex-1 text-left text-sm font-bold text-gray-700 dark:text-gray-200 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      >
                        {expanded
                          ? <ChevronUp className="h-4 w-4" />
                          : <ChevronDown className="h-4 w-4" />}
                        <span>{cat}</span>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          ({selectedCount}/{perms.length} seçilib)
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => allSelected ? deselectAllInCat(perms) : selectAllInCat(perms)}
                        className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors px-2 py-1 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20"
                      >
                        {allSelected ? 'Hamısını sil' : 'Hamısını seç'}
                      </button>
                    </div>

                    {/* Category items */}
                    {expanded && perms.map(perm => {
                      const desc = PERMISSION_META[perm.name]?.desc || perm.description || '';
                      const icon = perm.meta.icon;
                      return (
                        <label
                          key={perm.id}
                          className="flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:bg-primary-50 dark:hover:bg-army-700 border-t border-gray-100 dark:border-army-700 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPerms.includes(perm.id)}
                            onChange={() => togglePerm(perm.id)}
                            className="mt-0.5 rounded border-gray-300 dark:border-army-600 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-base leading-none mt-0.5" aria-hidden="true">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{perm.name}</p>
                            {desc && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-army-600 rounded-lg text-sm font-semibold
                         text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-army-700 transition-colors">
              Ləğv et
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-semibold
                         hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm">
              {saving
                ? <><svg className="w-4 h-4 animate-spin border-2 border-white/30 border-t-white rounded-full" viewBox="0 0 24 24" />Saxlanır…</>
                : <><Save className="h-4 w-4" />{isCreate ? 'Yarat' : 'Yadda saxla'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── DeleteConfirm modal ─────────────────────────────────────── */
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-army-800 rounded-2xl w-full max-w-sm shadow-2xl border border-gray-200 dark:border-army-700 p-6">
        <div className="text-center mb-5">
          <div className="mx-auto w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-3">
            <Trash2 className="h-7 w-7 text-red-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Rolu sil</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            <span className="font-semibold text-gray-900 dark:text-gray-100">"{role.name}"</span> rolu silinsin?
          </p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">Bu əməliyyat geri qaytarıla bilməz!</p>
        </div>
        {err && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-red-700 dark:text-red-400 text-sm">
            {err}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-army-600 rounded-lg text-sm font-semibold
                       text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-army-700 transition-colors">
            Ləğv et
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold
                       hover:bg-red-700 disabled:opacity-60 transition-colors shadow-sm">
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

  return (
    <div className="army-card p-5 hover:shadow-md dark:hover:border-primary-700/50 transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-gray-900 dark:text-gray-100">{role.name}</h3>
            {isSystem && (
              <span className="inline-flex items-center gap-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400
                               border border-red-200 dark:border-red-800 text-xs font-bold px-2 py-0.5 rounded-full">
                <Shield className="h-3 w-3" />SİSTEM
              </span>
            )}
            <span className="text-xs text-gray-400 dark:text-gray-500">ID: {role.id}</span>
          </div>
          {role.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{role.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => onEdit(role)}
            className="p-1.5 rounded-lg text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
            title="Redaktə et">
            <Edit2 className="h-4 w-4" />
          </button>
          {!isSystem && (
            <button onClick={() => onDelete(role)}
              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Sil">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Permissions */}
      <div className="mt-3">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          <Lock className="h-3.5 w-3.5" />
          {role.permissions?.length || 0} icazə
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {expanded && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(role.permissions || []).length === 0
              ? <span className="text-xs text-gray-400 dark:text-gray-500">İcazə yoxdur</span>
              : (role.permissions || []).map(p => <PermBadge key={p} name={p} />)
            }
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── RoleManagement page ─────────────────────────────────────── */
const RoleManagement = () => {
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);  // null | { type: 'create' | 'edit' | 'delete', role? }
  const [toast, setToast] = useState({ msg: '', type: 'success' });

  useEffect(() => {
    Promise.all([adminGetRoles(), adminGetPermissions()])
      .then(([rolesRes, permsRes]) => {
        setRoles(rolesRes.data);
        setPermissions(permsRes.data);
      })
      .catch(() => setError('Məlumatlar yüklənə bilmədi'))
      .finally(() => setLoading(false));
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3500);
  };

  const handleSaved = (savedRole, op) => {
    if (op === 'create') {
      setRoles(prev => [...prev, savedRole]);
      showToast(`"${savedRole.name}" rolu yaradıldı`);
    } else {
      setRoles(prev => prev.map(r => r.id === savedRole.id ? savedRole : r));
      showToast(`"${savedRole.name}" rolu yeniləndi`);
    }
    setModal(null);
  };

  const handleDeleted = (id) => {
    const deleted = roles.find(r => r.id === id);
    setRoles(prev => prev.filter(r => r.id !== id));
    showToast(`"${deleted?.name}" rolu silindi`);
    setModal(null);
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Shield className="h-12 w-12 text-primary-600 mx-auto mb-3 animate-pulse" />
            <p className="text-gray-500 dark:text-gray-400">Rollar yüklənir…</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-primary-50 dark:bg-army-900 transition-colors">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

          {/* Page header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/admin/users')}
                className="p-2 rounded-lg border border-gray-200 dark:border-army-700 bg-white dark:bg-army-800
                           text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-army-700 transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Shield className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                  Rol İdarəetməsi
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {roles.length} rol · {permissions.length} mövcud icazə
                </p>
              </div>
            </div>

            <button
              onClick={() => setModal({ type: 'create' })}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-semibold
                         rounded-xl hover:bg-primary-700 active:bg-primary-800 transition-colors shadow-sm">
              <Plus className="h-4 w-4" />Yeni Rol
            </button>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Permissions legend */}
          {permissions.length > 0 && (
            <div className="army-card p-4 mb-6">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                Mövcud icazələr
              </p>
              <div className="flex flex-wrap gap-2">
                {permissions.map(p => (
                  <div key={p.id} className="flex flex-col">
                    <PermBadge name={p.name} />
                    {p.description && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 max-w-[140px] truncate"
                            title={p.description}>{p.description}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Roles list */}
          <div className="space-y-3">
            {roles.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="h-12 w-12 text-gray-300 dark:text-army-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Hələ heç bir rol yoxdur</p>
              </div>
            ) : roles.map(role => (
              <RoleCard
                key={role.id}
                role={role}
                onEdit={(r) => setModal({ type: 'edit', role: r })}
                onDelete={(r) => setModal({ type: 'delete', role: r })}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal?.type === 'create' && (
        <RoleFormModal
          mode="create"
          permissions={permissions}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
      {modal?.type === 'edit' && (
        <RoleFormModal
          mode="edit"
          role={modal.role}
          permissions={permissions}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
      {modal?.type === 'delete' && (
        <DeleteModal
          role={modal.role}
          onClose={() => setModal(null)}
          onDeleted={handleDeleted}
        />
      )}

      <Toast msg={toast.msg} type={toast.type} />
    </>
  );
};

export default RoleManagement;
