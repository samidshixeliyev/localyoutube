import React from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * ModTube logo — SVG shield icon + styled text. No PNG files required.
 *
 * Props:
 *   size      – controls height in px (width scales proportionally)
 *   mini      – icon only, no text (used in collapsed/mobile navbar)
 *   className – extra Tailwind / CSS classes on the wrapper
 */
export default function ModTubeLogo({ size = 36, mini = false, className = '' }) {
  const { dark } = useTheme();

  const oliveText = dark ? '#a3b96a' : '#556430';   // primary-400 dark / primary-600 light
  const sandText  = dark ? '#c4aa62' : '#9a7b38';   // tan-400 dark   / tan-600 light

  // Proportional measurements
  const iconW  = Math.round(size * 0.875); // 28/32 ≈ 0.875 of height
  const fs     = Math.round(size * 0.50);  // font size
  const gap    = Math.round(size * 0.22);  // gap between icon and text

  /* ── Shield icon ──────────────────────────────────────────────── */
  const ShieldIcon = () => (
    <svg
      width={iconW}
      height={size}
      viewBox="0 0 28 32"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, display: 'block' }}
    >
      {/* Shield body */}
      <path
        d="M14 1 L27 5.5 L27 17 Q27 26 14 31 Q1 26 1 17 L1 5.5 Z"
        fill="#556430"
      />
      {/* Inner highlight for depth */}
      <path
        d="M14 3 L25 7 L25 17 Q25 24.5 14 29 Q3 24.5 3 17 L3 7 Z"
        fill="#6b7f3a"
        opacity="0.5"
      />
      {/* Play triangle */}
      <polygon
        points="10,10.5 22,16 10,21.5"
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
      <span
        style={{
          fontSize: fs,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'baseline',
        }}
      >
        <span style={{ color: oliveText }}>MOD</span>
        <span style={{ color: sandText  }}>TUBE</span>
      </span>
    </div>
  );
}
