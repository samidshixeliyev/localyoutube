import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ModTubeLogo from '../components/ModTubeLogo';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
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
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-primary-100 to-army-100
                    dark:from-army-950 dark:via-army-900 dark:to-army-800
                    flex flex-col items-center justify-center p-4 transition-colors duration-200">

      {/* Branding */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <ModTubeLogo size={52} />
        <p className="text-xs font-bold text-primary-700 dark:text-primary-400 tracking-widest uppercase">
          Lokal Hərbi Media Platforması
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white dark:bg-army-800 rounded-2xl
                      shadow-2xl dark:border dark:border-army-700 overflow-hidden">

        {/* Header strip */}
        <div className="bg-gradient-to-r from-primary-800 to-primary-600 px-10 py-7 text-center relative overflow-hidden">
          {/* decorative circles */}
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-black/10" />
          <p className="text-xs font-bold tracking-widest uppercase text-primary-200 mb-1 relative">Sistemə giriş</p>
          <h1 className="text-2xl font-black text-white tracking-tight relative">ModTube</h1>
          <div className="mt-3 inline-flex items-center gap-2 bg-black/25 rounded-full px-4 py-1.5 relative">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"/>
            <span className="text-xs text-white/90 font-medium">Sistem aktiv</span>
          </div>
        </div>

        {/* Body */}
        <div className="px-10 py-8">

          {error && (
            <div className="mb-6 flex items-start gap-2.5 bg-red-50 dark:bg-red-900/20
                            border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <span className="text-red-700 dark:text-red-400 text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                E-poçt ünvanı
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  name="email" type="email" autoComplete="email" required
                  value={form.email} onChange={handleChange}
                  placeholder="istifadeci@misal.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-army-600 rounded-xl
                             text-sm text-gray-900 dark:text-gray-100
                             placeholder-gray-400 dark:placeholder-gray-500
                             bg-white dark:bg-army-700
                             outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Şifrə
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  name="password" type={showPass ? 'text' : 'password'} autoComplete="current-password" required
                  value={form.password} onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 border border-gray-300 dark:border-army-600 rounded-xl
                             text-sm text-gray-900 dark:text-gray-100
                             placeholder-gray-400 dark:placeholder-gray-500
                             bg-white dark:bg-army-700
                             outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading || ssoLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3
                         bg-primary-600 text-white text-sm font-bold rounded-xl
                         hover:bg-primary-700 hover:-translate-y-px active:translate-y-0
                         transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none shadow-md mt-2">
              {loading
                ? <><svg className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" viewBox="0 0 24 24"/>Yüklənir…</>
                : 'Sistemə Daxil Ol'}
            </button>
          </form>

          {idpEnabled && (
            <>
              <div className="flex items-center gap-3 my-6">
                <hr className="flex-1 border-gray-200 dark:border-army-600"/>
                <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">VƏ YA</span>
                <hr className="flex-1 border-gray-200 dark:border-army-600"/>
              </div>
              <button type="button" onClick={handleSso} disabled={ssoLoading || loading}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-3
                           bg-tan-500 text-white font-bold rounded-xl shadow-md
                           hover:bg-tan-600 hover:-translate-y-px active:translate-y-0
                           transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none">
                {ssoLoading
                  ? <svg className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" viewBox="0 0 24 24"/>
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                }
                {ssoLoading ? 'Yönləndirilir…' : 'AO ID ilə Daxil Ol'}
              </button>
            </>
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
        Hesabınız yoxdur?{' '}
        <a href="mailto:admin@modtube.local" className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">
          Administratorla əlaqə saxlayın
        </a>
      </p>
    </div>
  );
};

export default Login;
