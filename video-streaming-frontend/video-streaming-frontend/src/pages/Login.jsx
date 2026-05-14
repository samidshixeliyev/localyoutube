import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const { login, initiateIdpLogin } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) { setError('Fill in all fields'); return; }
    setLoading(true);
    try {
      const result = await login(formData.email, formData.password);
      if (result.success) navigate('/');
      else setError(result.message || 'Login failed');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleSso = async () => {
    setSsoLoading(true);
    try { await initiateIdpLogin(); }
    catch { setError('SSO unavailable. Try again.'); setSsoLoading(false); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');

        .lt-login-root {
          min-height: 100vh;
          background: #0a0c10;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'JetBrains Mono', 'Courier New', monospace;
          padding: 1.5rem 1rem;
          position: relative;
          overflow: hidden;
          color: #5eead4;
        }
        .lt-login-root::before {
          content: '';
          position: fixed;
          inset: 0;
          pointer-events: none;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,255,255,0.012) 2px,
            rgba(0,255,255,0.012) 4px
          );
          z-index: 0;
        }
        .lt-login-root::after {
          content: '';
          position: fixed;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(ellipse at 50% 40%, rgba(94,234,212,0.06) 0%, transparent 65%);
          z-index: 0;
        }
        .lt-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 360px;
        }
        .lt-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 2rem;
        }
        .lt-logo {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .lt-logo-icon {
          filter: drop-shadow(0 0 6px rgba(94,234,212,0.7));
        }
        .lt-title {
          font-size: 1.35rem;
          font-weight: 700;
          color: #5eead4;
          letter-spacing: 0.05em;
        }
        .lt-subtitle {
          font-size: 0.6rem;
          color: #134e4a;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .lt-app-badge {
          margin-top: 0.25rem;
          background: rgba(94,234,212,0.04);
          border: 1px solid rgba(94,234,212,0.15);
          border-radius: 4px;
          padding: 0.35rem 0.75rem;
          font-size: 0.7rem;
          color: #2dd4bf;
          text-align: center;
        }
        .lt-app-badge strong { color: #5eead4; }
        .lt-panel {
          background: #12161e;
          border: 1px solid rgba(94,234,212,0.2);
          border-radius: 8px;
          padding: 1.75rem 1.5rem;
          box-shadow: 0 0 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(94,234,212,0.05);
        }
        .lt-section-tag {
          font-size: 0.6rem;
          color: #134e4a;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 1rem;
        }
        .lt-error {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          background: rgba(255,51,51,0.06);
          border: 1px solid rgba(255,68,68,0.3);
          border-radius: 4px;
          padding: 0.6rem 0.75rem;
          color: #ff4444;
          font-size: 0.75rem;
          margin-bottom: 1rem;
        }
        .lt-field { margin-bottom: 1rem; }
        .lt-label {
          display: block;
          font-size: 0.6rem;
          color: #2dd4bf;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 0.4rem;
        }
        .lt-input {
          width: 100%;
          background: #0a0c10;
          border: 1px solid rgba(94,234,212,0.25);
          border-radius: 4px;
          color: #5eead4;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.875rem;
          padding: 0.6rem 0.75rem;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          box-sizing: border-box;
          caret-color: #5eead4;
        }
        .lt-input::placeholder { color: #134e4a; }
        .lt-input:focus {
          border-color: #5eead4;
          box-shadow: 0 0 0 2px rgba(94,234,212,0.15);
        }
        .lt-btn-primary {
          width: 100%;
          background: transparent;
          border: 1px solid #5eead4;
          border-radius: 4px;
          color: #5eead4;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.8125rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          padding: 0.7rem 1rem;
          cursor: pointer;
          transition: background 0.15s, color 0.15s, box-shadow 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-top: 1.25rem;
        }
        .lt-btn-primary:hover:not(:disabled) {
          background: #5eead4;
          color: #0a0c10;
          box-shadow: 0 0 12px rgba(94,234,212,0.4);
        }
        .lt-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
        .lt-divider {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin: 1.25rem 0;
        }
        .lt-divider-line {
          flex: 1;
          height: 1px;
          background: rgba(94,234,212,0.12);
        }
        .lt-divider-text {
          font-size: 0.6rem;
          color: #134e4a;
          letter-spacing: 0.1em;
        }
        .lt-btn-sso {
          width: 100%;
          background: rgba(94,234,212,0.04);
          border: 1px solid rgba(94,234,212,0.2);
          border-radius: 4px;
          color: #5eead4;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.8125rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          padding: 0.7rem 1rem;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
        }
        .lt-btn-sso:hover:not(:disabled) {
          border-color: #5eead4;
          background: rgba(94,234,212,0.08);
          box-shadow: 0 0 8px rgba(94,234,212,0.2);
        }
        .lt-btn-sso:disabled { opacity: 0.45; cursor: not-allowed; }
        .lt-spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(94,234,212,0.3);
          border-top-color: #5eead4;
          border-radius: 50%;
          animation: lt-spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes lt-spin { to { transform: rotate(360deg); } }
        .lt-footer {
          margin-top: 1.5rem;
          text-align: center;
          font-size: 0.6rem;
          color: #134e4a;
          letter-spacing: 0.06em;
        }
      `}</style>

      <div className="lt-login-root">
        <div className="lt-card">
          {/* Header */}
          <div className="lt-header">
            <div className="lt-logo">
              <svg className="lt-logo-icon" width="22" height="22" viewBox="0 0 24 24"
                fill="none" stroke="#5eead4" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="1"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span className="lt-title">LocalTube</span>
            </div>
            <div className="lt-subtitle">media.platform · giriş</div>
            <div className="lt-app-badge">
              <strong>AO ID</strong> kimlik sistemi ilə qorunur
            </div>
          </div>

          <div className="lt-panel">
            {/* Error */}
            {error && (
              <div className="lt-error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{flexShrink:0, marginTop:'1px'}}>
                  <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* SSO — primary action */}
            <div className="lt-section-tag">// AO ID vasitəsilə daxil ol</div>
            <button
              type="button"
              className="lt-btn-sso"
              disabled={ssoLoading || loading}
              onClick={handleSso}
            >
              {ssoLoading ? (
                <div className="lt-spinner" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              )}
              {ssoLoading ? 'Yönləndirilir…' : 'Sign in with AO ID'}
            </button>

            {/* Divider */}
            <div className="lt-divider">
              <div className="lt-divider-line"/>
              <span className="lt-divider-text">or admin login</span>
              <div className="lt-divider-line"/>
            </div>

            {/* Local admin form */}
            <div className="lt-section-tag">// administrator girişi</div>
            <form onSubmit={handleSubmit}>
              <div className="lt-field">
                <label className="lt-label" htmlFor="email">E-poçt</label>
                <input
                  id="email" name="email" type="email" autoComplete="email" required
                  className="lt-input" placeholder="admin@example.com"
                  value={formData.email} onChange={handleChange}
                />
              </div>
              <div className="lt-field">
                <label className="lt-label" htmlFor="password">Şifrə</label>
                <input
                  id="password" name="password" type="password"
                  autoComplete="current-password" required
                  className="lt-input" placeholder="••••••••"
                  value={formData.password} onChange={handleChange}
                />
              </div>
              <button type="submit" className="lt-btn-primary" disabled={loading || ssoLoading}>
                {loading ? <><div className="lt-spinner"/>Yüklənir…</> : '→ Daxil ol'}
              </button>
            </form>
          </div>

          <div className="lt-footer">
            Hesabınız yoxdur? Administratorla əlaqə saxlayın.
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
