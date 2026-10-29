import React from 'react';

/**
 * Pure React + CSS school-themed hero illustration.
 * No photographs or generated screenshots are used as the application interface.
 */
export function SchoolHero({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 via-navy-800 to-[#16325f] ${compact ? 'h-[132px]' : 'h-[186px]'}`}
      aria-hidden
    >
      {/* soft light bloom */}
      <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-gold-500/25 blur-2xl" />
      <div className="absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-[#4A7BC8]/30 blur-2xl" />

      {/* ground */}
      <div className="absolute inset-x-0 bottom-0 h-[38%] bg-[#0B1C36]/70" />
      <div className="absolute inset-x-0 bottom-[36%] h-[3px] bg-gold-500/50" />

      <svg
        viewBox="0 0 360 190"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMax meet"
        role="presentation"
      >
        <defs>
          <linearGradient id="roof" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E6B455" />
            <stop offset="100%" stopColor="#C98B23" />
          </linearGradient>
          <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F7FAFF" />
            <stop offset="100%" stopColor="#DCE6F5" />
          </linearGradient>
          <linearGradient id="wing" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EAF1FB" />
            <stop offset="100%" stopColor="#CBD9ED" />
          </linearGradient>
        </defs>

        {/* flagpole */}
        <rect x="316" y="30" width="2.6" height="72" fill="#9FB4D2" />
        <path d="M318 34 l22 7 -22 7 z" fill="#D99B26" />

        {/* main school block */}
        <rect x="118" y="88" width="124" height="62" fill="url(#wall)" rx="2" />
        {/* left wing */}
        <rect x="72" y="102" width="48" height="48" fill="url(#wing)" rx="2" />
        {/* right wing */}
        <rect x="240" y="102" width="48" height="48" fill="url(#wing)" rx="2" />

        {/* roof */}
        <path d="M114 88 L180 56 L246 88 Z" fill="url(#roof)" />
        <path d="M68 102 L96 88 L124 102 Z" fill="url(#roof)" opacity="0.92" />
        <path d="M236 102 L264 88 L292 102 Z" fill="url(#roof)" opacity="0.92" />

        {/* emblem shield on pediment */}
        <circle cx="180" cy="74" r="7.5" fill="#0F2547" stroke="#D99B26" strokeWidth="1.6" />
        <path d="M176.6 76.5 l2.4 -5 2.4 5 z" fill="#D99B26" />

        {/* windows main block */}
        {[132, 152, 172, 192, 212].map((x) => (
          <g key={`m-${x}`}>
            <rect x={x} y="98" width="11" height="13" rx="1.6" fill="#2C4E82" opacity="0.9" />
            <rect x={x} y="132" width="11" height="13" rx="1.6" fill="#2C4E82" opacity="0.75" />
          </g>
        ))}

        {/* door */}
        <rect x="172" y="126" width="16" height="24" rx="1.6" fill="#173E6B" />
        <rect x="178.6" y="126" width="2.8" height="24" fill="#D99B26" opacity="0.85" />

        {/* wing windows */}
        {[82, 96, 110].map((x) => (
          <rect key={`l-${x}`} x={x} y="112" width="9" height="11" rx="1.4" fill="#2C4E82" opacity="0.7" />
        ))}
        {[250, 264, 278].map((x) => (
          <rect key={`r-${x}`} x={x} y="112" width="9" height="11" rx="1.4" fill="#2C4E82" opacity="0.7" />
        ))}

        {/* steps */}
        <rect x="156" y="150" width="48" height="4" fill="#C3D2E6" />
        <rect x="150" y="154" width="60" height="4" fill="#B4C6DE" />

        {/* palm tree */}
        <path d="M46 150 q3 -18 1 -30" stroke="#3F6E52" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M47 120 q-14 -8 -20 -3 q12 -2 20 3 z" fill="#3F8A5F" />
        <path d="M47 120 q14 -9 21 -4 q-13 -2 -21 4 z" fill="#4B9C6B" />
        <path d="M47 118 q-4 -14 2 -20 q2 12 -2 20 z" fill="#3F8A5F" />

        {/* small tree */}
        <path d="M310 152 q2 -12 1 -20" stroke="#3F6E52" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <circle cx="311" cy="128" r="8" fill="#4B9C6B" opacity="0.9" />

        {/* students walking */}
        <g fill="#E8EEF8">
          <circle cx="206" cy="160" r="3.1" />
          <path d="M204 164 h4 v10 h-4 z" />
          <circle cx="215" cy="162" r="2.7" />
          <path d="M213.4 165.6 h3.2 v8.4 h-3.2 z" />
        </g>
        <g fill="#D99B26">
          <circle cx="151" cy="161" r="2.9" />
          <path d="M149.2 164.8 h3.6 v9.2 h-3.6 z" />
        </g>
      </svg>

      {/* labels */}
      <div className="absolute left-4 top-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-400">Have R/C JHS</p>
        <p className="text-[13px] font-extrabold leading-tight text-white">Old Students 2022</p>
      </div>
    </div>
  );
}
