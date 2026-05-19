import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminGetUser, adminCreateUser, adminUpdateUser, adminGetRoles } from '../../services/api';
import { User, Mail, Lock, Shield, ArrowLeft, Save, Loader2 } from 'lucide-react';
import Navbar from '../../components/Navbar';

const inputClass =
  'w-full px-3.5 py-2.5 border border-gray-300 dark:border-army-600 rounded-xl text-sm ' +
  'bg-white dark:bg-army-700 text-gray-900 dark:text-gray-100 ' +
  'placeholder-gray-400 dark:placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all';

const UserForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [form, setForm] = useState({ name: '', surname: '', email: '', password: '', roleId: '' });
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(isEdit);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRoles();
    if (isEdit) loadUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadRoles = async () => {
    try {
      const res = await adminGetRoles();
      setRoles(res.data);
    } catch { /* silent */ }
  };

  const loadUser = async () => {
    try {
      const res = await adminGetUser(id);
      const u = res.data;
      setForm({ name: u.name || '', surname: u.surname || '', email: u.email || '', password: '', roleId: u.roleId || '' });
    } catch { setError('İstifadəçi yüklənə bilmədi'); }
    finally { setPageLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isEdit && (!form.password || form.password.length < 6)) {
      setError('Şifrə ən azı 6 simvol olmalıdır');
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        await adminUpdateUser(id, {
          name: form.name, surname: form.surname,
          email: form.email, roleId: form.roleId ? Number(form.roleId) : null,
        });
      } else {
        await adminCreateUser({ ...form, roleId: Number(form.roleId) });
      }
      navigate('/admin/users');
    } catch (err) {
      setError(err.response?.data?.message || (isEdit ? 'Yenilənə bilmədi' : 'Yaradıla bilmədi'));
    } finally { setLoading(false); }
  };

  if (pageLoading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-primary-50 dark:bg-army-900 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg bg-white dark:bg-army-800 rounded-2xl shadow-xl dark:border dark:border-army-700 overflow-hidden">

          {/* Header strip */}
          <div className="bg-gradient-to-r from-primary-800 to-primary-600 px-8 py-5 flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-primary-200">Admin</p>
              <h2 className="text-lg font-black text-white">
                {isEdit ? 'İstifadəçini Redaktə Et' : 'Yeni İstifadəçi Yarat'}
              </h2>
            </div>
          </div>

          <div className="px-8 py-7">
            {error && (
              <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-xl border border-red-200 dark:border-red-800">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Ad *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text" value={form.name} required
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="Ad"
                      className={inputClass + ' pl-9'}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Soyad *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text" value={form.surname} required
                      onChange={e => setForm({ ...form, surname: e.target.value })}
                      placeholder="Soyad"
                      className={inputClass + ' pl-9'}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  E-poçt *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email" value={form.email} required
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="istifadeci@ao.az"
                    className={inputClass + ' pl-9'}
                  />
                </div>
              </div>

              {!isEdit && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Şifrə *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="password" value={form.password} required minLength={6}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      placeholder="Ən az 6 simvol"
                      className={inputClass + ' pl-9'}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Rol *
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <select
                    value={form.roleId} required
                    onChange={e => setForm({ ...form, roleId: e.target.value })}
                    className={inputClass + ' pl-9 appearance-none'}
                  >
                    <option value="">Rol seçin…</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.name}{role.permissions?.length ? ` (${role.permissions.length} icazə)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-army-700">
                <button
                  type="button" onClick={() => navigate('/admin/users')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 dark:bg-army-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-army-600 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  İmtina et
                </button>
                <button
                  type="submit" disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Saxlanılır…</>
                    : <><Save className="h-4 w-4" />{isEdit ? 'Yenilə' : 'Yarat'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default UserForm;
