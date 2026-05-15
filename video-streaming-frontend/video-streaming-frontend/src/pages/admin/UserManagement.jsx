import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminGetUsers, adminDeleteUser, adminResetPassword } from '../../services/api';
import {
  Plus, Edit2, Trash2, Key, ArrowLeft, Shield, Users as UsersIcon,
  Search, X, Settings, Activity, Check, AlertTriangle,
} from 'lucide-react';
import Navbar from '../../components/Navbar';

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

/* ─── StatCard ────────────────────────────────────────────────── */
function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="army-card p-5 flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
        <p className="text-3xl font-black text-gray-900 dark:text-gray-100 mt-1">{value}</p>
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="h-7 w-7 text-white" />
      </div>
    </div>
  );
}

const UserManagement = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [resetModal, setResetModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [permModal, setPermModal] = useState(null);

  const [resetPwd, setResetPwd] = useState('');
  const [toast, setToast] = useState({ msg: '', type: 'success' });

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setFilteredUsers(users); return; }
    const q = searchQuery.toLowerCase();
    setFilteredUsers(users.filter(u =>
      u.email?.toLowerCase().includes(q) ||
      u.fullName?.toLowerCase().includes(q) ||
      u.name?.toLowerCase().includes(q) ||
      u.surname?.toLowerCase().includes(q) ||
      u.roleName?.toLowerCase().includes(q)
    ));
  }, [searchQuery, users]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await adminGetUsers();
      setUsers(res.data);
      setFilteredUsers(res.data);
      setError('');
    } catch {
      setError('İstifadəçilər yüklənə bilmədi');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await adminDeleteUser(deleteModal.id);
      setUsers(u => u.filter(x => x.id !== deleteModal.id));
      setDeleteModal(null);
      showToast('İstifadəçi silindi');
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

  const getRoleBadge = (permissions = []) => {
    if (permissions.includes('super-admin'))
      return { cls: 'bg-red-600 text-white', icon: '⭐' };
    if (permissions.includes('admin-modtube'))
      return { cls: 'bg-primary-600 text-white', icon: '🔧' };
    return { cls: 'bg-army-600 dark:bg-army-500 text-white', icon: '👤' };
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <UsersIcon className="h-12 w-12 text-primary-600 mx-auto mb-3 animate-pulse" />
            <p className="text-gray-500 dark:text-gray-400">İstifadəçilər yüklənir…</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-primary-50 dark:bg-army-900 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* ── Header ── */}
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
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Sistem istifadəçilərini idarə edin</p>
            </div>
            <button onClick={() => navigate('/admin/users/new')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold
                         hover:bg-primary-700 transition-colors shadow-md hover:shadow-lg">
              <Plus className="h-5 w-5" />İstifadəçi yarat
            </button>
          </div>

          {/* ── Stats ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatCard label="Ümumi istifadəçi" value={users.length} icon={UsersIcon} color="bg-primary-600" />
            <StatCard label="Super Admin"       value={users.filter(u => u.permissions?.includes('super-admin')).length} icon={Shield} color="bg-red-600" />
            <StatCard label="Moderator"         value={users.filter(u => u.permissions?.includes('admin-modtube')).length} icon={Key} color="bg-primary-700" />
          </div>

          {/* ── Search ── */}
          <div className="mb-5">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Ad, e-poçt və ya rol ilə axtar…"
                className="w-full pl-10 pr-10 py-2.5 border border-gray-200 dark:border-army-700 rounded-xl text-sm
                           bg-white dark:bg-army-800 text-gray-900 dark:text-gray-100
                           placeholder-gray-400 dark:placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* ── Table ── */}
          <div className="army-card overflow-hidden">
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
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center">
                        <UsersIcon className="h-10 w-10 text-gray-300 dark:text-army-600 mx-auto mb-2" />
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                          {searchQuery ? 'Axtarışa uyğun istifadəçi tapılmadı' : 'İstifadəçi yoxdur'}
                        </p>
                      </td>
                    </tr>
                  ) : filteredUsers.map(user => {
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
