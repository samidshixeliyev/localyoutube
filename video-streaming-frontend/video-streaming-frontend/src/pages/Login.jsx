import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const { login, initiateIdpLogin } = useAuth();
  const navigate = useNavigate();

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
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ao-root {
          min-height: 100vh;
          background: #f0f2f5;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          padding: 2rem 1rem;
        }

        /* ── Top branding bar ── */
        .ao-topbar {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 2rem;
        }
        .ao-topbar-logo {
          width: 40px;
          height: 40px;
          background: #003087;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .ao-topbar-logo svg { display: block; }
        .ao-topbar-text { line-height: 1.2; }
        .ao-topbar-name {
          font-size: 1.1rem;
          font-weight: 700;
          color: #003087;
          letter-spacing: -0.01em;
        }
        .ao-topbar-sub {
          font-size: 0.7rem;
          color: #6b7280;
          letter-spacing: 0.01em;
        }

        /* ── Card ── */
        .ao-card {
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.08);
          width: 100%;
          max-width: 400px;
          overflow: hidden;
        }

        /* ── Card header ── */
        .ao-card-header {
          background: #003087;
          padding: 1.5rem 2rem 1.25rem;
          text-align: center;
        }
        .ao-card-header-label {
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.55);
          margin-bottom: 0.4rem;
        }
        .ao-card-header-title {
          font-size: 1.15rem;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.01em;
        }
        .ao-card-header-app {
          margin-top: 0.6rem;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 20px;
          padding: 0.25rem 0.75rem;
          font-size: 0.75rem;
          color: rgba(255,255,255,0.85);
        }
        .ao-app-dot {
          width: 6px;
          height: 6px;
          background: #22c55e;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* ── Card body ── */
        .ao-card-body {
          padding: 1.75rem 2rem 2rem;
        }

        /* ── Error ── */
        .ao-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 0.65rem 0.875rem;
          color: #dc2626;
          font-size: 0.8125rem;
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
        }

        /* ── SSO button ── */
        .ao-btn-sso {
          width: 100%;
          background: #003087;
          border: none;
          border-radius: 8px;
          color: #ffffff;
          font-family: inherit;
          font-size: 0.9375rem;
          font-weight: 600;
          padding: 0.8rem 1.25rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.625rem;
          transition: background 0.15s, box-shadow 0.15s, transform 0.1s;
          letter-spacing: -0.01em;
        }
        .ao-btn-sso:hover:not(:disabled) {
          background: #00256e;
          box-shadow: 0 4px 12px rgba(0,48,135,0.3);
          transform: translateY(-1px);
        }
        .ao-btn-sso:active:not(:disabled) { transform: translateY(0); }
        .ao-btn-sso:disabled { opacity: 0.6; cursor: not-allowed; }

        .ao-btn-sso-icon {
          width: 22px;
          height: 22px;
          background: rgba(255,255,255,0.15);
          border-radius: 5px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        /* ── Divider ── */
        .ao-divider {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin: 1.25rem 0;
        }
        .ao-divider hr {
          flex: 1;
          border: none;
          border-top: 1px solid #e5e7eb;
        }
        .ao-divider span {
          font-size: 0.75rem;
          color: #9ca3af;
          white-space: nowrap;
        }

        /* ── Admin toggle ── */
        .ao-admin-toggle {
          width: 100%;
          background: none;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          color: #6b7280;
          font-family: inherit;
          font-size: 0.8125rem;
          font-weight: 500;
          padding: 0.65rem 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          transition: border-color 0.15s, color 0.15s, background 0.15s;
        }
        .ao-admin-toggle:hover {
          border-color: #9ca3af;
          color: #374151;
          background: #f9fafb;
        }

        /* ── Admin form ── */
        .ao-admin-form {
          margin-top: 1.25rem;
          padding-top: 1.25rem;
          border-top: 1px solid #f3f4f6;
        }
        .ao-admin-form-title {
          font-size: 0.75rem;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 1rem;
        }
        .ao-field { margin-bottom: 1rem; }
        .ao-label {
          display: block;
          font-size: 0.8125rem;
          font-weight: 500;
          color: #374151;
          margin-bottom: 0.375rem;
        }
        .ao-input {
          width: 100%;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 7px;
          color: #111827;
          font-family: inherit;
          font-size: 0.9375rem;
          padding: 0.625rem 0.875rem;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .ao-input::placeholder { color: #9ca3af; }
        .ao-input:focus {
          border-color: #003087;
          box-shadow: 0 0 0 3px rgba(0,48,135,0.1);
        }
        .ao-btn-submit {
          width: 100%;
          background: #111827;
          border: none;
          border-radius: 8px;
          color: #ffffff;
          font-family: inherit;
          font-size: 0.9rem;
          font-weight: 600;
          padding: 0.75rem 1rem;
          cursor: pointer;
          margin-top: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: background 0.15s, transform 0.1s;
        }
        .ao-btn-submit:hover:not(:disabled) {
          background: #1f2937;
          transform: translateY(-1px);
        }
        .ao-btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

        /* ── Spinner ── */
        .ao-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: ao-spin 0.65s linear infinite;
        }
        @keyframes ao-spin { to { transform: rotate(360deg); } }

        /* ── Footer ── */
        .ao-footer {
          text-align: center;
          margin-top: 1.5rem;
          font-size: 0.75rem;
          color: #9ca3af;
          line-height: 1.5;
        }
        .ao-footer a {
          color: #003087;
          text-decoration: none;
          font-weight: 500;
        }
        .ao-footer a:hover { text-decoration: underline; }
      `}</style>

      <div className="ao-root">

        {/* Top branding */}
        <div className="ao-topbar">
          <div className="ao-topbar-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div className="ao-topbar-text">
            <div className="ao-topbar-name">AO ID</div>
            <div className="ao-topbar-sub">Korporativ İdentifikasiya Sistemi</div>
          </div>
        </div>

        {/* Card */}
        <div className="ao-card">

          {/* Header */}
          <div className="ao-card-header">
            <div className="ao-card-header-label">Sistemə giriş</div>
            <div className="ao-card-header-title">LocalTube</div>
            <div className="ao-card-header-app">
              <span className="ao-app-dot"/>
              media.platform
            </div>
          </div>

          {/* Body */}
          <div className="ao-card-body">

            {error && (
              <div className="ao-error">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{flexShrink:0, marginTop:'1px'}}>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Primary: SSO */}
            <button
              type="button"
              className="ao-btn-sso"
              disabled={ssoLoading || loading}
              onClick={handleSso}
            >
              {ssoLoading ? (
                <div className="ao-spinner"/>
              ) : (
                <div className="ao-btn-sso-icon">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
              )}
              {ssoLoading ? 'Yönləndirilir…' : 'AO ID ilə daxil ol'}
            </button>

            {/* Divider */}
            <div className="ao-divider">
              <hr/><span>və ya</span><hr/>
            </div>

            {/* Secondary: admin toggle */}
            <button
              type="button"
              className="ao-admin-toggle"
              onClick={() => { setShowAdminForm(v => !v); setError(''); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="1"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              {showAdminForm ? 'Admin formu gizlət' : 'Administrator girişi'}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{marginLeft: 'auto', transform: showAdminForm ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s'}}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {/* Admin form (collapsible) */}
            {showAdminForm && (
              <div className="ao-admin-form">
                <div className="ao-admin-form-title">Administrator girişi</div>
                <form onSubmit={handleSubmit}>
                  <div className="ao-field">
                    <label className="ao-label" htmlFor="email">E-poçt ünvanı</label>
                    <input
                      id="email" name="email" type="email"
                      autoComplete="email" required
                      className="ao-input"
                      placeholder="admin@example.com"
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="ao-field">
                    <label className="ao-label" htmlFor="password">Şifrə</label>
                    <input
                      id="password" name="password" type="password"
                      autoComplete="current-password" required
                      className="ao-input"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                    />
                  </div>
                  <button type="submit" className="ao-btn-submit" disabled={loading || ssoLoading}>
                    {loading ? <><div className="ao-spinner"/>Yüklənir…</> : 'Daxil ol'}
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>

        <div className="ao-footer">
          Hesabınız yoxdur?&nbsp;
          <a href="mailto:admin@localtube.local">Administratorla əlaqə</a>
          <br/>
          <span style={{fontSize:'0.7rem', opacity: 0.7}}>
            Powered by AO ID · auth.ao.az
          </span>
        </div>

      </div>
    </>
  );
};

export default Login;
