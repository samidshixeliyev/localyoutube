import React from 'react';
import { useNavigate } from 'react-router-dom';

const LoggedOut = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0c10',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'JetBrains Mono', monospace",
      color: '#5eead4',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Scanlines */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 4px)',
      }} />
      {/* Radial glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(94,234,212,0.07) 0%, transparent 70%)',
      }} />

      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: 400,
        background: '#12161e',
        border: '1px solid rgba(94,234,212,0.2)',
        borderRadius: 10,
        padding: '2.5rem 2rem',
        textAlign: 'center',
        boxShadow: '0 0 40px rgba(94,234,212,0.06)',
      }}>
        {/* Icon */}
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
          style={{ marginBottom: '1.25rem' }}
          stroke="#5eead4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>

        <p style={{
          fontSize: '1rem', fontWeight: 700, color: '#e2e8f0',
          marginBottom: '0.5rem', letterSpacing: '0.02em',
        }}>
          Sistemdən çıxış edildi
        </p>
        <p style={{
          fontSize: '0.75rem', color: 'rgba(94,234,212,0.6)',
          marginBottom: '2rem', lineHeight: 1.6,
        }}>
          AO ID sessiyası uğurla sonlandırıldı.
        </p>

        <button
          onClick={() => navigate('/login')}
          style={{
            background: 'rgba(94,234,212,0.08)',
            border: '1px solid rgba(94,234,212,0.4)',
            color: '#5eead4',
            padding: '0.6rem 1.5rem',
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '0.8rem',
            letterSpacing: '0.05em',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(94,234,212,0.15)';
            e.currentTarget.style.borderColor = '#5eead4';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(94,234,212,0.08)';
            e.currentTarget.style.borderColor = 'rgba(94,234,212,0.4)';
          }}
        >
          ← Giriş səhifəsinə qayıt
        </button>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
      `}</style>
    </div>
  );
};

export default LoggedOut;
