import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ModTubeLogo from '../components/ModTubeLogo';

/**
 * Login page — any registered user can log in with email + password.
 * SSO (AO ID) button shown only when IDP is enabled in admin settings.
 */
const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [idpEnabled, setIdpEnabled] = useState(null);
  const { login, initiateIdpLogin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/auth/idp/config', { cache: 'no-store' })
      .then(r => r.json())
      .then(cfg => setIdpEnabled(cfg.idpEnabled !== 'false'))
      .catch(() => setIdpEnabled(false));
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('Bütün sahələri doldurun'); return; }
    setLoading(true);
    try {
      const result = await login(form.email, form.password);
      if (result.success) navigate('/');
      else setError(result.message || 'Giriş uğursuz oldu');
    } catch (err) {
      setError(err.response?.data?.message || 'E-poçt və ya şifrə yanlışdır');
    } finally { setLoading(false); }
  };

  const handleSso = async () => {
    setSsoLoading(true); setError('');
    try { await initiateIdpLogin(); }
    catch { setError('SSO mövcud deyil. Yenidən cəhd edin.'); setSsoLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100
                    dark:from-army-900 dark:to-army-800
                    flex flex-col items-center justify-center p-4 transition-colors duration-200">

      {/* Branding */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <ModTubeLogo size={44} />
        <p className="text-xs font-semibold text-primary-700 dark:text-primary-400 tracking-widest uppercase">
          Lokal Hərbi Kanal
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white dark:bg-army-800 rounded-2xl
                      shadow-xl dark:border dark:border-army-700 overflow-hidden">

        {/* Header strip — army green */}
        <div className="bg-gradient-to-r from-primary-700 to-primary-600 px-8 py-5 text-center">
          <p className="text-xs font-bold tracking-widest uppercase text-primary-200 mb-1">Sistemə giriş</p>
          <h1 className="text-xl font-black text-white tracking-tight">ModTube</h1>
          <div className="mt-2 inline-flex items-center gap-2 bg-black/20 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"/>
            <span className="text-xs text-white/80">media.platform</span>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-7">

          {error && (
            <div className="mb-5 flex items-start gap-2 bg-red-50 dark:bg-red-900/20
                            border border-red-200 dark:border-red-800 rounded-lg px-3 py-2.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="flex-shrink-0 mt-px">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <span className="text-red-700 dark:text-red-400 text-sm">{error}</span>
            </div>
          )}

          {/* Email + password form — always visible */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                E-poçt ünvanı
              </label>
              <input
                name="email" type="email" autoComplete="email" required
                value={form.email} onChange={handleChange}
                placeholder="istifadeci@misal.com"
                className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-army-600 rounded-lg
                           text-sm text-gray-900 dark:text-gray-100
                           placeholder-gray-400 dark:placeholder-gray-500
                           bg-white dark:bg-army-700
                           outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Şifrə
              </label>
              <input
                name="password" type="password" autoComplete="current-password" required
                value={form.password} onChange={handleChange}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-army-600 rounded-lg
                           text-sm text-gray-900 dark:text-gray-100
                           placeholder-gray-400 dark:placeholder-gray-500
                           bg-white dark:bg-army-700
                           outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
              />
            </div>
            <button type="submit" disabled={loading || ssoLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                         bg-primary-600 text-white text-sm font-semibold rounded-lg
                         hover:bg-primary-700 hover:-translate-y-px active:translate-y-0
                         transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none shadow-sm">
              {loading
                ? <><svg className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" viewBox="0 0 24 24"/>Yüklənir…</>
                : 'Daxil ol'}
            </button>
          </form>

          {/* SSO — only when enabled */}
          {idpEnabled && (
            <>
              <div className="flex items-center gap-3 my-5">
                <hr className="flex-1 border-gray-200 dark:border-army-600"/>
                <span className="text-xs text-gray-400 dark:text-gray-500">və ya</span>
                <hr className="flex-1 border-gray-200 dark:border-army-600"/>
              </div>
              <button type="button" onClick={handleSso} disabled={ssoLoading || loading}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-3
                           bg-tan-500 text-white font-semibold rounded-xl shadow-sm
                           hover:bg-tan-600 hover:-translate-y-px active:translate-y-0
                           transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none">
                {ssoLoading
                  ? <svg className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" viewBox="0 0 24 24"/>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                }
                {ssoLoading ? 'Yönləndirilir…' : 'AO ID ilə daxil ol'}
              </button>
            </>
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
        Hesabınız yoxdur?{' '}
        <a href="mailto:admin@modtube.local" className="text-primary-600 font-medium hover:underline">
          Administratorla əlaqə
        </a>
      </p>
    </div>
  );
};

export default Login;
