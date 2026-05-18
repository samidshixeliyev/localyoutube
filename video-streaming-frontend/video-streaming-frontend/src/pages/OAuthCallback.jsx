import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ModTubeLogo from '../components/ModTubeLogo';

function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

const OAuthCallback = () => {
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { loginWithIdp } = useAuth();

  useEffect(() => {
    const handle = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const errorParam = params.get('error');

      if (errorParam) {
        setError('IDP xətası: ' + (params.get('error_description') || errorParam));
        return;
      }

      const savedState = sessionStorage.getItem('pkce_state');
      const codeVerifier = sessionStorage.getItem('pkce_verifier');
      const idpConfig = JSON.parse(sessionStorage.getItem('idp_config') || '{}');
      sessionStorage.removeItem('pkce_state');
      sessionStorage.removeItem('pkce_verifier');
      sessionStorage.removeItem('idp_config');

      if (!code || state !== savedState) {
        setError('Etibarsız OAuth2 callback: state uyğunsuzluğu və ya kod tapılmadı.');
        return;
      }

      const redirectUri = idpConfig.redirectUri || window.location.origin + '/';

      try {
        const response = await fetch('/api/auth/idp/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirect_uri: redirectUri, code_verifier: codeVerifier }),
        });

        if (!response.ok) {
          const body = await response.text();
          setError('Token mübadiləsi uğursuz oldu: ' + body);
          return;
        }

        const data = await response.json();
        const accessToken = data.access_token;
        const idToken = data.id_token;
        const authToken = accessToken || idToken;

        if (!authToken) {
          setError('IDP cavabında token tapılmadı.');
          return;
        }

        const userInfoPayload = idToken
          ? decodeJwtPayload(idToken)
          : decodeJwtPayload(accessToken);

        loginWithIdp(authToken, userInfoPayload);

        try {
          await fetch('/api/auth/idp/sync-profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify(userInfoPayload),
          });
        } catch (_) {}

        window.history.replaceState({}, '', '/');
        navigate('/', { replace: true });
      } catch (e) {
        setError('Gözlənilməz xəta: ' + e.message);
      }
    };

    handle();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-primary-100 to-army-100
                      dark:from-army-950 dark:via-army-900 dark:to-army-800
                      flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white dark:bg-army-800 rounded-2xl shadow-2xl
                        border border-gray-200 dark:border-army-700 overflow-hidden">
          <div className="bg-gradient-to-r from-red-700 to-red-500 px-8 py-6 text-center">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2"
                   viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <p className="text-white font-bold text-lg">Giriş uğursuz oldu</p>
          </div>
          <div className="px-8 py-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5 leading-relaxed">{error}</p>
            <button onClick={() => navigate('/login')}
              className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold
                         rounded-lg transition-colors">
              ← Giriş səhifəsinə qayıt
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-primary-100 to-army-100
                    dark:from-army-950 dark:via-army-900 dark:to-army-800
                    flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-6">
        <ModTubeLogo size={52} />

        {/* Spinner ring */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-primary-200 dark:border-primary-900" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent
                          border-t-primary-600 dark:border-t-primary-400 animate-spin" />
          <div className="absolute inset-2 rounded-full border-2 border-transparent
                          border-t-tan-500 dark:border-t-tan-400 animate-spin"
               style={{ animationDuration: '0.6s', animationDirection: 'reverse' }} />
        </div>

        <div className="text-center">
          <p className="text-base font-semibold text-gray-800 dark:text-gray-100">Giriş tamamlanır…</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">AO ID hesabınız yoxlanılır</p>
        </div>

        {/* Animated dots */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i}
              className="w-2 h-2 rounded-full bg-primary-500 dark:bg-primary-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default OAuthCallback;
