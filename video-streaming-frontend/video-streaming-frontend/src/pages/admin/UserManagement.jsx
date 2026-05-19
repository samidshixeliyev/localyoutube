import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminSearchUsers, adminDeleteUser, adminResetPassword,
  adminGetRoles, adminGetPermissions,
} from '../../services/api';
import {
  Plus, Edit2, Trash2, Key, ArrowLeft, Shield, Users as UsersIcon,
  Search, X, Settings, Activity, Check, AlertTriangle, ChevronLeft,
  ChevronRight, Filter,
} from 'lucide-react';
import Navbar from '../../components/Navbar';

/* ─── Toast ───────────────────────────────────────────────────── */
function Toast({ msg, type = 'success' }) {
  if (!msg) return null;
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl font-medium text-sm
      ${type === 'success' ? 'bg-primary-700 text-white' : 'bg-red-700 text-white'}`}>
      {type === 'success' ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      {msg}
    </div>
  );
}

/* ─── Pagination ──────────────────────────────────────────────── */
function Pagination({ page, totalPages, total, size, onPage }) {
  if (totalPages <= 1) return null;
  const pages = [];
  const start = Math.max(0, page - 2);
  const end   = Math.min(totalPages - 1, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {page * size + 1}–{Math.min((page + 1) * size, total)} / {total} istifadəçi
      </p>
      <div className="flex items-center gap-1">
        <button
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
          className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-army-700 text-gray-600 dark:text-gray-300 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map(p => (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
              p === page
                ? 'bg-primary-600 text-white'
                : 'hover:bg-gray-100 dark:hover:bg-army-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            {p + 1}
          </button>
        ))}
        <button
          disabled={page >= totalPages - 1}
          onClick={() => onPage(page + 1)}
          className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-army-700 text-gray-600 dark:text-gray-300 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ─── Main ────────────────────────────────────────────────────── */
const PAGE_SIZE = 20;

const UserManagement = () => {
  const navigate = useNavigate();

  // Data
  const [users,       setUsers]       = useState([]);
  const [total,       setTotal]       = useState(0);
  const [totalPages,  setTotalPages]  = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');

  // Filters
  const [search,     setSearch]     = useState('');
  const [roleId,     setRoleId]     = useState('');
  const [permission, setPermission] = useState('');
  const [page,       setPage]       = useState(0);

  // Filter options
  const [roles,       setRoles]       = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Modals
  const [resetModal, setResetModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [permModal,  setPermModal]  = useState(null);
  const [resetPwd,   setResetPwd]   = useState('');
  const [toast,      setToast]      = useState({ msg: '', type: 'success' });

  const debounceRef = useRef(null);

  // Load filter options once
  useEffect(() => {
    Promise.all([adminGetRoles(), adminGetPermissions()])
      .then(([r, p]) => { setRoles(r.data || []); setPermissions(p.data || []); })
      .catch(() => {});
  }, []);

  const fetchUsers = useCallback(async (s, rid, perm, pg) => {
    try {
      setLoading(true);
      setError('');
      const res = await adminSearchUsers({
        search: s,
        roleId: rid ? Number(rid) : undefined,
        permission: perm,
        page: pg,
        size: PAGE_SIZE,
      });
      const d = res.data;
      setUsers(d.users || []);
      setTotal(d.total || 0);
      setTotalPages(d.totalPages || 0);
    } catch {
      setError('İstifadəçilər yüklənə bilmədi');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce search; immediate on filter/page change
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchUsers(search, roleId, permission, page);
    }, search ? 350 : 0);
    return () => clearTimeout(debounceRef.current);
  }, [search, roleId, permission, page, fetchUsers]);

  const handleSearchChange = (v) => { setSearch(v); setPage(0); };
  const handleRoleChange   = (v) => { setRoleId(v);  setPage(0); };
  const handlePermChange   = (v) => { setPermission(v); setPage(0); };
  const clearFilters = () => { setSearch(''); setRoleId(''); setPermission(''); setPage(0); };
  const hasFilters = search || roleId || permission;

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await adminDeleteUser(deleteModal.id);
      setDeleteModal(null);
      showToast('İstifadəçi silindi');
      fetchUsers(search, roleId, permission, page);
    } catch (ex) {
      showToast(ex.response?.data?.message || 'Silinə bilmədi', 'error');
    }
  };

  const handleResetPassword = async () => {
    if (!resetPwd || resetPwd.length < 6) { showToast('Şifrə ən azı 6 simvol olmalıdır', 'error'); return; }
    try {
      await adminResetPassword(resetModal.id, resetPwd);
      setResetModal(null); setResetPwd('');
      showToast('Şifrə yeniləndi');
    } catch (ex) {
      showToast(ex.response?.data?.message || 'Şifrə yenilənə bilmədi', 'error');
    }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3000);
  };

  const getRoleBadge = (perms = []) => {
    if (perms.includes('super-admin'))   return { cls: 'bg-red-600 text-white',     icon: '⭐' };
    if (perms.includes('admin-modtube')) return { cls: 'bg-primary-600 text-white', icon: '🔧' };
    return { cls: 'bg-army-600 dark:bg-army-500 text-white', icon: '👤' };
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-primary-50 dark:bg-army-900 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* ── Header nav ── */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <button onClick={() => navigate('/')}
              className="flex items-center gap-1.5 px-3 py-2 army-card text-sm text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-army-700 transition-colors">
              <ArrowLeft className="h-4 w-4" />Ana səhifə
            </button>
            <button onClick={() => navigate('/admin/roles')}
              className="flex items-center gap-1.5 px-3 py-2 army-card text-sm text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-army-700 transition-colors">
              <Shield className="h-4 w-4" />Rollar
            </button>
            <button onClick={() => navigate('/admin/settings')}
              className="flex items-center gap-1.5 px-3 py-2 army-card text-sm text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-army-700 transition-colors">
              <Settings className="h-4 w-4" />Parametrlər
            </button>
            <button onClick={() => navigate('/admin/metrics')}
              className="flex items-center gap-1.5 px-3 py-2 army-card text-sm text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-army-700 transition-colors">
              <Activity className="h-4 w-4" />Metriklər
            </button>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <UsersIcon className="h-8 w-8 text-primary-600 dark:text-primary-400" />
                İstifadəçi İdarəetməsi
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                {total > 0 ? `${total} istifadəçi tapıldı` : 'Sistem istifadəçilərini idarə edin'}
              </p>
            </div>
            <button onClick={() => navigate('/admin/users/new')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold
                         hover:bg-primary-700 transition-colors shadow-md hover:shadow-lg">
              <Plus className="h-5 w-5" />İstifadəçi yarat
            </button>
          </div>

          {/* ── Search + Filters ── */}
          <div className="mb-5 space-y-3">
            <div className="flex gap-2">
              {/* Search input */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => handleSearchChange(e.target.value)}
                  placeholder="Ad, soyad, e-poçt və ya rol…"
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-200 dark:border-army-700 rounded-xl text-sm
                             bg-white dark:bg-army-800 text-gray-900 dark:text-gray-100
                             placeholder-gray-400 dark:placeholder-gray-500
                             focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                />
                {search && (
                  <button onClick={() => handleSearchChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Toggle filter panel */}
              <button
                onClick={() => setFiltersOpen(v => !v)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  filtersOpen || roleId || permission
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white dark:bg-army-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-army-700 hover:bg-gray-50 dark:hover:bg-army-700'
                }`}
              >
                <Filter className="h-4 w-4" />
                Filterlər
                {(roleId || permission) && (
                  <span className="ml-1 bg-white/30 text-white rounded-full px-1.5 py-0.5 text-xs leading-none">
                    {(roleId ? 1 : 0) + (permission ? 1 : 0)}
                  </span>
                )}
              </button>

              {hasFilters && (
                <button onClick={clearFilters}
                  className="px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800
                             bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Expanded filter row */}
            {filtersOpen && (
              <div className="flex flex-wrap gap-3 p-4 bg-white dark:bg-army-800 rounded-xl border border-gray-200 dark:border-army-700">
                {/* Role filter */}
                <div className="flex flex-col gap-1 min-w-[180px]">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rol</label>
                  <select
                    value={roleId}
                    onChange={e => handleRoleChange(e.target.value)}
                    className="px-3 py-2 border border-gray-200 dark:border-army-600 rounded-lg text-sm
                               bg-white dark:bg-army-700 text-gray-900 dark:text-gray-100
                               focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                  >
                    <option value="">Hamısı</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                {/* Permission filter */}
                <div className="flex flex-col gap-1 min-w-[220px]">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">İcazə</label>
                  <select
                    value={permission}
                    onChange={e => handlePermChange(e.target.value)}
                    className="px-3 py-2 border border-gray-200 dark:border-army-600 rounded-lg text-sm
                               bg-white dark:bg-army-700 text-gray-900 dark:text-gray-100
                               focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                  >
                    <option value="">Hamısı</option>
                    {permissions.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Page size info */}
                <div className="flex flex-col gap-1 justify-end">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Səhifə başına</label>
                  <span className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">{PAGE_SIZE} nəticə</span>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* ── Table ── */}
          <div className="army-card overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <UsersIcon className="h-10 w-10 text-primary-600 animate-pulse" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-primary-50 dark:bg-army-700 border-b border-gray-200 dark:border-army-600">
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">İstifadəçi</th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">E-poçt</th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Rol</th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">İcazələr</th>
                      <th className="px-5 py-3.5 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Əməliyyatlar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-army-700">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-12 text-center">
                          <UsersIcon className="h-10 w-10 text-gray-300 dark:text-army-600 mx-auto mb-2" />
                          <p className="text-gray-500 dark:text-gray-400 text-sm">
                            {hasFilters ? 'Axtarışa uyğun istifadəçi tapılmadı' : 'İstifadəçi yoxdur'}
                          </p>
                        </td>
                      </tr>
                    ) : users.map(user => {
                      const badge = getRoleBadge(user.permissions || []);
                      return (
                        <tr key={user.id} className="hover:bg-primary-50/50 dark:hover:bg-army-700/50 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                {(user.fullName || user.name || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                                  {user.fullName || `${user.name || ''} ${user.surname || ''}`.trim()}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">ID: {user.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">{user.email}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>
                              <span>{badge.icon}</span>{user.roleName}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {user.permissions?.length > 0 ? (
                              <button onClick={() => setPermModal(user)}
                                className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium">
                                {user.permissions.length} icazə
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => navigate(`/admin/users/${user.id}/edit`)}
                                className="p-1.5 rounded-lg text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                                title="Redaktə et">
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button onClick={() => { setResetModal(user); setResetPwd(''); }}
                                className="p-1.5 rounded-lg text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors"
                                title="Şifrəni sıfırla">
                                <Key className="h-4 w-4" />
                              </button>
                              <button onClick={() => setDeleteModal(user)}
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                title="Sil">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && (
              <div className="px-5 pb-4">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  total={total}
                  size={PAGE_SIZE}
                  onPage={setPage}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Delete modal ── */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-army-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-200 dark:border-army-700">
            <div className="text-center mb-5">
              <div className="mx-auto w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-3">
                <Trash2 className="h-7 w-7 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">İstifadəçini sil</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{deleteModal.fullName || deleteModal.email}</span> silinsin?
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">Bu əməliyyat geri qaytarıla bilməz!</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-army-600 rounded-lg text-sm font-semibold
                           text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-army-700 transition-colors">
                Ləğv et
              </button>
              <button onClick={handleDelete}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors">
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset password modal ── */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-army-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-200 dark:border-army-700">
            <div className="text-center mb-5">
              <div className="mx-auto w-14 h-14 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mb-3">
                <Key className="h-7 w-7 text-yellow-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Şifrəni sıfırla</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                İstifadəçi: <span className="font-semibold text-gray-900 dark:text-gray-100">{resetModal.fullName || resetModal.email}</span>
              </p>
            </div>
            <input
              type="password"
              value={resetPwd}
              onChange={e => setResetPwd(e.target.value)}
              placeholder="Yeni şifrə (ən az 6 simvol)"
              className="w-full px-4 py-3 border border-gray-300 dark:border-army-600 rounded-xl mb-4 text-sm
                         bg-white dark:bg-army-700 text-gray-900 dark:text-gray-100
                         focus:outline-none focus:ring-2 focus:ring-yellow-500/30 focus:border-yellow-500 transition-all"
            />
            <div className="flex gap-3">
              <button onClick={() => setResetModal(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-army-600 rounded-lg text-sm font-semibold
                           text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-army-700 transition-colors">
                Ləğv et
              </button>
              <button onClick={handleResetPassword}
                className="flex-1 px-4 py-2.5 bg-yellow-600 text-white rounded-lg text-sm font-semibold hover:bg-yellow-700 transition-colors">
                Yenilə
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Permissions modal ── */}
      {permModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-army-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-200 dark:border-army-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">İstifadəçi icazələri</h3>
              <button onClick={() => setPermModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              <span className="font-semibold text-gray-900 dark:text-gray-100">{permModal.fullName || permModal.email}</span>
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(permModal.permissions || []).map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-primary-50 dark:bg-army-700 rounded-lg border border-primary-100 dark:border-army-600">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{p}</span>
                  <Shield className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                </div>
              ))}
            </div>
            <button onClick={() => setPermModal(null)}
              className="w-full mt-4 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors">
              Bağla
            </button>
          </div>
        </div>
      )}

      <Toast msg={toast.msg} type={toast.type} />
    </>
  );
};

export default UserManagement;
