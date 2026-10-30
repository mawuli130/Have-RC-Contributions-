import React from 'react';

/**
 * Recreated Have R/C JHS 2022 crest approximation (SVG).
 * Navy shield, gold border/laurels, open book and 2022 banner —
 * matching the reference mockups. This is a clean recreation,
 * not a claim of the official school artwork.
 */
export function Crest({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 100 112" role="img" aria-label="Have R/C JHS 2022 crest" className="shrink-0 drop-shadow-[0_4px_14px_rgba(0,0,0,0.35)]">
      <defs>
        <linearGradient id="crestShield" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#144582" />
          <stop offset="100%" stopColor="#071F42" />
        </linearGradient>
      </defs>
      {/* laurels */}
      <g fill="none" stroke="#FFC400" strokeWidth="2.4" strokeLinecap="round">
        <path d="M22 88 C10 76 10 52 20 38" />
        <path d="M78 88 C90 76 90 52 80 38" />
      </g>
      <g fill="#FFC400">
        {[0, 1, 2, 3, 4].map((i) => (
          <ellipse key={`l${i}`} cx={17 - i * 0.6} cy={78 - i * 9} rx="3.2" ry="5" transform={`rotate(-28 ${17 - i * 0.6} ${78 - i * 9})`} />
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <ellipse key={`r${i}`} cx={83 + i * 0.6} cy={78 - i * 9} rx="3.2" ry="5" transform={`rotate(28 ${83 + i * 0.6} ${78 - i * 9})`} />
        ))}
      </g>
      {/* shield */}
      <path d="M50 6 L86 14 V52 C86 78 70 96 50 106 C30 96 14 78 14 52 V14 Z" fill="url(#crestShield)" stroke="#FFC400" strokeWidth="3" />
      <path d="M50 12 L80 19 V52 C80 73 67 88 50 97 C33 88 20 73 20 52 V19 Z" fill="none" stroke="#FFC400" strokeWidth="1" opacity="0.65" />
      <text x="50" y="30" textAnchor="middle" fill="#FFC400" fontSize="10.5" fontWeight="800" letterSpacing="0.5">HAVE R/C</text>
      <text x="50" y="42" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="800" letterSpacing="2">JHS</text>
      {/* open book */}
      <g>
        <path d="M50 50 C42 45 33 45 27 47 V66 C33 64 42 64 50 69 C58 64 67 64 73 66 V47 C67 45 58 45 50 50 Z" fill="#FFFFFF" stroke="#FFC400" strokeWidth="1.6" />
        <path d="M50 50 V69" stroke="#0B3570" strokeWidth="1.6" />
        <path d="M32 52 C38 50.5 43 51 47 53 M32 58 C38 56.5 43 57 47 59 M53 53 C57 51 62 50.5 68 52 M53 59 C57 57 62 56.5 68 58" stroke="#8AB0E2" strokeWidth="1.3" fill="none" />
      </g>
      <rect x="34" y="76" width="32" height="11" rx="2" fill="#FFC400" />
      <text x="50" y="84.5" textAnchor="middle" fill="#071F42" fontSize="8.5" fontWeight="900" letterSpacing="1">2022</text>
    </svg>
  );
}
