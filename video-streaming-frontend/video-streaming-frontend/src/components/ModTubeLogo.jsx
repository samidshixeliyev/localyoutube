import React from 'react';

/**
 * ModTube army-patch logo.
 * Mirrors the physical patch: olive-green left half | tan right half,
 * with "MOD" / "TUBE" text and a stitched border.
 *
 * Props:
 *   size   – number, controls height (width = height * 2)
 *   mini   – render only the icon patch (square)
 */
export default function ModTubeLogo({ size = 36, mini = false, className = '' }) {
  if (mini) {
    // Square icon version for favicon / small spaces
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        {/* Border */}
        <rect x="1" y="1" width="38" height="38" rx="4" fill="#1a1f14" />
        {/* Left green half */}
        <rect x="3" y="3" width="17" height="34" rx="2" fill="#4a5a3a" />
        {/* Right tan half */}
        <rect x="20" y="3" width="17" height="34" rx="2" fill="#c4a86a" />
        {/* M */}
        <text x="11" y="26" fontSize="18" fontWeight="900" textAnchor="middle"
          fill="#1a1f14" fontFamily="Arial,Helvetica,sans-serif">M</text>
        {/* T */}
        <text x="28.5" y="26" fontSize="18" fontWeight="900" textAnchor="middle"
          fill="#1a1f14" fontFamily="Arial,Helvetica,sans-serif">T</text>
        {/* Stitching dots */}
        {[6,10,14,18,22,26,30,34].map(x => (
          <circle key={x} cx={x} cy={2} r="0.8" fill="#6b7f3a" opacity="0.6" />
        ))}
      </svg>
    );
  }

  // Full horizontal patch logo
  const h = size;
  const w = size * 2.8;
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 112 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer border / stitching frame */}
      <rect x="0.5" y="0.5" width="111" height="39" rx="3.5" fill="#1a1f14" stroke="#3a4a2e" strokeWidth="1"/>
      {/* Stitching dashes top */}
      {Array.from({length:20},(_,i)=>(
        <line key={`t${i}`} x1={4+i*5.5} y1="2" x2={7+i*5.5} y2="2"
          stroke="#4a5a3a" strokeWidth="0.8" strokeLinecap="round"/>
      ))}
      {/* Stitching dashes bottom */}
      {Array.from({length:20},(_,i)=>(
        <line key={`b${i}`} x1={4+i*5.5} y1="38" x2={7+i*5.5} y2="38"
          stroke="#4a5a3a" strokeWidth="0.8" strokeLinecap="round"/>
      ))}

      {/* Left olive-green half */}
      <rect x="2" y="2" width="53" height="36" rx="2" fill="#4a5a3a"/>
      {/* Right tan/sand half */}
      <rect x="57" y="2" width="53" height="36" rx="2" fill="#c4a86a"/>

      {/* Centre divider */}
      <rect x="54" y="2" width="4" height="36" fill="#1a1f14"/>

      {/* "MOD" text */}
      <text x="28" y="23" fontSize="15" fontWeight="900" textAnchor="middle"
        fill="#e8ead4" fontFamily="Arial Black,Arial,sans-serif"
        letterSpacing="1">MOD</text>

      {/* "TUBE" box */}
      <rect x="60" y="10" width="46" height="20" rx="2" fill="#1a1f14"/>
      <text x="83" y="24" fontSize="12" fontWeight="900" textAnchor="middle"
        fill="#c4a86a" fontFamily="Arial Black,Arial,sans-serif"
        letterSpacing="0.5">TUBE</text>

      {/* "LOCAL MILITARY CHANNEL" below — small */}
      <text x="28" y="33" fontSize="4.5" fontWeight="700" textAnchor="middle"
        fill="#c4a86a" fontFamily="Arial,sans-serif" letterSpacing="0.5"
        opacity="0.85">LOCAL MILITARY</text>
      <text x="83" y="33" fontSize="4.5" fontWeight="700" textAnchor="middle"
        fill="#4a5a3a" fontFamily="Arial,sans-serif" letterSpacing="0.5"
        opacity="0.85">CHANNEL</text>
    </svg>
  );
}
