import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);
  // null = still loading, true/false = resolved
  const [idpEnabled, setIdpEnabled] = useState(null);
  const { login, initiateIdpLogin } = useAuth();
  const navigate = useNavigate();

  // Fetch IDP config once on mount to know whether to show the SSO button.
  // Falls back to showing the button if the request fails (safe default).
  // When SSO is disabled, auto-expand the admin form so users aren't stuck.
  useEffect(() => {
    // cache: 'no-store' prevents the browser from serving a stale response
    // after an admin has just toggled the IDP enabled/disabled setting.
    fetch('/api/auth/idp/config', { cache: 'no-store' })
      .then(r => r.json())
      .then(cfg => {
        const enabled = cfg.idpEnabled !== 'false';
        setIdpEnabled(enabled);
        if (!enabled) setShowAdminForm(true); // auto-open admin login
      })
      .catch(() => setIdpEnabled(true));
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) { setError('Bütün sahələri doldurun'); return; }
    setLoading(true);
    try {
      const result = await login(formData.email, formData.password);
      if (result.success) navigate('/');
      else setError(result.message || 'Giriş uğursuz oldu');
    } catch (err) {
      setError(err.response?.data?.message || 'Yanlış məlumatlar');
    } finally {
      setLoading(false);
    }
  };

  const handleSso = async () => {
    setSsoLoading(true);
    setError('');
    try { await initiateIdpLogin(); }
    catch { setError('SSO mövcud deyil. Yenidən cəhd edin.'); setSsoLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-4 font-sans">

      {/* Top branding */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-orange-600 rounded-xl flex items-center justify-center shadow-md">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <div>
          <div className="text-base font-bold text-gray-900 leading-tight">AO ID</div>
          <div className="text-xs text-gray-500 tracking-wide">Korporativ İdentifikasiya Sistemi</div>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">

        {/* Card header */}
        <div className="bg-gradient-to-r from-primary-600 to-orange-500 px-8 py-6 text-center">
          <p className="text-xs font-semibold tracking-widest uppercase text-orange-100 mb-1">
            Sistemə giriş
          </p>
          <h1 className="text-xl font-bold text-white tracking-tight">ModTube</h1>
          <div className="mt-3 inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0"/>
            <span className="text-xs text-white/85">media.platform</span>
          </div>
        </div>

        {/* Card body */}
        <div className="px-8 py-7">

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="flex-shrink-0 mt-px">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <span className="text-red-700 text-sm leading-snug">{error}</span>
            </div>
          )}

          {/* Primary: SSO — hidden when IDP is disabled in admin settings */}
          {idpEnabled && (
            <>
              <button
                type="button"
                onClick={handleSso}
                disabled={ssoLoading || loading}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-gradient-to-r from-primary-600 to-orange-500 text-white font-semibold rounded-xl shadow-sm hover:from-primary-700 hover:to-orange-600 hover:-translate-y-px active:translate-y-0 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              >
                {ssoLoading ? (
                  <svg className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" viewBox="0 0 24 24"/>
                ) : (
                  <span className="w-6 h-6 bg-white/15 rounded-md flex items-center justify-center flex-shrink-0">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                      stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </span>
                )}
                {ssoLoading ? 'Yönləndirilir…' : 'AO ID ilə daxil ol'}
              </button>

              {/* Divider — only shown when SSO button is visible */}
              <div className="flex items-center gap-3 my-5">
                <hr className="flex-1 border-gray-200"/>
                <span className="text-xs text-gray-400">və ya</span>
                <hr className="flex-1 border-gray-200"/>
              </div>
            </>
          )}

          {/* Admin toggle — hidden when SSO is disabled (form is already open) */}
          {idpEnabled && <button
            type="button"
            onClick={() => { setShowAdminForm(v => !v); setError(''); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-500 text-sm font-medium hover:border-gray-300 hover:text-gray-700 hover:bg-gray-50 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="1"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            {showAdminForm ? 'Admin formu gizlət' : 'Administrator girişi'}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ marginLeft: 'auto', transform: showAdminForm ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>}

          {/* Admin form (collapsible) */}
          {showAdminForm && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
                Administrator girişi
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    E-poçt ünvanı
                  </label>
                  <input
                    id="email" name="email" type="email"
                    autoComplete="email" required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="admin@example.com"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Şifrə
                  </label>
                  <input
                    id="password" name="password" type="password"
                    autoComplete="current-password" required
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || ssoLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 hover:-translate-y-px active:translate-y-0 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" viewBox="0 0 24 24"/>
                      Yüklənir…
                    </>
                  ) : 'Daxil ol'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 text-center text-xs text-gray-400 leading-relaxed">
        Hesabınız yoxdur?{' '}
        <a href="mailto:admin@localtube.local" className="text-primary-600 font-medium hover:underline">
          Administratorla əlaqə
        </a>
        <br/>
        <span className="opacity-70">Powered by AO ID · auth.ao.az</span>
      </p>
    </div>
  );
};

export default Login;
