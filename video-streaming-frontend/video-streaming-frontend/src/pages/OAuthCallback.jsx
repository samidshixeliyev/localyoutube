import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
        setError('IDP returned error: ' + (params.get('error_description') || errorParam));
        return;
      }

      const savedState = sessionStorage.getItem('pkce_state');
      const codeVerifier = sessionStorage.getItem('pkce_verifier');
      const idpConfig = JSON.parse(sessionStorage.getItem('idp_config') || '{}');
      sessionStorage.removeItem('pkce_state');
      sessionStorage.removeItem('pkce_verifier');
      sessionStorage.removeItem('idp_config');

      if (!code || state !== savedState) {
        setError('Invalid OAuth2 callback: state mismatch or missing code.');
        return;
      }

      // Use the exact registered redirect URI from server config
      const redirectUri = idpConfig.redirectUri || window.location.origin + '/';

      try {
        const response = await fetch('/api/auth/idp/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirect_uri: redirectUri, code_verifier: codeVerifier }),
        });

        if (!response.ok) {
          const body = await response.text();
          setError('Token exchange failed: ' + body);
          return;
        }

        const data = await response.json();

        // access_token = sent to our API for authorization
        // id_token     = contains user identity claims (display_name, email, etc.)
        const accessToken = data.access_token;
        const idToken = data.id_token;
        const authToken = accessToken || idToken;

        if (!authToken) {
          setError('No token in IDP response.');
          return;
        }

        // Prefer id_token for user info (has display_name, email, given_name etc.)
        // Fall back to access_token payload if id_token is absent
        const userInfoPayload = idToken
          ? decodeJwtPayload(idToken)
          : decodeJwtPayload(accessToken);

        // Log in the user on the frontend
        loginWithIdp(authToken, userInfoPayload);

        // Sync id_token profile claims to the backend DB so admin can see real names.
        // Fire-and-forget: don't block login if this fails.
        try {
          await fetch('/api/auth/idp/sync-profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify(userInfoPayload),
          });
        } catch (_) { /* ignore — profile sync is best-effort */ }

        // Replace URL to remove ?code=&state= params, then go to home
        window.history.replaceState({}, '', '/');
        navigate('/', { replace: true });
      } catch (e) {
        setError('Unexpected error: ' + e.message);
      }
    };

    handle();
  }, []);

  if (error) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0c10', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono', monospace"
      }}>
        <div style={{
          maxWidth: 380, background: '#12161e', border: '1px solid rgba(255,68,68,0.3)',
          borderRadius: 8, padding: '2rem', textAlign: 'center'
        }}>
          <p style={{ color: '#ff4444', fontWeight: 700, marginBottom: '0.75rem' }}>Login failed</p>
          <p style={{ color: '#5eead4', fontSize: '0.8rem', marginBottom: '1.5rem' }}>{error}</p>
          <button onClick={() => navigate('/login')}
            style={{ background: 'none', border: '1px solid #5eead4', color: '#5eead4',
              padding: '0.5rem 1rem', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>
            ← Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0c10', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'JetBrains Mono', monospace", color: '#5eead4'
    }}>
      <div style={{
        width: 40, height: 40, border: '3px solid rgba(94,234,212,0.3)',
        borderTopColor: '#5eead4', borderRadius: '50%',
        animation: 'spin 0.7s linear infinite', marginBottom: '1rem'
      }} />
      <p style={{ fontSize: '0.85rem', color: '#2dd4bf' }}>Giriş tamamlanır…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default OAuthCallback;
