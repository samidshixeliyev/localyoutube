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

  const togglePerm = (id) => {
    setSelectedPerms(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              İcazələr
            </label>
            <div className="border border-gray-200 dark:border-army-600 rounded-lg overflow-hidden max-h-52 overflow-y-auto">
              {permissions.length === 0 ? (
                <p className="p-3 text-sm text-gray-400 dark:text-gray-500">İcazə tapılmadı</p>
              ) : permissions.map(perm => (
                <label
                  key={perm.id}
                  className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-primary-50 dark:hover:bg-army-700 border-b border-gray-100 dark:border-army-700 last:border-0 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedPerms.includes(perm.id)}
                    onChange={() => togglePerm(perm.id)}
                    className="mt-0.5 rounded border-gray-300 dark:border-army-600 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{perm.name}</p>
                    {perm.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{perm.description}</p>
                    )}
                  </div>
                </label>
              ))}
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
