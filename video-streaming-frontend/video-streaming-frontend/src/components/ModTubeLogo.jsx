import React from 'react';

/**
 * ModTube logo — military shield with play button.
 * Props:
 *   size   – controls height (width derived from viewBox ratio)
 *   mini   – render square icon only (for favicon / small spaces)
 */
export default function ModTubeLogo({ size = 36, mini = false, className = '' }) {
  if (mini) {
    return (
      <svg
        width={size} height={size}
        viewBox="0 0 40 40"
        fill="none" xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        {/* Shield background */}
        <path d="M20 2 L36 8 L36 22 C36 31 20 38 20 38 C20 38 4 31 4 22 L4 8 Z"
          fill="#3a4a2e" />
        {/* Shield inner */}
        <path d="M20 5 L33 10 L33 22 C33 29.5 20 35.5 20 35.5 C20 35.5 7 29.5 7 22 L7 10 Z"
          fill="#4a5a3a" />
        {/* Play triangle */}
        <path d="M16 15 L16 26 L27 20.5 Z" fill="#c4a86a" />
        {/* Top accent bar */}
        <rect x="12" y="7" width="16" height="2" rx="1" fill="#c4a86a" opacity="0.6" />
      </svg>
    );
  }

  const h = size;
  const w = Math.round(size * 3.2);
  return (
    <svg
      width={w} height={h}
      viewBox="0 0 128 40"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background pill */}
      <rect x="0.5" y="0.5" width="127" height="39" rx="6" fill="#1a1f14" stroke="#3a4a2e" strokeWidth="1"/>

      {/* Shield icon */}
      <path d="M12 5 L24 9 L24 19 C24 25 18 29 12 31 C6 29 0.5 25 0.5 19 L0.5 9 Z"
        transform="translate(8,4) scale(0.7)"
        fill="#4a5a3a" />
      <path d="M12 7 L22 10.5 L22 19 C22 24 17 27.5 12 29 C7 27.5 2.5 24 2.5 19 L2.5 10.5 Z"
        transform="translate(8,4) scale(0.7)"
        fill="#3a4a2e" />
      <path d="M10 13 L10 22 L18 17.5 Z"
        transform="translate(8,4) scale(0.7)"
        fill="#c4a86a" />

      {/* MOD text */}
      <text x="32" y="26" fontSize="17" fontWeight="900" textAnchor="start"
        fill="#e8ead4" fontFamily="'Arial Black',Arial,sans-serif" letterSpacing="1">MOD</text>

      {/* Divider */}
      <rect x="73" y="8" width="2" height="24" rx="1" fill="#3a4a2e" />

      {/* TUBE box */}
      <rect x="78" y="10" width="44" height="20" rx="4" fill="#4a5a3a" />
      <text x="100" y="25" fontSize="13" fontWeight="900" textAnchor="middle"
        fill="#c4a86a" fontFamily="'Arial Black',Arial,sans-serif" letterSpacing="1">TUBE</text>

      {/* Tagline */}
      <text x="100" y="36" fontSize="4" fontWeight="600" textAnchor="middle"
        fill="#6b7f3a" fontFamily="Arial,sans-serif" letterSpacing="1">MILITARY MEDIA</text>
    </svg>
  );
}
