import React from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * ModTube logo — gradient shield badge + styled text.
 *
 * Props:
 *   size      – controls height in px (width scales proportionally)
 *   mini      – icon only, no text (used in collapsed/mobile navbar)
 *   className – extra Tailwind / CSS classes on the wrapper
 */
export default function ModTubeLogo({ size = 36, mini = false, className = '' }) {
  const { dark } = useTheme();

  const modText  = dark ? '#f3f4f6' : '#111827';
  const tubeText = dark ? '#9ca3af' : '#6b7280';

  const iconW = Math.round(size * 0.875);
  const fs    = Math.round(size * 0.50);
  const gap   = Math.round(size * 0.20);

  const gradId = `mt-sg-${dark ? 'd' : 'l'}`;

  const ShieldIcon = () => (
    <svg
      width={iconW}
      height={size}
      viewBox="0 0 28 32"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, display: 'block' }}
    >
      <defs>
        <linearGradient id={gradId} x1="14" y1="0" x2="14" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#e02020" />
          <stop offset="100%" stopColor="#8b0f0f" />
        </linearGradient>
      </defs>

      {/* Shield body with gradient */}
      <path
        d="M14 1.5 L26.5 6 L26.5 17.5 Q26.5 26.5 14 31 Q1.5 26.5 1.5 17.5 L1.5 6 Z"
        fill={`url(#${gradId})`}
      />

      {/* Inner highlight border */}
      <path
        d="M14 4 L24 7.5 L24 17.5 Q24 24.5 14 28.5 Q4 24.5 4 17.5 L4 7.5 Z"
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="0.75"
      />

      {/* Top sheen */}
      <path
        d="M8 6 Q14 4 20 6"
        fill="none"
        stroke="rgba(255,255,255,0.30)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Play triangle */}
      <polygon
        points="11,11 22,16 11,21"
        fill="white"
        opacity="0.95"
      />
    </svg>
  );

  if (mini) {
    return (
      <div
        className={className}
        style={{ display: 'inline-flex', userSelect: 'none' }}
        aria-label="ModTube"
      >
        <ShieldIcon />
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        userSelect: 'none',
        lineHeight: 1,
      }}
      aria-label="ModTube"
    >
      <ShieldIcon />
      <span style={{ display: 'flex', alignItems: 'baseline', lineHeight: 1 }}>
        <span style={{ fontSize: fs, fontWeight: 900, letterSpacing: '0.04em', color: modText }}>
          MOD
        </span>
        <span style={{ fontSize: fs, fontWeight: 400, letterSpacing: '0.01em', color: tubeText }}>
          TUBE
        </span>
      </span>
    </div>
  );
}
